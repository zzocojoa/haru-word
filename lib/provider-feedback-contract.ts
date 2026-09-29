import {
  feedbackContentSchema, GRAMMAR_VALUES, MEANING_USAGE_VALUES, type SentenceFeedback,
} from './sentence-feedback.ts';
import { structureJsonSchema } from './sentence-structure.ts';

// Shared output contract, independent of either provider's HTTP protocol.
export const FEEDBACK_OUTPUT_LIMITS = { tokens: 4096, textCharacters: 30000 } as const;

export const responseJsonSchema = {
  type: 'object',
  properties: {
    meaningUsage: { type: 'string', enum: MEANING_USAGE_VALUES },
    grammar: { type: 'string', enum: GRAMMAR_VALUES },
    correctedSentence: { type: 'string' },
    explanation: { type: 'string' },
    structure: structureJsonSchema,
  },
  required: ['meaningUsage', 'grammar', 'correctedSentence', 'explanation', 'structure'],
  additionalProperties: false,
};

// The provider owns envelope/finish/error handling. It translates any parsing
// failure to its safe error code; raw response text must not reach UI or logs.
export function parseProviderFeedback(
  text: unknown,
  original: string,
  model: SentenceFeedback['model'],
): SentenceFeedback {
  if (typeof text !== 'string' || text.length > FEEDBACK_OUTPUT_LIMITS.textCharacters) {
    throw new Error('Invalid feedback content');
  }
  const content = feedbackContentSchema.parse(JSON.parse(text));
  return { ...content, original, model, createdAt: new Date().toISOString() };
}
