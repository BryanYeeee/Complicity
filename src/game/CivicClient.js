import { interpretDemo } from './CivicCore.js';

const timeoutSignal = (ms) => AbortSignal.timeout ? AbortSignal.timeout(ms) : undefined;

export class CivicClient {
  constructor() {
    this.mode = 'demo-local';
    this.sessionId = null;
    this.pendingProposal = null;
    this.requestNumber = 0;
    this.features = [];
  }

  async start(runId) {
    try {
      const response = await fetch('/api/civic/run', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ runId }), signal: timeoutSignal(2500) });
      if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw new Error('CIVIC server unavailable');
      const data = await response.json();
      this.mode = data.mode;
      this.sessionId = data.sessionId;
      this.features = data.features || [];
      if (!this.features.includes('society-builder-v3')) {
        this.mode = 'demo-local'; this.sessionId = null; this.features = [];
        return { mode: this.mode };
      }
      this.pendingProposal = null;
      return data;
    } catch {
      this.mode = 'demo-local'; this.sessionId = null; this.pendingProposal = null;
      return { mode: this.mode };
    }
  }

  async message({ text, state, event, signal }) {
    const requestId = `${state.runId}:${++this.requestNumber}`;
    if (this.sessionId) {
      const response = await fetch('/api/civic/message', {
        method: 'POST', headers: { 'content-type': 'application/json' }, signal,
        body: JSON.stringify({ sessionId: this.sessionId, runId: state.runId, revision: state.revision, requestId, text }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(data.error || 'CIVIC could not complete that request.');
        error.code = data.code || 'civic_error';
        error.retryable = data.retryable;
        error.retryAfterMs = data.retryAfterMs;
        throw error;
      }
      this.pendingProposal = data.pendingProposal || null;
      return data;
    }
    const result = interpretDemo({ text, state, event, pendingProposal: this.pendingProposal });
    if (result.type === 'proposal') this.pendingProposal = { actionId: result.actionId, label: event.choices.find((item) => item.id === result.actionId)?.label || result.actionId };
    if (result.type === 'cancel' || result.type === 'execute') this.pendingProposal = null;
    return { ...result, requestId, mode: this.mode, pendingProposal: this.pendingProposal };
  }

  async build({ state, action = 'build', type, plotId, movingId = null, buildingId = null }) {
    if (!this.sessionId) return null;
    if (!this.features.includes('validated-placement') || !this.features.includes('society-builder-v3')) { this.cancel(); return null; }
    const response = await fetch('/api/civic/build', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionId: this.sessionId, runId: state.runId, revision: state.revision, action, type, plotId, movingId, buildingId }) });
    if (response.status === 404) { this.cancel(); return null; }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'CIVIC could not validate that placement.');
    return data;
  }

  cancel() { this.sessionId = null; this.pendingProposal = null; this.features = []; }
}

