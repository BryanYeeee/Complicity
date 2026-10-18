import Phaser from 'phaser';
import { PALETTE } from '../data/palette.js';
import { PLOTS, FOREST_PATCHES, REEDBANK_HOMES, RIVER_POINTS, ROAD_POINTS, LANDMARKS } from '../data/worldLayout.js';
import { CameraDirector } from './CameraDirector.js';
import { assetRegistry } from './AssetRegistry.js';
import { BUILDING_CATALOG } from '../data/buildingCatalog.js';
import { validatePlacement } from './SettlementBuilder.js';

const seeded = (index, salt = 0) => {
  const x = Math.sin(index * 999 + salt * 71) * 43758.5453;
  return x - Math.floor(x);
};

export class WorldScene extends Phaser.Scene {
  constructor({ getState, onReady, onPlacementChange, onSelectionChange }) {
    super({ key: 'WorldScene' });
    this.getState = getState;
    this.onWorldReady = onReady;
    this.onPlacementChange = onPlacementChange;
    this.onSelectionChange = onSelectionChange;
    this.revealMode = false;
  }

  preload() { assetRegistry.preload(this); }

  create() {
    this.cameras.main.setBackgroundColor(0x171c19);
    this.terrain = this.add.graphics();
    this.details = this.add.graphics();
    this.labels = this.add.container();
    this.ambient = this.add.container();
    this.effectObjects = this.add.container().setDepth(50);
    this.interaction = this.add.graphics().setDepth(45);
    this.cameraDirector = new CameraDirector(this);
    this.draw(this.getState());
    this.createAmbientMotion();
    this.cameraDirector.showOpening();
    this.scale.on('resize', () => this.cameraDirector.resize());
    this.input.on('pointermove', (pointer) => this.handlePointerMove(pointer));
    this.input.on('pointerdown', (pointer) => this.handlePointerDown(pointer));
    this.onWorldReady?.(this);
  }

  updateState(state) { this.draw(state); }

  beginPlacement(type, { preferred = null, movingId = null, nearPlotId = null, proposalId = 0 } = {}) {
    this.selectedBuildingId = null; this.onSelectionChange?.(null);
    this.placement = { type, plotId: null, valid: false, reason: 'Choose a glowing plot in the world.', movingId, preferred, nearPlotId, proposalId, mode: 'selected' };
    const available = PLOTS.filter((plot) => BUILDING_CATALOG[type]?.allowedPlots.includes(plot.kind));
    const ranked = [...available].sort((a, b) => {
      if (preferred === 'river') return Math.abs(a.y - 620) - Math.abs(b.y - 620);
      if (preferred === 'far-river') return Math.abs(b.y - 620) - Math.abs(a.y - 620);
      if (preferred === 'trees') return a.x - b.x;
      if (nearPlotId) { const near = PLOTS.find((plot) => plot.id === nearPlotId); if (near) return Math.hypot(a.x - near.x, a.y - near.y) - Math.hypot(b.x - near.x, b.y - near.y); }
      if (preferred === 'homes') return Math.hypot(a.x - 1660, a.y - 500) - Math.hypot(b.x - 1660, b.y - 500);
      return Math.hypot(a.x - 1640, a.y - 570) - Math.hypot(b.x - 1640, b.y - 570);
    });
    const candidate = ranked.find((plot) => validatePlacement(this.getState(), type, plot.id, movingId).ok);
    if (candidate) this.setPlacementPlot(candidate.id, 'selected'); else { this.placement.reason = `No legal ${BUILDING_CATALOG[type]?.noun.toLowerCase()} site is available.`; this.renderInteraction(); this.onPlacementChange?.({ ...this.placement }); }
  }

  cancelPlacement() { this.placement = null; this.interaction?.clear(); this.onPlacementChange?.(null); }
  getPlacement() { return this.placement ? { ...this.placement } : null; }
  clearSelection() { this.selectedBuildingId = null; this.renderInteraction(); this.onSelectionChange?.(null); }
  getSelectedBuilding() { return this.getState().world.buildings.find((item) => item.id === this.selectedBuildingId) || null; }
  beginMoveSelected() { const building = this.getSelectedBuilding(); if (building?.movable) this.beginPlacement(building.type, { movingId: building.id }); }

  setPlacementPlot(plotId, mode = 'selected') {
    if (!this.placement) return;
    const result = validatePlacement(this.getState(), this.placement.type, plotId, this.placement.movingId);
    this.placement = { ...this.placement, plotId, valid: result.ok, mode, reason: result.ok ? null : result.reason };
    this.renderInteraction(); this.onPlacementChange?.({ ...this.placement });
  }

  cyclePlacement(preferred = null) {
    if (!this.placement) return false;
    const definition = BUILDING_CATALOG[this.placement.type]; const current = this.placement.plotId;
    let candidates = PLOTS.filter((plot) => definition?.allowedPlots.includes(plot.kind) && validatePlacement(this.getState(), this.placement.type, plot.id, this.placement.movingId).ok);
    if (preferred === 'river') candidates.sort((a, b) => Math.abs(a.y - 620) - Math.abs(b.y - 620));
    else if (preferred === 'far-river') candidates.sort((a, b) => Math.abs(b.y - 620) - Math.abs(a.y - 620));
    else if (preferred === 'trees') candidates.sort((a, b) => a.x - b.x);
    const index = candidates.findIndex((plot) => plot.id === current); const next = preferred ? candidates.find((plot) => plot.id !== current) : candidates[(index + 1 + candidates.length) % candidates.length];
    if (!next || next.id === current) return false; this.setPlacementPlot(next.id, 'selected'); return true;
  }

