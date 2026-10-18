export const LANDSCAPE_BOUNDS = Object.freeze({ x: 80, y: 100, width: 3040, height: 1000 });
export const SETTLEMENT_BOUNDS = Object.freeze({ x: 1070, y: 310, width: 1060, height: 570 });

export const PLOTS = Object.freeze([
  { id: 'plot-home-1', x: 1320, y: 485, kind: 'home' },
  { id: 'plot-home-2', x: 1430, y: 440, kind: 'home' },
  { id: 'plot-home-3', x: 1530, y: 505, kind: 'home' },
  { id: 'plot-home-4', x: 1670, y: 455, kind: 'home' },
  { id: 'plot-home-5', x: 1810, y: 520, kind: 'home' },
  { id: 'plot-home-6', x: 1940, y: 460, kind: 'home' },
  { id: 'plot-service-1', x: 1430, y: 670, kind: 'service' },
  { id: 'plot-service-2', x: 1730, y: 690, kind: 'service' },
  { id: 'plot-service-3', x: 1970, y: 650, kind: 'service' },
  { id: 'plot-utility-1', x: 1200, y: 690, kind: 'utility' },
  { id: 'plot-utility-2', x: 2080, y: 715, kind: 'utility' },
  { id: 'plot-green-1', x: 1570, y: 660, kind: 'green' },
  { id: 'plot-green-2', x: 1870, y: 720, kind: 'green' },
  { id: 'plot-edge-1', x: 1120, y: 520, kind: 'edge' },
  { id: 'plot-edge-2', x: 2160, y: 520, kind: 'edge' },
  { id: 'plot-edge-3', x: 2050, y: 390, kind: 'edge' },
]);

export const FOREST_PATCHES = Object.freeze([
  { id: 'pine-a', x: 300, y: 390, trees: 15 },
  { id: 'pine-b', x: 520, y: 310, trees: 18 },
  { id: 'pine-c', x: 720, y: 440, trees: 14 },
  { id: 'pine-d', x: 840, y: 265, trees: 12 },
]);

export const REEDBANK_HOMES = Object.freeze([
  { id: 'reed-home-1', x: 2490, y: 510 },
  { id: 'reed-home-2', x: 2670, y: 450 },
  { id: 'reed-home-3', x: 2810, y: 560 },
]);

export const RIVER_POINTS = Object.freeze([
  [100, 740], [420, 690], [770, 735], [1080, 650], [1390, 610],
  [1670, 590], [1960, 610], [2260, 680], [2550, 720], [3100, 675],
]);

export const ROAD_POINTS = Object.freeze([
  [170, 850], [520, 800], [880, 835], [1160, 755], [1540, 760],
  [1910, 785], [2260, 825], [2660, 805], [3070, 845],
]);

export const LANDMARKS = Object.freeze({
  bridge: { id: 'stone-bridge', x: 1900, y: 625 },
  forkedTree: { id: 'forked-tree', x: 1180, y: 540 },
  depot: { id: 'old-depot', x: 1260, y: 640 },
  serviceHall: { id: 'service-hall', x: 1740, y: 610 },
});

