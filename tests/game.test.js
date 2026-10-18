import { describe, expect, it } from 'vitest';
import { createInitialState, resetState } from '../src/game/GameState.js';
import { StoryDirector } from '../src/game/StoryDirector.js';
import { ActionResolver } from '../src/game/ActionResolver.js';
import { PromptInterpreter } from '../src/game/PromptInterpreter.js';

const play = (actionIds) => {
  let state = createInitialState();
  const story = new StoryDirector(); const resolver = new ActionResolver();
  for (const actionId of actionIds) {
    const event = story.prepare(state);
    const result = resolver.resolve(state, event, actionId);
    if (!result.ok) throw new Error(`${actionId}: ${result.reason}`);
    state = result.nextState;
    if (state.beatIndex < 9) story.advance(state);
  }
  return state;
};

const EXPANSION = ['housing_cottages', 'water_intake', 'energy_grid', 'materials_extract', 'road_widen', 'arrivals_adapt', 'river_local', 'gather_clinic', 'capacity_expand', 'final_expand'];
const CAREFUL = ['housing_depot', 'water_conservation', 'energy_efficiency', 'materials_reclaim', 'road_light', 'delegation_facilities', 'river_restore', 'gather_expand', 'capacity_shared', 'final_reuse'];

describe('story state machine', () => {
  it('completes all ten beats exactly once at 100%', () => {
    const state = play(EXPANSION);
    expect(state.progress).toBe(100);
    expect(state.resolvedEvents).toHaveLength(10);
    expect(state.ledger).toHaveLength(10);
    expect(new Set(state.resolvedEvents).size).toBe(10);
  });

  it('keeps every reachable event supplied with at least two legal actions', () => {
    const story = new StoryDirector(); const resolver = new ActionResolver();
    let frontier = [createInitialState()];
    const seenByBeat = new Array(10).fill(0);
    for (let depth = 0; depth < 10; depth += 1) {
      const next = [];
      for (const state of frontier) {
        const event = story.prepare(state); seenByBeat[depth] += 1;
        expect(event.choices.length, `${event.id}:${event.variant}`).toBeGreaterThanOrEqual(2);
        for (const choice of event.choices) {
          const result = resolver.resolve(state, event, choice.id);
          expect(result.ok).toBe(true);
          const successor = result.nextState;
          if (depth < 9) story.advance(successor);
          next.push(successor);
        }
      }
      // Keep all distinct causal states while bounding visually equivalent permutations.
      const unique = new Map(next.map((state) => [JSON.stringify({
        beat: state.beatIndex, housing: state.housing.method, water: state.water.method, energy: state.energy.method,
        materials: state.materials.method, road: state.road.method, displaced: state.flags.displaced,
        flow: state.regions.reedbank.flow, bank: state.regions.reedbank.bankDamage, restored: state.regions.reedbank.restored,
        gathering: state.services.gathering, gap: state.flags.finalGap, partnership: state.people.partnership,
      }), state]));
      frontier = [...unique.values()];
    }
    expect(frontier.length).toBeGreaterThan(1);
    expect(frontier.every((state) => state.progress === 100)).toBe(true);
    expect(seenByBeat.every((count) => count > 0)).toBe(true);
  });

  it('rejects duplicate and stale actions without advancing', () => {
    const state = createInitialState(); const story = new StoryDirector(); const resolver = new ActionResolver();
    const event = story.prepare(state); const first = resolver.resolve(state, event, 'housing_cottages');
    expect(first.ok).toBe(true);
    const duplicate = resolver.resolve(first.nextState, event, 'housing_cottages');
    expect(duplicate.ok).toBe(false);
    const wrongEvent = resolver.resolve(state, event, 'water_intake');
    expect(wrongEvent.ok).toBe(false);
  });

  it('produces materially different regional outcomes and callbacks', () => {
    const expansion = play(EXPANSION); const careful = play(CAREFUL);
    expect(expansion.regions.pinebank.quarry).toBeGreaterThan(careful.regions.pinebank.quarry);
    expect(expansion.regions.pinebank.vegetation).toBeLessThan(careful.regions.pinebank.vegetation);
    expect(expansion.regions.corridor.industry).toBeGreaterThan(careful.regions.corridor.industry);
    expect(expansion.flags.displaced).toBe(true);
    expect(careful.flags.displaced).toBe(false);
    expect(expansion.history.map((entry) => entry.text).join(' ')).not.toBe(careful.history.map((entry) => entry.text).join(' '));
  });

  it('restores the affected segment and blocks a repeated no-op', () => {
    const prefix = CAREFUL.slice(0, 6);
    let state = play(prefix); const story = new StoryDirector(); const resolver = new ActionResolver();
    const event = story.prepare(state); const before = state.regions.reedbank.bankDamage;
    const result = resolver.resolve(state, event, 'river_restore');
    expect(result.ok).toBe(true);
    expect(result.nextState.regions.reedbank.bankDamage).toBeLessThan(before);
    expect(result.nextState.regions.reedbank.restored).toBe(true);
    expect(resolver.resolve(result.nextState, event, 'river_restore').ok).toBe(false);
  });

  it('creates a clean replay state with no causal residue', () => {
    const finished = play(EXPANSION); const replayed = resetState(finished); const initial = createInitialState();
    replayed.runId = initial.runId;
    expect(replayed).toEqual(initial);
    expect(replayed.ledger).toEqual([]);
  });
});

describe('prompt interpreter', () => {
  it('prioritizes specific intent and handles normalization', () => {
    const state = createInitialState(); const event = new StoryDirector().prepare(state); const interpreter = new PromptInterpreter();
    expect(interpreter.interpret('  Use the empty DEPOT!!! ', event.choices)).toMatchObject({ type: 'action', actionId: 'housing_depot' });
  });

  it('ignores harmless articles in supported requests', () => {
    let state = play(EXPANSION.slice(0, 5)); const event = new StoryDirector().prepare(state); const interpreter = new PromptInterpreter();
    expect(interpreter.interpret('Adapt the community hall', event.choices)).toMatchObject({ type: 'action', actionId: 'arrivals_adapt' });
  });

  it('never applies a negated action', () => {
    const state = createInitialState(); const event = new StoryDirector().prepare(state); const interpreter = new PromptInterpreter();
    expect(interpreter.interpret('Do not build homes', event.choices).type).toBe('clarification');
  });

  it('asks for clarification when competing actions are requested', () => {
    const state = createInitialState(); const event = new StoryDirector().prepare(state); const interpreter = new PromptInterpreter();
    expect(interpreter.interpret('Build homes or convert the depot', event.choices).type).toBe('clarification');
  });

  it('keeps supported but unrelated requests in the current context', () => {
    const state = createInitialState(); const event = new StoryDirector().prepare(state); const interpreter = new PromptInterpreter();
    expect(interpreter.interpret('Clean the polluted river', event.choices).type).toBe('unrelated');
  });

  it('does not change state for unsupported input', () => {
    const state = createInitialState(); const before = structuredClone(state); const event = new StoryDirector().prepare(state); const interpreter = new PromptInterpreter();
    expect(interpreter.interpret('Make the moon closer', event.choices).type).toBe('invalid');
    expect(state).toEqual(before);
  });
});

