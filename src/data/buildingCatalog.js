const project = (definition) => Object.freeze({
  families: 0, water: 0, power: 0, economy: 0, prosperity: 0,
  damage: Object.freeze({ forest: 0, quarry: 0, flow: 0, smoke: 0 }),
  ...definition,
  cost: Object.freeze(definition.cost), allowedPlots: Object.freeze(definition.allowedPlots),
  damage: Object.freeze({ forest: 0, quarry: 0, flow: 0, smoke: 0, ...definition.damage }),
  ...(definition.recovery ? { recovery: Object.freeze(definition.recovery) } : {}),
});

export const BUILDING_CATALOG = Object.freeze({
  cottage: project({ id: 'cottage', category: 'housing', label: 'Build cottages', noun: 'Cottages', icon: '⌂', description: 'Housing for two residents.', cost: { timber: 24, stone: 12 }, families: 1, allowedPlots: ['home', 'edge', 'green'], damage: { forest: 12, quarry: 2 } }),
  courtyard: project({ id: 'courtyard', category: 'housing', label: 'Build apartments', noun: 'Apartments', icon: '▦', description: 'Housing for four residents.', cost: { timber: 36, stone: 30 }, families: 2, allowedPlots: ['home', 'edge'], damage: { forest: 8, quarry: 8, smoke: 2 } }),
  cistern: project({ id: 'cistern', category: 'water', label: 'Add a water supply', noun: 'Water supply', icon: '◒', description: 'Clean water for eight residents.', cost: { timber: 8, stone: 28 }, water: 8, radius: 950, allowedPlots: ['utility', 'edge'], damage: { forest: 1, quarry: 5, flow: 18, smoke: 1 } }),
  reedbed: project({ id: 'reedbed', category: 'water', label: 'Build a water loop', noun: 'Water loop', icon: '≋', description: 'Efficient water for eight residents.', cost: { timber: 18, stone: 18 }, water: 8, radius: 900, allowedPlots: ['green', 'edge'], damage: { forest: 3, quarry: 3, flow: 10, smoke: 1 } }),
  pump: project({ id: 'pump', category: 'water', label: 'Install a water pump', noun: 'Water pump', icon: '◉', description: 'High-capacity water for twelve residents.', cost: { timber: 16, stone: 34 }, water: 12, radius: 1250, major: true, allowedPlots: ['utility', 'edge'], damage: { forest: 4, quarry: 8, flow: 34, smoke: 4 } }),
  solar: project({ id: 'solar', category: 'energy', label: 'Install solar power', noun: 'Solar yard', icon: '☀', description: 'Power for eight residents.', cost: { timber: 12, stone: 20 }, power: 8, radius: 950, allowedPlots: ['utility', 'edge'], damage: { forest: 2, quarry: 12, smoke: 3 } }),
  turbine: project({ id: 'turbine', category: 'energy', label: 'Raise a wind turbine', noun: 'Wind turbine', icon: '✣', description: 'Power for twelve residents.', cost: { timber: 20, stone: 30 }, power: 12, radius: 1100, allowedPlots: ['edge'], damage: { forest: 5, quarry: 10, smoke: 1 } }),
  powerplant: project({ id: 'powerplant', category: 'energy', label: 'Build a power plant', noun: 'Power plant', icon: 'ϟ', description: 'High-output power for sixteen residents.', cost: { timber: 20, stone: 38 }, power: 16, radius: 1500, economy: 1, major: true, allowedPlots: ['utility', 'edge'], damage: { forest: 8, quarry: 18, flow: 6, smoke: 16 } }),
  workshop: project({ id: 'workshop', category: 'industry', label: 'Open a workshop', noun: 'Workshop', icon: '◇', description: 'Creates jobs and reclaims supplies.', cost: { timber: 18, stone: 18 }, economy: 2, prosperity: 1, allowedPlots: ['service', 'utility'], recovery: { timber: 28, stone: 22 }, damage: { forest: 8, quarry: 10, smoke: 5 } }),
  market: project({ id: 'market', category: 'trade', label: 'Open a market', noun: 'Market hall', icon: '◆', description: 'Creates trade and a lively centre.', cost: { timber: 26, stone: 16 }, economy: 3, prosperity: 1, allowedPlots: ['service', 'green'], damage: { forest: 5, quarry: 7, smoke: 4 } }),
  depot: project({ id: 'depot', category: 'trade', label: 'Build a trading depot', noun: 'Trading depot', icon: '▣', description: 'Creates trade and brings in supplies.', cost: { timber: 14, stone: 14 }, economy: 2, allowedPlots: ['service', 'utility', 'edge'], recovery: { timber: 34, stone: 26 }, damage: { forest: 7, quarry: 9, smoke: 7 } }),
  factory: project({ id: 'factory', category: 'industry', label: 'Build a factory', noun: 'Factory', icon: '▥', description: 'Creates large-scale production and jobs.', cost: { timber: 30, stone: 38 }, economy: 5, prosperity: 1, major: true, requiresPopulation: 2, allowedPlots: ['service', 'edge'], recovery: { timber: 18, stone: 12 }, damage: { forest: 18, quarry: 22, flow: 8, smoke: 18 } }),
  highway: project({ id: 'highway', category: 'transport', label: 'Build a freight highway', noun: 'Freight highway', icon: '═', description: 'Moves goods and supports local business.', cost: { timber: 12, stone: 32 }, economy: 2, major: true, requiresPopulation: 2, allowedPlots: ['edge', 'service'], damage: { forest: 20, quarry: 16, flow: 5, smoke: 10 } }),
  logging: project({ id: 'logging', category: 'materials', label: 'Open a logging yard', noun: 'Logging yard', icon: '▤', description: 'Secures a large timber supply.', cost: { timber: 0, stone: 6 }, economy: 1, major: true, allowedPlots: ['edge', 'utility'], recovery: { timber: 68, stone: 0 }, damage: { forest: 32, quarry: 2, smoke: 6 } }),
  waste: project({ id: 'waste', category: 'infrastructure', label: 'Build a waste plant', noun: 'Waste plant', icon: '♲', description: 'Improves local sanitation.', cost: { timber: 16, stone: 28 }, prosperity: 2, major: true, localAir: 8, allowedPlots: ['utility', 'edge'], damage: { forest: 6, quarry: 10, flow: 10, smoke: 10 } }),
  garden: project({ id: 'garden', category: 'public', label: 'Create a public garden', noun: 'Public garden', icon: '✿', description: 'A shared place for residents.', cost: { timber: 10, stone: 4 }, prosperity: 1, localAir: 4, allowedPlots: ['green'], damage: { forest: 2, quarry: 2 } }),
});

