import { BUILDING_CATALOG } from '../data/buildingCatalog.js';
import { PLOTS } from '../data/worldLayout.js';
import { cloneState } from './GameState.js';

const HOUSEHOLD_SIZE = 2;
const homeTypes = new Set(['home', 'apartments', 'cottage', 'courtyard']);
const emergencyProjects = new Set(['workshop', 'depot', 'logging']);
const residentNames = ['Ari', 'Mina', 'Sol', 'Iris', 'Ren', 'Nia', 'Tao', 'Eli', 'Uma', 'Noa', 'Mara', 'Leo'];
const plotFor = (plotId) => PLOTS.find((plot) => plot.id === plotId);
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const capacityOf = (building) => ((building.families ?? BUILDING_CATALOG[building.type]?.families ?? 0) + ((building.level || 1) > 1 && building.type === 'cottage' ? 1 : 0)) * HOUSEHOLD_SIZE;

function residentsOf(state) { return Array.isArray(state.people?.residents) ? state.people.residents : []; }

export function settlementStatus(state) {
  const buildings = state.world.buildings;
  const homes = buildings.filter((item) => homeTypes.has(item.type));
  const residents = residentsOf(state).filter((resident) => homes.some((home) => home.id === resident.homeId));
  const housingCapacity = homes.reduce((sum, item) => sum + capacityOf(item), 0);
  const placedHomes = homes.map((item) => ({ ...(plotFor(item.plotId) || {}), ...item }));
  const sources = buildings.map((item) => ({ ...(plotFor(item.plotId) || {}), ...item, definition: BUILDING_CATALOG[item.type] }));
  const coveredResidents = (kind) => {
    const capacity = sources.reduce((sum, source) => sum + (source.definition?.[kind] || 0) * (source.level || 1), 0);
    const eligibleHomes = new Set(placedHomes.filter((home) => sources.some((source) => source.definition?.[kind] > 0 && distance(home, source) <= source.definition.radius + ((source.level || 1) - 1) * 120)).map((home) => home.id));
    return Math.min(capacity, residents.filter((resident) => eligibleHomes.has(resident.homeId)).length);
  };
  const population = residents.length; const water = coveredResidents('water'); const power = coveredResidents('power');
  const economy = buildings.reduce((sum, item) => sum + (BUILDING_CATALOG[item.type]?.economy || 0) * (item.level || 1), 0);
  const prosperity = buildings.reduce((sum, item) => sum + (BUILDING_CATALOG[item.type]?.prosperity || 0) + ((item.level || 1) - 1), 0);
  const localSmoke = buildings.reduce((sum, item) => sum + (['workshop', 'market', 'factory', 'powerplant'].includes(item.type) ? 2 : 0) - (BUILDING_CATALOG[item.type]?.localAir || 0) / 4, 0);
  const majorProjects = buildings.filter((item) => BUILDING_CATALOG[item.type]?.major).length;
  const complete = population >= 8 && housingCapacity >= 8 && water >= population && power >= population && economy >= 2 && prosperity >= 2 && majorProjects >= 1;
  return {
    families: Math.ceil(population / HOUSEHOLD_SIZE), population, housingCapacity, vacantHousing: Math.max(0, housingCapacity - population),
    housingQuality: homes.length ? Math.round(homes.reduce((sum, item) => sum + (item.level || 1), 0) / homes.length * 100) / 100 : 0,
    water, waterPercent: population ? Math.round(water / population * 100) : 0, power, energyPercent: population ? Math.round(power / population * 100) : 0,
    economy, prosperity, majorProjects, airQuality: Math.max(68, Math.min(100, Math.round(96 - localSmoke * 5))), complete,
  };
}

export function developmentProgress(state) {
  const status = settlementStatus(state);
  return (status.housingCapacity >= 2 ? 10 : 0) + (status.population >= 2 ? 10 : 0)
    + (status.population >= 2 && status.water >= status.population ? 15 : 0) + (status.economy >= 2 ? 15 : 0)
    + (status.housingCapacity >= 8 ? 10 : 0) + (status.population >= 8 ? 10 : 0)
    + (status.population >= 8 && status.power >= status.population ? 15 : 0) + (status.prosperity >= 2 ? 10 : 0)
    + (status.majorProjects >= 1 ? 5 : 0);
}

