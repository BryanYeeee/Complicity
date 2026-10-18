import { ACTIONS } from '../data/actions.js';

export function normalizePrompt(value) {
  return value.toLowerCase().replace(/[^a-z0-9\s'-]/g, ' ').replace(/\b(?:the|a|an)\b/g, ' ').replace(/\s+/g, ' ').trim();
}

const NEGATION = /\b(?:do not|don't|dont|never|no)\b/;

export class PromptInterpreter {
  interpret(raw, validActions) {
    const text = normalizePrompt(raw);
    if (!text) return { type: 'invalid', message: 'Describe how you want CIVIC AI to address the current need.' };
    if (NEGATION.test(text)) {
      return { type: 'clarification', message: `Understood—not that method. Choose one available approach: ${validActions.map((item) => item.label).join('; ')}.` };
    }

    const matches = [];
    for (const action of validActions) {
      const aliases = action.aliases.filter((alias) => text.includes(normalizePrompt(alias)));
      if (aliases.length) matches.push({ action, score: Math.max(...aliases.map((alias) => alias.length)) });
    }
    matches.sort((a, b) => b.score - a.score);
    if (matches.length > 1) {
      return { type: 'clarification', message: `I found more than one possible method. Do you mean ${matches.slice(0, 3).map(({ action }) => action.label).join(' or ')}?` };
    }
    if (matches.length) return { type: 'action', actionId: matches[0].action.id };

    const related = ACTIONS.some((action) => action.aliases.some((alias) => text.includes(normalizePrompt(alias))));
    if (related) return { type: 'unrelated', message: `That is a supported kind of work, but it does not address this situation. Current methods: ${validActions.map((item) => item.label).join('; ')}.` };
    return { type: 'invalid', message: `I could not map that request to the current decision. Try: ${validActions.map((item) => item.label).join('; ')}.` };
  }
}

