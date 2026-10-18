import { PALETTE } from '../data/palette.js';

const record = (key, width, height, extra = {}) => Object.freeze({
  key, file: null, frame: null, source: [width * 2, height * 2], footprint: [width, Math.max(16, Math.round(height * 0.34))],
  anchor: [0.5, 1], groundContact: [0.5, 1], depth: 'ground-y',
  variants: ['construction', 'active', 'upgraded', 'damaged', 'abandoned', 'restored'], animation: null, ...extra,
});

export const ASSETS = Object.freeze({
  home: record('home', 68, 70), apartments: record('apartments', 88, 78), service: record('service', 112, 84), depot: record('depot', 116, 74),
  factory: record('factory', 150, 125, { animation: { key: 'operating', frames: 4, fps: 4 } }), workshop: record('workshop', 108, 74), utility: record('utility', 78, 112),
  tree: record('tree', 54, 72, { variants: ['active', 'stump', 'young', 'damaged'] }), resident: record('resident', 10, 24, { animation: { key: 'walk', frames: 4, fps: 6 } }),
  road: record('road', 32, 32, { anchor: [0.5, 0.5], groundContact: [0.5, 0.5], variants: ['active', 'upgraded', 'damaged', 'restored'] }),
  river: record('river', 32, 32, { anchor: [0.5, 0.5], groundContact: [0.5, 0.5], variants: ['active', 'damaged', 'restored'], animation: { key: 'flow', frames: 4, fps: 5 } }),
});

