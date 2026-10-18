import { ACTIONS_BY_ID } from '../data/actions.js';
import { BEAT_AWARDS, cloneState } from './GameState.js';

export class ActionResolver {
  resolve(state, event, actionId) {
    if (state.inputState !== 'ready') return { ok: false, reason: 'The current work is still resolving.' };
    if (state.resolvedEvents.includes(event.id)) return { ok: false, reason: 'That decision has already been completed.' };
    const action = ACTIONS_BY_ID.get(actionId);
    if (!action || action.eventId !== event.id) return { ok: false, reason: 'That method does not apply to the current decision.' };
    if (state.retiredActions.includes(actionId) || !action.eligible(state)) return { ok: false, reason: 'That method is no longer available.' };

    const next = cloneState(state);
    next.inputState = 'resolving';
    if (event.id === 'almost_enough') next.flags.finalGap = event.getVariant(next);
    const effects = action.apply(next);
    next.resolvedEvents.push(event.id);
    next.retiredActions.push(...event.getChoices(state).map((choice) => choice.id));
    next.progress += BEAT_AWARDS[state.beatIndex];
    next.ledger.push({ eventId: event.id, actionId, ...effects });
    next.history.push({ speaker: event.speaker, text: event.getText(state, event.getVariant(state)), kind: 'event' });
    next.history.push({ speaker: 'CIVIC AI', text: action.response, kind: 'response' });
    return { ok: true, nextState: next, action, effects, response: action.response };
  }
}

