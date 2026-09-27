import { z } from 'zod';
import { grammarStateSchema } from './grammar/model';
import rawWords from '@/data/words.json';
import { createStateSchemas } from './state-shape';
import { stateIdentityIssues } from './state-integrity';
export { validProgressIdentity } from './state-integrity';
const ids = new Set(rawWords.map(w => w.id));
const levels = new Map(rawWords.map(w => [w.id, w.level]));
const entryId = z.string().refine(id => ids.has(id) || /^personal_[a-zA-Z0-9-]{36}$/.test(id), '알 수 없는 단어입니다.');
export const { progressSchema, settingsSchema, sessionSchema } = createStateSchemas(entryId, id => levels.get(id));
export const saveSchema = z.object({
    grammar: grammarStateSchema.optional(),
    revision: z.number().int().min(0), settings: settingsSchema.optional(), progress: z.record(entryId, progressSchema).refine(v => Object.keys(v).length <= 5000), sessions: z.record(z.string().uuid(), sessionSchema).refine(v => Object.keys(v).length <= 3)
}).strict().superRefine((v, c) => {
    for (const message of stateIdentityIssues(v)) c.addIssue({ code: 'custom', message });
});