  changePlacementLocation() { if (!this.placement) return false; this.placement = { ...this.placement, mode: 'preview', reason: null }; this.renderInteraction(); this.onPlacementChange?.({ ...this.placement }); return true; }

  nearestPlot(worldX, worldY) {
    return PLOTS.map((plot) => ({ plot, distance: Math.hypot(plot.x - worldX, plot.y - worldY) })).sort((a, b) => a.distance - b.distance)[0];
  }

  screenForPlot(plotId) {
    const plot = PLOTS.find((item) => item.id === plotId); if (!plot) return null;
    const camera = this.cameras.main; const bounds = this.game.canvas.getBoundingClientRect();
    return { x: bounds.left + (plot.x - camera.worldView.x) * camera.zoom, y: bounds.top + (plot.y - camera.worldView.y) * camera.zoom };
  }

  handlePointerMove(pointer) {
    if (!this.placement || this.placement.mode !== 'preview') return; const world = pointer.positionToCamera(this.cameras.main); const nearest = this.nearestPlot(world.x, world.y);
    if (nearest && nearest.distance < 115 && nearest.plot.id !== this.placement.plotId) this.setPlacementPlot(nearest.plot.id, 'preview');
  }

  handlePointerDown(pointer) {
    const world = pointer.positionToCamera(this.cameras.main);
    if (this.placement) { const nearest = this.nearestPlot(world.x, world.y); if (nearest?.distance < 150) this.setPlacementPlot(nearest.plot.id, 'selected'); return; }
    const building = this.getState().world.buildings.map((item) => ({ item, plot: PLOTS.find((plot) => plot.id === item.plotId) })).filter((entry) => entry.plot).map((entry) => ({ ...entry, distance: Math.hypot(entry.plot.x - world.x, entry.plot.y - world.y) })).sort((a, b) => a.distance - b.distance)[0];
    if (building?.distance < 75) { this.selectedBuildingId = building.item.id; this.renderInteraction(); this.onSelectionChange?.(building.item); } else this.clearSelection();
  }

  renderInteraction() {
    const g = this.interaction; if (!g) return; g.clear();
    if (this.placement) {
      const definition = BUILDING_CATALOG[this.placement.type];
      for (const plot of PLOTS) {
        if (!definition?.allowedPlots.includes(plot.kind)) continue;
        const check = validatePlacement(this.getState(), this.placement.type, plot.id, this.placement.movingId);
        g.fillStyle(check.ok ? 0xc8e08d : 0xad5e4d, check.ok ? 0.18 : 0.08).fillCircle(plot.x, plot.y - 10, 48);
        g.lineStyle(3, check.ok ? 0xc8e08d : 0xad5e4d, check.ok ? 0.8 : 0.35).strokeCircle(plot.x, plot.y - 10, 48);
      }
      const plot = PLOTS.find((item) => item.id === this.placement.plotId);
      if (plot) {
        g.fillStyle(this.placement.valid ? 0xc8e08d : 0xc46f58, 0.27).fillCircle(plot.x, plot.y - 10, 58);
        g.lineStyle(this.placement.mode === 'selected' ? 7 : 4, this.placement.valid ? 0xf3f7d7 : 0xff9478, 1).strokeCircle(plot.x, plot.y - 10, 58);
        assetRegistry.draw(this, g, this.placement.type === 'courtyard' ? 'apartments' : this.placement.type === 'cottage' ? 'home' : ['workshop', 'factory'].includes(this.placement.type) ? 'workshop' : ['solar', 'turbine', 'cistern', 'reedbed', 'pump', 'powerplant', 'waste'].includes(this.placement.type) ? 'utility' : 'service', plot.x, plot.y, { scale: 1, alpha: 0.55 });
      }
    } else if (this.selectedBuildingId) {
      const building = this.getSelectedBuilding(); const plot = PLOTS.find((item) => item.id === building?.plotId);
      if (plot) g.lineStyle(5, 0xf1cf85, 1).strokeCircle(plot.x, plot.y - 12, 54);
    }
  }

