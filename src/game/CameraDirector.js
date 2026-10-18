import { LANDSCAPE_BOUNDS, SETTLEMENT_BOUNDS } from '../data/worldLayout.js';

const frameFor = (width, height, bounds, paddingRatio) => {
  const px = width * paddingRatio;
  const py = height * paddingRatio;
  const zoom = Math.min((width - 2 * px) / bounds.width, (height - 2 * py) / bounds.height);
  return { zoom, x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
};

export class CameraDirector {
  constructor(scene) {
    this.scene = scene;
    this.mode = 'opening';
    this.revealProgress = 0;
    this.revealing = false;
  }

  get size() {
    return { width: this.scene.scale.width, height: this.scene.scale.height };
  }

  openingFrame() {
    const { width, height } = this.size;
    const padding = width / height > 2 ? 0.08 : 0.06;
    const px = width * padding; const py = height * padding;
    const zoom = Math.max((width - 2 * px) / SETTLEMENT_BOUNDS.width, (height - 2 * py) / SETTLEMENT_BOUNDS.height);
    return { zoom, x: SETTLEMENT_BOUNDS.x + SETTLEMENT_BOUNDS.width / 2, y: SETTLEMENT_BOUNDS.y + SETTLEMENT_BOUNDS.height / 2 };
  }

  finalFrame() {
    const { width, height } = this.size;
    return frameFor(width, height, LANDSCAPE_BOUNDS, 0.065);
  }

  apply(frame) {
    const camera = this.scene.cameras.main;
    camera.setZoom(frame.zoom);
    camera.centerOn(frame.x, frame.y);
  }

  showOpening() {
    this.mode = 'opening'; this.revealing = false; this.revealProgress = 0;
    this.scene.cameras.main.stopFollow();
    this.apply(this.openingFrame());
  }

  showFinal() {
    this.mode = 'final'; this.revealing = false; this.revealProgress = 1;
    this.apply(this.finalFrame());
  }

  reveal({ duration = 7000, reducedMotion = false, onComplete } = {}) {
    const camera = this.scene.cameras.main;
    this.mode = 'reveal'; this.revealing = true; this.revealProgress = 0;
    if (reducedMotion) {
      this.apply(this.finalFrame()); this.mode = 'final'; this.revealing = false; this.revealProgress = 1;
      this.scene.time.delayedCall(350, () => onComplete?.());
      return;
    }
    const start = { zoom: camera.zoom, x: camera.midPoint.x, y: camera.midPoint.y };
    this.scene.tweens.addCounter({
      from: 0, to: 1, duration, ease: 'Sine.easeInOut',
      onUpdate: (tween) => {
        const value = tween.getValue(); this.revealProgress = value;
        const target = this.finalFrame();
        camera.setZoom(Phaser.Math.Linear(start.zoom, target.zoom, value)); camera.centerOn(Phaser.Math.Linear(start.x, target.x, value), Phaser.Math.Linear(start.y, target.y, value));
      },
      onComplete: () => { this.mode = 'final'; this.revealing = false; this.revealProgress = 1; this.apply(this.finalFrame()); onComplete?.(); },
    });
  }

  resize() {
    if (this.mode === 'opening') this.showOpening();
    else if (this.mode === 'final') this.showFinal();
    else if (this.mode === 'reveal') {
      const opening = this.openingFrame(); const final = this.finalFrame(); const p = this.revealProgress;
      this.apply({ zoom: Phaser.Math.Linear(opening.zoom, final.zoom, p), x: Phaser.Math.Linear(opening.x, final.x, p), y: Phaser.Math.Linear(opening.y, final.y, p) });
    }
  }
}

