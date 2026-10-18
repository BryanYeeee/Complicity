import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createInitialState } from '../src/game/GameState.js';
import { StoryDirector } from '../src/game/StoryDirector.js';
import { ActionResolver } from '../src/game/ActionResolver.js';
import { legalCapabilities } from '../src/game/CapabilityRegistry.js';
import { groundedFacts, interpretDemo } from '../src/game/CivicCore.js';
import { demolishBuilding, placeBuilding, moveBuilding, recoverMaterials, upgradeBuilding, welcomeResidents } from '../src/game/SettlementBuilder.js';
import { CIVIC_PROMPT_VERSION, CIVIC_SYSTEM_PROMPT } from './civic-prompt.js';
import { CIVIC_RESPONSE_SCHEMA } from './civic-schema.js';

const PORT = Number(process.env.PORT || 8787);
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
const API_KEY = process.env.GEMINI_API_KEY || '';
const THINKING_LEVEL = process.env.GEMINI_THINKING_LEVEL || 'low';
const FORCE_DEMO = process.env.CIVIC_DEMO_MODE === '1';
const MODE = API_KEY && !FORCE_DEMO ? 'live' : 'demo-server';
const MAX_BODY = 16_384;
const MAX_MESSAGES = 80;
const sessions = new Map();
const story = new StoryDirector();
const resolver = new ActionResolver();

function json(response, status, payload, headers = {}) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...headers });
  response.end(JSON.stringify(payload));
}

async function body(request) {
  let value = '';
  for await (const chunk of request) {
    value += chunk;
    if (value.length > MAX_BODY) throw Object.assign(new Error('Request too large.'), { status: 413 });
  }
  return JSON.parse(value || '{}');
}

function publicEvent(event) {
  if (!event) return null;
  return { id: event.id, speaker: event.speaker, title: event.title, text: event.text, choices: event.choices.map(({ id, label, detail }) => ({ id, label, detail })) };
}

export function beginSession(clientRunId) {
  const cutoff = Date.now() - 4 * 60 * 60 * 1000;
  for (const [id, existing] of sessions) if (existing.createdAt < cutoff) sessions.delete(id);
  const state = createInitialState();
  state.runId = Number.isSafeInteger(clientRunId) ? clientRunId : 1;
  state.phase = 'playing';
  state.history.push({ speaker: 'CIVIC', text: "The land is open and supplies are limited. Let's make room for the first residents.", kind: 'response' });
  const event = story.prepare(state);
  const session = { id: randomUUID(), state, event, pendingProposal: null, responses: new Map(), busy: false, calls: 0, createdAt: Date.now() };
  sessions.set(session.id, session);
  return session;
}

function compactContext(session, playerText) {
  return {
    prompt_version: CIVIC_PROMPT_VERSION,
    current_need: { id: session.event.id, title: session.event.title, description: session.event.text },
    valid_capabilities: legalCapabilities(session.state, session.event).map(({ id, family, label, detail, parameters }) => ({ id, family, label, detail, parameters })),
    facts: groundedFacts(session.state),
    pending_proposal: session.pendingProposal,
    recent_conversation: session.state.history.slice(-8),
    player_message: playerText,
  };
}

function isAuthorizedText(raw, pending) {
  const text = raw.toLowerCase().trim();
  if (/^(what|why|who|where|when|how|can|could|would|should|is|are|do)\b/.test(text) || text.includes('?') || text.includes('what if')) return false;
  if (pending && /\b(yes|go ahead|do it|use that|proceed)\b/.test(text)) return true;
  return /\b(build|convert|repair|restore|install|extend|expand|open|widen|strengthen|reduce|adapt|share|protect|finish|complete|put|use|give|reclaim)\b/.test(text);
}

const ACTION_REQUIRED_429_CODES = new Set(['quota_exceeded', 'billing_not_active', 'billing_hard_limit_reached']);

function retryAfterMs(response) {
  const value = response.headers.get('retry-after');
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds * 1000);
  const date = Date.parse(value);
  return Number.isNaN(date) ? null : Math.max(0, date - Date.now());
}

