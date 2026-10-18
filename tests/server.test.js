import { describe, expect, it } from 'vitest';
import { beginSession, createGeminiPayload, handleBuild, handleMessage, MODE, geminiErrorFromResponse } from '../server/civic-server.mjs';

const send = (session, text, requestId, overrides = {}) => handleMessage(session, {
  text, requestId, runId: session.state.runId, revision: session.state.revision, ...overrides,
});

describe('server-authoritative CIVIC demo sessions', () => {
  it('is explicitly labeled and does not silently impersonate live AI', () => { expect(MODE).toBe('demo-server'); });

  it('uses the Gemini generateContent enum required for structured JSON', () => {
    const payload = createGeminiPayload({ player_message: 'Where should I start?' });
    expect(payload.generationConfig.responseFormat.text.mimeType).toBe('APPLICATION_JSON');
    expect(payload.generationConfig.maxOutputTokens).toBeGreaterThanOrEqual(1024);
    expect(payload.generationConfig.thinkingConfig).toEqual({ thinkingLevel: 'low' });
    expect(payload.systemInstruction.parts[0].text).toContain('current_need object is the only active story decision');
    expect(payload.systemInstruction.parts[0].text).toContain('never mention the four initial households');
  });

  it('keeps questions read-only and commits explicit work once', async () => {
    const session = beginSession(41);
    const advice = await send(session, 'What does the town need?', 'q1');
    expect(advice.type).toBe('answer'); expect(session.state.revision).toBe(0); expect(session.state.progress).toBe(0);
    const commit = await send(session, 'Convert the empty depot into homes.', 'a1');
    expect(commit.type).toBe('commit'); expect(commit.state.revision).toBe(1); expect(commit.state.progress).toBe(13);
    const duplicate = await handleMessage(session, { text: 'Convert the empty depot into homes.', requestId: 'a1', runId: 41, revision: 0 });
    expect(duplicate).toEqual(commit); expect(session.state.ledger).toHaveLength(1);
  });

  it('rejects stale revisions and responses from an earlier run', async () => {
    const session = beginSession(8);
    await send(session, 'Build meadow cottages.', 'a1');
    await expect(handleMessage(session, { text: 'repair the pipes', requestId: 'a2', runId: 8, revision: 0 })).rejects.toMatchObject({ status: 409 });
    await expect(handleMessage(session, { text: 'repair the pipes', requestId: 'a3', runId: 7, revision: 1 })).rejects.toMatchObject({ status: 409 });
  });

  it('stores and cancels a proposal without changing the world', async () => {
    const session = beginSession(12);
    const proposal = await send(session, 'Can we house them without clearing the meadow?', 'p1');
    expect(proposal.type).toBe('proposal'); expect(proposal.pendingProposal.actionId).toBe('housing_depot'); expect(session.state.revision).toBe(0);
    const cancelled = await send(session, 'Actually, cancel that.', 'p2');
    expect(cancelled.type).toBe('cancel'); expect(cancelled.pendingProposal).toBeNull(); expect(session.state.ledger).toHaveLength(0);
  });

  it('validates direct placements on the same authoritative session', () => {
    const session = beginSession(51);
    const placed = handleBuild(session, { runId: 51, revision: 0, type: 'courtyard', plotId: 'plot-home-3' });
    expect(placed.type).toBe('build'); expect(session.state.revision).toBe(1); expect(session.state.resources.timber).toBe(104);
    expect(() => handleBuild(session, { runId: 51, revision: 1, type: 'cottage', plotId: 'plot-home-3' })).toThrow(/occupied/i);
  });

  it('distinguishes a temporary provider rate limit from quota exhaustion', async () => {
    const limited = await geminiErrorFromResponse(new Response(JSON.stringify({ error: { code: 'rate_limit_exceeded', message: 'Slow down.' } }), { status: 429, headers: { 'retry-after': '3' } }));
    expect(limited).toMatchObject({ status: 429, code: 'provider_rate_limit', retryable: true, retryAfterMs: 3000 });
    expect(limited.message).toContain('3 seconds');

    const quota = await geminiErrorFromResponse(new Response(JSON.stringify({ error: { code: 'quota_exceeded', message: 'Daily quota exhausted.' } }), { status: 429 }));
    expect(quota).toMatchObject({ status: 429, code: 'provider_quota', retryable: false, providerCode: 'quota_exceeded' });
    expect(quota.message).toContain('daily quota');
  });

  it('reads Gemini RetryInfo when the HTTP header is absent', async () => {
    const limited = await geminiErrorFromResponse(new Response(JSON.stringify({ error: { code: 429, status: 'RESOURCE_EXHAUSTED', details: [{ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '2.5s' }] } }), { status: 429 }));
    expect(limited).toMatchObject({ status: 429, code: 'provider_rate_limit', retryable: true, retryAfterMs: 2500, providerCode: 'resource_exhausted' });
  });

  it('reports concurrent local requests as a conflict rather than a provider limit', async () => {
    const session = beginSession(19); session.busy = true;
    await expect(send(session, 'What should I do?', 'busy')).rejects.toMatchObject({ status: 409, code: 'request_in_progress' });
  });
});