  transition(previousState, nextState, effects, reducedMotion = false) {
    this.cancelTransitions();
    const duration = reducedMotion ? 180 : effects.durationMs;
    const [x, y] = effects.location;
    const overlay = this.add.graphics().setDepth(51); this.effectObjects.add(overlay);
    const marker = this.add.ellipse(x, y, effects.kind === 'route' ? 74 : 120, effects.kind === 'route' ? 34 : 62, PALETTE.light, 0.18).setStrokeStyle(4, PALETTE.light, 0.95).setDepth(52);
    this.effectObjects.add(marker);
    this.spawnEffectParticles(x, y, effects.kind, duration, reducedMotion);
    if (effects.path) this.drawPolyline(overlay, effects.path, effects.kind === 'connection' ? 9 : 13, PALETTE.light, 0.78);
    if (effects.kind === 'construction' || effects.kind === 'conversion') {
      overlay.fillStyle(PALETTE.soil, 0.65).fillRoundedRect(x - 72, y - 20, 144, 22, 5);
      overlay.lineStyle(5, PALETTE.industry, 0.75).strokeRect(x - 54, y - 104, 108, 90).lineBetween(x, y - 104, x, y - 14).lineBetween(x - 54, y - 64, x + 54, y - 64);
    } else if (effects.kind === 'extraction') {
      overlay.fillStyle(PALETTE.soil, 0.8).fillRoundedRect(x - 92, y - 25, 184, 30, 8);
      for (let i = 0; i < 5; i += 1) overlay.fillStyle(0x8d674e, 1).fillRect(x - 75 + i * 30, y - 42 - (i % 2) * 8, 24, 10);
    } else if (effects.kind === 'restoration') {
      for (let i = 0; i < 9; i += 1) overlay.fillStyle(PALETTE.vegetation, 0.9).fillCircle(x - 80 + i * 20, y - (i % 2) * 15, 6);
    } else if (effects.kind === 'relocation' || effects.kind === 'arrival') {
      for (let i = 0; i < Math.min(4, effects.targets?.length || 4); i += 1) assetRegistry.draw(this, overlay, 'resident', x - 45 + i * 30, y, { scale: 0.9, variant: effects.kind === 'arrival' ? 'active' : 'displaced' });
    }
    let committed = false;
    this.effectTimer = this.time.delayedCall(Math.round(duration * 0.48), () => { committed = true; this.draw(nextState); this.createAmbientMotion(); });
    return new Promise((resolve) => {
      this.effectTween = this.tweens.add({ targets: marker, alpha: { from: 1, to: 0 }, scaleX: { from: 0.72, to: 1.28 }, scaleY: { from: 0.72, to: 1.28 }, duration, ease: 'Sine.easeOut',
        onComplete: () => { if (!committed) { this.draw(nextState); this.createAmbientMotion(); } this.effectObjects.removeAll(true); this.effectTween = null; this.effectTimer = null; resolve(); },
      });
    });
  }

  cancelTransitions() {
    if (this.effectTween) { this.effectTween.stop(); this.effectTween = null; }
    if (this.effectTimer) { this.effectTimer.remove(false); this.effectTimer = null; }
    this.effectObjects?.removeAll(true);
  }

  draw(state) {
    const g = this.terrain; const d = this.details;
    g.clear(); d.clear(); this.labels.removeAll(true);
    if (this.revealMode) this.drawGround(g); else this.drawDevelopmentGround(g);
    this.drawRiver(g, state);
    this.drawRoad(g, state);
    if (this.revealMode) { this.drawPinebank(g, d, state); this.drawCorridor(g, d, state); this.drawReedbank(g, d, state); this.drawConnections(g, d, state); }
    this.drawSettlement(g, d, state);
    this.drawLandmarks(g, d);
    this.drawPeople(d, state);
    this.renderInteraction();
  }

  drawDevelopmentGround(g) {
    g.fillStyle(0xa9c289, 1).fillRect(690, 100, 1940, 1030);
    g.fillStyle(0xf3d98a, .08).fillRect(760, 170, 1800, 850);
    for (let i = 0; i < 34; i += 1) g.fillStyle(i % 3 ? 0xb8cf8c : 0xe1cf82, .42).fillCircle(820 + seeded(i, 72) * 1680, 250 + seeded(i, 73) * 680, 3 + seeded(i, 74) * 3);
  }

  prepareReveal() { this.revealMode = true; this.draw(this.getState()); this.createAmbientMotion(); }
  resetReveal() { this.revealMode = false; this.draw(this.getState()); this.createAmbientMotion(); }

  drawGround(g) {
    g.fillStyle(0x2a2924, 1).fillRoundedRect(80, 220, 3040, 730, 130);
    g.fillStyle(0x5b3b31, .78).fillEllipse(520, 570, 1040, 700);
    g.fillStyle(0x4c4a29, .82).fillEllipse(2660, 620, 980, 650);
    g.fillStyle(0xf0dc9b, .18).fillEllipse(1640, 590, 1440, 740);
    for (let i = 0; i < 38; i += 1) {
      const x = 120 + seeded(i, 2) * 2960; const y = 270 + seeded(i, 8) * 610;
      g.fillStyle(0xffffff, 0.08).fillCircle(x, y, 5 + seeded(i, 3) * 12);
    }
    g.lineStyle(3, 0x806451, 0.45).strokeRoundedRect(95, 235, 3010, 700, 120);
  }

  drawPolyline(g, points, width, color, alpha = 1) {
    g.lineStyle(width, color, alpha).beginPath().moveTo(points[0][0], points[0][1]);
    points.slice(1).forEach(([x, y]) => g.lineTo(x, y)); g.strokePath();
  }

  drawRiver(g, state) {
    this.drawPolyline(g, RIVER_POINTS, 80, 0xd8d3bd, 0.7);
    const split = 6;
    this.drawPolyline(g, RIVER_POINTS.slice(0, split + 1), 54, PALETTE.water, 1);
    const downstream = RIVER_POINTS.slice(split);
    const color = state.regions.reedbank.contamination > 5 ? PALETTE.polluted : PALETTE.water;
    const width = 54 * Math.max(0.62, state.regions.reedbank.flow / 100);
    this.drawPolyline(g, downstream, width, color, 1);
    this.drawPolyline(g, RIVER_POINTS.map(([x, y]) => [x + 8, y - 8]), 3, 0xe8f1e8, 0.65);
    if (state.regions.reedbank.restored) {
      g.fillStyle(PALETTE.water, 0.48).fillEllipse(2700, 705, 390, 135);
      for (let i = 0; i < 20; i += 1) g.fillStyle(PALETTE.vegetation, 0.8).fillRect(2510 + i * 20, 640 + (i % 3) * 18, 4, 45);
    }
  }