function providerMessage(status, code, delay) {
  if (code === 'quota_exceeded') return 'The Gemini API daily quota has been reached. Wait for it to reset or request a quota increase, then retry.';
  if (code === 'billing_not_active' || code === 'billing_hard_limit_reached') return 'Gemini API billing is unavailable for this project. Check its billing and quota settings, then retry.';
  if (status === 429) return `CIVIC's live model is rate-limited.${delay ? ` Wait at least ${Math.ceil(delay / 1000)} seconds and retry.` : ' Wait briefly and retry.'}`;
  if (status === 503) return `CIVIC's live model is temporarily overloaded.${delay ? ` Wait at least ${Math.ceil(delay / 1000)} seconds and retry.` : ' Wait briefly and retry.'}`;
  if (status === 400 && code === 'api_key_invalid') return 'The server GEMINI_API_KEY is invalid. Replace it and restart the server.';
  if (status === 400 && code === 'invalid_argument') return 'Gemini rejected the configured request. Check GEMINI_MODEL and the server request settings.';
  if (status === 401) return 'The server GEMINI_API_KEY is invalid or inactive. Replace it and restart the server.';
  if (status === 403) return 'This Gemini API project does not have permission to make that request. Check the key, project, billing, and model access.';
  if (status === 404) return `The configured Gemini model “${MODEL}” is unavailable to this project. Check GEMINI_MODEL and restart the server.`;
  return 'CIVIC could not reach its live model. The world has not changed; retry shortly.';
}

function detailRetryAfterMs(provider) {
  const retry = provider.details?.find((item) => item['@type']?.endsWith('RetryInfo'))?.retryDelay;
  const match = typeof retry === 'string' ? retry.match(/^(\d+(?:\.\d+)?)s$/) : null;
  return match ? Math.ceil(Number(match[1]) * 1000) : null;
}

export async function geminiErrorFromResponse(response) {
  const raw = await response.text();
  let detail = {};
  try { detail = JSON.parse(raw); } catch { /* The provider may return a non-JSON gateway response. */ }
  const provider = detail?.error || {};
  const providerCode = typeof provider.code === 'string'
    ? provider.code.toLowerCase()
    : provider.status?.toLowerCase() || null;
  const delay = retryAfterMs(response) ?? detailRetryAfterMs(provider);
  const actionRequired = response.status === 429 && ACTION_REQUIRED_429_CODES.has(providerCode);
  const error = new Error(providerMessage(response.status, providerCode, delay));
  error.status = [400, 401, 403, 404, 429, 503].includes(response.status) ? response.status : 502;
  error.code = actionRequired ? 'provider_quota' : response.status === 429 ? 'provider_rate_limit' : response.status === 503 ? 'provider_overloaded' : response.status === 400 ? 'provider_invalid_request' : 'provider_error';
  error.providerCode = providerCode;
  error.retryable = !actionRequired && (response.status === 429 || response.status >= 500);
  error.retryAfterMs = delay;
  return error;
}

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function createGeminiPayload(context) {
  const generationConfig = {
    maxOutputTokens: 1024,
    responseFormat: { text: { mimeType: 'APPLICATION_JSON', schema: CIVIC_RESPONSE_SCHEMA } },
  };
  if (/^gemini-[34](?:\.|-)/.test(MODEL)) generationConfig.thinkingConfig = { thinkingLevel: THINKING_LEVEL };
  return {
    systemInstruction: { parts: [{ text: CIVIC_SYSTEM_PROMPT }] },
    contents: [{ role: 'user', parts: [{ text: JSON.stringify(context) }] }],
    generationConfig,
  };
}

function parseGeminiResult(data) {
  const candidate = data.candidates?.[0];
  const outputText = candidate?.content?.parts?.map((part) => part.text || '').join('');
  if (candidate?.finishReason === 'MAX_TOKENS') {
    const error = new Error('Gemini reached its output limit before completing a response. The world has not changed; retry.');
    error.status = 502; error.code = 'provider_truncated'; error.retryable = true;
    throw error;
  }
  if (!outputText) {
    const blockReason = data.promptFeedback?.blockReason || candidate?.finishReason;
    const error = new Error(blockReason ? `Gemini blocked that response (${blockReason}). Revise the message and retry.` : 'Gemini returned no structured response.');
    error.status = 422; error.code = 'provider_blocked'; error.retryable = false;
    throw error;
  }
  let result;
  try { result = JSON.parse(outputText); } catch {
    const error = new Error('Gemini returned malformed structured output. The world has not changed; retry.');
    error.status = 502; error.code = 'provider_malformed'; error.retryable = true;
    throw error;
  }
  const intents = CIVIC_RESPONSE_SCHEMA.properties.intent.enum;
  const actionIds = CIVIC_RESPONSE_SCHEMA.properties.action_id.enum;
  if (!result || !intents.includes(result.intent) || !actionIds.includes(result.action_id) || typeof result.response !== 'string' || !result.response.trim()) {
    const error = new Error('Gemini returned an invalid CIVIC response. The world has not changed; retry.');
    error.status = 502; error.code = 'provider_malformed'; error.retryable = true;
    throw error;
  }
  return result;
}