export function currentObjective(state) {
  const status = settlementStatus(state);
  if (status.housingCapacity < 2) return { id: 'shelter', title: 'House your first residents', detail: 'Create welcoming shelter.', value: status.housingCapacity, target: 2 };
  if (status.population < 2) return { id: 'arrival', title: 'Welcome your first residents', detail: 'Invite people into the available homes.', value: status.population, target: 2 };
  if (status.water < status.population) return { id: 'water', title: 'Supply clean water', detail: 'Connect every resident to clean water.', value: status.water, target: status.population };
  if (status.economy < 2) return { id: 'economy', title: 'Create jobs', detail: 'Establish useful work or trade.', value: status.economy, target: 2 };
  if (status.housingCapacity < 8) return { id: 'growth', title: 'Expand housing', detail: 'Make room for four households.', value: status.housingCapacity, target: 8 };
  if (status.population < 8) return { id: 'arrival', title: 'Welcome four families', detail: 'Invite residents into vacant homes.', value: status.population, target: 8 };
  if (status.power < status.population) return { id: 'energy', title: 'Power every home', detail: 'Provide dependable local energy.', value: status.power, target: status.population };
  if (status.majorProjects < 1) return { id: 'industry', title: 'Strengthen production', detail: 'Build substantial infrastructure.', value: status.majorProjects, target: 1 };
  if (status.prosperity < 2) return { id: 'public', title: 'Improve public life', detail: 'Create a useful shared amenity.', value: status.prosperity, target: 2 };
  return { id: 'complete', title: 'A thriving society', detail: 'Every local need is met.', value: 1, target: 1 };
}

function prerequisiteReason(state, definition) {
  const status = settlementStatus(state);
  if (definition.requiresPopulation && status.population < definition.requiresPopulation) return `${definition.noun} needs at least ${definition.requiresPopulation} residents first.`;
  return null;
}

export function validatePlacement(state, type, plotId, movingId = null) {
  const definition = BUILDING_CATALOG[type]; const plot = plotFor(plotId);
  if (!definition || !plot) return { ok: false, reason: 'Choose one of the marked settlement plots.' };
  const prerequisite = prerequisiteReason(state, definition); if (prerequisite) return { ok: false, reason: prerequisite };
  if (!definition.allowedPlots.includes(plot.kind)) return { ok: false, reason: `${definition.noun} cannot use ${plot.id.replace('plot-', '').replaceAll('-', ' ')}; it requires ${definition.allowedPlots.join(' or ')} terrain.` };
  const occupied = state.world.buildings.find((item) => item.plotId === plotId && item.id !== movingId);
  if (occupied) return { ok: false, reason: `${plot.id.replace('plot-', '').replaceAll('-', ' ')} is occupied by ${BUILDING_CATALOG[occupied.type]?.noun || occupied.type}.` };
  if (!movingId) {
    const missing = Object.entries(definition.cost).find(([key, value]) => (state.resources?.[key] || 0) < value);
    if (missing && !emergencyProjects.has(type)) return { ok: false, reason: `You need ${missing[1] - (state.resources?.[missing[0]] || 0)} more ${missing[0]}. Trade for materials or open a recovery project.` };
  }
  return { ok: true, plot, definition };
}

export function legalPlots(state, type, movingId = null) { return PLOTS.filter((plot) => validatePlacement(state, type, plot.id, movingId).ok); }
export function canPlaceBuilding(state, type) { const definition = BUILDING_CATALOG[type]; return definition ? legalPlots(state, type).length > 0 : false; }

function syncDerived(next) { next.people.population = residentsOf(next).length; next.progress = developmentProgress(next); return next; }

