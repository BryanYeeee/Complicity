import { ACTIONS_BY_ID } from '../data/actions.js';
import { BEAT_AWARDS, cloneState } from './GameState.js';
import { effectRecord } from './EffectCatalog.js';

export class ActionResolver {
  resolve(state, event, actionId, requestId = null) {
    if (state.inputState !== 'ready') return { ok: false, reason: 'The current work is still resolving.' };
    if (state.resolvedEvents.includes(event.id)) return { ok: false, reason: 'That decision has already been completed.' };
    const action = ACTIONS_BY_ID.get(actionId);
    if (!action || action.eventId !== event.id) return { ok: false, reason: 'That method does not apply to the current decision.' };
    if (state.retiredActions.includes(actionId) || !action.eligible(state)) return { ok: false, reason: 'That method is no longer available.' };

    const next = cloneState(state);
    next.inputState = 'resolving';
    if (event.id === 'almost_enough') next.flags.finalGap = event.getVariant(next);
    const rawEffects = action.apply(next);
    next.revision += 1;
    const effects = effectRecord(actionId, rawEffects, next.revision);
    next.resolvedEvents.push(event.id);
    next.retiredActions.push(...event.getChoices(state).map((choice) => choice.id));
    next.progress += BEAT_AWARDS[state.beatIndex];
    next.pendingProposal = null;
    next.ledger.push({ eventId: event.id, actionId, requestId, revision: next.revision, ...effects });
    next.history.push({ speaker: event.speaker, text: event.getText(state, event.getVariant(state)), kind: 'event' });
    next.history.push({ speaker: 'CIVIC AI', text: action.response, kind: 'response' });
    return { ok: true, nextState: next, action, effects, response: action.response };
  }

  resolveOptional(state, actionId, requestId = null) {
    if (state.inputState !== 'ready') return { ok: false, reason: 'The current work is still resolving.' };
    const action = ACTIONS_BY_ID.get(actionId);
    if (!action || actionId !== 'river_restore') return { ok: false, reason: 'That optional work is not supported.' };
    if (!action.eligible(state)) return { ok: false, reason: 'There is no unresolved damage for that repair.' };
    const next = cloneState(state); next.inputState = 'ready';
    const rawEffects = action.apply(next); next.revision += 1;
    const effects = effectRecord(actionId, rawEffects, next.revision);
    next.pendingProposal = null;
    next.ledger.push({ eventId: 'optional_work', actionId, requestId, revision: next.revision, optional: true, ...effects });
    next.history.push({ speaker: 'CIVIC AI', text: action.response, kind: 'response' });
    return { ok: true, nextState: next, action, effects, response: action.response, optional: true };
  }
}