  drawRoad(g, state) {
    const width = state.road.width === 2 ? 45 : 24;
    this.drawPolyline(g, ROAD_POINTS, width + 8, 0xe1d9c7, 1);
    this.drawPolyline(g, ROAD_POINTS, width, PALETTE.road, 0.9);
    if (state.road.width === 2) this.drawPolyline(g, ROAD_POINTS, 2, 0xf0e3c7, 0.8);
  }

  tree(g, x, y, scale = 1, living = true) {
    if (!living) {
      g.lineStyle(5 * scale, 0x6e5a49, 1).lineBetween(x, y, x, y - 27 * scale).lineBetween(x, y - 18 * scale, x - 10 * scale, y - 28 * scale);
      return;
    }
    g.fillStyle(0x5f5849, 1).fillRect(x - 3 * scale, y - 21 * scale, 6 * scale, 25 * scale);
    g.fillStyle(PALETTE.forest, 1).fillTriangle(x, y - 67 * scale, x - 23 * scale, y - 14 * scale, x + 23 * scale, y - 14 * scale);
    g.fillStyle(PALETTE.vegetation, 0.75).fillTriangle(x, y - 51 * scale, x - 27 * scale, y - 2 * scale, x + 27 * scale, y - 2 * scale);
  }

  drawPinebank(g, d, state) {
    const remaining = Math.round(59 * state.regions.pinebank.vegetation / 100);
    if (state.regions.pinebank.quarry > 0) {
      const q = state.regions.pinebank.quarry;
      g.fillStyle(PALETTE.soil, 0.92).fillEllipse(555, 615, 280 + q * 5, 150 + q * 2);
      g.lineStyle(8, 0x8e5d48, 0.8).strokeEllipse(555, 615, 220 + q * 4, 105 + q * 2);
      g.lineStyle(5, 0x795947, 0.7).strokeEllipse(555, 620, 145 + q * 3, 68 + q).strokeEllipse(555, 626, 76 + q * 2, 34 + q);
      g.lineStyle(9, PALETTE.road, 0.75).lineBetween(690, 660, 970, 800);
    }
    for (let i = 0; i < 59; i += 1) {
      const patch = FOREST_PATCHES[i % FOREST_PATCHES.length];
      const x = patch.x - 100 + seeded(i, 4) * 220; const y = patch.y + seeded(i, 6) * 260;
      assetRegistry.draw(this, d, 'tree', x, y, { scale: 0.72 + seeded(i, 1) * 0.45, variant: i < remaining ? 'active' : 'stump' });
    }
    if (state.materials.factory) this.factory(d, 690, 690, 1.05);
    if (state.materials.workshop) this.workshop(d, 820, 705);
    if (state.regions.pinebank.restored) {
      g.lineStyle(4, PALETTE.vegetation, 0.8).strokeEllipse(430, 510, 390, 250);
      for (let i = 0; i < 12; i += 1) assetRegistry.draw(this, d, 'tree', 300 + i * 31, 620 - (i % 3) * 18, { scale: 0.5, variant: 'young' });
    }
    this.regionLabel('PINEBANK', 520, 250);
  }

  drawCorridor(g, d, state) {
    g.fillStyle(0x341f22, 0.76).fillRoundedRect(800, 842, 1540, 196, 60);
    g.fillStyle(0x722f2b, Math.min(.32, .08 + state.regions.corridor.industry / 180)).fillEllipse(1590, 930, 1620, 260);
    const units = Math.min(8, 2 + Math.round(state.regions.corridor.industry / 8));
    for (let i = 0; i < units; i += 1) {
      const x = 940 + i * 175;
      d.fillStyle(PALETTE.industry, 0.92).fillRect(x, 915 - (i % 2) * 16, 92, 65 + (i % 2) * 16);
      d.fillStyle(PALETTE.light, 0.85).fillRect(x + 13, 936, 18, 12).fillRect(x + 42, 936, 18, 12);
      if (i < state.regions.corridor.smoke) d.fillStyle(PALETTE.industry, 0.5).fillCircle(x + 78, 880 - i * 3, 18).fillCircle(x + 84, 852 - i * 2, 13);
    }
    g.lineStyle(11, 0x716b61, 0.65).lineBetween(820, 985, 2320, 985);
    for (let x = 890; x < 2280; x += 58) g.fillStyle(0x5b5d58, 0.65).fillRect(x, 978, 30, 13);
    this.regionLabel('SERVICE CORRIDOR', 1580, 1005);
  }

