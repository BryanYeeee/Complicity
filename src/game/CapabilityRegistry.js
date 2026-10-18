import { ACTIONS } from '../data/actions.js';

const familyFor = (eventId) => ({
  room_to_live: 'housing', water_at_door: 'water', lights_after_dusk: 'energy', materials_somewhere: 'materials',
  connecting_road: 'transport', people_beyond: 'households', same_river: 'river', place_to_gather: 'services',
  almost_enough: 'capacity', completed_picture: 'completion',
}[eventId]);

const methodFor = (id) => id.split('_').slice(1).join('-');

export const CAPABILITIES = Object.freeze(ACTIONS.map((item) => Object.freeze({
  id: item.id,
  family: familyFor(item.eventId),
  description: item.detail,
  eventId: item.eventId,
  targets: item.targets || [],
  parameters: Object.freeze({ method: methodFor(item.id), scale: /compact|light|managed|reuse|retrofit|conservation/.test(item.id) ? 'limited' : /expand|extract|widen|cottages|clinic/.test(item.id) ? 'expanded' : 'standard' }),
  prerequisites: Object.freeze([item.eventId]),
  milestoneContribution: item.eventId,
})));

export function legalCapabilities(state, event) {
  if (!event) return [];
  const current = event.getChoices(state).map((choice) => {
    const descriptor = CAPABILITIES.find((item) => item.id === choice.id);
    return { ...descriptor, label: choice.label, detail: choice.detail };
  });
  const restoration = ACTIONS.find((item) => item.id === 'river_restore');
  if (event.id !== restoration.eventId && restoration.eligible(state)) {
    const descriptor = CAPABILITIES.find((item) => item.id === restoration.id);
    current.push({ ...descriptor, label: restoration.label, detail: restoration.detail, milestoneContribution: null, optional: true });
  }
  return current;
}

export function previewCapability(state, event, actionId) {
  const capability = legalCapabilities(state, event).find((item) => item.id === actionId);
  if (!capability) return { ok: false, reason: 'That work is not currently available.' };
  const action = ACTIONS.find((item) => item.id === actionId);
  const draft = structuredClone(state);
  const effects = action.apply(draft);
  return {
    ok: true,
    capability,
    effects,
    before: { housing: state.housing, water: state.water, energy: state.energy, regions: state.regions },
    after: { housing: draft.housing, water: draft.water, energy: draft.energy, regions: draft.regions },
  };
}

