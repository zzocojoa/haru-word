import { z } from 'zod';
import { grammarStateSchema } from './grammar/model';
import words from '@/data/words.json';
import { progressSchema, sessionSchema, settingsSchema, validProgressIdentity } from './validation';
import { LARGE_BACKUP_BYTES, RESTORE_PART_BYTES, utf8Bytes, type RestorePart } from './restore-protocol';
import { assertBackupStructure } from './backup-structure';
import { validSessionIdentity } from './state-integrity';
import { assertStateDataKeys } from './state-data-keys';
import { STATE_COUNTS } from './state-limits';
export const catalogIds = new Set(words.map(w => w.id));
export const digestSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const manifestSchema = z.object({
  fileHash: digestSchema, fileBytes: z.number().int().min(1).max(LARGE_BACKUP_BYTES), settings: settingsSchema,
  parts: z.array(z.object({ kind: z.enum(['progress', 'sessions', 'grammar']), bytes: z.number().int().min(2).max(RESTORE_PART_BYTES), hash: digestSchema, count: z.number().int().min(0).max(10000) }).strict()).max(64),
}).strict().superRefine((m, ctx) => {
  const sum = (kind: string) => m.parts.filter(p => p.kind === kind).reduce((n, p) => n + p.count, 0);
  if (sum('progress') > STATE_COUNTS.progress || sum('sessions') > STATE_COUNTS.sessions || sum('grammar') > STATE_COUNTS.grammar || m.parts.filter(p => p.kind === 'grammar').length > 1 || m.parts.some(p => p.kind !== 'grammar' && !p.count) || m.parts.reduce((n,p) => n+p.bytes, utf8Bytes(JSON.stringify(m.settings))) > LARGE_BACKUP_BYTES)
    ctx.addIssue({ code: 'custom', message: '복원할 기록이 지원 범위를 넘었어요.' });
});
export const createRestoreSchema = z.object({ revision: z.number().int().nonnegative().safe(), manifest: manifestSchema }).strict();
export function parsePart(raw: string, part: RestorePart): Record<string, unknown> {
  let value: unknown;
  try { value = JSON.parse(raw); }
  catch { throw new Error('전송한 기록의 JSON 형식이 잘못되었어요.'); }
  assertBackupStructure(value);
  assertStateDataKeys(value, part.kind);
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== part.count) throw new Error('전송한 기록 수가 맞지 않아요.');
  if (part.kind === 'grammar') {
    if (!grammarStateSchema.safeParse(value).success) throw new Error('품사 수업 진도의 형식이 잘못되었어요.');
    return value as Record<string, unknown>;
  }
  for (const [id, row] of Object.entries(value)) {
    if (part.kind === 'progress') {
      const p = progressSchema.safeParse(row);
      if (!p.success || !(catalogIds.has(id) || /^personal_[a-zA-Z0-9-]{36}$/.test(id)) || !validProgressIdentity(id, p.data)) throw new Error('단어 기록의 형식이 잘못되었어요.');
    } else {
      const s = sessionSchema.safeParse(row);
      if (!s.success || !validSessionIdentity(id, s.data)) throw new Error('학습 회차의 형식이나 진행 위치가 잘못되었어요.');
    }
  }
  return value as Record<string, unknown>;
}
