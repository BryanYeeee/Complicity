const STARTING_PROGRESS = 0;
export const BEAT_AWARDS = Object.freeze([13, 9, 9, 10, 10, 10, 10, 10, 9, 10]);

export function createInitialState() {
  return {
    runId: 1,
    revision: 0,
    phase: 'opening',
    inputState: 'ready',
    beatIndex: 0,
    progress: STARTING_PROGRESS,
    resources: { timber: 140, stone: 120, spentTimber: 0, spentStone: 0 },
    ledger: [],
    history: [],
    pendingProposal: null,
    resolvedEvents: [],
    retiredActions: [],
    housing: { method: null, fourHouseholdsHoused: false, spareUnits: 0, depotAvailable: true },
    water: { method: null, capacity: 5, demand: 5, intakeProtected: false, loopRepaired: false },
    energy: { method: null, capacity: 6, demand: 5, rooftop: false, outerConnection: false },
    materials: { method: null, reclaimed: false, managed: false, extraction: 0, workshop: false, factory: false },
    road: { method: null, width: 1, bridgeStrengthened: false, reedbankAccess: false },
    people: { population: 0, residents: [], nextResidentId: 1, arrivals: 0, arrivalsResolved: false, partnership: false },
    services: { gathering: null, capacity: 4 },
    regions: {
      pinebank: { vegetation: 100, quarry: 0, stumps: 0, restored: false },
      reedbank: { flow: 100, contamination: 0, bankDamage: 0, restored: false, displacedHomes: [] },
      corridor: { industry: 12, smoke: 1, powerLines: true, pipes: true },
    },
    flags: {
      displaced: false,
      riverIssue: null,
      finalGap: null,
      capacityResolved: false,
      finalComplete: false,
    },
    world: {
      nextBuildingId: 1,
      occupiedPlots: [],
      reservations: [],
      buildings: [],
      connections: [],
    },
  };
}

export function cloneState(state) {
  return structuredClone(state);
}

export function resetState(previous) {
  const state = createInitialState();
  state.runId = (previous?.runId || 0) + 1;
  return state;
}

