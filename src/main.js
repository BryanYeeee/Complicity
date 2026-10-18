import Phaser from 'phaser';
import './styles.css';
import { createInitialState, resetState } from './game/GameState.js';
import { StoryDirector } from './game/StoryDirector.js';
import { CivicClient } from './game/CivicClient.js';
import { appendConversation } from './game/CivicCore.js';
import { WorldScene } from './game/WorldRenderer.js';
import { GameUI } from './ui/GameUI.js';
import { BUILDING_CATALOG, INTENT_CATALOG, buildingTypeFromPrompt, intentFromPrompt } from './data/buildingCatalog.js';
import { PLOTS } from './data/worldLayout.js';
import { canPlaceBuilding, currentObjective, demolishBuilding, developmentProgress, legalPlots, moveBuilding, placeBuilding, recoverMaterials, settlementStatus, upgradeBuilding, welcomeResidents } from './game/SettlementBuilder.js';

const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));
let state = createInitialState();
const story = new StoryDirector(); const civic = new CivicClient();
let worldScene = null; let activeEvent = null; let generation = 0; let requestController = null; let endingStarted = false; let placementCommitPending = false; let proposalVersion = 0; let choiceEpoch = 0;
const context = { lastType: null, lastBuildingId: null, lastPlotId: null };

function ensureSettlementState(value, fresh = false) {
  const next = value;
  next.resources ||= { timber: 140, stone: 120, spentTimber: 0, spentStone: 0 }; next.resources.spentTimber ??= 0; next.resources.spentStone ??= 0;
  next.world ||= { buildings: [], occupiedPlots: [], connections: [], reservations: [], nextBuildingId: 1 }; next.world.nextBuildingId ??= 1; next.world.reservations ||= [];
  next.people ||= {}; next.people.residents ||= []; next.people.nextResidentId ||= 1; next.people.population = next.people.residents.length;
  if (fresh && next.revision === 0) { next.world.buildings = []; next.world.occupiedPlots = []; next.world.connections = []; next.world.reservations = []; next.people = { ...next.people, population: 0, residents: [], nextResidentId: 1, arrivals: 0 }; next.resources = { timber: 140, stone: 120, spentTimber: 0, spentStone: 0 }; }
  next.progress = developmentProgress(next); return next;
}

const ui = new GameUI(document.querySelector('#app'), {
  onBegin: () => begin(), onSubmit: (value) => submitPrompt(value), onReplay: () => replay(), onOption: (choice) => handleOption(choice),
  onMoveSelected: () => beginMove(worldScene?.getSelectedBuilding()), onUpgradeSelected: () => upgradeSelected(worldScene?.getSelectedBuilding()), onRemoveSelected: () => removeSelected(worldScene?.getSelectedBuilding()), onClearSelection: () => worldScene?.clearSelection(),
});
const game = new Phaser.Game({
  type: Phaser.AUTO, parent: 'game-canvas', transparent: true, audio: { noAudio: true }, render: { antialias: false, pixelArt: true, roundPixels: true },
  scale: { mode: Phaser.Scale.NONE, width: Math.max(1, ui.stageElement.clientWidth), height: Math.max(1, ui.stageElement.clientHeight) },
  scene: [new WorldScene({ getState: () => state, onReady: (scene) => { worldScene = scene; }, onPlacementChange: (placement) => { if (placement) { ui.showPlacement(placement); renderPlacementChoices(); } else ui.hidePlacement(); }, onSelectionChange: (building) => { ui.showSelection(building); if (building) { context.lastType = building.type; context.lastBuildingId = building.id; context.lastPlotId = building.plotId; } } })],
});
new ResizeObserver(([entry]) => { const { width, height } = entry.contentRect; if (width > 0 && height > 0) game.scale.resize(Math.round(width), Math.round(height)); }).observe(ui.stageElement);

