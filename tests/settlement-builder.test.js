import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/game/GameState.js';
import { canPlaceBuilding, currentObjective, demolishBuilding, developmentProgress, moveBuilding, placeBuilding, recoverMaterials, settlementStatus, upgradeBuilding, validatePlacement, welcomeResidents } from '../src/game/SettlementBuilder.js';

function build(state, type, plotId) { const result = placeBuilding(state, type, plotId); expect(result.ok, result.reason).toBe(true); return result.nextState; }
function arrive(state) { const result = welcomeResidents(state); expect(result.ok, result.reason).toBe(true); return result.nextState; }

describe('authoritative society building', () => {
  it('starts at 0%, keeps homes vacant, and counts named residents exactly', () => {
    let state = createInitialState(); expect(developmentProgress(state)).toBe(0); expect(currentObjective(state).id).toBe('shelter');
    state = build(state, 'courtyard', 'plot-home-3');
    expect(settlementStatus(state)).toMatchObject({ population: 0, housingCapacity: 4, vacantHousing: 4 }); expect(currentObjective(state).id).toBe('arrival'); expect(developmentProgress(state)).toBe(10);
    state = arrive(state); const status = settlementStatus(state);
    expect(status.population).toBe(4); expect(state.people.residents).toHaveLength(4); expect(new Set(state.people.residents.map((item) => item.id)).size).toBe(4); expect(state.people.residents.every((item) => item.homeId === state.world.buildings[0].id)).toBe(true);
    expect(currentObjective(state).id).toBe('water');
  });

  it('supports distinct routes from 0% to the same 100% ending', () => {
    let compact = createInitialState();
    compact = build(compact, 'courtyard', 'plot-home-3'); compact = arrive(compact); compact = build(compact, 'cistern', 'plot-edge-1'); compact = build(compact, 'workshop', 'plot-service-1');
    compact = build(compact, 'courtyard', 'plot-home-5'); compact = arrive(compact); compact = build(compact, 'turbine', 'plot-edge-3'); compact = recoverMaterials(compact).nextState; compact = build(compact, 'logging', 'plot-utility-2'); compact = build(compact, 'garden', 'plot-green-1');
    let distributed = createInitialState();
    distributed = build(distributed, 'courtyard', 'plot-home-2'); distributed = arrive(distributed); distributed = build(distributed, 'pump', 'plot-edge-1'); distributed = build(distributed, 'market', 'plot-service-2');
    distributed = build(distributed, 'courtyard', 'plot-home-6'); distributed = arrive(distributed); distributed = recoverMaterials(distributed).nextState; distributed = build(distributed, 'solar', 'plot-utility-2'); distributed = build(distributed, 'garden', 'plot-green-1');
    expect(settlementStatus(compact).complete).toBe(true); expect(settlementStatus(distributed).complete).toBe(true); expect(developmentProgress(compact)).toBe(100); expect(developmentProgress(distributed)).toBe(100);
    expect(compact.world.buildings.map((item) => item.type)).not.toEqual(distributed.world.buildings.map((item) => item.type)); expect(compact.regions.reedbank.flow).not.toBe(distributed.regions.reedbank.flow);
  });

  it('uses rendered buildings—not stale occupancy records—as placement authority', () => {
    const state = createInitialState(); state.world.occupiedPlots = ['plot-home-1'];
    expect(validatePlacement(state, 'cottage', 'plot-home-1').ok).toBe(true);
    const occupied = build(state, 'cottage', 'plot-home-1'); const collision = validatePlacement(occupied, 'courtyard', 'plot-home-1');
    expect(collision.ok).toBe(false); expect(collision.reason).toMatch(/occupied by cottages/i);
    expect(validatePlacement(state, 'cistern', 'plot-home-3').reason).toMatch(/requires utility or edge terrain/i);
  });

  it('filters projects with no legal site and releases sites on cancel-equivalent removal', () => {
    let state = createInitialState(); state = build(state, 'cottage', 'plot-green-1'); state = build(state, 'cottage', 'plot-green-2');
    expect(canPlaceBuilding(state, 'garden')).toBe(false);
    const id = state.world.buildings.find((item) => item.plotId === 'plot-green-1').id; const removed = demolishBuilding(state, id);
    expect(removed.ok).toBe(true); expect(canPlaceBuilding(removed.nextState, 'garden')).toBe(true); expect(removed.nextState.world.occupiedPlots).not.toContain('plot-green-1');
  });

  it('keeps movement and recovery from farming development progress', () => {
    let state = build(createInitialState(), 'cottage', 'plot-home-3'); const progress = developmentProgress(state); const spent = structuredClone(state.resources); const id = state.world.buildings[0].id;
    const moved = moveBuilding(state, id, 'plot-home-4'); expect(moved.ok).toBe(true); expect(moved.nextState.resources).toEqual(spent); expect(developmentProgress(moved.nextState)).toBe(progress);
    const recovered = recoverMaterials(moved.nextState); expect(recovered.ok).toBe(true); expect(developmentProgress(recovered.nextState)).toBe(progress);
  });

  it('keeps material recovery reachable with no supplies or spare land', () => {
    const state = createInitialState(); state.resources.timber = 0; state.resources.stone = 0;
    const blocked = placeBuilding(state, 'cottage', 'plot-home-1'); expect(blocked.ok).toBe(false); expect(blocked.reason).toMatch(/trade for materials/i);
    const workshop = placeBuilding(state, 'workshop', 'plot-service-1'); expect(workshop.ok).toBe(true); expect(workshop.nextState.resources).toMatchObject({ timber: 10, stone: 4 });
    const full = createInitialState(); full.resources.timber = 0; full.resources.stone = 0; full.world.buildings = Array.from({ length: 16 }, (_, index) => ({ id: `block-${index}`, type: 'garden', plotId: `occupied-${index}`, movable: true }));
    const recovered = recoverMaterials(full); expect(recovered.ok).toBe(true); expect(recovered.nextState.resources).toMatchObject({ timber: 34, stone: 24 });
  });

  it('updates capacity on upgrade without inventing residents', () => {
    let state = build(createInitialState(), 'cottage', 'plot-home-3'); const upgraded = upgradeBuilding(state, state.world.buildings[0].id); expect(upgraded.ok).toBe(true); state = upgraded.nextState;
    expect(settlementStatus(state)).toMatchObject({ population: 0, housingCapacity: 4, housingQuality: 2 });
  });
});
