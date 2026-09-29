import { z } from 'zod';

import { FEEDBACK_MODEL, GROQ_FEEDBACK_MODEL } from './learning/feedback-identity.ts';
import { sentenceStructureSchema, validSentenceStructure } from './sentence-structure.ts';
export { FEEDBACK_MODEL, GROQ_FEEDBACK_MODEL, feedbackProvider } from './learning/feedback-identity.ts';
export const MEANING_USAGE_VALUES = ['appropriate', 'needs_work', 'uncertain'] as const;
export const GRAMMAR_VALUES = ['natural', 'needs_work', 'uncertain'] as const;
const feedbackFields = z.object({
  meaningUsage: z.enum(MEANING_USAGE_VALUES),
  grammar: z.enum(GRAMMAR_VALUES),
  correctedSentence: z.string().max(2000),
  explanation: z.string().min(1).max(1500),
  structure: sentenceStructureSchema.optional(),
}).strict();
const validStructure = (feedback: z.infer<typeof feedbackFields>) => !feedback.structure || validSentenceStructure(feedback.structure, feedback.correctedSentence);
export const feedbackContentSchema = feedbackFields.refine(validStructure, '문장 구조와 교정문이 일치하지 않아요.');
export const sentenceFeedbackSchema = feedbackFields.extend({
  original: z.string().min(1).max(2000),
  model: z.enum([FEEDBACK_MODEL, GROQ_FEEDBACK_MODEL]),
  createdAt: z.string().datetime(),
}).refine(validStructure, '문장 구조와 교정문이 일치하지 않아요.');
export type SentenceFeedback = z.infer<typeof sentenceFeedbackSchema>;
export const feedbackRequestSchema = z.object({
  sessionId: z.string().uuid(),
  entryId: z.string().min(1).max(100),
  sentence: z.string().trim().min(1).max(2000),
}).strict();

export const MEANING_USAGE_TEXT = {appropriate:'오늘의 뜻에 맞아요',needs_work:'뜻·용법을 확인해요',uncertain:'뜻·용법 판단이 어려워요'};
export const GRAMMAR_TEXT = {natural:'자연스러운 문장이에요',needs_work:'문장을 다듬어 보세요',uncertain:'문법 판단이 어려워요'};
