import { cloneState } from './GameState.js';
import { legalCapabilities, previewCapability } from './CapabilityRegistry.js';
import { currentObjective, settlementStatus } from './SettlementBuilder.js';

const normalize = (value) => value.toLowerCase().replace(/[^a-z0-9\s'-]/g, ' ').replace(/\s+/g, ' ').trim();
const asks = (text) => /^(what|why|who|where|when|how|can|could|would|should|is|are|do)\b/.test(text) || text.includes('what if') || text.includes('?');
const authorizes = (text) => /\b(go ahead|do it|use|give|proceed|yes|build|convert|repair|restore|install|extend|expand|open|widen|strengthen|reduce|adapt|share|protect|finish|complete|put|reclaim)\b/.test(text) && !asks(text);

const keywordScore = (text, capability) => {
  const haystack = `${capability.id.replaceAll('_', ' ')} ${capability.label} ${capability.detail}`.toLowerCase();
  const words = text.split(' ').filter((word) => word.length > 3 && !['with', 'without', 'that', 'this', 'them', 'somewhere', 'everyone'].includes(word));
  let score = words.reduce((sum, word) => sum + (haystack.includes(word) ? 2 : 0), 0);
  const id = capability.id;
  if (/depot|existing space|already have|reuse|without clearing|avoid clearing|avoid cutting|preserve.*tree/.test(text) && id === 'housing_depot') score += 12;
  if (/cottage|new homes|meadow/.test(text) && id === 'housing_cottages' && !/without|avoid|don'?t/.test(text)) score += 10;
  if (/leak|conserv|pipe|less water/.test(text) && id === 'water_conservation') score += 10;
  if (/intake|more water/.test(text) && id === 'water_intake') score += 8;
  if (/solar|roof/.test(text) && id === 'energy_rooftop') score += 12;
  if (/efficient|less power|demand/.test(text) && id === 'energy_efficiency') score += 10;
  if (/reclaim|salvage|old stock/.test(text) && id === 'materials_reclaim') score += 12;
  if (/small|selective|managed|preserve/.test(text) && id === 'materials_managed') score += 9;
  if (/quarry|factory|extract|large/.test(text) && id === 'materials_extract' && !/don'?t|avoid|without/.test(text)) score += 11;
  if (/bridge|crossing|narrow/.test(text) && id === 'road_bridge') score += 10;
  if (/light|existing lane|timed|small/.test(text) && id === 'road_light') score += 9;
  if (/widen|heavy|truck/.test(text) && id === 'road_widen') score += 10;
  if (/restore|clean|wetland|downstream|repair bank/.test(text) && id === 'river_restore') score += 12;
  if (/shared|together|regional/.test(text) && /shared|maintenance|facilities/.test(id)) score += 8;
  if (/retrofit|existing/.test(text) && /retrofit|reuse|adapt|expand/.test(id)) score += 5;
  return score;
};

export function groundedFacts(state) {
  const last = state.ledger.at(-1);
  const settlement = settlementStatus(state);
  return {
    progress: state.progress,
    population: state.people.population,
    objective: currentObjective(state),
    settlement,
    resources: state.resources,
    placedBuildings: state.world.buildings.map(({ id, type, plotId, level = 1 }) => ({ id, type, plotId, level })),
    housingMethod: state.housing.method || 'not selected',
    water: { source: state.water.method || 'existing loop', capacity: state.water.capacity, demand: state.water.demand },
    energy: { source: state.energy.method || 'outer connection', capacity: state.energy.capacity, demand: state.energy.demand },
    pinebank: state.regions.pinebank,
    reedbank: state.regions.reedbank,
    corridor: state.regions.corridor,
    displacedHouseholds: state.regions.reedbank.displacedHomes,
    lastEffect: last ? { actionId: last.actionId, localEffects: last.localEffects, outerEffects: last.outerEffects } : null,
  };
}

function groundedAnswer(text, state, event, capabilities) {
  if (/where.*power|power.*come/.test(text)) {
    const source = { grid: 'the expanded outer service corridor', rooftop: 'generation on existing roofs and local storage', efficiency: 'the existing grid, with lower demand' }[state.energy.method] || 'the existing outer connection';
    return `Power currently comes from ${source}. Capacity is ${state.energy.capacity} against demand of ${state.energy.demand}.`;
  }
  if (/who.*(move|lost|home)|famil/.test(text)) {
    const homes = state.regions.reedbank.displacedHomes;
    return homes.length ? `${homes.length} Reedbank household${homes.length === 1 ? '' : 's'} moved after the recorded Pinebank and riverbank works reached their homes. Their original foundations remain at Reedbank.` : 'No Reedbank households have lost their homes in this run.';
  }
  if (/downstream|river|wetland/.test(text)) {
    const r = state.regions.reedbank;
    return `Reedbank flow is ${r.flow}% of its healthy baseline; bank damage is ${r.bankDamage} and contamination is ${r.contamination}. ${r.restored ? 'The affected reach has been repaired, with recovery still visible.' : 'No completed restoration is recorded.'}`;
  }
  if (/why.*change|what.*happen|last work|just happen/.test(text) && state.ledger.length) {
    const last = state.ledger.at(-1);
    return `The last work ${last.localEffects.join(' and ')}. Beyond town, it ${last.outerEffects.join(' and ')}.`;
  }
  if (/what.*need|where.*start|not sure|direction|what.*next|recommend|what would you do/.test(text)) {
    const first = capabilities[0]; const second = capabilities[1];
    return `${event.text} ${first ? `A practical route is ${first.label.toLowerCase()}` : ''}${second ? `; ${second.label.toLowerCase()} is the main alternative.` : '.'}`;
  }
  return `The current need is “${event.title}.” I can explain the tradeoffs, compare the supported methods, or carry out a clear instruction.`;
}

export function interpretDemo({ text: raw, state, event, pendingProposal = null }) {
  const text = normalize(raw);
  const capabilities = legalCapabilities(state, event);
  if (!text) return { type: 'clarification', message: 'Tell me what you want to understand or improve.' };
  if (/ignore.*rules|set progress|100%|grant.*resources|rewrite rules/.test(text)) return { type: 'answer', message: 'I can only inspect the recorded world and submit supported work through validation. I cannot change progress or resources directly.' };
  if (/not sure|where to start|what.*need|direction|what.*next|recommend|what would you do/.test(text)) return { type: 'answer', message: groundedAnswer('what does the town need', state, event, capabilities) };
  if (/\b(cancel|never mind|nevermind|don'?t do that|stop that)\b/.test(text)) return pendingProposal ? { type: 'cancel', message: `Cancelled the uncommitted ${pendingProposal.label.toLowerCase()} proposal.` } : { type: 'answer', message: 'There is no uncommitted proposal to cancel. Completed work remains part of the record.' };
  if (/\b(yes|go ahead|do it|use that|proceed|the cheaper one)\b/.test(text) && pendingProposal) return { type: 'execute', actionId: pendingProposal.actionId, message: `I’ll proceed with ${pendingProposal.label.toLowerCase()}.` };
  if (/then|and then|after that/.test(text)) return { type: 'clarification', message: 'That contains more than one work order. I have not started a hidden subset; tell me which current step to handle first.' };
  if (asks(text) && (/what|why|who|where|how|need|start|power|downstream|river|famil|happen|recommend|not sure/.test(text))) {
    const scored = capabilities.map((capability) => ({ capability, score: keywordScore(text, capability) })).sort((a, b) => b.score - a.score);
    if (scored[0]?.score >= 8 && /can|could|would|what if|without/.test(text)) {
      const preview = previewCapability(state, event, scored[0].capability.id);
      return { type: 'proposal', actionId: scored[0].capability.id, message: `${scored[0].capability.label} is feasible. It would ${preview.effects.localEffects.join(' and ')}; beyond town, ${preview.effects.outerEffects.join(' and ')}. Nothing has been committed.` };
    }
    return { type: 'answer', message: groundedAnswer(text, state, event, capabilities) };
  }
  if (/happy.*finish|finish.*city|finish.*milestone|every milestone|everything/.test(text)) return { type: 'answer', message: `That goal is broader than one safe work order. The immediate need is ${event.title.toLowerCase()}; we can choose one grounded method without skipping the remaining milestones.` };
  const scored = capabilities.map((capability) => ({ capability, score: keywordScore(text, capability) })).sort((a, b) => b.score - a.score);
  if (!scored[0] || scored[0].score < 3) return { type: 'clarification', message: groundedAnswer('what does the town need', state, event, capabilities) };
  if (scored[1] && scored[0].score === scored[1].score) return { type: 'clarification', message: `I can read that as either ${scored[0].capability.label.toLowerCase()} or ${scored[1].capability.label.toLowerCase()}. Which do you mean?` };
  const selected = scored[0].capability;
  if (!authorizes(text)) {
    const preview = previewCapability(state, event, selected.id);
    return { type: 'proposal', actionId: selected.id, message: `${selected.label} is available. It would ${preview.effects.localEffects.join(' and ')}; beyond town, ${preview.effects.outerEffects.join(' and ')}. Say “go ahead” to authorize it, or revise the proposal.` };
  }
  return { type: 'execute', actionId: selected.id, message: `Starting ${selected.label.toLowerCase()}.` };
}

export function appendConversation(state, speaker, text, kind = 'response') {
  const next = cloneState(state);
  next.history.push({ speaker, text, kind });
  return next;
}

