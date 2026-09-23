import { z } from 'zod';
import { MAX_DAILY_GOAL } from './learning/model';
import { sentenceFeedbackSchema } from './sentence-feedback';
import { isCalendarDate } from './calendar-date';
// Structure and local invariants only. Callers choose catalog validation at their boundary.
export function createStateSchemas(entryId: z.ZodType<string>) {
    const targetId = z.string().max(100).refine(id => entryId.safeParse(id).success || /^target_[a-f0-9-]{36}$/.test(id), "알 수 없는 학습 대상입니다.");
    const level = z.enum(["A1", "A2", "B1", "B2"]);
    const result = z.enum(["independent", "help", "unmeasured"]);
    const familiarity = z.enum(["known", "uncertain", "new"]);
    const date = z.string().refine(isCalendarDate, "존재하지 않는 학습 날짜가 있어요.");
    const text = z.string().max(2000);
    const materialText = z.object({
        meaning: text,
        expression: text,
        expressionTranslation: text.optional(),
        example: text,
        translation: text
    });
    const optionalMaterialText = materialText.partial().shape;
    const personal = z.object({
        id: entryId, word: z.string().trim().min(1).max(80), headword: z.string().max(100), pos: z.string().max(30), level, page: z.literal(0), personal: z.literal(true)
    }).strict();
    const familiarityCheck = z.object({
        initial: familiarity, answer: text, meaning: text, final: familiarity.optional()
    }).strict().refine(c => !c.final || c.final === c.initial || (c.initial === "known" && c.final === "uncertain"), "뜻 공개 후 친숙도를 올릴 수 없습니다.");
    const sense = z.object({
        ...optionalMaterialText, en: result.optional(), ko: result.optional(), sentenceStatus: z.enum(["written", "improve", "unmeasured"]).optional(), sentence: text.optional(), notes: text.optional(), studyDates: z.array(date).max(20000).optional(), lastStudied: date.optional(), lastReviewed: date.optional(), needsReview: z.boolean().optional()
    }).strict();
    const material = materialText.extend({
        ipa: text.optional(), source: text, attribution: text.optional(), url: z.string().url().refine(v => v.startsWith("https://")).optional()
    }).strict();
    const progressSchema = z.object({
        senses: z.record(z.string().max(2000), sense).refine(v => Object.keys(v).length <= 100).optional(), familiarity: familiarity.optional(), familiarityCheck: familiarityCheck.optional(), ...optionalMaterialText, en: result.optional(), ko: result.optional(), sentenceStatus: z.enum(["written", "improve", "unmeasured"]).optional(), sentence: text.optional(), notes: text.optional(), studyDates: z.array(date).max(20000).optional(), lastStudied: date.optional(), needsReview: z.boolean().optional(), personal: personal.optional(), useful: z.boolean().optional(), lastReviewed: date.optional(), encounters: z.array(z.object({
            date, source: z.enum(["reading", "listening"]), text
        }).strict()).max(200).optional()
    }).strict();
    const assessment = z.object({
        ids: z.array(entryId).max(20), index: z.number().int().min(0).max(20), marks: z.record(entryId, familiarity), completed: z.boolean()
    }).strict();
    const settingsSchema = z.object({
        level, dailyGoal: z.number().int().min(1).max(MAX_DAILY_GOAL), assessments: z.object({
            A1: assessment.optional(), A2: assessment.optional(), B1: assessment.optional(), B2: assessment.optional()
        }).strict(), activeSessionId: z.string().uuid().nullable(), newWordsPaused: z.boolean().optional(), monthlyBatchSize: z.number().int().min(1).max(15).optional(), reviewDay: z.number().int().min(0).max(6).optional()
    }).strict();
    const record = z.object({
        entryId: entryId.optional(), learnedOn: date.optional(), lastPracticedOn: date.optional(), material: material.optional(), historicalMeaningUnknown: z.boolean().optional(), aiFeedback: sentenceFeedbackSchema.optional(), meaning: text, familiarity: familiarity.optional(), en: result, ko: result, sentenceStatus: z.enum(["written", "improve", "unmeasured"]), sentence: text, notes: text, spoken: z.boolean().optional(), enAnswer: text.optional(), koAnswer: text.optional(), hintEn: z.boolean().optional(), hintKo: z.boolean().optional(), retryEn: result.optional(), retryKo: result.optional(), draft: z.object({
            answer: text, hinted: z.boolean(), revealed: z.boolean(), stage: z.enum(["en", "ko"]), retry: z.boolean()
        }).strict().optional()
    }).strict();
    const sessionSchema = z.object({
        id: z.string().uuid(), kind: z.enum(["daily", "weekly", "monthly", "practice"]), date, period: z.string().regex(/^\d{4}-\d{2}(?:-\d{2})?$/), ids: z.array(targetId).max(5000), wordKeys: z.record(targetId, z.string().max(100)).optional(), warmupIds: z.array(entryId).max(3), warmupResults: z.record(entryId, result).optional(), warmupDraft: z.object({
            id: entryId, answer: text, hinted: z.boolean(), revealed: z.boolean()
        }).strict().optional(), stage: z.enum(["warmup", "learn", "en", "ko", "sentence", "checkpoint", "done"]), index: z.number().int().min(0).max(5000), records: z.record(targetId, record), retry: z.array(z.object({
            id: targetId, direction: z.enum(["en", "ko"]), seen: z.array(targetId).max(5000).optional()
        }).strict()).max(10000), retryMode: z.boolean(), resumeAfterRetry: z.object({ stage: z.enum(["warmup", "learn", "en", "ko", "sentence", "checkpoint", "done"]), index: z.number().int().min(0).max(5000) }).strict().optional(), batchSize: z.number().int().min(1).max(15).optional(), batchStart: z.number().int().min(0).max(5000).optional(), reviewEnd: z.number().int().min(1).max(5000).optional(), practiceMode: z.enum(["known", "ko", "sentence", "repeat"]).optional(), elapsed: z.number().int().min(0).max(31536000), finished: z.boolean(), paused: z.boolean(), createdAt: z.string().datetime()
    }).strict().superRefine((s, ctx) => {
        const issue = (message: string) => ctx.addIssue({ code: 'custom', message });
        if (!s.ids.length || s.ids.some(id => !s.records[id]))
            issue('회차의 목표 단어 기록이 빠졌어요.');
        if (s.kind === 'monthly' ? !/^\d{4}-\d{2}$/.test(s.period) || !isCalendarDate(s.period + '-01') : !isCalendarDate(s.period))
            issue('점검 기간이 잘못되었어요.');
        if (new Set(s.warmupIds).size !== s.warmupIds.length || Object.keys(s.warmupResults || {}).some(id => !s.warmupIds.includes(id)) || s.warmupDraft && !s.warmupIds.includes(s.warmupDraft.id))
            issue('이전 복습의 단어 정보가 맞지 않아요.');
        if (Object.keys(s.wordKeys || {}).some(id => !s.ids.includes(id)) || s.retry.some(r => r.seen?.some(id => !s.ids.includes(id))))
            issue('재시도 순서가 맞지 않아요.');
        const limit = s.stage === 'warmup' ? s.warmupIds.length : s.ids.length;
        if (s.finished !== (s.stage === 'done') || s.retryMode && !s.retry.length || s.index > limit || (!s.finished && !s.retryMode && s.stage !== 'checkpoint' && s.index >= limit))
            issue('학습을 이어갈 위치가 맞지 않아요.');
        if (s.stage === 'checkpoint' && ((s.kind !== 'monthly' && s.kind !== 'weekly') || s.index >= s.ids.length) || s.resumeAfterRetry && s.resumeAfterRetry.index > s.ids.length)
            issue('점검을 이어갈 위치가 맞지 않아요.');
        if (s.reviewEnd !== undefined && (!['weekly', 'monthly'].includes(s.kind) || s.reviewEnd >= s.ids.length || s.reviewEnd <= (s.batchStart || 0)))
            ctx.addIssue({ code: 'custom', message: '추가 점검의 진행 경계가 맞지 않습니다.' });
        for (const [key, r] of Object.entries(s.records))
            if (key.startsWith("target_") ? !r.entryId : r.entryId && r.entryId !== key)
                ctx.addIssue({ code: "custom", message: "단어와 뜻별 대상이 일치하지 않습니다." });
        if (new Set(s.ids).size !== s.ids.length)
            ctx.addIssue({ code: "custom", message: "중복 학습 항목" });
        const valid = new Set(s.ids);
        if (Object.keys(s.records).some(id => !valid.has(id)) || s.retry.some(x => !valid.has(x.id)))
            ctx.addIssue({ code: "custom", message: "목표 목록과 기록이 일치하지 않습니다." });
        if (s.practiceMode === "repeat" && (s.kind !== "practice" || s.period.length !== 10))
            ctx.addIssue({ code: "custom", message: "다시 학습의 원래 학습일이 필요합니다." });
        if (s.kind === "daily" && s.ids.length > MAX_DAILY_GOAL)
            ctx.addIssue({ code: "custom", message: `하루 목표는 최대 ${MAX_DAILY_GOAL}개입니다.` });
    });
    return {
        progressSchema, settingsSchema, sessionSchema
    };
}