function addConversation(speaker, text, kind = 'response') { state = appendConversation(state, speaker, text, kind); ui.renderState(state); }
function say(text, kind = 'response') { addConversation('CIVIC', text, kind); ui.showFeedback(text, 'success'); }
function showChoices(choices = []) { choiceEpoch += 1; ui.renderChoices(choices.map((choice) => ({ ...choice, epoch: choiceEpoch }))); }
function clearChoices() { showChoices([]); }
const affordable = (type) => { const def = BUILDING_CATALOG[type]; return def && (def.recovery || (state.resources.timber >= def.cost.timber && state.resources.stone >= def.cost.stone)); };
const buildChoice = (type) => ({ kind: 'build', type, label: BUILDING_CATALOG[type].label, detail: `${BUILDING_CATALOG[type].cost.timber} timber · ${BUILDING_CATALOG[type].cost.stone} stone` });

function availableTypes(intent) { return (INTENT_CATALOG[intent] || []).filter((type) => affordable(type) && canPlaceBuilding(state, type)); }

function offerIntent(intent) {
  const types = availableTypes(intent).slice(0, 3); const choices = types.map(buildChoice);
  if (intent === 'housing' && settlementStatus(state).vacantHousing > 0) choices.unshift({ kind: 'welcome', label: 'Welcome residents' });
  const status = settlementStatus(state); const lowResources = state.resources.timber < 24 || state.resources.stone < 18;
  if ((intent === 'materials' || (!choices.length && lowResources)) && !choices.some((item) => item.kind === 'recover')) {
    const recovery = { kind: 'recover', label: 'Trade for materials' }; if (lowResources) choices.unshift(recovery); else choices.push(recovery);
  }
  if (!choices.length) {
    const upgradable = state.world.buildings.find((item) => item.movable && (item.level || 1) < 2);
    const removable = [...state.world.buildings].reverse().find((item) => item.movable && !(state.people.residents || []).some((resident) => resident.homeId === item.id));
    if (upgradable) choices.push({ kind: 'upgrade', buildingId: upgradable.id, label: `Upgrade ${BUILDING_CATALOG[upgradable.type]?.noun || 'a building'}` });
    if (removable) choices.push({ kind: 'remove', buildingId: removable.id, label: `Clear ${BUILDING_CATALOG[removable.type]?.noun || 'a site'}` });
  }
  const trimmed = choices.slice(0, 3);
  if (!trimmed.length) { say('There is no legal site for that project. Select a structure to move or remove, or ask about another approach.'); clearChoices(); return; }
  const lead = intent === 'trade' ? 'For local trade, these projects are available.' : intent === 'industry' ? 'For production and jobs, these projects fit.' : intent === 'materials' ? 'These are the available supply routes.' : 'These options fit the need and the current map.';
  say(lead); showChoices(trimmed);
}

function renderPlacementChoices() {
  const placement = worldScene?.getPlacement(); if (!placement) return;
  if (placement.mode === 'preview') showChoices([{ kind: 'select-site', label: placement.valid ? 'Select this site' : 'Choose a valid site', disabled: !placement.valid, proposalId: placement.proposalId }, { kind: 'adjust', label: 'Try another site', proposalId: placement.proposalId }, { kind: 'cancel', label: 'Cancel', proposalId: placement.proposalId }]);
  else showChoices([{ kind: 'confirm', label: placement.valid ? 'Confirm project' : 'Choose another site', primary: placement.valid, disabled: !placement.valid, proposalId: placement.proposalId }, { kind: 'change-location', label: 'Change location', proposalId: placement.proposalId }, { kind: 'cancel', label: 'Cancel', proposalId: placement.proposalId }]);
}

function localOpening() { state.phase = 'playing'; state.history = [{ speaker: 'CIVIC', text: 'The land is open. Tell me how you want to begin.', kind: 'response' }]; activeEvent = story.prepare(state); }

function preferredFromText(text) {
  const value = text.toLowerCase(); if (/farther from|away from.*river|dry ground/.test(value)) return 'far-river'; if (/tree|forest|woods/.test(value)) return 'trees'; if (/river|water|bank/.test(value)) return 'river'; if (/behind|beside|next to|another one|near.*(house|home)|centre|center/.test(value)) return 'homes'; return null;
}