async function callGemini(session, playerText) {
  const payload = createGeminiPayload(compactContext(session, playerText));
  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent`, {
        method: 'POST', signal: AbortSignal.timeout(14_000),
        headers: { 'x-goog-api-key': API_KEY, 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw await geminiErrorFromResponse(response);
      }
      const data = await response.json();
      return {
        result: parseGeminiResult(data),
        usage: data.usageMetadata || null,
        providerRequestId: data.responseId || response.headers.get('x-request-id') || null,
      };
    } catch (error) {
      lastError = error;
      if (!error.retryable || attempt === 1) break;
      const delay = error.retryAfterMs ?? (400 * (2 ** attempt) + Math.floor(Math.random() * 200));
      if (delay > 4_000) break;
      await pause(delay);
    }
  }
  throw lastError;
}

function commit(session, actionId, requestId, modelMessage) {
  const capability = legalCapabilities(session.state, session.event).find((item) => item.id === actionId);
  const result = capability?.optional ? resolver.resolveOptional(session.state, actionId, requestId) : resolver.resolve(session.state, session.event, actionId, requestId);
  if (!result.ok) return { type: 'clarification', message: result.reason };
  const next = result.nextState;
  if (result.optional) {
    session.state = next; session.pendingProposal = null;
    return { type: 'commit', message: result.response, effects: result.effects, state: next, event: publicEvent(session.event), completed: false, optional: true };
  }
  const completed = next.beatIndex === 9;
  if (completed) {
    next.beatIndex = 10; next.inputState = 'ending'; next.phase = 'ending'; next.progress = 100;
    session.event = null;
  } else {
    session.event = story.advance(next);
  }
  session.state = next;
  session.pendingProposal = null;
  return { type: 'commit', message: result.response, effects: result.effects, state: next, event: publicEvent(session.event), completed };
}

export async function handleMessage(session, payload) {
  const { text, requestId, runId, revision } = payload;
  if (typeof text !== 'string' || !text.trim() || text.length > 800) throw Object.assign(new Error('Enter a message between 1 and 800 characters.'), { status: 400 });
  if (runId !== session.state.runId) throw Object.assign(new Error('That reply belongs to an earlier run.'), { status: 409 });
  if (session.responses.has(requestId)) return session.responses.get(requestId);
  if (revision !== session.state.revision) throw Object.assign(new Error('The world changed before that request could be applied.'), { status: 409 });
  if (session.busy) throw Object.assign(new Error('CIVIC is already considering another request.'), { status: 409, code: 'request_in_progress', retryable: true });
  if (session.calls >= MAX_MESSAGES) throw Object.assign(new Error('This run has reached its conversation limit.'), { status: 429, code: 'conversation_limit', retryable: false });
  session.busy = true; session.calls += 1;
  const started = performance.now();
  try {
    session.state.history.push({ speaker: 'YOU', text: text.trim(), kind: 'player' });
    let interpreted; let usage = null; let providerRequestId = null;
    if (MODE === 'live') {
      const live = await callGemini(session, text.trim()); interpreted = { type: live.result.intent, actionId: live.result.action_id, message: live.result.response }; usage = live.usage; providerRequestId = live.providerRequestId;
    } else interpreted = interpretDemo({ text, state: session.state, event: session.event, pendingProposal: session.pendingProposal });

    if (interpreted.type === 'execute' && interpreted.actionId !== 'none') {
      if (!isAuthorizedText(text, session.pendingProposal)) interpreted = { ...interpreted, type: 'proposal', message: `${interpreted.message} Nothing has been committed; say “go ahead” to authorize it.` };
      else {
        const committed = commit(session, interpreted.actionId, requestId, interpreted.message);
        const response = { ...committed, mode: MODE, requestId, pendingProposal: null, latencyMs: Math.round(performance.now() - started), usage, providerRequestId };
        session.responses.set(requestId, response); return response;
      }
    }
    if (interpreted.type === 'proposal' && interpreted.actionId && interpreted.actionId !== 'none') {
      const valid = legalCapabilities(session.state, session.event).find((item) => item.id === interpreted.actionId);
      if (valid) session.pendingProposal = { actionId: valid.id, label: valid.label, revision: session.state.revision };
      else interpreted = { type: 'clarification', message: 'That proposal is not available for the current need.' };
    }
    if (interpreted.type === 'cancel') session.pendingProposal = null;
    session.state.history.push({ speaker: 'CIVIC', text: interpreted.message, kind: 'response' });
    const response = { ...interpreted, mode: MODE, requestId, state: session.state, event: publicEvent(session.event), pendingProposal: session.pendingProposal, latencyMs: Math.round(performance.now() - started), usage, providerRequestId };
    session.responses.set(requestId, response); return response;
  } finally { session.busy = false; }
}

export function handleBuild(session, payload) {
  const { runId, revision, action = 'build', type, plotId, movingId = null, buildingId = null } = payload;
  if (runId !== session.state.runId) throw Object.assign(new Error('That placement belongs to an earlier run.'), { status: 409 });
  if (revision !== session.state.revision) throw Object.assign(new Error('The world changed before that placement could be confirmed.'), { status: 409 });
  const result = action === 'upgrade' ? upgradeBuilding(session.state, buildingId)
    : action === 'remove' ? demolishBuilding(session.state, buildingId)
      : action === 'welcome' ? welcomeResidents(session.state)
        : action === 'recover' ? recoverMaterials(session.state)
          : movingId || action === 'move' ? moveBuilding(session.state, movingId, plotId) : placeBuilding(session.state, type, plotId);
  if (!result.ok) throw Object.assign(new Error(result.reason), { status: 422, code: 'invalid_placement' });
  session.state = result.nextState;
  return { type: action, state: session.state, effects: result.effects, building: result.building, definition: result.definition, residents: result.residents };
}

const contentTypes = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
async function staticFile(request, response) {
  const pathname = new URL(request.url, 'http://local').pathname;
  const requested = pathname === '/' ? 'index.html' : pathname.slice(1);
  const safe = normalize(requested).replace(/^(\.\.[/\\])+/, '');
  let file = join(process.cwd(), 'dist', safe);
  try { if (!(await stat(file)).isFile()) throw new Error(); } catch { file = join(process.cwd(), 'dist', 'index.html'); }
  try {
    const data = await readFile(file);
    response.writeHead(200, { 'content-type': contentTypes[extname(file)] || 'application/octet-stream', 'x-content-type-options': 'nosniff' }); response.end(data);
  } catch { response.writeHead(404); response.end('Not found'); }
}

const server = createServer(async (request, response) => {
  try {
    if (request.method === 'GET' && request.url === '/api/civic/config') return json(response, 200, { mode: MODE, provider: MODE === 'live' ? 'gemini' : null, model: MODE === 'live' ? MODEL : null, promptVersion: CIVIC_PROMPT_VERSION });
    if (request.method === 'POST' && request.url === '/api/civic/run') {
      const payload = await body(request); const session = beginSession(payload.runId);
      return json(response, 201, { mode: MODE, provider: MODE === 'live' ? 'gemini' : null, sessionId: session.id, features: ['validated-placement', 'society-builder-v3'], state: session.state, event: publicEvent(session.event), greeting: session.state.history[0].text, promptVersion: CIVIC_PROMPT_VERSION });
    }
    if (request.method === 'POST' && request.url === '/api/civic/message') {
      const payload = await body(request); const session = sessions.get(payload.sessionId);
      if (!session) return json(response, 404, { error: 'This CIVIC session has expired. Start a new run.' });
      return json(response, 200, await handleMessage(session, payload));
    }
    if (request.method === 'POST' && request.url === '/api/civic/build') {
      const payload = await body(request); const session = sessions.get(payload.sessionId);
      if (!session) return json(response, 404, { error: 'This CIVIC session has expired. Start a new run.' });
      return json(response, 200, handleBuild(session, payload));
    }
    if (request.url?.startsWith('/api/')) return json(response, 404, { error: 'Unknown API route.' });
    return staticFile(request, response);
  } catch (error) {
    const status = error.status || (error.name === 'TimeoutError' ? 504 : 503);
    const message = error.status ? error.message : error.name === 'TimeoutError' ? 'CIVIC timed out waiting for its live model. The world has not changed; retry shortly.' : 'CIVIC is temporarily unavailable. The world has not changed; please retry.';
    const code = error.code || (status === 504 ? 'provider_timeout' : 'civic_unavailable');
    console.error(`[civic] ${code} status=${status}${error.providerCode ? ` provider_code=${error.providerCode}` : ''}`);
    const headers = error.retryAfterMs ? { 'retry-after': String(Math.ceil(error.retryAfterMs / 1000)) } : {};
    return json(response, status, { error: message, code, retryable: Boolean(error.retryable), retryAfterMs: error.retryAfterMs || null }, headers);
  }
});

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  server.listen(PORT, '127.0.0.1', () => console.log(`CIVIC ${MODE} server listening at http://127.0.0.1:${PORT} (${MODE === 'live' ? MODEL : 'no provider calls'})`));
}

export { server, MODE, MODEL };