  createOuterFireEffect() {
    if (!this.revealMode || !this.ambient) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const fire = this.add.container().setDepth(51);
    const layers = [
      { count: 9, color: 0x9d3f24, width: 32, height: 72, alpha: 0.8, speed: 1450 },
      { count: 13, color: 0xe36a2e, width: 23, height: 54, alpha: 0.9, speed: 1050 },
      { count: 17, color: 0xffc15a, width: 15, height: 36, alpha: 0.95, speed: 760 },
    ];
    const startX = 930;
    const spacing = 132;
    const baseY = 963;

    layers.forEach((layer, layerIndex) => {
      for (let i = 0; i < (reduced ? Math.ceil(layer.count / 2) : layer.count); i += 1) {
        const x = startX + i * spacing + layerIndex * 19 + (seeded(i, 80 + layerIndex) - 0.5) * 42;
        const height = layer.height * (0.72 + seeded(i, 90 + layerIndex) * 0.5);
        const width = layer.width * (0.8 + seeded(i, 100 + layerIndex) * 0.35);
        const flame = this.add.graphics();
        flame.fillStyle(layer.color, layer.alpha);
        flame.fillTriangle(0, 0, -width, 0, width * 0.18, -height);
        flame.fillTriangle(0, 0, width, 0, -width * 0.18, -height * 0.7);
        flame.x = x;
        flame.y = baseY;
        fire.add(flame);
        if (!reduced) {
          this.tweens.add({
            targets: flame,
            scaleX: { from: 0.84, to: 1.16 },
            scaleY: { from: 0.86, to: 1.12 },
            angle: { from: -5, to: 5 },
            alpha: { from: layer.alpha * 0.7, to: layer.alpha },
            duration: layer.speed + seeded(i, 110 + layerIndex) * 420,
            delay: -seeded(i, 120 + layerIndex) * 1600,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
          });
        }
      }
    });
    this.ambient.add(fire);
  }

  drawReedbank(g, d, state) {
    const damage = state.regions.reedbank.bankDamage;
    const systemicStrain = (100 - state.regions.reedbank.flow) + state.regions.reedbank.contamination * 3 + Math.floor(state.regions.pinebank.quarry / 3);
    if (damage > 0) {
      g.fillStyle(PALETTE.soil, Math.min(0.9, 0.25 + damage / 50)).fillEllipse(2620, 620, 280 + damage * 4, 115 + damage * 2);
    }
    if (!state.regions.reedbank.restored) g.fillStyle(0x4f592e, .18 + Math.min(.22, (100 - state.regions.reedbank.flow) / 120)).fillEllipse(2700, 650, 830, 560);
    for (let i = 0; i < 34; i += 1) {
      const x = 2330 + seeded(i, 9) * 690; const y = 590 + seeded(i, 10) * 220;
      const alive = damage < 18 || i > damage;
      if (alive) d.fillStyle(i % 2 ? PALETTE.vegetation : PALETTE.forest, 0.85).fillRect(x, y, 5, 32 + seeded(i, 4) * 26);
      else d.lineStyle(3, 0x6e5a49, 0.9).lineBetween(x, y + 25, x, y + 6);
    }
    for (const [index, home] of REEDBANK_HOMES.entries()) {
      if (state.regions.reedbank.displacedHomes.includes(home.id) || systemicStrain > 28 + index * 14) this.foundation(d, home.x, home.y);
      else this.home(d, home.x, home.y, 0.72);
    }
    const stressed = state.regions.reedbank.flow < 90 && !state.regions.reedbank.restored;
    for (let row = 0; row < 3; row += 1) {
      g.fillStyle(stressed ? 0xb99b6c : 0x91a56d, 0.72).fillRect(2390 + row * 135, 785, 112, 58);
      for (let line = 0; line < 5; line += 1) g.lineStyle(2, stressed ? 0x8f714c : 0x667d54, 0.7).lineBetween(2400 + row * 135, 794 + line * 10, 2490 + row * 135, 794 + line * 10);
    }
    if (stressed) for (let i = 0; i < 5; i += 1) assetRegistry.draw(this, d, 'resident', 2850 + i * 16, 690, { scale: 0.75, variant: 'displaced' });
    if (state.regions.reedbank.contamination > 2) {
      g.fillStyle(0x657335, .72).fillEllipse(2820, 690, 330 + state.regions.reedbank.contamination * 12, 95 + state.regions.reedbank.contamination * 4);
      for (let i = 0; i < 8; i += 1) g.fillStyle(0xb0b85b, .32).fillCircle(2690 + i * 35, 680 + (i % 3) * 13, 9 + (i % 2) * 5);
    }
    this.regionLabel('REEDBANK', 2730, 350);
  }

