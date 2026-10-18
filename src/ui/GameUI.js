import { BUILDING_CATALOG } from '../data/buildingCatalog.js';
import { currentObjective, developmentProgress, settlementStatus } from '../game/SettlementBuilder.js';

export class GameUI {
  constructor(root, handlers) {
    this.root = root; this.handlers = handlers; this.placement = null; this.selected = null;
    this.root.innerHTML = `
      <main class="experience" data-phase="opening">
        <header class="hud" aria-label="Settlement status">
          <div class="hud-brand"><span class="mark" aria-hidden="true"></span><span>COMPLICITY</span></div>
          <div class="resource-strip" aria-label="Starting supplies"><span><i class="timber-icon"></i><b id="timber-value">140</b> timber</span><span><i class="stone-icon"></i><b id="stone-value">120</b> stone</span></div>
          <button class="chat-toggle" type="button" aria-expanded="true" aria-controls="civic-panel"><span>CIVIC</span><i aria-hidden="true">×</i></button>
        </header>
        <div class="play-layout">
          <section class="world-stage" aria-label="The connected landscape">
            <div id="game-canvas"></div>
            <section class="objective-card" aria-labelledby="objective-title">
              <p class="eyebrow">CURRENT OBJECTIVE</p><h2 id="objective-title">House your first residents</h2><p class="objective-detail">Create welcoming shelter.</p>
              <div class="objective-progress" role="progressbar" aria-valuemin="0" aria-valuemax="1" aria-valuenow="0"><i></i></div><span class="objective-count">0/1</span>
            </section>
            <section class="development-card" aria-label="Overall development"><div><strong id="development-value">0%</strong><span>DEVELOPMENT</span></div><div class="development-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i></i></div></section>
            <div class="opening-card" role="dialog" aria-labelledby="opening-title"><p class="eyebrow">A LANDSCAPE. A SMALL SUPPLY. A CHOICE.</p><h1 id="opening-title">COMPLICITY<span class="opening-title-subtitle">At Whose Expense?</span></h1><p>Build a society with CIVIC, one decision at a time.</p><button class="primary begin-button" type="button">BEGIN DEVELOPMENT</button></div>
            <div class="work-caption" aria-live="polite"></div>
            <div class="placement-panel" hidden><div><p class="placement-kicker">SITE PREVIEW</p><strong class="placement-name"></strong><small class="placement-note">CIVIC is finding a valid site.</small></div></div>
            <div class="selection-panel" hidden><div><p class="placement-kicker">SELECTED</p><strong class="selection-name"></strong><small class="selection-occupancy"></small></div><button class="secondary move-selection" type="button">MOVE</button><button class="secondary upgrade-selection" type="button">UPGRADE</button><button class="secondary remove-selection" type="button">REMOVE</button><button class="secondary close-selection" type="button" aria-label="Close selection">×</button></div>
            <section class="society-dashboard" aria-label="Your settlement statistics">
              <p class="dashboard-scope"><strong>YOUR SETTLEMENT</strong><span>live conditions</span></p>
              <div class="stat" data-stat="population"><i>●</i><span>Population<b>0</b></span></div>
              <div class="stat" data-stat="housing"><i>⌂</i><span>Housing<b>0</b></span></div>
              <div class="stat" data-stat="economy"><i>◆</i><span>Economy<b>0</b></span></div>
              <div class="stat" data-stat="water"><i>≋</i><span>Water<b>—</b></span></div>
              <div class="stat" data-stat="energy"><i>ϟ</i><span>Energy<b>—</b></span></div>
              <div class="stat" data-stat="air"><i>◌</i><span>Local air<b>96%</b></span></div>
            </section>
            <div class="ending-copy" aria-live="polite"><p class="ending-line ending-line-one">You Build This</p><p class="ending-line ending-line-two">nice job</p><div class="ending-actions"><button class="secondary view-button" type="button">INSPECT THE WORLD</button><button class="primary replay-button" type="button">BUILD AGAIN</button></div></div>
            <button class="restore-ending" type="button">BACK</button>
          </section>
          <aside class="assistant" id="civic-panel" aria-label="Conversation with CIVIC">
            <div class="assistant-topline"><div><span class="assistant-dot" aria-hidden="true"></span><strong>CIVIC</strong><span class="status">CONNECTING</span></div><button class="hint-button" type="button" aria-expanded="false">?</button></div>
            <section class="situation" aria-label="Current situation"><p class="speaker">SETTLEMENT BRIEF</p><h3>Empty land</h3><p class="event-text">Tell CIVIC what this place needs first.</p><p class="hint" hidden>Try “Let’s make room for residents,” “What should we build next?” or ask where a material comes from.</p></section>
            <div class="conversation" role="log" aria-live="polite" aria-relevant="additions text"></div>
            <div class="quick-actions" aria-label="CIVIC suggestions"></div>
            <p class="feedback" role="status" aria-live="polite"></p>
            <form class="composer-form"><label class="sr-only" for="prompt-input">Message CIVIC</label><textarea id="prompt-input" name="prompt" maxlength="800" rows="2" placeholder="Tell CIVIC what to build or change…"></textarea><button class="submit-button" type="submit">SEND</button></form>
          </aside>
        </div>
      </main>`;
    this.els = {
      experience: root.querySelector('.experience'), stage: root.querySelector('.world-stage'), assistant: root.querySelector('.assistant'), eventTitle: root.querySelector('.situation h3'), eventText: root.querySelector('.event-text'), conversation: root.querySelector('.conversation'), quickActions: root.querySelector('.quick-actions'), feedback: root.querySelector('.feedback'), hint: root.querySelector('.hint'), hintButton: root.querySelector('.hint-button'), input: root.querySelector('#prompt-input'), form: root.querySelector('.composer-form'), submit: root.querySelector('.submit-button'), status: root.querySelector('.status'), opening: root.querySelector('.opening-card'), ending: root.querySelector('.ending-copy'), restore: root.querySelector('.restore-ending'), workCaption: root.querySelector('.work-caption'), timber: root.querySelector('#timber-value'), stone: root.querySelector('#stone-value'), placement: root.querySelector('.placement-panel'), placementName: root.querySelector('.placement-name'), placementNote: root.querySelector('.placement-note'), selection: root.querySelector('.selection-panel'), selectionName: root.querySelector('.selection-name'), selectionOccupancy: root.querySelector('.selection-occupancy'), chatToggle: root.querySelector('.chat-toggle'), objectiveTitle: root.querySelector('#objective-title'), objectiveDetail: root.querySelector('.objective-detail'), objectiveCount: root.querySelector('.objective-count'), objectiveProgress: root.querySelector('.objective-progress'), developmentValue: root.querySelector('#development-value'), developmentTrack: root.querySelector('.development-track'),
    };
    root.querySelector('.begin-button').addEventListener('click', () => handlers.onBegin()); root.querySelector('.replay-button').addEventListener('click', () => handlers.onReplay()); root.querySelector('.view-button').addEventListener('click', () => this.viewWorld()); this.els.restore.addEventListener('click', () => this.restoreEnding());
    this.els.hintButton.addEventListener('click', () => this.toggleHint()); this.els.chatToggle.addEventListener('click', () => this.toggleChat());
    this.els.form.addEventListener('submit', (event) => { event.preventDefault(); handlers.onSubmit(this.els.input.value); }); this.els.input.addEventListener('keydown', (event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); this.els.form.requestSubmit(); } });
    root.querySelector('.move-selection').addEventListener('click', () => handlers.onMoveSelected()); root.querySelector('.upgrade-selection').addEventListener('click', () => handlers.onUpgradeSelected()); root.querySelector('.remove-selection').addEventListener('click', () => handlers.onRemoveSelected()); root.querySelector('.close-selection').addEventListener('click', () => handlers.onClearSelection());
    if (window.matchMedia('(max-width: 760px)').matches) this.setChatCollapsed(true);
  }

  get stageElement() { return this.els.stage; }
  setPhase(phase) { this.els.experience.dataset.phase = phase; if (phase !== 'opening') this.els.opening.setAttribute('aria-hidden', 'true'); }
  setMode(mode) { this.els.status.textContent = mode === 'live' ? 'LIVE · READY' : mode === 'demo-server' ? 'DEMO · READY' : 'LOCAL · READY'; this.els.assistant.dataset.mode = mode; }
  renderState(state) {
    this.lastState = state;
    this.els.timber.textContent = state.resources?.timber ?? 0; this.els.stone.textContent = state.resources?.stone ?? 0;
    const status = settlementStatus(state); const objective = currentObjective(state); const ratio = objective.target ? Math.min(1, objective.value / objective.target) : 0; const development = developmentProgress(state);
    this.els.objectiveTitle.textContent = objective.title; this.els.objectiveDetail.textContent = objective.detail; this.els.objectiveCount.textContent = `${objective.value}/${objective.target}`; this.els.objectiveProgress.setAttribute('aria-valuemax', String(objective.target)); this.els.objectiveProgress.setAttribute('aria-valuenow', String(objective.value)); this.els.objectiveProgress.querySelector('i').style.width = `${ratio * 100}%`;
    this.els.developmentValue.textContent = `${development}%`; this.els.developmentTrack.setAttribute('aria-valuenow', String(development)); this.els.developmentTrack.querySelector('i').style.width = `${development}%`;
    const values = { population: status.population, housing: `${status.population}/${status.housingCapacity}`, economy: status.economy, water: status.population ? `${status.waterPercent}%` : '—', energy: status.population ? `${status.energyPercent}%` : '—', air: `${status.airQuality}%` };
    Object.entries(values).forEach(([key, value]) => { const node = this.root.querySelector(`[data-stat="${key}"] b`); if (node.textContent !== String(value)) { node.textContent = value; node.closest('.stat').classList.remove('changed'); requestAnimationFrame(() => node.closest('.stat').classList.add('changed')); } });
    this.els.eventTitle.textContent = objective.title; this.els.eventText.textContent = objective.detail;
    this.renderConversation(state.history);
  }
  renderEvent() { const objective = currentObjective(this.lastState || { world: { buildings: [] } }); if (objective) { this.els.eventTitle.textContent = objective.title; this.els.eventText.textContent = objective.detail; } }
  renderConversation(history) { this.els.conversation.replaceChildren(...history.slice(-18).map((item) => { const block = document.createElement('article'); block.className = `message ${item.kind}`; const speaker = document.createElement('strong'); speaker.textContent = item.speaker; const text = document.createElement('p'); text.textContent = item.text; block.append(speaker, text); return block; })); this.els.conversation.scrollTop = this.els.conversation.scrollHeight; }
  renderChoices(choices = []) { this.els.quickActions.replaceChildren(...choices.slice(0, 3).map((choice) => { const button = document.createElement('button'); button.type = 'button'; button.className = choice.primary ? 'choice-button primary-choice' : 'choice-button'; button.textContent = choice.label; button.disabled = Boolean(choice.disabled); if (choice.detail) button.title = choice.detail; button.addEventListener('click', () => this.handlers.onOption(choice)); return button; })); this.els.quickActions.hidden = choices.length === 0; }
  showThinking(playerText) { this.els.feedback.textContent = 'CIVIC is reading the settlement…'; this.els.feedback.dataset.kind = 'thinking'; const block = document.createElement('article'); block.className = 'message player pending-message'; block.innerHTML = '<strong>YOU</strong>'; const p = document.createElement('p'); p.textContent = playerText; block.append(p); this.els.conversation.append(block); }
  setLocked(locked, status = null) { this.els.input.disabled = locked; this.els.submit.disabled = locked; this.els.quickActions.querySelectorAll('button').forEach((button) => { button.disabled = locked; }); this.els.experience.classList.toggle('is-resolving', locked); if (status) this.els.status.textContent = status; }
  showFeedback(message, kind = 'info') { this.els.feedback.textContent = message; this.els.feedback.dataset.kind = kind; }
  showWork(label) { this.els.workCaption.textContent = label; this.els.workCaption.classList.add('visible'); } hideWork() { this.els.workCaption.classList.remove('visible'); }
  acceptInput() { this.els.input.value = ''; } focusInput() { this.els.input.focus({ preventScroll: true }); }
  toggleHint() { const show = this.els.hint.hidden; this.els.hint.hidden = !show; this.els.hintButton.setAttribute('aria-expanded', String(show)); }
  toggleChat() { this.setChatCollapsed(!this.els.experience.classList.contains('chat-collapsed')); }
  setChatCollapsed(collapsed) { this.els.experience.classList.toggle('chat-collapsed', collapsed); this.els.chatToggle.setAttribute('aria-expanded', String(!collapsed)); this.els.chatToggle.querySelector('i').textContent = collapsed ? '+' : '×'; }
  showPlacement(info) { this.placement = info; const definition = BUILDING_CATALOG[info.type]; this.els.placement.hidden = false; this.els.selection.hidden = true; this.els.placementName.textContent = definition?.noun || definition?.label || 'Building'; this.els.placementNote.textContent = info.reason || (info.mode === 'preview' ? 'Move over a valid site, then select it.' : info.valid ? 'Location selected — ready to confirm.' : 'Choose another marked site.'); this.els.placementNote.dataset.valid = String(Boolean(info.valid)); }
  hidePlacement() { this.placement = null; this.els.placement.hidden = true; }
  showSelection(building) { this.selected = building; this.els.selection.hidden = !building; this.els.placement.hidden = true; if (building) { const definition = BUILDING_CATALOG[building.type]; const occupants = (this.lastState?.people?.residents || []).filter((resident) => resident.homeId === building.id); this.els.selectionName.textContent = `${definition?.noun || building.type}${building.level > 1 ? ' · upgraded' : ''}`; this.els.selectionOccupancy.textContent = occupants.length ? `${occupants.length} residents: ${occupants.map((item) => item.name).join(', ')}` : definition?.families ? 'Vacant' : ''; this.root.querySelector('.move-selection').disabled = !building.movable; this.root.querySelector('.upgrade-selection').disabled = !building.movable || building.level > 1; this.root.querySelector('.remove-selection').disabled = !building.movable; } }
  beginEnding(response) { this.setLocked(true, 'SOCIETY COMPLETE'); this.showFeedback(response, 'success'); this.renderChoices([]); this.hidePlacement(); this.els.selection.hidden = true; }
  collapseComposer() { this.setPhase('revealing'); this.setChatCollapsed(true); }
  showEndingFirst() { this.setPhase('ending'); this.els.ending.classList.add('show-one'); } showEndingSecond() { this.els.ending.classList.add('show-two'); } showEndingActions() { this.els.ending.classList.add('show-actions'); }
  viewWorld() { this.els.ending.classList.add('hidden'); this.els.restore.classList.add('visible'); this.els.restore.focus(); } restoreEnding() { this.els.ending.classList.remove('hidden'); this.els.restore.classList.remove('visible'); this.root.querySelector('.view-button').focus(); }
  reset() { this.els.ending.className = 'ending-copy'; this.els.restore.className = 'restore-ending'; this.els.workCaption.className = 'work-caption'; this.setPhase('opening'); this.els.opening.removeAttribute('aria-hidden'); this.els.input.value = ''; this.els.feedback.textContent = ''; this.renderChoices([]); this.hidePlacement(); this.showSelection(null); this.els.hint.hidden = true; this.els.hintButton.setAttribute('aria-expanded', 'false'); this.setLocked(false, 'CONNECTING'); this.setChatCollapsed(window.matchMedia('(max-width: 760px)').matches); }
}