function unavailableReason(type) {
  const definition = BUILDING_CATALOG[type]; if (!definition) return 'That project is unavailable.';
  const plots = legalPlots(state, type); if (plots.length) return null;
  const terrainPlots = (awaitlessPlots(type));
  if (!terrainPlots.length) return `${definition.noun} has no compatible site on this map.`;
  const occupied = terrainPlots.filter((plot) => state.world.buildings.some((item) => item.plotId === plot.id));
  if (occupied.length === terrainPlots.length) return `Every compatible site for ${definition.noun.toLowerCase()} is occupied. Move or remove a structure first.`;
  if (!affordable(type)) return `There are not enough supplies for ${definition.noun.toLowerCase()}. Trade for materials first.`;
  return `${definition.noun} is not available yet.`;
}
function awaitlessPlots(type) { const allowed = BUILDING_CATALOG[type]?.allowedPlots || []; return PLOTS.filter((plot) => allowed.includes(plot.kind)); }

function beginPlacement(type, preferred = null, movingId = null) {
  if (state.phase !== 'playing' || state.inputState !== 'ready' || !BUILDING_CATALOG[type]) return;
  if (!movingId && !canPlaceBuilding(state, type)) { say(unavailableReason(type) || 'That project cannot be placed right now.'); offerIntent(BUILDING_CATALOG[type].category); return; }
  proposalVersion += 1; worldScene?.cancelPlacement(); context.lastType = type;
  worldScene?.beginPlacement(type, { preferred, movingId, nearPlotId: context.lastPlotId, proposalId: proposalVersion });
  const definition = BUILDING_CATALOG[type]; say(`${definition.noun}: ${definition.cost.timber} timber and ${definition.cost.stone} stone. I’ve proposed a valid site.`); renderPlacementChoices();
}

function replacePlacement(type, preferred = null) { const old = worldScene?.getPlacement(); beginPlacement(type, preferred, null); if (old && worldScene?.getPlacement()) say(`${BUILDING_CATALOG[type].noun} replaces the unconfirmed ${BUILDING_CATALOG[old.type].noun.toLowerCase()}.`); }
function cancelPlacement() { proposalVersion += 1; worldScene?.cancelPlacement(); say('Cancelled. No supplies were used.'); clearChoices(); }
function adjustPlacement(preferred = null) { if (!worldScene?.cyclePlacement(preferred)) ui.showFeedback('No other legal site is available.', 'error'); else renderPlacementChoices(); }
function changePlacementLocation() { if (worldScene?.changePlacementLocation()) { say('Choose a new highlighted location.'); renderPlacementChoices(); } }
function beginMove(building) { if (!building?.movable) { say('Select a player-built structure first.'); return; } context.lastBuildingId = building.id; context.lastType = building.type; context.lastPlotId = building.plotId; proposalVersion += 1; worldScene.beginPlacement(building.type, { movingId: building.id, preferred: 'homes', nearPlotId: building.plotId, proposalId: proposalVersion }); say(`Choose a new site for ${BUILDING_CATALOG[building.type].noun.toLowerCase()}.`); }

async function commitResult(result, message) {
  const previous = state; const history = state.history; state = ensureSettlementState(result.nextState); state.history = history; worldScene.cancelPlacement(); ui.showSelection(null);
  if (result.building?.plotId) { context.lastBuildingId = result.building.id; context.lastType = result.building.type; context.lastPlotId = result.building.plotId; }
  clearChoices(); ui.setLocked(true, result.effects.label); ui.showWork(result.effects.label); await worldScene?.transition(previous, state, result.effects, window.matchMedia('(prefers-reduced-motion: reduce)').matches); ui.hideWork(); ui.renderState(state);
  const objective = currentObjective(state);
  if (!endingStarted && settlementStatus(state).complete && developmentProgress(state) === 100) { endingStarted = true; state.phase = 'ending'; state.inputState = 'ending'; state.progress = 100; window.setTimeout(() => runEnding('Development has reached 100%. Take a moment to look at the whole system.', generation), 700); }
  else { say(`${message.split('.')[0]}. Next: ${objective.title}.`); ui.setLocked(false, civic.mode === 'live' ? 'LIVE · READY' : 'LOCAL · READY'); }
}