const FALLBACKS = {
  home(g, x, y, scale, variant) {
    g.fillStyle(PALETTE.building, 1).fillRect(x - 31 * scale, y - 39 * scale, 62 * scale, 39 * scale);
    g.fillStyle(PALETTE.roof, 1).fillTriangle(x, y - 70 * scale, x - 39 * scale, y - 36 * scale, x + 39 * scale, y - 36 * scale);
    g.fillStyle(variant === 'abandoned' ? 0x5e625c : PALETTE.light, variant === 'abandoned' ? 0.4 : 1).fillRect(x - 20 * scale, y - 29 * scale, 13 * scale, 13 * scale).fillRect(x + 8 * scale, y - 29 * scale, 13 * scale, 13 * scale);
    g.fillStyle(0x6f594a, 1).fillRect(x - 5 * scale, y - 22 * scale, 10 * scale, 22 * scale);
  },
  apartments(g, x, y, scale) {
    g.fillStyle(PALETTE.roof, 1).fillRect(x - 44 * scale, y - 72 * scale, 88 * scale, 9 * scale); g.fillStyle(PALETTE.building, 1).fillRect(x - 40 * scale, y - 63 * scale, 80 * scale, 63 * scale);
    for (let i = 0; i < 3; i += 1) for (let j = 0; j < 2; j += 1) g.fillStyle(PALETTE.light, 1).fillRect(x - 29 * scale + i * 23 * scale, y - 50 * scale + j * 24 * scale, 12 * scale, 11 * scale);
    g.fillStyle(0x6f594a, 1).fillRect(x - 6 * scale, y - 22 * scale, 12 * scale, 22 * scale);
  },
  service(g, x, y, scale, variant) {
    const width = variant === 'upgraded' ? 138 : 108; g.fillStyle(PALETTE.building, 1).fillRoundedRect(x - width * scale / 2, y - 58 * scale, width * scale, 58 * scale, 5);
    g.fillStyle(PALETTE.roof, 1).fillTriangle(x, y - 84 * scale, x - (width / 2 + 8) * scale, y - 54 * scale, x + (width / 2 + 8) * scale, y - 54 * scale);
    g.fillStyle(PALETTE.light, 1).fillRect(x - 38 * scale, y - 42 * scale, 24 * scale, 18 * scale).fillRect(x + 14 * scale, y - 42 * scale, 24 * scale, 18 * scale);
  },
  depot(g, x, y, scale, variant) {
    g.fillStyle(variant === 'active' ? 0xa99676 : PALETTE.industry, 1).fillRect(x - 58 * scale, y - 52 * scale, 116 * scale, 52 * scale); g.fillStyle(PALETTE.roof, 1).fillTriangle(x, y - 74 * scale, x - 66 * scale, y - 48 * scale, x + 66 * scale, y - 48 * scale);
    g.fillStyle(PALETTE.light, 0.82).fillRect(x - 42 * scale, y - 35 * scale, 22 * scale, 16 * scale).fillRect(x + 20 * scale, y - 35 * scale, 22 * scale, 16 * scale);
  },
  workshop(g, x, y, scale) { FALLBACKS.depot(g, x, y, scale, 'damaged'); g.fillStyle(PALETTE.light, 0.9).fillRect(x - 7 * scale, y - 22 * scale, 14 * scale, 22 * scale); },
  factory(g, x, y, scale) { g.fillStyle(PALETTE.industry, 1).fillRect(x - 75 * scale, y - 63 * scale, 150 * scale, 63 * scale); g.fillStyle(PALETTE.soil, 0.8).fillTriangle(x - 75 * scale, y - 63 * scale, x - 30 * scale, y - 92 * scale, x - 30 * scale, y - 63 * scale); g.fillStyle(PALETTE.industry, 1).fillRect(x + 38 * scale, y - 125 * scale, 22 * scale, 65 * scale); },
  utility(g, x, y, scale) { g.fillStyle(PALETTE.industry, 1).fillRect(x - 39 * scale, y - 48 * scale, 78 * scale, 48 * scale); g.lineStyle(5 * scale, PALETTE.industry, 1).lineBetween(x, y - 48 * scale, x, y - 112 * scale).lineBetween(x - 28 * scale, y - 84 * scale, x + 28 * scale, y - 84 * scale); },
  tree(g, x, y, scale, variant) {
    if (variant === 'stump') { g.fillStyle(0x6e5a49, 1).fillRect(x - 7 * scale, y - 10 * scale, 14 * scale, 12 * scale); g.fillStyle(0x9a7656, 1).fillEllipse(x, y - 10 * scale, 14 * scale, 6 * scale); return; }
    const young = variant === 'young'; g.fillStyle(0x5f5849, 1).fillRect(x - 3 * scale, y - (young ? 13 : 24) * scale, 6 * scale, (young ? 15 : 28) * scale);
    g.fillStyle(young ? PALETTE.vegetation : PALETTE.forest, 1).fillTriangle(x, y - (young ? 38 : 72) * scale, x - (young ? 15 : 24) * scale, y - 12 * scale, x + (young ? 15 : 24) * scale, y - 12 * scale);
    if (!young) g.fillStyle(PALETTE.vegetation, 0.78).fillTriangle(x, y - 54 * scale, x - 28 * scale, y - 2 * scale, x + 28 * scale, y - 2 * scale);
  },
  resident(g, x, y, scale, variant) { const color = variant === 'displaced' ? 0x875d50 : PALETTE.ink; g.fillStyle(color, 1).fillCircle(x, y - 12 * scale, 5 * scale).fillRect(x - 3 * scale, y - 7 * scale, 6 * scale, 15 * scale); },
};

export class SemanticAssetRegistry {
  preload(scene) { Object.values(ASSETS).forEach((asset) => { if (asset.file && !scene.textures.exists(asset.key)) scene.load.image(asset.key, asset.file); }); }
  draw(scene, graphics, key, x, y, { scale = 1, variant = 'active', depth = y } = {}) {
    const asset = ASSETS[key]; if (!asset) throw new Error(`Unknown semantic asset: ${key}`);
    if (asset.file && scene.textures.exists(asset.key)) return scene.add.image(x, y, asset.key, asset.frame || undefined).setOrigin(...asset.anchor).setScale(scale).setDepth(depth).setPipeline('TextureTintPipeline');
    FALLBACKS[key]?.(graphics, Math.round(x), Math.round(y), scale, variant); return null;
  }
  get(key) { return ASSETS[key]; }
}

export const assetRegistry = new SemanticAssetRegistry();
