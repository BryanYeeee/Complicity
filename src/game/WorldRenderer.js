import Phaser from 'phaser';
import { PALETTE } from '../data/palette.js';
import { PLOTS, FOREST_PATCHES, REEDBANK_HOMES, RIVER_POINTS, ROAD_POINTS, LANDMARKS } from '../data/worldLayout.js';
import { CameraDirector } from './CameraDirector.js';

const seeded = (index, salt = 0) => {
  const x = Math.sin(index * 999 + salt * 71) * 43758.5453;
  return x - Math.floor(x);
};

export class WorldScene extends Phaser.Scene {
  constructor({ getState, onReady }) {
    super({ key: 'WorldScene' });
    this.getState = getState;
    this.onWorldReady = onReady;
  }

  create() {
    this.cameras.main.setBackgroundColor(PALETTE.paper);
    this.terrain = this.add.graphics();
    this.details = this.add.graphics();
    this.labels = this.add.container();
    this.ambient = this.add.container();
    this.cameraDirector = new CameraDirector(this);
    this.draw(this.getState());
    this.createAmbientMotion();
    this.cameraDirector.showOpening();
    this.scale.on('resize', () => this.cameraDirector.resize());
    this.onWorldReady?.(this);
  }

  updateState(state, effects = null) {
    this.draw(state);
    if (effects) this.animateEffects(effects);
  }

  draw(state) {
    const g = this.terrain; const d = this.details;
    g.clear(); d.clear(); this.labels.removeAll(true);
    this.drawGround(g);
    this.drawRiver(g, state);
    this.drawRoad(g, state);
    this.drawPinebank(g, d, state);
    this.drawCorridor(g, d, state);
    this.drawReedbank(g, d, state);
    this.drawConnections(g, d, state);
    this.drawSettlement(g, d, state);
    this.drawLandmarks(g, d);
    this.drawPeople(d, state);
  }