export const BUILDING_LIST = Object.freeze(Object.values(BUILDING_CATALOG));

export const INTENT_CATALOG = Object.freeze({
  housing: Object.freeze(['cottage', 'courtyard']), water: Object.freeze(['cistern', 'reedbed', 'pump']),
  trade: Object.freeze(['market', 'depot']), industry: Object.freeze(['workshop', 'factory']),
  energy: Object.freeze(['solar', 'turbine', 'powerplant']), transport: Object.freeze(['highway']),
  materials: Object.freeze(['logging', 'depot', 'workshop']), public: Object.freeze(['garden', 'waste', 'market']),
});

export function intentFromPrompt(text) {
  const value = text.toLowerCase();
  if (/trade|market|shops?|commerce|depot/.test(value)) return 'trade';
  if (/timber|wood|material|logging|suppl|extract|quarry|reclaim/.test(value)) return 'materials';
  if (/manufactur|factory|industry|workshop|jobs?|employment|production/.test(value)) return 'industry';
  if (/traffic|transport|road|highway|freight|congestion/.test(value)) return 'transport';
  if (/water|cistern|pump|reed|drink/.test(value)) return 'water';
  if (/energy|power|electric|solar|wind|turbine/.test(value)) return 'energy';
  if (/garden|park|public|community|waste|sanitation|shared/.test(value)) return 'public';
  if (/home|house|housing|shelter|resident|apartment|cottage|room/.test(value)) return 'housing';
  return null;
}

export function buildingTypeFromPrompt(text) {
  const value = text.toLowerCase();
  if (!/\b(build|place|add|construct|install|put|make|open|raise|create|establish)\b/.test(value)) return null;
  if (/factory/.test(value)) return 'factory'; if (/highway|freight road/.test(value)) return 'highway';
  if (/logging|timber yard/.test(value)) return 'logging'; if (/waste|sanitation/.test(value)) return 'waste';
  if (/power plant/.test(value)) return 'powerplant'; if (/water pump|large.*water/.test(value)) return 'pump';
  if (/trading depot|trade depot/.test(value)) return 'depot'; if (/courtyard|apartments?|compact homes?/.test(value)) return 'courtyard';
  if (/reedbed|water loop|conservation/.test(value)) return 'reedbed'; if (/water|cistern|intake/.test(value)) return 'cistern';
  if (/wind|turbine/.test(value)) return 'turbine'; if (/solar|panels?/.test(value)) return 'solar';
  if (/garden|park|green/.test(value)) return 'garden'; if (/workshop|repair/.test(value)) return 'workshop';
  if (/market|shops?/.test(value)) return 'market'; if (/homes?|houses?|cottages?/.test(value)) return 'cottage';
  return null;
}
