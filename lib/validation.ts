import { z } from 'zod';
import rawWords from '@/data/words.json';
import { createStateSchemas } from './state-shape';
const ids = new Set(rawWords.map(w => w.id));
const entryId = z.string().refine(id => ids.has(id) || /^personal_[a-zA-Z0-9-]{36}$/.test(id), '알 수 없는 단어입니다.');
export const { progressSchema, settingsSchema, sessionSchema } = createStateSchemas(entryId);
export const saveSchema = z.object({
    revision: z.number().int().min(0), settings: settingsSchema.optional(), progress: z.record(entryId, progressSchema).refine(v => Object.keys(v).length <= 5000), sessions: z.record(z.string().uuid(), sessionSchema).refine(v => Object.keys(v).length <= 3)
}).strict().superRefine((v, c) => {
    for (const [key, s] of Object.entries(v.sessions))
        if (s.id !== key)
            c.addIssue({ code: "custom", message: "회차 식별자 불일치" });
    for (const [key, p] of Object.entries(v.progress))
        if (p.personal && p.personal.id !== key)
            c.addIssue({ code: "custom", message: "개인 단어 식별자 불일치" });
});
