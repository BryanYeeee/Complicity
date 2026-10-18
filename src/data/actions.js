const addBuilding = (state, id, type, plotId) => {
  if (!state.world.buildings.some((building) => building.id === id)) {
    state.world.buildings.push({ id, type, plotId });
    if (plotId && !state.world.occupiedPlots.includes(plotId)) state.world.occupiedPlots.push(plotId);
  }
};

const action = (definition) => Object.freeze(definition);

export const ACTIONS = Object.freeze([
  action({
    id: 'housing_cottages', eventId: 'room_to_live', label: 'Build meadow cottages',
    detail: 'Four warm homes using new Pinebank timber.', aliases: ['build homes', 'build cottages', 'new homes', 'meadow cottages', 'housing'],
    eligible: () => true,
    apply(state) {
      ['plot-home-3', 'plot-home-4', 'plot-home-5', 'plot-home-6'].forEach((plotId, index) => addBuilding(state, `meadow-cottage-${index + 1}`, 'home', plotId));
      state.housing.method = 'cottages'; state.housing.fourHouseholdsHoused = true; state.housing.spareUnits = 0;
      state.people.population += 8; state.materials.extraction += 10; state.regions.pinebank.vegetation -= 10; state.regions.pinebank.stumps += 5;
      return { affectedEntityIds: ['pine-a', 'plot-home-3', 'plot-home-4', 'plot-home-5', 'plot-home-6'], localEffects: ['four meadow cottages constructed'], outerEffects: ['pine-a lightly thinned for timber'], narrativeFlags: ['new_timber_housing'] };
    },
    response: 'Four meadow cottages are ready. Their windows are lit; the new households now need a reliable water connection.',
  }),
  action({
    id: 'housing_depot', eventId: 'room_to_live', label: 'Convert the old depot',
    detail: 'Reclaim the structure as compact homes.', aliases: ['use the empty depot', 'convert depot', 'reuse depot', 'reclaimed housing', 'apartments'],
    eligible: (state) => state.housing.depotAvailable,
    apply(state) {
      const depot = state.world.buildings.find((building) => building.id === 'old-depot'); if (depot) depot.type = 'apartments';
      state.housing.method = 'depot'; state.housing.fourHouseholdsHoused = true; state.housing.spareUnits = 2; state.housing.depotAvailable = false;
      state.people.population += 8; state.materials.reclaimed = true;
      return { affectedEntityIds: ['old-depot'], localEffects: ['depot converted into six compact homes'], outerEffects: ['existing structure reused; no new timber cut'], narrativeFlags: ['reused_depot', 'spare_housing'] };
    },
    response: 'The old depot now holds six compact homes, with two rooms still free. Its original frame remains in use.',
  }),

  action({
    id: 'water_intake', eventId: 'water_at_door', label: 'Extend the river intake',
    detail: 'Add a new intake and pipe from the protected reach.', aliases: ['extend intake', 'river intake', 'new water pipe', 'give everyone clean water', 'more water'],
    eligible: () => true,
    apply(state) {
      state.water.method = 'intake'; state.water.capacity += 8; state.water.demand += 4; state.energy.demand += 2;
      state.regions.reedbank.flow -= 18; state.flags.riverIssue = 'low_flow'; state.world.connections.push('extended-intake');
      return { affectedEntityIds: ['river-town', 'river-reedbank', 'intake-pipe'], localEffects: ['new intake supplies the homes'], outerEffects: ['downstream flow reduced'], narrativeFlags: ['extended_intake'] };
    },
    response: 'The new intake is feeding the homes. The pumps add to evening demand, and less water now continues toward Reedbank.',
  }),
  action({
    id: 'water_conservation', eventId: 'water_at_door', label: 'Repair the loop & conserve',
    detail: 'Seal leaks and fit low-flow equipment.', aliases: ['repair loop', 'fix leaks', 'conserve water', 'conservation equipment', 'repair the pipes'],
    eligible: () => true,
    apply(state) {
      state.water.method = 'conservation'; state.water.capacity += 5; state.water.demand += 1; state.water.loopRepaired = true; state.energy.demand += 1;
      state.world.connections.push('repaired-water-loop');
      return { affectedEntityIds: ['town-water-loop'], localEffects: ['leaks repaired and fixtures fitted'], outerEffects: ['downstream flow retained'], narrativeFlags: ['water_conservation'] };
    },
    response: 'The repaired loop reaches every home with less draw from the river. The smaller pumps still need dependable power after dusk.',
  }),

  action({
    id: 'energy_grid', eventId: 'lights_after_dusk', label: 'Extend the outer connection',
    detail: 'Add pylons and a substation through the service corridor.', aliases: ['extend grid', 'outer power', 'power connection', 'build power line', 'substation'],
    eligible: () => true,
    apply(state) {
      state.energy.method = 'grid'; state.energy.capacity += 12; state.energy.outerConnection = true; state.regions.corridor.industry += 8; state.regions.corridor.smoke += 1;
      state.world.connections.push('new-power-line'); addBuilding(state, 'town-substation', 'utility', 'plot-utility-2');
      return { affectedEntityIds: ['outer-corridor', 'town-substation'], localEffects: ['substation connects the settlement'], outerEffects: ['service corridor generation expanded'], narrativeFlags: ['grid_expansion'] };
    },
    response: 'The substation is online and the paths stay lit. The extended connection increases the settlement’s dependence on the outer service corridor.',
  }),
  action({
    id: 'energy_rooftop', eventId: 'lights_after_dusk', label: 'Install rooftop generation',
    detail: 'Use roofs and compact storage near the homes.', aliases: ['solar', 'rooftop generation', 'roof panels', 'battery storage', 'local power'],
    eligible: () => true,
    apply(state) {
      state.energy.method = 'rooftop'; state.energy.capacity += 8; state.energy.rooftop = true; state.materials.extraction += 3; state.regions.pinebank.vegetation -= 2;
      state.world.connections.push('roof-storage');
      return { affectedEntityIds: ['town-roofs', 'pine-b'], localEffects: ['rooftops and storage supply evening power'], outerEffects: ['small material allocation processed at Pinebank'], narrativeFlags: ['rooftop_power'] };
    },
    response: 'Panels and storage now carry the homes through dusk. Their fittings create a smaller, specialised material order for Pinebank.',
  }),
  action({
    id: 'energy_efficiency', eventId: 'lights_after_dusk', label: 'Reduce evening demand',
    detail: 'Upgrade pumps and fit efficient lights.', aliases: ['reduce demand', 'reduce evening demand', 'efficient lights', 'upgrade pumps', 'efficiency', 'use less power'],
    eligible: (state) => state.water.method === 'conservation',
    apply(state) {
      state.energy.method = 'efficiency'; state.energy.capacity += 5; state.energy.demand = Math.max(3, state.energy.demand - 2); state.materials.reclaimed = true;
      return { affectedEntityIds: ['town-water-loop', 'service-hall'], localEffects: ['pumps and lighting retrofitted'], outerEffects: ['existing grid capacity retained'], narrativeFlags: ['demand_reduction'] };
    },
    response: 'Efficient pumps and lights close the evening gap without a new supply line. The retrofit crew needs reusable fittings and repair stock.',
  }),

  action({
    id: 'materials_extract', eventId: 'materials_somewhere', label: 'Expand Pinebank processing',
    detail: 'Clear a larger worksite for timber and aggregate.', aliases: ['expand extraction', 'pinebank extraction', 'build a factory', 'processing plant', 'quarry', 'new timber'],
    eligible: (state) => state.regions.pinebank.vegetation >= 45,
    apply(state) {
      state.materials.method = 'extraction'; state.materials.factory = true; state.materials.extraction += 32; state.regions.pinebank.vegetation -= 32; state.regions.pinebank.quarry += 26; state.regions.pinebank.stumps += 16;
      addBuilding(state, 'pinebank-processor', 'factory', null);
      if (state.housing.method === 'cottages') { state.flags.displaced = true; state.regions.reedbank.displacedHomes = ['reed-home-1']; }
      return { affectedEntityIds: ['pine-a', 'pine-b', 'pinebank-processor'], localEffects: ['material order secured'], outerEffects: ['two forest patches cleared for processing and quarrying'], narrativeFlags: ['large_extraction', state.flags.displaced ? 'future_displacement' : ''] };
    },
    response: 'Pinebank processing is expanded and the material order is secured. The larger site has removed a recognisable section of the forest edge.',
  }),
  action({
    id: 'materials_reclaim', eventId: 'materials_somewhere', label: 'Open a reclamation workshop',
    detail: 'Recover fittings and structural stock from the region.', aliases: ['reclaim materials', 'reclamation workshop', 'reuse materials', 'repair workshop', 'salvage'],
    eligible: () => true,
    apply(state) {
      state.materials.method = 'reclaim'; state.materials.reclaimed = true; state.materials.workshop = true; state.materials.extraction += 4; state.regions.pinebank.vegetation -= 3;
      addBuilding(state, 'reclamation-workshop', 'workshop', null);
      return { affectedEntityIds: ['pinebank-reclamation-yard'], localEffects: ['reclaimed stock delivered'], outerEffects: ['small reclamation yard opened beside existing road'], narrativeFlags: ['reclamation'] };
    },
    response: 'The reclamation workshop has recovered the needed stock. Repair crews, rather than quarry trucks, will use the road into town.',
  }),
  action({
    id: 'materials_managed', eventId: 'materials_somewhere', label: 'Use a managed timber allotment',
    detail: 'Take a smaller marked section and retain the canopy line.', aliases: ['managed timber', 'small timber allotment', 'selective logging', 'limited timber'],
    eligible: (state) => state.regions.pinebank.vegetation >= 65,
    apply(state) {
      state.materials.method = 'managed'; state.materials.managed = true; state.materials.extraction += 12; state.regions.pinebank.vegetation -= 12; state.regions.pinebank.stumps += 6;
      return { affectedEntityIds: ['pine-c'], localEffects: ['marked timber allocation delivered'], outerEffects: ['one forest patch selectively thinned'], narrativeFlags: ['managed_timber'] };
    },
    response: 'A marked Pinebank allotment supplies the order while retaining the canopy line. Small timber loads now need dependable access.',
  }),

  action({
    id: 'road_widen', eventId: 'connecting_road', label: 'Widen the riverbank road',
    detail: 'Create a direct heavy route through the outer bank.', aliases: ['widen road', 'bigger road', 'truck road', 'riverbank road', 'heavy route'],
    eligible: () => true,
    apply(state) {
      state.road.method = 'wide'; state.road.width = 2; state.road.reedbankAccess = true; state.regions.reedbank.bankDamage += 26;
      state.flags.riverIssue = state.flags.riverIssue || 'damaged_bank';
      if (state.materials.method === 'extraction') { state.flags.displaced = true; state.regions.reedbank.displacedHomes = ['reed-home-1', 'reed-home-2']; }
      return { affectedEntityIds: ['outer-road', 'reed-home-1', 'river-reedbank'], localEffects: ['heavy deliveries reach the settlement'], outerEffects: ['riverbank widened and Reedbank edge disturbed'], narrativeFlags: ['wide_road', state.flags.displaced ? 'reedbank_displacement' : ''] };
    },
    response: 'The riverbank road now carries heavy deliveries directly into town. Its wider cut reaches Reedbank’s inhabited edge.',
  }),
  action({
    id: 'road_bridge', eventId: 'connecting_road', label: 'Strengthen the stone bridge',
    detail: 'Keep the road narrow and reinforce the existing crossing.', aliases: ['strengthen bridge', 'repair bridge', 'stone bridge', 'reinforce crossing', 'keep road narrow'],
    eligible: () => true,
    apply(state) {
      state.road.method = 'bridge'; state.road.bridgeStrengthened = true; state.road.reedbankAccess = true; state.regions.reedbank.bankDamage += 5;
      state.flags.riverIssue = state.flags.riverIssue || 'maintenance';
      return { affectedEntityIds: ['stone-bridge'], localEffects: ['bridge reinforced for deliveries'], outerEffects: ['road footprint kept within its existing width'], narrativeFlags: ['bridge_reinforced'] };
    },
    response: 'The stone bridge is carrying the new loads without widening the old road. Reedbank crews ask to share the maintenance schedule.',
  }),
  action({
    id: 'road_light', eventId: 'connecting_road', label: 'Mark a light service route',
    detail: 'Use timed vans and the existing lane.', aliases: ['light route', 'service route', 'existing lane', 'timed deliveries', 'small road'],
    eligible: (state) => state.materials.method !== 'extraction',
    apply(state) {
      state.road.method = 'light'; state.road.reedbankAccess = true; state.regions.reedbank.bankDamage += 2; state.flags.riverIssue = state.flags.riverIssue || 'maintenance';
      return { affectedEntityIds: ['outer-road'], localEffects: ['timed service deliveries established'], outerEffects: ['existing lane retained'], narrativeFlags: ['light_route'] };
    },
    response: 'Timed vans are using the existing lane. Repair crews can reach town while Reedbank keeps most of its riverbank intact.',
  }),

  action({
    id: 'arrivals_spare', eventId: 'people_beyond', label: 'Offer the spare homes',
    detail: 'House the arriving Reedbank households in the converted depot.', aliases: ['house the newcomers', 'spare homes', 'give them rooms', 'offer housing', 'house arrivals'],
    eligible: (state) => state.flags.displaced && state.housing.spareUnits >= state.regions.reedbank.displacedHomes.length,
    apply(state) {
      const count = state.regions.reedbank.displacedHomes.length; state.housing.spareUnits -= count; state.people.arrivals += count * 2; state.people.population += count * 2; state.people.arrivalsResolved = true;
      return { affectedEntityIds: ['old-depot', ...state.regions.reedbank.displacedHomes], localEffects: ['spare homes assigned to Reedbank households'], outerEffects: ['vacated Reedbank foundations remain visible'], narrativeFlags: ['arrivals_housed_in_spare_space'] };
    },
    response: 'The spare rooms are now Reedbank homes. Ivo has marked the vacated foundations so their origin is not forgotten.',
  }),
  action({
    id: 'arrivals_adapt', eventId: 'people_beyond', label: 'Adapt the community hall',
    detail: 'Create dignified temporary rooms without new land.', aliases: ['adapt community hall', 'use the hall', 'temporary rooms', 'community space', 'shelter'],
    eligible: (state) => state.flags.displaced,
    apply(state) {
      const count = state.regions.reedbank.displacedHomes.length || 1; state.people.arrivals += count * 2; state.people.population += count * 2; state.people.arrivalsResolved = true; state.services.capacity += 1;
      return { affectedEntityIds: ['service-hall', ...state.regions.reedbank.displacedHomes], localEffects: ['community hall adapted for arrivals'], outerEffects: ['vacated Reedbank foundations remain visible'], narrativeFlags: ['arrivals_in_hall'] };
    },
    response: 'The community hall now has private rooms for the arriving households. It works, though the town’s shared-service space is tight.',
  }),
  action({
    id: 'arrivals_compact', eventId: 'people_beyond', label: 'Build compact accommodation',
    detail: 'Add a small courtyard block beside the settlement.', aliases: ['compact accommodation', 'build apartments', 'new accommodation', 'courtyard housing'],
    eligible: (state) => state.flags.displaced,
    apply(state) {
      const count = state.regions.reedbank.displacedHomes.length || 1; state.people.arrivals += count * 2; state.people.population += count * 2; state.people.arrivalsResolved = true; state.energy.demand += 2; state.water.demand += 2;
      addBuilding(state, 'arrival-court', 'apartments', 'plot-edge-2');
      return { affectedEntityIds: ['arrival-court', ...state.regions.reedbank.displacedHomes], localEffects: ['compact courtyard homes built'], outerEffects: ['vacated Reedbank foundations remain visible'], narrativeFlags: ['new_arrival_housing'] };
    },
    response: 'The courtyard homes are occupied. Their residents came from the foundations still visible at Reedbank, and they now share town utilities.',
  }),
  action({
    id: 'delegation_facilities', eventId: 'people_beyond', label: 'Share town facilities',
    detail: 'Make the hall and workshop available to both communities.', aliases: ['share facilities', 'regional partnership', 'help reedbank', 'share the hall', 'cooperate'],
    eligible: (state) => !state.flags.displaced,
    apply(state) {
      state.people.partnership = true; state.people.arrivalsResolved = true; state.services.capacity += 2;
      return { affectedEntityIds: ['service-hall', 'reedbank-homes'], localEffects: ['town facilities opened regionally'], outerEffects: ['Reedbank delegation gains scheduled access'], narrativeFlags: ['regional_partnership'] };
    },
    response: 'Mara and Ivo have opened the hall and workshop schedule to both communities. Reedbank remains inhabited and connected.',
  }),
  action({
    id: 'delegation_connection', eventId: 'people_beyond', label: 'Add a service connection',
    detail: 'Run a modest shared line along the existing road.', aliases: ['service connection', 'connect reedbank', 'shared line', 'extend service'],
    eligible: (state) => !state.flags.displaced,
    apply(state) {
      state.people.partnership = true; state.people.arrivalsResolved = true; state.energy.demand += 1; state.water.demand += 1; state.world.connections.push('reedbank-service');
      return { affectedEntityIds: ['reedbank-service-line', 'reedbank-homes'], localEffects: ['shared service line commissioned'], outerEffects: ['Reedbank homes remain occupied and connected'], narrativeFlags: ['reedbank_connection'] };
    },
    response: 'A shared line now follows the existing road to Reedbank. The homes there remain occupied, and their maintenance is part of the schedule.',
  }),

  action({
    id: 'river_local', eventId: 'same_river', label: 'Protect the town intake',
    detail: 'Secure local water quality without changing the outer cause.', aliases: ['protect town intake', 'protect our water', 'local filter', 'town water only'],
    eligible: () => true,
    apply(state) {
      state.water.intakeProtected = true; state.energy.demand += 1;
      return { affectedEntityIds: ['town-intake'], localEffects: ['town intake filtered and protected'], outerEffects: ['downstream issue remains unresolved'], narrativeFlags: ['local_only_mitigation'] };
    },
    response: 'The settlement intake is protected. CIVIC AI confirms local water quality; Ivo’s downstream concern remains outside that boundary.',
  }),
  action({
    id: 'river_restore', eventId: 'same_river', label: 'Restore the affected reach',
    detail: 'Repair Reedbank’s flow, bank, or water segment.', aliases: ['restore river', 'clean polluted river', 'clean the polluted river', 'repair downstream', 'restore wetland', 'fix reedbank', 'repair bank'],
    eligible: (state) => !state.regions.reedbank.restored && (state.flags.riverIssue || state.regions.reedbank.bankDamage > 0),
    apply(state) {
      state.regions.reedbank.flow = Math.min(100, state.regions.reedbank.flow + 16); state.regions.reedbank.contamination = Math.max(0, state.regions.reedbank.contamination - 30); state.regions.reedbank.bankDamage = Math.max(0, state.regions.reedbank.bankDamage - 18); state.regions.reedbank.restored = true;
      return { affectedEntityIds: ['river-reedbank', 'reedbank-wetland'], localEffects: ['shared maintenance obligation established'], outerEffects: ['affected downstream reach visibly restored'], narrativeFlags: ['river_restored'] };
    },
    response: 'Crews have restored the affected Reedbank reach. Water is moving through the wetland again, and Ivo has joined the maintenance rota.',
  }),
  action({
    id: 'river_reduce_source', eventId: 'same_river', label: 'Reduce the upstream cause',
    detail: 'Cut the actual diversion or discharge creating the issue.', aliases: ['reduce diversion', 'stop discharge', 'reduce source', 'use less water', 'fix upstream cause'],
    eligible: (state) => ['low_flow', 'polluted'].includes(state.flags.riverIssue),
    apply(state) {
      if (state.flags.riverIssue === 'low_flow') { state.regions.reedbank.flow = Math.min(100, state.regions.reedbank.flow + 12); state.water.capacity -= 1; }
      else { state.regions.reedbank.contamination = Math.max(0, state.regions.reedbank.contamination - 25); state.materials.factory = false; }
      return { affectedEntityIds: ['river-town', 'river-reedbank'], localEffects: ['upstream system throttled and balanced'], outerEffects: ['source of downstream pressure reduced'], narrativeFlags: ['source_reduced'] };
    },
    response: 'The upstream system has been throttled at its source. Local reserves are slimmer, while Reedbank’s river begins to recover.',
  }),
  action({
    id: 'river_maintenance', eventId: 'same_river', label: 'Create a shared river rota',
    detail: 'Fund inspections and repairs along the whole reach.', aliases: ['shared maintenance', 'river rota', 'joint repairs', 'maintain river'],
    eligible: () => true,
    apply(state) {
      state.people.partnership = true; state.regions.reedbank.bankDamage = Math.max(0, state.regions.reedbank.bankDamage - 8); state.regions.reedbank.restored = state.regions.reedbank.bankDamage === 0;
      return { affectedEntityIds: ['stone-bridge', 'river-reedbank'], localEffects: ['shared river rota established'], outerEffects: ['bank repairs scheduled across both communities'], narrativeFlags: ['shared_river_care'] };
    },
    response: 'Mara and Ivo now share one river maintenance rota. The bridge, intake, and Reedbank bank will be inspected as one system.',
  }),

  action({
    id: 'gather_clinic', eventId: 'place_to_gather', label: 'Build a clinic & commons',
    detail: 'Add a purpose-built public room and clinic.', aliases: ['build clinic', 'community building', 'clinic and commons', 'new public service'],
    eligible: () => true,
    apply(state) {
      state.services.gathering = 'clinic'; state.services.capacity += 8; state.energy.demand += 3; state.water.demand += 2; addBuilding(state, 'clinic-commons', 'service', 'plot-service-2');
      return { affectedEntityIds: ['clinic-commons'], localEffects: ['clinic and commons opened'], outerEffects: ['new material and utility demand created'], narrativeFlags: ['new_clinic'] };
    },
    response: 'The clinic and commons are open, and residents are already using the steps. Its lights and washrooms create the last capacity gap.',
  }),
  action({
    id: 'gather_expand', eventId: 'place_to_gather', label: 'Expand the service hall',
    detail: 'Add a clinic room to the existing hall.', aliases: ['expand service', 'expand hall', 'add clinic room', 'improve hall'],
    eligible: () => true,
    apply(state) {
      state.services.gathering = 'expanded-hall'; state.services.capacity += 6; state.energy.demand += 2; state.water.demand += 1;
      const hall = state.world.buildings.find((building) => building.id === 'service-hall'); if (hall) hall.type = 'expanded-service';
      return { affectedEntityIds: ['service-hall'], localEffects: ['existing hall expanded with clinic room'], outerEffects: ['moderate utility demand added'], narrativeFlags: ['expanded_service'] };
    },
    response: 'The service hall now includes a clinic room and a larger commons. The reused walls keep the footprint modest, but utilities are near capacity.',
  }),
  action({
    id: 'gather_adapt', eventId: 'place_to_gather', label: 'Adapt an unused structure',
    detail: 'Reuse the depot if it remains available.', aliases: ['adapt unused structure', 'reuse building', 'use depot for clinic', 'convert structure'],
    eligible: (state) => state.housing.depotAvailable,
    apply(state) {
      state.services.gathering = 'adapted-depot'; state.services.capacity += 5; state.energy.demand += 1; state.water.demand += 1; state.housing.depotAvailable = false;
      const depot = state.world.buildings.find((building) => building.id === 'old-depot'); if (depot) depot.type = 'service';
      return { affectedEntityIds: ['old-depot'], localEffects: ['unused depot adapted as public service'], outerEffects: ['no new building footprint'], narrativeFlags: ['adapted_service'] };
    },
    response: 'The old depot is serving the whole population as a clinic and meeting room. Reuse kept the meadow open; existing utilities are almost full.',
  }),

  action({
    id: 'capacity_expand', eventId: 'almost_enough', label: 'Expand the supply source',
    detail: 'Add capacity at the system now under pressure.', aliases: ['expand supply', 'more capacity', 'new plant', 'increase power', 'increase water'],
    eligible: () => true,
    apply(state) {
      const gap = state.flags.finalGap;
      if (gap === 'water') { state.water.capacity += 7; state.regions.reedbank.flow -= 10; state.world.connections.push('second-intake'); }
      else { state.energy.capacity += 7; state.regions.corridor.industry += 10; state.regions.corridor.smoke += 2; addBuilding(state, 'corridor-generator', 'factory', null); }
      state.flags.capacityResolved = true;
      return { affectedEntityIds: gap === 'water' ? ['river-town', 'river-reedbank'] : ['outer-corridor', 'corridor-generator'], localEffects: [`${gap} capacity expanded`], outerEffects: [gap === 'water' ? 'additional downstream draw created' : 'outer generation expanded'], narrativeFlags: ['capacity_expansion'] };
    },
    response: 'The supply source now covers the settlement’s final demand. Its new connection is visible beyond the town boundary.',
  }),
  action({
    id: 'capacity_retrofit', eventId: 'almost_enough', label: 'Retrofit existing infrastructure',
    detail: 'Recover capacity from the system already in place.', aliases: ['retrofit', 'improve existing plant', 'upgrade existing', 'repair infrastructure', 'efficiency upgrade'],
    eligible: () => true,
    apply(state) {
      const gap = state.flags.finalGap;
      if (gap === 'water') { state.water.capacity += 5; state.water.demand = Math.max(1, state.water.demand - 2); }
      else { state.energy.capacity += 5; state.energy.demand = Math.max(1, state.energy.demand - 2); }
      state.flags.capacityResolved = true;
      return { affectedEntityIds: gap === 'water' ? ['town-water-loop'] : ['town-substation', 'town-roofs'], localEffects: [`existing ${gap} system retrofitted`], outerEffects: ['no new supply footprint'], narrativeFlags: ['capacity_retrofit'] };
    },
    response: 'The existing system has been retrofitted and now carries the load. No new supply site was opened.',
  }),
  action({
    id: 'capacity_shared', eventId: 'almost_enough', label: 'Share regional capacity',
    detail: 'Balance the gap through the Reedbank partnership.', aliases: ['shared capacity', 'regional capacity', 'share power', 'share water', 'partnership capacity'],
    eligible: (state) => state.people.partnership || state.regions.reedbank.restored,
    apply(state) {
      const gap = state.flags.finalGap; if (gap === 'water') state.water.capacity += 5; else state.energy.capacity += 5; state.flags.capacityResolved = true; state.world.connections.push('shared-capacity');
      return { affectedEntityIds: ['reedbank-service-line', 'outer-road'], localEffects: [`${gap} demand balanced regionally`], outerEffects: ['shared connection serves both communities'], narrativeFlags: ['shared_capacity'] };
    },
    response: 'The regional connection is balancing the last capacity gap. The settlement and Reedbank now depend on the same maintained line.',
  }),

  action({
    id: 'final_expand', eventId: 'completed_picture', label: 'Finish the current expansion',
    detail: 'Complete the last public-space and utility works.', aliases: ['finish expansion', 'complete project', 'finish development', 'complete works'],
    eligible: () => true,
    apply(state) {
      state.flags.finalComplete = true; state.regions.corridor.industry += 5; addBuilding(state, 'final-pavilion', 'service', 'plot-service-3');
      return { affectedEntityIds: ['final-pavilion', 'outer-corridor'], localEffects: ['final pavilion and utility works completed'], outerEffects: ['service corridor output increased'], narrativeFlags: ['ordinary_completion'] };
    },
    response: 'The final pavilion is complete and every local objective has been certified.',
  }),
  action({
    id: 'final_reuse', eventId: 'completed_picture', label: 'Complete with reuse upgrades',
    detail: 'Finish inside the existing footprint with recovered materials.', aliases: ['reuse solution', 'lower impact', 'finish with reuse', 'upgrade existing', 'recovered materials'],
    eligible: () => true,
    apply(state) {
      state.flags.finalComplete = true; state.services.capacity += 2;
      return { affectedEntityIds: ['service-hall', 'town-water-loop'], localEffects: ['final objective completed inside existing footprint'], outerEffects: ['recovered materials used'], narrativeFlags: ['reuse_completion'] };
    },
    response: 'Recovered materials complete the final objective within the existing footprint. Every local target has been certified.',
  }),
  action({
    id: 'final_repair', eventId: 'completed_picture', label: 'Complete & repair the outer site',
    detail: 'Finish locally while repairing the most affected region.', aliases: ['complete and repair', 'repair outer site', 'restore pinebank', 'finish and restore', 'repair damage'],
    eligible: (state) => state.regions.pinebank.vegetation < 88 || state.regions.reedbank.bankDamage > 4 || state.regions.reedbank.flow < 95,
    apply(state) {
      state.flags.finalComplete = true;
      if (state.regions.pinebank.vegetation < 88) { state.regions.pinebank.vegetation = Math.min(92, state.regions.pinebank.vegetation + 14); state.regions.pinebank.restored = true; }
      else { state.regions.reedbank.bankDamage = Math.max(0, state.regions.reedbank.bankDamage - 12); state.regions.reedbank.flow = Math.min(100, state.regions.reedbank.flow + 8); state.regions.reedbank.restored = true; }
      return { affectedEntityIds: ['final-pavilion', state.regions.pinebank.restored ? 'pinebank-restoration' : 'reedbank-wetland'], localEffects: ['final objective completed'], outerEffects: ['most affected outer site repaired'], narrativeFlags: ['completion_with_repair'] };
    },
    response: 'The local objective is complete, and the most affected outer site has been repaired as part of the same work order.',
  }),
]);

export const ACTIONS_BY_ID = new Map(ACTIONS.map((item) => [item.id, item]));

export function actionsForEvent(eventId, state) {
  return ACTIONS.filter((item) => item.eventId === eventId && item.eligible(state));
}

