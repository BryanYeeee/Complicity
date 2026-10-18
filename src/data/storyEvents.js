import { actionsForEvent } from './actions.js';

const homesName = (state) => state.housing.method === 'depot' ? 'converted depot homes' : 'meadow cottages';
const supplyName = (state) => ({ extraction: 'Pinebank processor', reclaim: 'reclamation workshop', managed: 'managed timber allotment' }[state.materials.method] || 'supply site');

export const STORY_EVENTS = Object.freeze([
  {
    id: 'room_to_live', speaker: 'Mara', title: 'Room to live', requires: [],
    getVariant: () => 'opening',
    getText: () => 'Four households are ready to settle here. We can raise cottages in the meadow, or give the old depot a second life as homes.',
    getChoices: (state) => actionsForEvent('room_to_live', state),
  },
  {
    id: 'water_at_door', speaker: 'CIVIC AI', title: 'Water at the door', requires: ['room_to_live'],
    getVariant: (state) => state.housing.method,
    getText: (state) => state.housing.method === 'depot'
      ? 'The converted depot homes are occupied. Their old service loop leaks at two joins; it can be repaired, or a new river intake can supply the block directly.'
      : 'The new meadow cottages are occupied beyond the old water loop. Extend the protected river intake to them, or repair the loop and add conservation equipment.',
    getChoices: (state) => actionsForEvent('water_at_door', state),
  },
  {
    id: 'lights_after_dusk', speaker: 'Mara', title: 'Lights after dusk', requires: ['water_at_door'],
    getVariant: (state) => state.water.method,
    getText: (state) => state.water.method === 'intake'
      ? `The pumps serving the ${homesName(state)} run into the evening. We need dependable power before the paths can stay lit.`
      : `The repaired loop uses less water, but its pumps and the ${homesName(state)} still need dependable power after dusk.`,
    getChoices: (state) => actionsForEvent('lights_after_dusk', state),
  },
  {
    id: 'materials_somewhere', speaker: 'CIVIC AI', title: 'Materials from somewhere', requires: ['lights_after_dusk'],
    getVariant: (state) => state.energy.method,
    getText: (state) => {
      if (state.energy.method === 'grid') return 'The new substation needs aggregate and treated poles. Pinebank can expand extraction, open a reclamation workshop, or release a smaller managed timber allotment.';
      if (state.energy.method === 'rooftop') return 'The rooftop system needs frames, cable, and storage housings. Pinebank can process new material, reclaim regional stock, or mark a small timber allotment.';
      return 'The pump-and-light retrofit needs fittings and repair stock. Pinebank can process new material, reclaim what already exists, or supply a limited timber allotment.';
    },
    getChoices: (state) => actionsForEvent('materials_somewhere', state),
  },
  {
    id: 'connecting_road', speaker: 'Mara', title: 'The connecting road', requires: ['materials_somewhere'],
    getVariant: (state) => state.materials.method,
    getText: (state) => {
      const site = supplyName(state);
      if (state.materials.method === 'extraction') return `Quarry trucks from the ${site} are too heavy for the old crossing. We can widen the riverbank road or strengthen the stone bridge.`;
      if (state.materials.method === 'reclaim') return `Repair crews from the ${site} need regular access. We can keep timed vans on the old lane, reinforce the stone bridge, or widen the riverbank road.`;
      return `Small timber loads from the ${site} now need access. A light route or stronger bridge will suffice; widening the riverbank road would carry more at once.`;
    },
    getChoices: (state) => actionsForEvent('connecting_road', state),
  },
  {
    id: 'people_beyond', speaker: 'Ivo', title: 'People from beyond', requires: ['connecting_road'],
    getVariant: (state) => state.flags.displaced ? 'arrivals' : 'delegation',
    getText: (state) => state.flags.displaced
      ? `I’m Ivo, from Reedbank. The ${state.road.method === 'wide' ? 'wider road cut' : 'Pinebank works'} reached our inhabited edge. ${state.regions.reedbank.displacedHomes.length || 1} household${state.regions.reedbank.displacedHomes.length === 1 ? '' : 's'} need a place to live.`
      : `I’m Ivo, from Reedbank. No homes were lost, but the ${state.water.method === 'intake' ? 'lower river flow' : 'new service traffic'} is something we now share. Our repair delegation proposes a practical connection.`,
    getChoices: (state) => actionsForEvent('people_beyond', state),
  },
  {
    id: 'same_river', speaker: 'Ivo', title: 'The same river', requires: ['people_beyond'],
    getVariant: (state) => {
      if (state.regions.reedbank.contamination > 0) return 'polluted';
      if (state.regions.reedbank.flow < 90) return 'low_flow';
      if (state.regions.reedbank.bankDamage > 10) return 'damaged_bank';
      return 'maintenance';
    },
    getText: (state, variant) => {
      const callback = state.flags.displaced ? 'The households you received still recognise this bank as home.' : 'Our delegation has been tracing the shared system.';
      if (variant === 'low_flow') return `${callback} The intake for the ${homesName(state)} leaves Reedbank’s wetland short of water. Protect town supply only, restore the reach, or reduce the diversion.`;
      if (variant === 'damaged_bank') return `${callback} The riverbank road has loosened Reedbank’s bank. Protect the town intake, repair the affected reach, or establish shared maintenance.`;
      if (variant === 'polluted') return `${callback} Processing discharge is collecting below Reedbank. Protect the town intake, restore the reach, or reduce the source.`;
      return `${callback} The bridge, intake, and Reedbank bank now rely on the same river. We can protect town supply, repair the reach, or maintain it together.`;
    },
    getChoices: (state) => actionsForEvent('same_river', state),
  },
  {
    id: 'place_to_gather', speaker: 'Mara', title: 'A place to gather', requires: ['same_river'],
    getVariant: (state) => state.flags.displaced ? (state.people.arrivals > 0 ? 'arrivals_housed' : 'arrivals_pending') : 'partnership',
    getText: (state) => state.flags.displaced
      ? `With Reedbank’s arriving households now housed, ${state.people.population} people share the settlement. We need a clinic and a room large enough to gather.`
      : `Our Reedbank partnership now uses town services too. A clinic and shared room would make that connection useful in ordinary life.`,
    getChoices: (state) => actionsForEvent('place_to_gather', state),
  },
  {
    id: 'almost_enough', speaker: 'CIVIC AI', title: 'Almost enough', requires: ['place_to_gather'],
    getVariant: (state) => state.water.demand >= state.water.capacity ? 'water' : 'energy',
    getText: (state, variant) => {
      const service = state.services.gathering === 'clinic' ? 'new clinic and commons' : state.services.gathering === 'expanded-hall' ? 'expanded service hall' : 'adapted public rooms';
      const memory = state.regions.reedbank.restored ? 'The wetland you restored is holding water again.' : state.water.intakeProtected ? 'The protected town intake left the outer issue unresolved.' : 'The shared river work reduced pressure downstream.';
      return `${memory} The ${service} now leaves a final ${variant} capacity gap. Expand supply, retrofit what exists${state.people.partnership || state.regions.reedbank.restored ? ', or balance capacity with Reedbank' : ''}.`;
    },
    getChoices: (state) => actionsForEvent('almost_enough', state),
  },
  {
    id: 'completed_picture', speaker: 'CIVIC AI', title: 'The completed picture', requires: ['almost_enough'],
    getVariant: (state) => state.regions.reedbank.restored || state.regions.pinebank.restored ? 'repair_minded' : state.materials.method,
    getText: (state) => {
      const recalled = state.materials.method === 'extraction' ? 'Pinebank supplied the large material order' : state.materials.method === 'reclaim' ? 'the reclamation workshop kept old material in use' : 'the managed Pinebank allotment supplied the settlement';
      const capacity = state.flags.finalGap === 'water' ? 'water system' : 'power system';
      return `The ${capacity} is ready, and ${recalled}. One ordinary objective remains: complete the public space and certify development.`;
    },
    getChoices: (state) => actionsForEvent('completed_picture', state),
  },
]);

export const EVENTS_BY_ID = new Map(STORY_EVENTS.map((event) => [event.id, event]));