async function performValidated(action, localResolver, payload = {}) {
  if (placementCommitPending) return null; placementCommitPending = true; ui.setLocked(true, 'VALIDATING');
  try { const remote = await civic.build({ state, action, ...payload }); return remote ? { ok: true, nextState: remote.state, effects: remote.effects, building: remote.building, definition: remote.definition, residents: remote.residents } : localResolver(); }
  catch (error) { ui.showFeedback(`${error.message} Nothing was charged.`, 'error'); return null; }
  finally { placementCommitPending = false; if (state.phase === 'playing') ui.setLocked(false, civic.mode === 'live' ? 'LIVE · READY' : 'LOCAL · READY'); }
}

async function confirmPlacement(expectedProposalId = null) {
  const placement = worldScene?.getPlacement(); if (expectedProposalId !== null && placement?.proposalId !== expectedProposalId) { ui.showFeedback('That proposal has been replaced.', 'error'); return; }
  if (!placement?.valid || placement.mode !== 'selected') { ui.showFeedback(placement?.reason || 'Select a valid site first.', 'error'); return; }
  const snapshot = { ...placement }; const result = await performValidated(snapshot.movingId ? 'move' : 'build', () => snapshot.movingId ? moveBuilding(state, snapshot.movingId, snapshot.plotId) : placeBuilding(state, snapshot.type, snapshot.plotId), { type: snapshot.type, plotId: snapshot.plotId, movingId: snapshot.movingId });
  if (!result) return; if (!result.ok) { ui.showFeedback(result.reason, 'error'); return; }
  const noun = result.definition.noun; await commitResult(result, snapshot.movingId ? `${noun} moved. No new materials were used.` : `${noun} complete`);
}

async function welcome() { const result = await performValidated('welcome', () => welcomeResidents(state)); if (!result) return; if (!result.ok) { say(result.reason); return; } await commitResult(result, `${result.residents?.length || 0} residents arrived`); }
async function recover() { const result = await performValidated('recover', () => recoverMaterials(state)); if (result?.ok) await commitResult(result, 'Materials received. Development did not increase'); }

async function upgradeSelected(building = null) {
  const target = building || state.world.buildings.find((item) => item.id === context.lastBuildingId); if (!target) { say('Select the building you want to upgrade.'); return; }
  const result = await performValidated('upgrade', () => upgradeBuilding(state, target.id), { type: target.type, plotId: target.plotId, buildingId: target.id }); if (!result) return; if (!result.ok) { say(result.reason); return; } await commitResult(result, `${result.definition.noun} upgraded`);
}
async function removeSelected(building = null) {
  const target = building || state.world.buildings.find((item) => item.id === context.lastBuildingId); if (!target) { say('Select the structure you want to remove.'); return; }
  const result = await performValidated('remove', () => demolishBuilding(state, target.id), { type: target.type, plotId: target.plotId, buildingId: target.id }); if (!result) return; if (!result.ok) { say(result.reason); return; } await commitResult(result, `${result.definition.noun} removed. The site is available again`);
}

async function handleOption(choice) {
  if (choice.epoch !== choiceEpoch) { ui.showFeedback('That option has been replaced.', 'error'); return; }
  if (choice.proposalId && worldScene?.getPlacement()?.proposalId !== choice.proposalId) { ui.showFeedback('That proposal has been replaced.', 'error'); return; }
  if (choice.kind === 'build') beginPlacement(choice.type); else if (choice.kind === 'confirm') await confirmPlacement(choice.proposalId); else if (choice.kind === 'change-location') changePlacementLocation();
  else if (choice.kind === 'select-site') { const placement = worldScene?.getPlacement(); if (placement?.valid) worldScene.setPlacementPlot(placement.plotId, 'selected'); }
  else if (choice.kind === 'adjust') adjustPlacement(); else if (choice.kind === 'cancel') cancelPlacement(); else if (choice.kind === 'welcome') await welcome(); else if (choice.kind === 'recover') await recover();
  else if (choice.kind === 'upgrade') await upgradeSelected(state.world.buildings.find((item) => item.id === choice.buildingId));
  else if (choice.kind === 'remove') await removeSelected(state.world.buildings.find((item) => item.id === choice.buildingId));
}