  drawConnections(g, d, state) {
    if ((state.resources?.spentTimber || 0) + (state.resources?.spentStone || 0) > 0) {
      const load = Math.min(18, 5 + Math.round((state.resources.spentTimber + state.resources.spentStone) / 28));
      g.lineStyle(load + 7, 0x2d2724, .72).beginPath().moveTo(520, 720).lineTo(930, 820).lineTo(1230, 720).lineTo(1500, 660).strokePath();
      g.lineStyle(3, 0xc78555, .75).beginPath().moveTo(520, 720).lineTo(930, 820).lineTo(1230, 720).lineTo(1500, 660).strokePath();
      g.lineStyle(8, 0x575d43, .8).beginPath().moveTo(1750, 650).lineTo(2200, 730).lineTo(2730, 760).strokePath();
    }
    if (state.world.connections.includes('extended-intake') || state.world.connections.includes('second-intake')) {
      g.lineStyle(state.world.connections.includes('second-intake') ? 14 : 9, PALETTE.polluted, 0.9).beginPath().moveTo(1620, 600).lineTo(1580, 500).lineTo(1480, 500).strokePath();
    }
    if (state.world.connections.includes('new-power-line') || state.energy.outerConnection) {
      for (let x = 1050; x <= 2200; x += 230) {
        d.lineStyle(5, PALETTE.industry, 0.9).lineBetween(x, 900, x, 760).lineBetween(x - 24, 790, x + 24, 790);
      }
      d.lineStyle(2, PALETTE.industry, 0.75).lineBetween(1050, 790, 2200, 790);
    }
    if (state.world.connections.includes('reedbank-service') || state.world.connections.includes('shared-capacity')) {
      g.lineStyle(7, PALETTE.vegetation, 0.9).beginPath().moveTo(2060, 770).lineTo(2420, 800).lineTo(2810, 720).strokePath();
    }
    if (state.world.connections.includes('freight-highway')) {
      g.lineStyle(34, 0x4d514e, .95).beginPath().moveTo(120, 880).lineTo(930, 800).lineTo(1500, 700).lineTo(2240, 820).lineTo(3070, 850).strokePath();
      g.lineStyle(3, 0xe8d991, .8).beginPath().moveTo(120, 880).lineTo(930, 800).lineTo(1500, 700).lineTo(2240, 820).lineTo(3070, 850).strokePath();
    }
    if (state.world.connections.includes('water-service')) g.lineStyle(10, 0x517a78, .9).beginPath().moveTo(1640, 610).lineTo(2250, 690).lineTo(2780, 700).strokePath();
  }

  drawSettlement(g, d, state) {
    const developed = state.world.buildings.length > 0;
    if (this.revealMode) {
      g.fillStyle(0xf3d98a, developed ? .16 : .07).fillEllipse(1640, 585, 1320, 690);
      g.fillStyle(developed ? 0xaec78e : 0x8ba173, developed ? 0.82 : .48).fillEllipse(1640, 600, 1190, 610);
    }
    if (developed) {
      if (this.revealMode) g.lineStyle(9, 0xd8d0b9, .7).strokeEllipse(1640, 610, 950, 420);
      g.lineStyle(5, PALETTE.road, 0.8).beginPath().moveTo(1060, 705).lineTo(1450, 580).lineTo(1730, 620).lineTo(2230, 530).strokePath();
    } else {
      for (let i = 0; i < 26; i += 1) g.fillStyle(i % 3 ? 0xb8cf8c : 0xe1cf82, .55).fillCircle(1200 + seeded(i, 70) * 880, 420 + seeded(i, 71) * 340, 3);
    }
    for (const building of state.world.buildings) {
      const plot = PLOTS.find((item) => item.id === building.plotId);
      if (!plot) continue;
      const type = building.type;
      if (type === 'home') assetRegistry.draw(this, d, 'home', plot.x, plot.y);
      else if (type === 'apartments') assetRegistry.draw(this, d, 'apartments', plot.x, plot.y);
      else if (type.includes('service') || type === 'service') assetRegistry.draw(this, d, 'service', plot.x, plot.y, { variant: type === 'expanded-service' ? 'upgraded' : 'active' });
      else if (type === 'utility') assetRegistry.draw(this, d, 'utility', plot.x, plot.y);
      else if (type === 'depot') assetRegistry.draw(this, d, 'depot', plot.x, plot.y);
      else if (type === 'cottage') assetRegistry.draw(this, d, 'home', plot.x, plot.y, { variant: 'active' });
      else if (type === 'courtyard') assetRegistry.draw(this, d, 'apartments', plot.x, plot.y, { variant: 'active' });
      else if (type === 'solar') { assetRegistry.draw(this, d, 'utility', plot.x, plot.y); d.fillStyle(0x486d72, 1).fillRect(plot.x - 43, plot.y - 55, 86, 13); }
      else if (type === 'turbine') { d.lineStyle(8, 0xe4e6d9, 1).lineBetween(plot.x, plot.y, plot.x, plot.y - 120); d.lineStyle(4, 0xe4e6d9, 1).lineBetween(plot.x, plot.y - 120, plot.x - 42, plot.y - 148).lineBetween(plot.x, plot.y - 120, plot.x + 48, plot.y - 136).lineBetween(plot.x, plot.y - 120, plot.x - 4, plot.y - 70); }
      else if (type === 'cistern') { d.fillStyle(0x83b7bb, 1).fillEllipse(plot.x, plot.y - 30, 94, 48); d.lineStyle(5, 0xe7f2e8, .8).strokeEllipse(plot.x, plot.y - 30, 94, 48); }
      else if (type === 'reedbed') { d.fillStyle(0x78a77c, .9).fillEllipse(plot.x, plot.y - 12, 120, 46); for (let i = 0; i < 8; i += 1) d.lineStyle(3, 0x496c59, 1).lineBetween(plot.x - 45 + i * 13, plot.y - 12, plot.x - 45 + i * 13, plot.y - 52 - (i % 3) * 8); }
      else if (type === 'garden') { d.fillStyle(0x93bc75, .82).fillEllipse(plot.x, plot.y - 10, 118, 54); for (let i = 0; i < 9; i += 1) d.fillStyle(i % 2 ? 0xf0c36a : 0xd97978, .9).fillCircle(plot.x - 44 + i * 11, plot.y - 24 + (i % 3) * 10, 4); }
      else if (type === 'workshop') assetRegistry.draw(this, d, 'workshop', plot.x, plot.y);
      else if (type === 'market') { assetRegistry.draw(this, d, 'service', plot.x, plot.y, { variant: 'upgraded' }); d.fillStyle(0xd46f58, 1).fillTriangle(plot.x - 42, plot.y - 52, plot.x - 18, plot.y - 70, plot.x + 4, plot.y - 52).fillTriangle(plot.x + 4, plot.y - 52, plot.x + 25, plot.y - 70, plot.x + 45, plot.y - 52); }
      else if (type === 'depot' || type === 'logging') { assetRegistry.draw(this, d, 'depot', plot.x, plot.y); if (type === 'logging') for (let i = 0; i < 5; i += 1) d.fillStyle(0x8c6548, 1).fillRect(plot.x - 52 + i * 21, plot.y - 16, 16, 8); }
      else if (type === 'factory' || type === 'powerplant') { assetRegistry.draw(this, d, 'factory', plot.x, plot.y); d.fillStyle(type === 'powerplant' ? 0xd8c36f : 0x9d5044, 1).fillRect(plot.x + 27, plot.y - 98, 13, 68); }
      else if (type === 'pump') { assetRegistry.draw(this, d, 'utility', plot.x, plot.y); d.lineStyle(8, 0x75aeb2, 1).strokeCircle(plot.x, plot.y - 46, 30); }
      else if (type === 'highway') { d.lineStyle(28, 0x5d625e, 1).lineBetween(plot.x - 75, plot.y - 38, plot.x + 78, plot.y + 4); d.lineStyle(3, 0xeee5b8, .9).lineBetween(plot.x - 65, plot.y - 35, plot.x + 70, plot.y + 2); }
      else if (type === 'waste') { assetRegistry.draw(this, d, 'utility', plot.x, plot.y); d.fillStyle(0x78914c, .85).fillEllipse(plot.x + 35, plot.y - 12, 82, 27); }
      if ((building.level || 1) > 1) { d.lineStyle(4, 0xf1cf85, .95).strokeRoundedRect(plot.x - 52, plot.y - 72, 104, 76, 5); d.fillStyle(0xf1cf85, .9).fillCircle(plot.x + 40, plot.y - 64, 6); }
    }
    if (state.energy.rooftop) {
      state.world.buildings.filter((building) => building.type === 'home' || building.type === 'apartments').forEach((building) => {
        const plot = PLOTS.find((item) => item.id === building.plotId); if (plot) d.fillStyle(0x506a6d, 1).fillRect(plot.x - 23, plot.y - 51, 45, 9);
      });
    }
    if (state.world.buildings.some((building) => building.id === 'clinic-commons')) this.service(d, 1730, 690, true);
    if (state.world.buildings.some((building) => building.id === 'arrival-court')) this.apartments(d, 2160, 520, 1.05);
    if (state.world.buildings.some((building) => building.id === 'final-pavilion')) this.service(d, 1970, 650, false, 0.85);
    this.regionLabel(developed ? 'THE SETTLEMENT' : 'OPEN MEADOW', 1640, 335);
  }