  drawGround(g) {
    g.fillStyle(PALETTE.mist, 0.35).fillEllipse(1600, 690, 3020, 800);
    g.fillStyle(0xded7c2, 1).fillRoundedRect(80, 220, 3040, 730, 130);
    g.fillStyle(0xc9c6aa, 0.34).fillEllipse(520, 570, 900, 620);
    g.fillStyle(0xb9c6aa, 0.34).fillEllipse(2660, 620, 880, 600);
    for (let i = 0; i < 38; i += 1) {
      const x = 120 + seeded(i, 2) * 2960; const y = 270 + seeded(i, 8) * 610;
      g.fillStyle(0xffffff, 0.08).fillCircle(x, y, 5 + seeded(i, 3) * 12);
    }
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
      g.lineStyle(6, 0x8e5d48, 0.8).strokeEllipse(555, 615, 220 + q * 4, 105 + q * 2);
    }
    for (let i = 0; i < 59; i += 1) {
      const patch = FOREST_PATCHES[i % FOREST_PATCHES.length];
      const x = patch.x - 100 + seeded(i, 4) * 220; const y = patch.y + seeded(i, 6) * 260;
      this.tree(d, x, y, 0.72 + seeded(i, 1) * 0.45, i < remaining);
    }
    if (state.materials.factory) this.factory(d, 690, 690, 1.05);
    if (state.materials.workshop) this.workshop(d, 820, 705);
    if (state.regions.pinebank.restored) {
      g.lineStyle(4, PALETTE.vegetation, 0.8).strokeEllipse(430, 510, 390, 250);
      for (let i = 0; i < 9; i += 1) g.fillStyle(PALETTE.vegetation, 1).fillCircle(300 + i * 30, 610 - (i % 2) * 15, 8);
    }
    this.regionLabel('PINEBANK', 520, 250);
  }

  drawCorridor(g, d, state) {
    g.fillStyle(PALETTE.industry, 0.12).fillRoundedRect(840, 850, 1460, 175, 60);
    const units = Math.min(8, 2 + Math.round(state.regions.corridor.industry / 8));
    for (let i = 0; i < units; i += 1) {
      const x = 940 + i * 175;
      d.fillStyle(PALETTE.industry, 0.92).fillRect(x, 915 - (i % 2) * 16, 92, 65 + (i % 2) * 16);
      d.fillStyle(PALETTE.light, 0.85).fillRect(x + 13, 936, 18, 12).fillRect(x + 42, 936, 18, 12);
      if (i < state.regions.corridor.smoke) d.fillStyle(PALETTE.industry, 0.5).fillCircle(x + 78, 880 - i * 3, 18).fillCircle(x + 84, 852 - i * 2, 13);
    }
    this.regionLabel('SERVICE CORRIDOR', 1580, 1005);
  }

  drawReedbank(g, d, state) {
    const damage = state.regions.reedbank.bankDamage;
    if (damage > 0) {
      g.fillStyle(PALETTE.soil, Math.min(0.9, 0.25 + damage / 50)).fillEllipse(2620, 620, 280 + damage * 4, 115 + damage * 2);
    }
    for (let i = 0; i < 34; i += 1) {
      const x = 2330 + seeded(i, 9) * 690; const y = 590 + seeded(i, 10) * 220;
      const alive = damage < 18 || i > damage;
      if (alive) d.fillStyle(i % 2 ? PALETTE.vegetation : PALETTE.forest, 0.85).fillRect(x, y, 5, 32 + seeded(i, 4) * 26);
      else d.lineStyle(3, 0x6e5a49, 0.9).lineBetween(x, y + 25, x, y + 6);
    }
    for (const home of REEDBANK_HOMES) {
      if (state.regions.reedbank.displacedHomes.includes(home.id)) this.foundation(d, home.x, home.y);
      else this.home(d, home.x, home.y, 0.72);
    }
    this.regionLabel('REEDBANK', 2730, 350);
  }

  drawConnections(g, d, state) {
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
  }

  drawSettlement(g, d, state) {
    g.fillStyle(0xaebc96, 0.58).fillEllipse(1640, 600, 1190, 610);
    g.lineStyle(14, 0xd8d0b9, 1).strokeEllipse(1640, 610, 950, 420);
    g.lineStyle(5, PALETTE.road, 0.8).beginPath().moveTo(1190, 665).lineTo(1450, 580).lineTo(1730, 620).lineTo(2070, 560).strokePath();
    for (const building of state.world.buildings) {
      const plot = PLOTS.find((item) => item.id === building.plotId);
      if (!plot) continue;
      const type = building.type;
      if (type === 'home') this.home(d, plot.x, plot.y);
      else if (type === 'apartments') this.apartments(d, plot.x, plot.y);
      else if (type.includes('service') || type === 'service') this.service(d, plot.x, plot.y, type === 'expanded-service');
      else if (type === 'utility') this.utility(d, plot.x, plot.y);
      else if (type === 'depot') this.workshop(d, plot.x, plot.y, true);
    }
    if (state.energy.rooftop) {
      state.world.buildings.filter((building) => building.type === 'home' || building.type === 'apartments').forEach((building) => {
        const plot = PLOTS.find((item) => item.id === building.plotId); if (plot) d.fillStyle(0x506a6d, 1).fillRect(plot.x - 23, plot.y - 51, 45, 9);
      });
    }
    if (state.world.buildings.some((building) => building.id === 'clinic-commons')) this.service(d, 1730, 690, true);
    if (state.world.buildings.some((building) => building.id === 'arrival-court')) this.apartments(d, 2160, 520, 1.05);
    if (state.world.buildings.some((building) => building.id === 'final-pavilion')) this.service(d, 1970, 650, false, 0.85);
    this.regionLabel('THE SETTLEMENT', 1640, 335);
  }

  home(g, x, y, scale = 1) {
    g.fillStyle(PALETTE.building, 1).fillRect(x - 31 * scale, y - 39 * scale, 62 * scale, 39 * scale);
    g.fillStyle(PALETTE.roof, 1).fillTriangle(x, y - 70 * scale, x - 39 * scale, y - 36 * scale, x + 39 * scale, y - 36 * scale);
    g.fillStyle(PALETTE.light, 1).fillRect(x - 20 * scale, y - 29 * scale, 13 * scale, 13 * scale).fillRect(x + 8 * scale, y - 29 * scale, 13 * scale, 13 * scale);
  }

  apartments(g, x, y, scale = 1) {
    g.fillStyle(PALETTE.roof, 1).fillRect(x - 41 * scale, y - 70 * scale, 82 * scale, 8 * scale);
    g.fillStyle(PALETTE.building, 1).fillRect(x - 38 * scale, y - 62 * scale, 76 * scale, 62 * scale);
    for (let i = 0; i < 3; i += 1) for (let j = 0; j < 2; j += 1) g.fillStyle(PALETTE.light, 1).fillRect(x - 27 * scale + i * 22 * scale, y - 49 * scale + j * 23 * scale, 12 * scale, 11 * scale);
  }

  service(g, x, y, expanded = false, scale = 1) {
    const width = (expanded ? 138 : 108) * scale;
    g.fillStyle(PALETTE.building, 1).fillRoundedRect(x - width / 2, y - 58 * scale, width, 58 * scale, 5);
    g.fillStyle(PALETTE.roof, 1).fillTriangle(x, y - 83 * scale, x - width / 2 - 8, y - 54 * scale, x + width / 2 + 8, y - 54 * scale);
    g.fillStyle(PALETTE.light, 1).fillRect(x - 38 * scale, y - 42 * scale, 24 * scale, 18 * scale).fillRect(x + 14 * scale, y - 42 * scale, 24 * scale, 18 * scale);
  }

  workshop(g, x, y, depot = false) {
    g.fillStyle(depot ? 0xa99676 : PALETTE.industry, 1).fillRect(x - 58, y - 52, 116, 52);
    g.fillStyle(PALETTE.roof, 1).fillTriangle(x, y - 74, x - 66, y - 48, x + 66, y - 48);
    g.fillStyle(PALETTE.light, 0.8).fillRect(x - 42, y - 35, 22, 16).fillRect(x + 20, y - 35, 22, 16);
  }

  factory(g, x, y, scale = 1) {
    g.fillStyle(PALETTE.industry, 1).fillRect(x - 75 * scale, y - 63 * scale, 150 * scale, 63 * scale);
    g.fillStyle(PALETTE.soil, 0.8).fillTriangle(x - 75 * scale, y - 63 * scale, x - 30 * scale, y - 92 * scale, x - 30 * scale, y - 63 * scale);
    g.fillStyle(PALETTE.industry, 1).fillRect(x + 38 * scale, y - 125 * scale, 22 * scale, 65 * scale);
  }

  utility(g, x, y) {
    g.fillStyle(PALETTE.industry, 1).fillRect(x - 39, y - 48, 78, 48);
    g.lineStyle(5, PALETTE.industry, 1).lineBetween(x, y - 48, x, y - 112).lineBetween(x - 28, y - 84, x + 28, y - 84);
  }

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
    const count = Math.min(18, 7 + Math.round(state.people.population / 4));
    for (let i = 0; i < count; i += 1) {
      const x = 1260 + seeded(i, 21) * 800; const y = 560 + seeded(i, 22) * 190;
      g.fillStyle(i % 3 === 0 ? 0x875d50 : PALETTE.ink, 1).fillCircle(x, y - 12, 5).fillRect(x - 3, y - 7, 6, 15);
    }
  }

  regionLabel(text, x, y) {
    const label = this.add.text(x, y, text, { fontFamily: 'Georgia, serif', fontSize: '26px', color: '#262d29', letterSpacing: 5 }).setOrigin(0.5).setAlpha(0.7);
    this.labels.add(label);
  }

  createAmbientMotion() {
    for (let i = 0; i < 4; i += 1) {
      const cloud = this.add.ellipse(700 + i * 620, 150 + (i % 2) * 80, 230, 52, 0xffffff, 0.28);
      this.ambient.add(cloud);
      this.tweens.add({ targets: cloud, x: cloud.x + 130, duration: 18000 + i * 2200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    const glint = this.add.ellipse(1640, 582, 120, 7, 0xffffff, 0.4); this.ambient.add(glint);
    this.tweens.add({ targets: glint, x: 2020, alpha: { from: 0.1, to: 0.6 }, duration: 4200, repeat: -1, yoyo: true, ease: 'Sine.easeInOut' });
  }

  animateEffects(effects) {
    const ring = this.add.ellipse(1640, 590, 560, 260).setStrokeStyle(5, PALETTE.light, 0.8).setAlpha(0);
    this.tweens.add({ targets: ring, alpha: { from: 0.75, to: 0 }, scaleX: { from: 0.65, to: 1.25 }, scaleY: { from: 0.65, to: 1.25 }, duration: 900, ease: 'Sine.easeOut', onComplete: () => ring.destroy() });
  }
}

