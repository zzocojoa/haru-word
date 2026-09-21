import { z } from 'zod';

export const FEEDBACK_MODEL = 'gemini-3.1-flash-lite';
export const FEEDBACK_DAILY_LIMIT = 30;
export const feedbackContentSchema = z.object({
  meaningUsage: z.enum(['appropriate', 'needs_work', 'uncertain']),
  grammar: z.enum(['natural', 'needs_work', 'uncertain']),
  correctedSentence: z.string().max(2000),
  explanation: z.string().min(1).max(1500),
}).strict();
export const sentenceFeedbackSchema = feedbackContentSchema.extend({
  original: z.string().min(1).max(2000),
  model: z.literal(FEEDBACK_MODEL),
  createdAt: z.string().datetime(),
});
export type SentenceFeedback = z.infer<typeof sentenceFeedbackSchema>;
export const feedbackRequestSchema = z.object({
  sessionId: z.string().uuid(),
  entryId: z.string().min(1).max(100),
  sentence: z.string().trim().min(1).max(2000),
}).strict();

export const MEANING_USAGE_TEXT = {appropriate:'오늘의 뜻에 맞아요',needs_work:'뜻·용법을 확인해요',uncertain:'뜻·용법 판단이 어려워요'};
export const GRAMMAR_TEXT = {natural:'자연스러운 문장이에요',needs_work:'문장을 다듬어 보세요',uncertain:'문법 판단이 어려워요'};