async function begin() {
  if (state.phase !== 'opening') return; const token = generation; ui.setPhase('playing'); ui.setLocked(true, 'CONNECTING'); const started = await civic.start(state.runId); if (token !== generation) return;
  if (started.state && started.event) { state = ensureSettlementState(started.state, true); state.history = [{ speaker: 'CIVIC', text: 'The land is open. Tell me how you want to begin.', kind: 'response' }]; activeEvent = started.event; } else localOpening();
  ui.setMode(civic.mode); ui.renderState(state); ui.renderEvent(); ui.setLocked(false); clearChoices(); window.setTimeout(() => ui.focusInput(), 80);
}

function answerInvestigation(text) {
  const status = settlementStatus(state); const regions = state.regions;
  if (/how many|population|resident|occup/.test(text)) return `${status.population} named residents live in ${status.housingCapacity} available places. Select a home to inspect its occupants.`;
  if (/source|come from|material|timber|stone|supply/.test(text)) return `The ledger records ${state.resources.spentTimber} timber and ${state.resources.spentStone} stone used. Trade remains available if supplies run low.`;
  if (/river|water|downstream|pollution/.test(text)) return `Local water access is ${status.waterPercent}%. Regional flow is ${regions.reedbank.flow}% with contamination at ${regions.reedbank.contamination}.`;
  if (/outside|beyond|forest|tree|damage|consequence|cost/.test(text)) return `Local air is ${status.airQuality}%. Regional records show ${regions.pinebank.vegetation}% forest cover and ${regions.corridor.smoke} smoke units.`;
  if (/cost|price|afford/.test(text) && worldScene?.getPlacement()) { const definition = BUILDING_CATALOG[worldScene.getPlacement().type]; return `${definition.noun} costs ${definition.cost.timber} timber and ${definition.cost.stone} stone. Nothing is deducted before confirmation.`; }
  return null;
}

const isQuestion = (text) => /\?$/.test(text.trim()) || /^(what|why|where|when|how|can|could|would|should|is|are|do|does|will)\b/i.test(text.trim());