export function placeBuilding(state, type, plotId) {
  const validation = validatePlacement(state, type, plotId); if (!validation.ok) return validation;
  const next = cloneState(state); const { definition, plot } = validation;
  if (definition.recovery) { next.resources.timber += definition.recovery.timber; next.resources.stone += definition.recovery.stone; }
  next.resources.timber -= definition.cost.timber; next.resources.stone -= definition.cost.stone;
  next.resources.spentTimber += definition.cost.timber; next.resources.spentStone += definition.cost.stone;
  const serial = next.world.nextBuildingId++; const building = { id: `placed-${type}-${serial}`, type, plotId, x: plot.x, y: plot.y, families: definition.families, movable: true, level: 1 };
  next.world.buildings.push(building); next.world.occupiedPlots = next.world.buildings.map((item) => item.plotId).filter(Boolean);
  if (type === 'highway') next.world.connections.push('freight-highway');
  if (['cistern', 'reedbed', 'pump'].includes(type)) next.world.connections.push('water-service');
  const damage = definition.damage;
  next.regions.pinebank.vegetation = Math.max(8, next.regions.pinebank.vegetation - damage.forest); next.regions.pinebank.stumps += damage.forest; next.regions.pinebank.quarry += damage.quarry;
  next.regions.reedbank.flow = Math.max(30, next.regions.reedbank.flow - damage.flow); next.regions.reedbank.contamination += Math.ceil(damage.smoke / 2);
  next.regions.corridor.industry += Math.ceil((definition.cost.stone || 0) / 8) + (definition.major ? 4 : 0); next.regions.corridor.smoke += damage.smoke;
  next.revision += 1; syncDerived(next);
  const effects = { effectId: `build:${type}:${next.revision}`, actionId: `build_${type}`, kind: type === 'garden' || type === 'reedbed' ? 'restoration' : ['logging'].includes(type) ? 'extraction' : type === 'highway' ? 'route' : 'construction', region: 'settlement', location: [plot.x, plot.y], targets: [building.id], label: `BUILDING ${definition.noun.toUpperCase()}`, durationMs: definition.major ? 1450 : 1050, affectedEntityIds: [building.id], localEffects: [`${definition.noun} completed`], outerEffects: ['regional supply load increased'], narrativeFlags: ['player_placed'] };
  next.ledger.push({ eventId: 'player_construction', actionId: effects.actionId, revision: next.revision, ...effects });
  return { ok: true, nextState: next, building, definition, effects };
}

export function welcomeResidents(state) {
  const next = cloneState(state); next.people.residents ||= []; next.people.nextResidentId ||= 1;
  const homes = next.world.buildings.filter((item) => homeTypes.has(item.type)); const vacancies = [];
  for (const home of homes) for (let slot = next.people.residents.filter((item) => item.homeId === home.id).length; slot < capacityOf(home); slot += 1) vacancies.push(home);
  if (!vacancies.length) return { ok: false, reason: 'There are no vacant homes. Create or upgrade housing first.' };
  const arriving = vacancies.slice(0, Math.min(4, vacancies.length)).map((home) => { const serial = next.people.nextResidentId++; return { id: `resident-${serial}`, name: residentNames[(serial - 1) % residentNames.length], homeId: home.id, status: 'housed' }; });
  next.people.residents.push(...arriving); next.people.arrivals += arriving.length; next.revision += 1; syncDerived(next);
  const home = homes.find((item) => item.id === arriving[0].homeId); const plot = plotFor(home.plotId);
  const effects = { effectId: `arrival:${next.revision}`, actionId: 'welcome_residents', kind: 'arrival', region: 'settlement', location: [plot.x, plot.y], targets: arriving.map((item) => item.id), label: `WELCOMING ${arriving.length} RESIDENTS`, durationMs: 950, affectedEntityIds: arriving.map((item) => item.id), localEffects: [`${arriving.length} residents arrived`], outerEffects: [], narrativeFlags: ['resident_arrival'] };
  next.ledger.push({ eventId: 'resident_arrival', revision: next.revision, ...effects });
  return { ok: true, nextState: next, building: home, definition: BUILDING_CATALOG[home.type], effects, residents: arriving };
}

export function recoverMaterials(state) {
  const next = cloneState(state); next.resources.timber += 34; next.resources.stone += 24; next.regions.corridor.industry += 2; next.regions.corridor.smoke += 3; next.revision += 1; syncDerived(next);
  const effects = { effectId: `trade:${next.revision}`, actionId: 'trade_materials', kind: 'route', region: 'settlement', location: [1430, 670], targets: [], label: 'RECEIVING SUPPLIES', durationMs: 800, affectedEntityIds: [], localEffects: ['materials received'], outerEffects: ['freight increased'], narrativeFlags: ['recovery'] };
  next.ledger.push({ eventId: 'material_recovery', revision: next.revision, ...effects });
  return { ok: true, nextState: next, building: { id: 'supply-delivery', type: 'depot', plotId: null }, definition: BUILDING_CATALOG.depot, effects };
}

