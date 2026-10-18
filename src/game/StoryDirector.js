import { STORY_EVENTS } from '../data/storyEvents.js';

export class StoryDirector {
  getCurrent(state) {
    return STORY_EVENTS[state.beatIndex] || null;
  }

  prepare(state) {
    const event = this.getCurrent(state);
    if (!event) return null;
    const missing = event.requires.filter((requirement) => !state.resolvedEvents.includes(requirement));
    if (missing.length) throw new Error(`Story prerequisite missing: ${missing.join(', ')}`);
    const variant = event.getVariant(state);
    if (event.id === 'almost_enough') state.flags.finalGap = variant;
    const choices = event.getChoices(state);
    if (choices.length < 2) throw new Error(`Event ${event.id} has fewer than two eligible actions.`);
    return { ...event, variant, text: event.getText(state, variant), choices };
  }

  advance(state) {
    state.beatIndex += 1;
    state.inputState = state.beatIndex >= STORY_EVENTS.length ? 'ending' : 'ready';
    return this.prepare(state);
  }
}