  home(g, x, y, scale = 1) { assetRegistry.draw(this, g, 'home', x, y, { scale }); }

  apartments(g, x, y, scale = 1) { assetRegistry.draw(this, g, 'apartments', x, y, { scale }); }

  service(g, x, y, expanded = false, scale = 1) { assetRegistry.draw(this, g, 'service', x, y, { scale, variant: expanded ? 'upgraded' : 'active' }); }

  workshop(g, x, y, depot = false) { assetRegistry.draw(this, g, depot ? 'depot' : 'workshop', x, y); }

  factory(g, x, y, scale = 1) { assetRegistry.draw(this, g, 'factory', x, y, { scale }); }

  utility(g, x, y) { assetRegistry.draw(this, g, 'utility', x, y); }

  foundation(g, x, y) {
    g.fillStyle(0xb3a58b, 0.85).fillRect(x - 34, y - 10, 68, 12);
    g.lineStyle(3, 0x80685a, 0.8).strokeRect(x - 34, y - 10, 68, 12);
    g.fillStyle(0x80685a, 0.8).fillRect(x - 21, y - 22, 5, 12).fillRect(x + 17, y - 22, 5, 12);
  }

  drawLandmarks(g, d) {
    const bridge = LANDMARKS.bridge;
    d.lineStyle(18, 0x8b8170, 1).lineBetween(bridge.x - 55, bridge.y - 30, bridge.x + 55, bridge.y + 22);
    d.lineStyle(4, 0xd7c9ac, 1).lineBetween(bridge.x - 55, bridge.y - 35, bridge.x + 55, bridge.y + 17);
    const tree = LANDMARKS.forkedTree;
    d.lineStyle(10, 0x5f5849, 1).lineBetween(tree.x, tree.y, tree.x, tree.y - 83).lineBetween(tree.x, tree.y - 54, tree.x - 28, tree.y - 91).lineBetween(tree.x, tree.y - 52, tree.x + 31, tree.y - 87);
    d.fillStyle(PALETTE.forest, 1).fillCircle(tree.x - 28, tree.y - 94, 32).fillCircle(tree.x + 31, tree.y - 92, 34);
  }

