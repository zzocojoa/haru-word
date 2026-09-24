import { z } from 'zod';
import { sentenceFeedbackSchema } from '../sentence-feedback';

export const LESSON_IDS = ['noun', 'verb', 'pronoun', 'adjective', 'adverb', 'determiner', 'indefinite-article', 'definite-article', 'number', 'preposition', 'conjunction', 'auxiliary', 'modal', 'infinitive', 'exclamation'] as const;
export type LessonId = typeof LESSON_IDS[number];
export const lessonIdSchema = z.enum(LESSON_IDS);
export const answerSchema = z.object({
  first: z.string().min(1).max(200), latest: z.string().min(1).max(200),
  helped: z.boolean(), attempts: z.number().int().min(1).max(1000),
}).strict();
const answersSchema = z.object({ q1: answerSchema.optional(), q2: answerSchema.optional(), q3: answerSchema.optional() }).strict();
const questionHintsSchema = z.array(z.enum(['q1', 'q2', 'q3'])).max(3).refine(v => new Set(v).size === v.length);
const orderSelectionSchema = z.array(z.number().int().min(0).max(11)).max(12).refine(v => new Set(v).size === v.length);
export const selfCheckSchema = z.enum(['appropriate', 'needs_work', 'uncertain']);
const reviewSchema = z.object({ index: z.number().int().min(0).max(3), answers: answersSchema, hints: questionHintsSchema.optional(), order: orderSelectionSchema.optional(), completedAt: z.string().datetime().optional() }).strict().superRefine((r, c) => {
  for (let i = 1; i <= r.index; i++) if (!r.answers[`q${i}` as keyof typeof r.answers]) c.addIssue({ code: 'custom', message: '재점검 답변이 빠졌어요.' });
  if ((r.index === 3) !== !!r.completedAt) c.addIssue({ code: 'custom', message: '재점검의 완료 상태와 위치가 달라요.' });
});
export const grammarProgressSchema = z.object({
  stage: z.number().int().min(0).max(6), answers: answersSchema,
  hints: questionHintsSchema.optional(), order: orderSelectionSchema.optional(),
  sentence: z.string().max(2000), check: selfCheckSchema.optional(),
  feedback: sentenceFeedbackSchema.optional(), completedAt: z.string().datetime().optional(),
  review: reviewSchema.optional(), updatedAt: z.string().datetime(),
}).strict().superRefine((p, c) => {
  for (let i = 1; i <= Math.min(3, p.stage - 2); i++) if (!p.answers[`q${i}` as keyof typeof p.answers]) c.addIssue({ code: 'custom', message: '수업 답변이 빠졌어요.' });
  if ((p.stage === 6 || p.completedAt) && (!p.answers.q1 || !p.answers.q2 || !p.answers.q3 || !p.sentence.trim() || !p.check)) c.addIssue({ code: 'custom', message: '문장과 자기 점검을 먼저 저장해 주세요.' });
  if (p.review && !p.completedAt) c.addIssue({ code: 'custom', message: '수업을 마친 뒤 다시 점검할 수 있어요.' });
  if (p.stage === 6 && !p.completedAt) c.addIssue({ code: 'custom', message: '수업의 완료 정보가 빠졌어요.' });
  if (p.feedback && p.feedback.original !== p.sentence) c.addIssue({ code: 'custom', message: 'AI 의견의 원문과 현재 문장이 달라요.' });
});
export const grammarStateSchema = z.record(lessonIdSchema, grammarProgressSchema);
export type GrammarProgress = z.infer<typeof grammarProgressSchema>;
export type GrammarState = Partial<Record<LessonId, GrammarProgress>>;
export type GrammarAnswer = z.infer<typeof answerSchema>;
export type QuestionKey = 'q1' | 'q2' | 'q3';
export const QUESTION_KEYS: QuestionKey[] = ['q1', 'q2', 'q3'];
export const newGrammarProgress = (now = new Date().toISOString()): GrammarProgress => ({ stage: 0, answers: {}, sentence: '', updatedAt: now });
export function recordAnswer(previous: GrammarAnswer | undefined, answer: string, helped = false): GrammarAnswer {
  return { first: previous?.first ?? answer, latest: answer, helped: !!previous?.helped || helped, attempts: Math.min(1000, (previous?.attempts ?? 0) + 1) };
}
export function updateGrammarSentence(progress: GrammarProgress, sentence: string): GrammarProgress {
  if (progress.sentence === sentence) return progress;
  // Editing a checked sentence requires a fresh self-check; previous AI text is not applied to a new draft.
  return { ...progress, sentence, check: undefined, feedback: undefined, stage: 5, completedAt: undefined, review: undefined };
}
