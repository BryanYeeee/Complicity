export class GameUI {
  constructor(root, handlers) {
    this.root = root;
    this.handlers = handlers;
    this.root.innerHTML = `
      <main class="experience" data-phase="opening">
        <header class="hud" aria-label="Development progress">
          <div class="hud-brand"><span class="mark" aria-hidden="true"></span><span>THE WORLD BEYOND</span></div>
          <div class="progress-wrap">
            <span id="progress-label">DEVELOPMENT — 5%</span>
            <div class="progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="5"><i></i></div>
          </div>
        </header>
        <section class="world-stage" aria-label="The connected landscape">
          <div id="game-canvas"></div>
          <div class="opening-card" role="dialog" aria-labelledby="opening-title">
            <p class="eyebrow">A SILENT INTERACTIVE LANDSCAPE</p>
            <h1 id="opening-title">THE WORLD<br />BEYOND</h1>
            <p>A better world is just one prompt away.</p>
            <button class="primary begin-button" type="button">BEGIN DEVELOPMENT</button>
          </div>
          <div class="ending-copy" aria-live="polite">
            <p class="ending-line ending-line-one">Your civilization is thriving.</p>
            <p class="ending-line ending-line-two">At what cost?</p>
            <div class="ending-actions">
              <button class="secondary view-button" type="button">VIEW THE WORLD</button>
              <button class="primary replay-button" type="button">PLAY AGAIN</button>
            </div>
          </div>
          <button class="restore-ending" type="button">Restore ending</button>
        </section>
        <section class="assistant" aria-label="CIVIC AI decision composer">
          <div class="assistant-topline">
            <div><span class="assistant-dot" aria-hidden="true"></span><strong>CIVIC AI</strong><span class="status">LOCAL SYSTEM · READY</span></div>
            <details class="history-drawer">
              <summary>History <span class="history-count">0</span></summary>
              <div class="history-list" aria-label="Conversation history"></div>
            </details>
          </div>
          <div class="decision-row">
            <div class="event-copy">
              <p class="speaker"></p>
              <h2></h2>
              <p class="event-text"></p>
              <p class="feedback" role="status" aria-live="polite"></p>
            </div>
            <div class="choices" aria-label="Available methods"></div>
          </div>
          <form class="composer-form">
            <label class="sr-only" for="prompt-input">Tell CIVIC AI how to respond</label>
            <input id="prompt-input" name="prompt" autocomplete="off" placeholder="Tell CIVIC AI what to do…" />
            <button class="submit-button" type="submit">SUBMIT</button>
          </form>
        </section>
      </main>`;
    this.els = {
      experience: root.querySelector('.experience'), stage: root.querySelector('.world-stage'), assistant: root.querySelector('.assistant'),
      eventTitle: root.querySelector('.event-copy h2'), speaker: root.querySelector('.speaker'), eventText: root.querySelector('.event-text'), feedback: root.querySelector('.feedback'),
      choices: root.querySelector('.choices'), input: root.querySelector('#prompt-input'), form: root.querySelector('.composer-form'), submit: root.querySelector('.submit-button'),
      progressLabel: root.querySelector('#progress-label'), progressBar: root.querySelector('.progress-track'), progressFill: root.querySelector('.progress-track i'),
      history: root.querySelector('.history-list'), historyCount: root.querySelector('.history-count'), opening: root.querySelector('.opening-card'), ending: root.querySelector('.ending-copy'), restore: root.querySelector('.restore-ending'),
    };
    root.querySelector('.begin-button').addEventListener('click', () => handlers.onBegin());
    root.querySelector('.replay-button').addEventListener('click', () => handlers.onReplay());
    root.querySelector('.view-button').addEventListener('click', () => this.viewWorld());
    this.els.restore.addEventListener('click', () => this.restoreEnding());
    this.els.form.addEventListener('submit', (event) => { event.preventDefault(); handlers.onSubmit(this.els.input.value); });
  }

  get stageElement() { return this.els.stage; }

  setPhase(phase) {
    this.els.experience.dataset.phase = phase;
    if (phase !== 'opening') this.els.opening.setAttribute('aria-hidden', 'true');
  }

  renderState(state) {
    const complete = state.progress === 100;
    this.els.progressLabel.textContent = complete ? 'CIVILIZATION COMPLETE — 100%' : `DEVELOPMENT — ${state.progress}%`;
    this.els.progressBar.setAttribute('aria-valuenow', String(state.progress));
    this.els.progressFill.style.width = `${state.progress}%`;
    this.renderHistory(state.history);
  }

  renderEvent(event) {
    if (!event) return;
    this.els.speaker.textContent = event.speaker;
    this.els.eventTitle.textContent = event.title;
    this.els.eventText.textContent = event.text;
    this.els.feedback.textContent = '';
    this.els.choices.replaceChildren(...event.choices.map((choice) => {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'choice'; button.dataset.actionId = choice.id;
      button.innerHTML = `<span>${choice.label}</span><small>${choice.detail}</small>`;
      button.addEventListener('click', () => this.handlers.onAction(choice.id));
      return button;
    }));
    this.setLocked(false);
  }

  renderHistory(history) {
    this.els.historyCount.textContent = history.length;
    this.els.history.replaceChildren(...history.map((item) => {
      const block = document.createElement('div'); block.className = `history-item ${item.kind}`;
      const speaker = document.createElement('strong'); speaker.textContent = item.speaker;
      const text = document.createElement('p'); text.textContent = item.text;
      block.append(speaker, text); return block;
    }));
  }

  setLocked(locked) {
    this.els.input.disabled = locked; this.els.submit.disabled = locked;
    this.els.choices.querySelectorAll('button').forEach((button) => { button.disabled = locked; });
    this.els.experience.classList.toggle('is-resolving', locked);
    this.els.assistant.querySelector('.status').textContent = locked ? 'LOCAL SYSTEM · RESOLVING' : 'LOCAL SYSTEM · READY';
  }

  showFeedback(message, kind = 'info') {
    this.els.feedback.textContent = message; this.els.feedback.dataset.kind = kind;
  }

  acceptInput() { this.els.input.value = ''; }
  focusInput() { this.els.input.focus({ preventScroll: true }); }

  beginEnding(response) {
    this.setLocked(true); this.showFeedback(response, 'success'); this.els.assistant.querySelector('.status').textContent = 'LOCAL SYSTEM · COMPLETE';
  }

  collapseComposer() { this.setPhase('revealing'); }
  showEndingFirst() { this.setPhase('ending'); this.els.ending.classList.add('show-one'); }
  showEndingSecond() { this.els.ending.classList.add('show-two'); }
  showEndingActions() { this.els.ending.classList.add('show-actions'); }

  viewWorld() {
    this.els.ending.classList.add('hidden'); this.els.restore.classList.add('visible'); this.els.restore.focus();
  }

  restoreEnding() {
    this.els.ending.classList.remove('hidden'); this.els.restore.classList.remove('visible'); this.root.querySelector('.view-button').focus();
  }

  reset() {
    this.els.ending.className = 'ending-copy'; this.els.restore.className = 'restore-ending';
    this.setPhase('opening'); this.els.opening.removeAttribute('aria-hidden'); this.els.opening.classList.remove('leaving');
    this.els.input.value = ''; this.els.feedback.textContent = ''; this.setLocked(false);
  }
}

