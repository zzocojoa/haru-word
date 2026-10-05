import {
  feedbackContentSchema, GRAMMAR_VALUES, MEANING_USAGE_VALUES, type SentenceFeedback,
} from './sentence-feedback.ts';
import { structureJsonSchema, structureInstruction } from './sentence-structure.ts';
import type { FeedbackValidationDetail } from './feedback-validation-detail';

// Shared output contract, independent of either provider's HTTP protocol.
export const FEEDBACK_OUTPUT_LIMITS = { tokens: 4096, textCharacters: 30000 } as const;

// Application-owned stages only: never attach provider text or Zod issue paths.
export const FEEDBACK_VALIDATION_STAGES = ['envelope', 'model', 'content_type', 'content_limit', 'json_syntax', 'fields', 'structure', 'judgment'] as const;
export type FeedbackValidationStage = (typeof FEEDBACK_VALIDATION_STAGES)[number];
export const FEEDBACK_DIAGNOSTICS = ['free_tier_region', 'wire_fields', 'chunk_count', 'evidence_contract'] as const;
export type FeedbackDiagnostic = (typeof FEEDBACK_DIAGNOSTICS)[number];
export class FeedbackValidationError extends Error {
  readonly stage: FeedbackValidationStage;
  readonly diagnostic?: FeedbackDiagnostic;
  readonly validationDetail?: FeedbackValidationDetail;
  constructor(stage: FeedbackValidationStage, diagnostic?: FeedbackDiagnostic, validationDetail?: FeedbackValidationDetail) { super('Invalid feedback content'); this.stage = stage; this.diagnostic = diagnostic; this.validationDetail = validationDetail; }
}

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
  if (typeof text !== 'string') throw new FeedbackValidationError('content_type');
  if (text.length > FEEDBACK_OUTPUT_LIMITS.textCharacters) throw new FeedbackValidationError('content_limit');
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new FeedbackValidationError('json_syntax'); }
  const parsed = feedbackContentSchema.safeParse(value);
  if (!parsed.success) throw new FeedbackValidationError(parsed.error.issues.some(i => i.code !== 'custom') ? 'fields' : 'structure');
  const content = parsed.data;
  // New provider results judge the ORIGINAL. Keep this out of persisted schemas
  // so previously saved results and backups remain readable. Reject rather than
  // silently relabel a contradictory answer as a valid grammar correction.
  const correction = content.correctedSentence.trim();
  if ((content.grammar === 'natural' && (!correction || correction !== original.trim()))
      || (content.grammar === 'uncertain' && correction)) throw new FeedbackValidationError('judgment');
  return { ...content, original, model, createdAt: new Date().toISOString() };
}

export type ProviderFeedbackContract = {
  schema: Record<string, unknown>;
  instruction: string;
  parse: typeof parseProviderFeedback;
};
export const defaultFeedbackContract: ProviderFeedbackContract = {
  schema: responseJsonSchema, instruction: structureInstruction, parse: parseProviderFeedback,
};