async function submitPrompt(value) {
  const text = value.trim(); if (!text || state.inputState !== 'ready' || requestController) return; const lower = text.toLowerCase(); ui.acceptInput(); addConversation('YOU', text, 'player');
  const explicitType = buildingTypeFromPrompt(lower); const placement = worldScene?.getPlacement();
  if (placement && explicitType && explicitType !== placement.type) { replacePlacement(explicitType, preferredFromText(lower)); return; }
  if (placement && isQuestion(lower)) { say(answerInvestigation(lower) || `The ${BUILDING_CATALOG[placement.type].noun.toLowerCase()} proposal remains uncommitted. You can confirm, change its location, replace it, or cancel.`); renderPlacementChoices(); return; }
  if (placement && /\b(confirm|go ahead|build it|place it|yes|do it)\b/.test(lower)) { await confirmPlacement(placement.proposalId); return; }
  if (placement && /\b(cancel|never mind|stop)\b/.test(lower)) { cancelPlacement(); return; }
  if (placement && /\b(change location|move|closer|farther|another site|different site|near|beside|behind)\b/.test(lower)) { adjustPlacement(preferredFromText(lower)); say('The proposed location has changed.'); return; }
  if (/\b(add|build|make|place)\s+(another|one more)|another one/.test(lower) && context.lastType) { beginPlacement(context.lastType, 'homes'); return; }
  if (/\bmove (that|it|the last|this)\b/.test(lower)) { beginMove(state.world.buildings.find((item) => item.id === context.lastBuildingId)); return; }
  if (/\bupgrade (that|it|those|the last|this)\b/.test(lower)) { await upgradeSelected(); return; }
  if (/\b(remove|demolish|clear) (that|it|the last|this)\b/.test(lower)) { await removeSelected(); return; }
  if (explicitType) { beginPlacement(explicitType, preferredFromText(lower)); return; }
  if (/\b(invite|welcome|move in|residents? arrive|people arrive)\b/.test(lower)) { const status = settlementStatus(state); if (status.vacantHousing) { say(`${status.vacantHousing} housing places are ready.`); showChoices([{ kind: 'welcome', label: 'Welcome residents' }]); } else { say('There are no vacant homes yet.'); offerIntent('housing'); } return; }
  const grounded = answerInvestigation(lower); if (isQuestion(lower)) { say(grounded || `${currentObjective(state).title}. ${currentObjective(state).detail}`); clearChoices(); return; }
  const intent = intentFromPrompt(lower); if (intent) { offerIntent(intent); return; }
  if (grounded) { say(grounded); clearChoices(); return; }
  if (!activeEvent) { say('Tell me what problem you want to solve.'); clearChoices(); return; }
  const token = generation; requestController = new AbortController(); ui.setLocked(true, civic.mode === 'live' ? 'LIVE · THINKING' : 'DEMO · THINKING');
  try { const result = await civic.message({ text, state, event: activeEvent, signal: requestController.signal }); if (token !== generation) return; say(result.message || 'Tell me what local need you want to address.'); clearChoices(); }
  catch (error) { if (error.name !== 'AbortError') { ui.showFeedback(`${error.message} Your message is preserved.`, 'error'); ui.els.input.value = text; } }
  finally { if (token === generation && state.phase === 'playing') { requestController = null; ui.setLocked(false, civic.mode === 'live' ? 'LIVE · READY' : 'LOCAL · READY'); ui.focusInput(); } }
}

async function runEnding(response, token) {
  state.inputState = 'ending'; state.phase = 'ending'; state.progress = 100; ui.renderState(state); ui.beginEnding(response); await wait(1700); if (token !== generation) return; ui.collapseComposer(); worldScene.prepareReveal(); await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))); if (token !== generation) return;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches; await new Promise((resolve) => worldScene.cameraDirector.reveal({ duration: 7600, reducedMotion, onComplete: resolve })); if (token !== generation) return;
  await wait(4200); if (token !== generation) return; ui.showEndingFirst(); await wait(1800); if (token !== generation) return; ui.showEndingSecond(); await wait(2400); if (token !== generation) return; ui.showEndingActions();
}

function replay() {
  generation += 1; requestController?.abort(); requestController = null; civic.cancel(); state = resetState(state); activeEvent = null; endingStarted = false; placementCommitPending = false; proposalVersion = 0; choiceEpoch = 0; context.lastType = null; context.lastBuildingId = null; context.lastPlotId = null;
  worldScene?.cancelTransitions(); worldScene?.cancelPlacement(); worldScene?.resetReveal(); worldScene?.cameraDirector.showOpening(); ui.reset(); ui.renderState(state);
}

ui.renderState(state);
if (import.meta.env.DEV) window.__WORLD_BEYOND__ = { getState: () => structuredClone(state), getLedger: () => structuredClone(state.ledger), finalFrame: () => { worldScene?.prepareReveal(); ui.collapseComposer(); worldScene?.cameraDirector.showFinal(); }, mode: () => civic.mode, beginPlacement: (type) => beginPlacement(type), placement: () => worldScene?.getPlacement(), confirmPlacement: () => confirmPlacement(worldScene?.getPlacement()?.proposalId), cancelPlacement: () => cancelPlacement(), status: () => settlementStatus(state), objective: () => currentObjective(state), development: () => developmentProgress(state), choosePlot: (plotId) => worldScene?.setPlacementPlot(plotId, 'selected'), changeLocation: () => worldScene?.changePlacementLocation(), screenForPlot: (plotId) => worldScene?.screenForPlot(plotId), choices: () => [...document.querySelectorAll('.quick-actions button')].map((item) => item.textContent) };
