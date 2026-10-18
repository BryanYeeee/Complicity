import Phaser from 'phaser';
import './styles.css';
import { createInitialState, resetState } from './game/GameState.js';
import { StoryDirector } from './game/StoryDirector.js';
import { ActionResolver } from './game/ActionResolver.js';
import { PromptInterpreter } from './game/PromptInterpreter.js';
import { WorldScene } from './game/WorldRenderer.js';
import { GameUI } from './ui/GameUI.js';

const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));
let state = createInitialState();
const story = new StoryDirector();
const resolver = new ActionResolver();
const interpreter = new PromptInterpreter();
let worldScene = null;
let activeEvent = null;
let generation = 0;

const ui = new GameUI(document.querySelector('#app'), {
  onBegin: () => begin(),
  onAction: (actionId) => commit(actionId),
  onSubmit: (value) => submitPrompt(value),
  onReplay: () => replay(),
});

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game-canvas',
  transparent: true,
  audio: { noAudio: true },
  render: { antialias: true, pixelArt: false, roundPixels: false },
  scale: { mode: Phaser.Scale.NONE, width: Math.max(1, ui.stageElement.clientWidth), height: Math.max(1, ui.stageElement.clientHeight) },
  scene: [new WorldScene({ getState: () => state, onReady: (scene) => { worldScene = scene; } })],
});

const observer = new ResizeObserver(([entry]) => {
  const { width, height } = entry.contentRect;
  if (width > 0 && height > 0) game.scale.resize(Math.round(width), Math.round(height));
});
observer.observe(ui.stageElement);

function begin() {
  if (state.phase !== 'opening') return;
  state.phase = 'playing'; ui.setPhase('playing');
  activeEvent = story.prepare(state); ui.renderState(state); ui.renderEvent(activeEvent);
  window.setTimeout(() => ui.focusInput(), 550);
}

function submitPrompt(value) {
  if (!activeEvent || state.inputState !== 'ready') return;
  const result = interpreter.interpret(value, activeEvent.choices);
  if (result.type === 'action') { ui.acceptInput(); commit(result.actionId); }
  else ui.showFeedback(result.message, result.type === 'invalid' ? 'error' : 'info');
}

async function commit(actionId) {
  if (!activeEvent || state.inputState !== 'ready') return;
  ui.setLocked(true);
  const result = resolver.resolve(state, activeEvent, actionId);
  if (!result.ok) { ui.setLocked(false); ui.showFeedback(result.reason, 'error'); return; }
  const token = generation;
  state = result.nextState;
  ui.renderState(state); ui.showFeedback(result.response, 'success'); worldScene?.updateState(state, result.effects);
  await wait(950); if (token !== generation) return;

  if (state.beatIndex === 9) { await runEnding(result.response, token); return; }
  activeEvent = story.advance(state);
  await wait(300); if (token !== generation) return;
  ui.renderState(state); ui.renderEvent(activeEvent); ui.focusInput();
}

async function runEnding(response, token) {
  state.beatIndex = 10; state.inputState = 'ending'; state.phase = 'ending'; state.progress = 100;
  ui.renderState(state); ui.beginEnding(response);
  await wait(1800); if (token !== generation) return;
  ui.collapseComposer();
  await wait(750); if (token !== generation) return;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  await new Promise((resolve) => worldScene.cameraDirector.reveal({ duration: 7000, reducedMotion, onComplete: resolve }));
  if (token !== generation) return;
  await wait(3000); if (token !== generation) return;
  ui.showEndingFirst();
  await wait(2000); if (token !== generation) return;
  ui.showEndingSecond();
  await wait(2200); if (token !== generation) return;
  ui.showEndingActions();
}

function replay() {
  generation += 1;
  state = resetState(state); activeEvent = null;
  worldScene?.tweens.killAll(); worldScene?.time.removeAllEvents(); worldScene?.ambient.removeAll(true); worldScene?.draw(state); worldScene?.createAmbientMotion(); worldScene?.cameraDirector.showOpening();
  ui.reset(); ui.renderState(state);
}

ui.renderState(state);

if (import.meta.env.DEV) {
  window.__WORLD_BEYOND__ = {
    getState: () => structuredClone(state),
    getLedger: () => structuredClone(state.ledger),
    choose: (actionId) => commit(actionId),
    finalFrame: () => { ui.collapseComposer(); worldScene?.cameraDirector.showFinal(); },
  };
}

