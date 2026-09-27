import { z } from 'zod';
import { sentenceFeedbackSchema } from '../sentence-feedback';
import { isCalendarDate } from '../calendar-date';

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
const dateSchema = z.string().refine(isCalendarDate, '올바른 한국 날짜를 확인해 주세요.');
const questionIdsSchema = z.tuple([z.string().max(80), z.string().max(80), z.string().max(80)]);
const helpSchema = z.enum(['clue', 'answer', 'gloss', 'translation']);
const practiceFields = {
  contentVersion: z.literal(2).optional(), questionIds: questionIdsSchema.optional(),
  clues: questionHintsSchema.optional(), choice: z.string().max(200).optional(),
};
export const selfCheckSchema = z.enum(['appropriate', 'needs_work', 'uncertain']);
const reviewSchema = z.object({ ...practiceFields, setId: z.enum(['a', 'b']).optional(), mode: z.enum(['extra', 'scheduled']).optional(), startedOn: dateSchema.optional(), reused: z.boolean().optional(), index: z.number().int().min(0).max(3), answers: answersSchema, hints: questionHintsSchema.optional(), order: orderSelectionSchema.optional(), completedAt: z.string().datetime().optional() }).strict().superRefine((r, c) => {
  for (let i = 1; i <= r.index; i++) if (!r.answers[`q${i}` as keyof typeof r.answers]) c.addIssue({ code: 'custom', message: '재점검 답변이 빠졌어요.' });
  if ((r.index === 3) !== !!r.completedAt) c.addIssue({ code: 'custom', message: '재점검의 완료 상태와 위치가 달라요.' });
  if (r.contentVersion === 2 && (!r.questionIds || !r.setId || !r.mode || !r.startedOn)) c.addIssue({ code: 'custom', message: '재점검 문제 정보가 빠졌어요.' });
  if (!r.contentVersion && (r.questionIds || r.setId || r.mode || r.startedOn || r.reused !== undefined)) c.addIssue({ code: 'custom', message: '재점검 콘텐츠 버전이 빠졌어요.' });
});
export const grammarProgressSchema = z.object({
  ...practiceFields,
  observation: answerSchema.optional(), observationHelp: helpSchema.optional(),
  observationChoice: z.string().max(200).optional(),
  frame: z.array(z.string().max(200)).max(4).optional(),
  checks: z.object({ meaning: selfCheckSchema.optional(), form: selfCheckSchema.optional() }).strict().optional(),
  schedule: z.object({
    nextDate: dateSchema.optional(), lastDate: dateSchema,
    passed: z.number().int().min(0).max(2), nextSet: z.enum(['a', 'b']),
    used: z.object({ a: z.number().int().min(0).max(10000), b: z.number().int().min(0).max(10000) }).strict(),
  }).strict().optional(),
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
  if (p.contentVersion === 2) {
    if (!p.questionIds || (p.stage > 0 && !p.observation)) c.addIssue({ code: 'custom', message: '살펴보기 답변과 문제 정보를 확인해 주세요.' });
    if ((p.stage === 6 || p.completedAt) && (!p.checks?.meaning || !p.checks.form)) c.addIssue({ code: 'custom', message: '뜻과 형태를 각각 점검해 주세요.' });
    if (p.check && p.check !== combinedCheck(p.checks)) c.addIssue({ code: 'custom', message: '자기 점검 결과가 일치하지 않아요.' });
  }
  if (!p.contentVersion && (p.questionIds || p.observation || p.observationHelp || p.observationChoice !== undefined || p.frame || p.checks)) c.addIssue({ code: 'custom', message: '수업 콘텐츠 버전이 빠졌어요.' });
  if (p.schedule && !p.completedAt) c.addIssue({ code: 'custom', message: '수업 완료 후 복습을 추천할 수 있어요.' });
  if (p.schedule?.passed === 2 && p.schedule.nextDate) c.addIssue({ code: 'custom', message: '두 차례 점검 후에는 자유 연습이에요.' });
  if (p.schedule && p.schedule.passed < 2 && (!p.schedule.nextDate || p.schedule.nextDate <= p.schedule.lastDate)) c.addIssue({ code: 'custom', message: '다음 복습 날짜를 확인해 주세요.' });
});
export const grammarStateSchema = z.record(lessonIdSchema, grammarProgressSchema).superRefine((state, ctx) => {
  for (const [id, p] of Object.entries(state)) {
    for (const [bank, entry] of [['base', p], [p.review?.setId, p.review]] as const) {
      if (entry?.contentVersion === 2 && entry.questionIds?.some((qid, i) => qid !== `${id}:2:${bank}:q${i + 1}`))
        ctx.addIssue({ code: 'custom', path: [id, 'questionIds'], message: '문제와 수업의 식별자가 맞지 않아요.' });
    }
  }
});
export type GrammarProgress = z.infer<typeof grammarProgressSchema>;
export type GrammarState = Partial<Record<LessonId, GrammarProgress>>;
export type GrammarAnswer = z.infer<typeof answerSchema>;
export type QuestionKey = 'q1' | 'q2' | 'q3';
export const QUESTION_KEYS: QuestionKey[] = ['q1', 'q2', 'q3'];
export const newGrammarProgress = (now = new Date().toISOString()): GrammarProgress => ({ stage: 0, answers: {}, sentence: '', updatedAt: now });
export function combinedCheck(checks?: { meaning?: z.infer<typeof selfCheckSchema>; form?: z.infer<typeof selfCheckSchema> }): z.infer<typeof selfCheckSchema> | undefined {
  if (!checks?.meaning || !checks.form) return undefined;
  if (checks.meaning === 'needs_work' || checks.form === 'needs_work') return 'needs_work';
  return checks.meaning === 'uncertain' || checks.form === 'uncertain' ? 'uncertain' : 'appropriate';
}
export function recordAnswer(previous: GrammarAnswer | undefined, answer: string, helped = false): GrammarAnswer {
  // Every submitted answer reveals an explanation. A retry is therefore no
  // longer an unaided first response, even without pressing the hint button.
  return { first: previous?.first ?? answer, latest: answer, helped: !!previous || helped, attempts: Math.min(1000, (previous?.attempts ?? 0) + 1) };
}
export function revealGrammarAnswer(progress: GrammarProgress, key: QuestionKey, reviewing: boolean): GrammarProgress {
  const target = reviewing ? progress.review : progress;
  if (!target) return progress;
  const answer = target.answers[key];
  const update = {
    hints: [...new Set([...(target.hints ?? []), key])],
    answers: answer ? { ...target.answers, [key]: { ...answer, helped: true } } : target.answers,
  };
  // Viewing help must be recorded even when the learner proceeds without
  // submitting another answer. It is not itself an answer or another attempt.
  return reviewing ? { ...progress, review: { ...progress.review!, ...update } } : { ...progress, ...update };
}
export function updateGrammarSentence(progress: GrammarProgress, sentence: string): GrammarProgress {
  if (progress.sentence === sentence) return progress;
  // Editing a checked sentence requires a fresh self-check; previous AI text is not applied to a new draft.
  return { ...progress, sentence, check: undefined, checks: undefined, feedback: undefined, stage: 5, completedAt: undefined, review: undefined, schedule: undefined };
}
