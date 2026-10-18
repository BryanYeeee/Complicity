import { ACTIONS } from '../src/data/actions.js';

export const CIVIC_RESPONSE_SCHEMA = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: ['intent', 'action_id', 'response'],
  properties: {
    intent: { type: 'string', enum: ['answer', 'proposal', 'execute', 'cancel', 'clarify'] },
    action_id: { type: 'string', enum: ['none', ...ACTIONS.map((action) => action.id)] },
    response: { type: 'string' },
  },
});