export function moveBuilding(state, buildingId, plotId) {
  const current = state.world.buildings.find((item) => item.id === buildingId); if (!current?.movable) return { ok: false, reason: 'That building cannot be moved.' };
  const validation = validatePlacement(state, current.type, plotId, buildingId); if (!validation.ok) return validation;
  const next = cloneState(state); const building = next.world.buildings.find((item) => item.id === buildingId); const oldPlotId = building.plotId;
  building.plotId = plotId; building.x = validation.plot.x; building.y = validation.plot.y; next.world.occupiedPlots = next.world.buildings.map((item) => item.plotId).filter(Boolean); next.revision += 1; syncDerived(next);
  const effects = { effectId: `move:${buildingId}:${next.revision}`, actionId: 'move_building', kind: 'relocation', region: 'settlement', location: [building.x, building.y], targets: [buildingId], label: `MOVING ${validation.definition.noun.toUpperCase()}`, durationMs: 700, affectedEntityIds: [buildingId], localEffects: [`moved from ${oldPlotId} to ${plotId}`], outerEffects: ['no new materials used'], narrativeFlags: ['player_moved'] };
  next.ledger.push({ eventId: 'player_move', revision: next.revision, ...effects }); return { ok: true, nextState: next, building, definition: validation.definition, effects };
}

export function upgradeBuilding(state, buildingId) {
  const current = state.world.buildings.find((item) => item.id === buildingId); if (!current?.movable) return { ok: false, reason: 'Select a player-built structure to upgrade.' };
  if ((current.level || 1) >= 2) return { ok: false, reason: 'That building is already fully upgraded.' };
  const cost = { timber: 12, stone: 10 }; const missing = Object.entries(cost).find(([key, value]) => state.resources[key] < value); if (missing) return { ok: false, reason: `You need ${missing[1] - state.resources[missing[0]]} more ${missing[0]}. Trade for materials first.` };
  const next = cloneState(state); next.resources.timber -= cost.timber; next.resources.stone -= cost.stone; next.resources.spentTimber += cost.timber; next.resources.spentStone += cost.stone;
  const building = next.world.buildings.find((item) => item.id === buildingId); building.level = 2; next.revision += 1;
  next.regions.pinebank.vegetation = Math.max(8, next.regions.pinebank.vegetation - 4); next.regions.pinebank.quarry += 5; next.regions.pinebank.stumps += 4; next.regions.corridor.industry += 2; next.regions.corridor.smoke += 1; syncDerived(next);
  const plot = plotFor(building.plotId); const definition = BUILDING_CATALOG[building.type]; const effects = { effectId: `upgrade:${buildingId}:${next.revision}`, actionId: 'upgrade_building', kind: 'conversion', region: 'settlement', location: [plot.x, plot.y], targets: [buildingId], label: `UPGRADING ${definition.noun.toUpperCase()}`, durationMs: 850, affectedEntityIds: [buildingId], localEffects: ['building upgraded'], outerEffects: ['regional supply load increased'], narrativeFlags: ['player_upgraded'] };
  next.ledger.push({ eventId: 'player_upgrade', revision: next.revision, ...effects }); return { ok: true, nextState: next, building, definition, effects };
}

export function demolishBuilding(state, buildingId) {
  const current = state.world.buildings.find((item) => item.id === buildingId); if (!current?.movable) return { ok: false, reason: 'That structure cannot be removed.' };
  if (residentsOf(state).some((resident) => resident.homeId === buildingId)) return { ok: false, reason: 'That home is occupied. Move its residents before removing it.' };
  const definition = BUILDING_CATALOG[current.type]; const next = cloneState(state); next.world.buildings = next.world.buildings.filter((item) => item.id !== buildingId); next.world.occupiedPlots = next.world.buildings.map((item) => item.plotId).filter(Boolean);
  next.resources.timber += Math.floor(definition.cost.timber / 2); next.resources.stone += Math.floor(definition.cost.stone / 2); next.revision += 1; syncDerived(next);
  const plot = plotFor(current.plotId); const effects = { effectId: `remove:${buildingId}:${next.revision}`, actionId: 'remove_building', kind: 'extraction', region: 'settlement', location: [plot.x, plot.y], targets: [buildingId], label: `REMOVING ${definition.noun.toUpperCase()}`, durationMs: 650, affectedEntityIds: [buildingId], localEffects: ['site cleared'], outerEffects: [], narrativeFlags: ['player_removed'] };
  next.ledger.push({ eventId: 'player_remove', revision: next.revision, ...effects }); return { ok: true, nextState: next, building: current, definition, effects };
}