  drawPeople(g, state) {
    const residents = state.people?.residents || [];
    residents.forEach((resident, index) => {
      const home = state.world.buildings.find((building) => building.id === resident.homeId); const plot = PLOTS.find((item) => item.id === home?.plotId);
      if (!plot) return; const column = index % 4; const row = Math.floor(index / 4) % 2;
      assetRegistry.draw(this, g, 'resident', plot.x - 34 + column * 22, plot.y + 18 + row * 20, { variant: 'active' });
    });
  }

  regionLabel(text, x, y) {
    const label = this.add.text(x, y, text, { fontFamily: 'Georgia, serif', fontSize: '26px', color: '#262d29', letterSpacing: 5 }).setOrigin(0.5).setAlpha(0.7);
    this.labels.add(label);
  }

  createAmbientMotion() {
    if (!this.ambient) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    this.tweens.killTweensOf(this.ambient.getAll()); this.ambient.removeAll(true);
    this.createOuterFireEffect();
    for (let i = 0; i < 4; i += 1) {
      const cloud = this.add.ellipse(700 + i * 620, 150 + (i % 2) * 80, 230, 52, 0xffffff, 0.28);
      this.ambient.add(cloud);
      this.tweens.add({ targets: cloud, x: cloud.x + 130, duration: 18000 + i * 2200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    const glint = this.add.ellipse(1640, 582, 120, 7, 0xffffff, 0.4); this.ambient.add(glint);
    this.tweens.add({ targets: glint, x: 2020, alpha: { from: 0.1, to: 0.6 }, duration: 4200, repeat: -1, yoyo: true, ease: 'Sine.easeInOut' });
    const smokeCount = Math.min(4, this.getState().regions.corridor.smoke);
    for (let i = 0; i < smokeCount; i += 1) {
      const smoke = this.add.ellipse(1018 + i * 175, 880 - (i % 2) * 15, 34, 22, PALETTE.industry, 0.35); this.ambient.add(smoke);
      this.tweens.add({ targets: smoke, y: smoke.y - 70, x: smoke.x + 18, alpha: { from: 0.38, to: 0 }, duration: 4300 + i * 350, repeat: -1, ease: 'Sine.easeOut' });
    }
    for (let i = 0; i < (reduced ? 3 : Math.min(16, 5 + this.getState().regions.corridor.smoke * 2)); i += 1) {
      const ash = this.add.rectangle(850 + seeded(i, 61) * 1450, 820 + seeded(i, 62) * 190, 3, 7, i % 3 ? 0x2d302c : 0x7a342f, .45); this.ambient.add(ash);
      this.tweens.add({ targets: ash, x: ash.x + 70, y: ash.y - 100, alpha: 0, angle: 140, duration: 3800 + i * 190, repeat: -1, delay: i * 160 });
    }
    const motes = reduced ? 5 : 22;
    for (let i = 0; i < motes; i += 1) {
      const pollen = this.add.circle(1110 + seeded(i, 31) * 1060, 370 + seeded(i, 32) * 420, 2 + seeded(i, 33) * 2, i % 4 ? 0xf4df8c : 0xffffff, .35); this.ambient.add(pollen);
      this.tweens.add({ targets: pollen, x: pollen.x + 35 + seeded(i, 34) * 60, y: pollen.y - 14 + seeded(i, 35) * 28, alpha: { from: .12, to: .55 }, duration: 3600 + i * 170, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    for (let i = 0; i < (reduced ? 2 : 7); i += 1) {
      const ripple = this.add.ellipse(1220 + i * 220, 635 + (i % 2) * 18, 18, 6, 0xffffff, .16).setStrokeStyle(2, 0xeaf7ef, .38); this.ambient.add(ripple);
      this.tweens.add({ targets: ripple, scaleX: 2.8, scaleY: 1.8, alpha: 0, duration: 2600 + i * 230, repeat: -1, delay: i * 340 });
    }
  }

  spawnEffectParticles(x, y, kind, duration, reducedMotion) {
    const count = reducedMotion ? 8 : kind === 'construction' ? 34 : kind === 'extraction' ? 42 : kind === 'restoration' ? 30 : 22;
    const colors = kind === 'restoration' ? [0x83b889, 0xb9df91, 0x7bc3c8] : kind === 'extraction' ? [0xa86c4d, 0x756150, 0xd59a58] : kind === 'relocation' ? [0xf1cf85, 0xeaa878, 0xeef1df] : [0xd0ab76, 0xc47c54, 0xf1cf85, 0xdde8df];
    for (let i = 0; i < count; i += 1) {
      const size = 3 + seeded(i, 42) * 6; const particle = kind === 'construction' && i % 5 === 0 ? this.add.rectangle(x, y - 25, size * 1.8, size / 2, colors[i % colors.length], .9) : this.add.circle(x, y - 20, size, colors[i % colors.length], .75);
      particle.setDepth(54); this.effectObjects.add(particle);
      const angle = -Math.PI + seeded(i, 43) * Math.PI; const spread = 45 + seeded(i, 44) * 110;
      this.tweens.add({ targets: particle, x: x + Math.cos(angle) * spread, y: y - 30 + Math.sin(angle) * spread - seeded(i, 45) * 70, alpha: 0, scale: .25, angle: seeded(i, 46) * 220, duration: Math.max(180, duration * (.45 + seeded(i, 47) * .45)), ease: 'Quad.easeOut' });
    }
  }
}
