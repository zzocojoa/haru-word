import type { SaveStateRequest } from '@/lib/api-contracts';
import { EMPTY, type State } from '@/lib/learning';
import { serializeBackup } from '@/lib/backup-format';
import { STATE_COUNTS, STATE_BACKUP_BYTES, STATE_PART_BYTES } from '@/lib/state-limits';

const bytes = (text: string) => new TextEncoder().encode(text).byteLength;
const emptyBackup = { settings: EMPTY.settings, progress: {}, sessions: {}, grammar: {} };
const envelopeBytes = bytes(serializeBackup(emptyBackup, new Date('2000-01-01T00:00:00.000Z'))) - bytes(JSON.stringify(EMPTY.settings));
const collections = [
  ['progress', 'word_progress', 'entry_id'],
  ['sessions', 'study_sessions', 'session_id'],
  ['grammar', 'grammar_progress', 'lesson_id'],
] as const;
type Kind = typeof collections[number][0];
type Aggregate = { revision: number; settings: string } & Record<`${Kind}_${'count' | 'bytes' | 'largest'}`, number>;

export class StateCapacityError extends Error {
  constructor(public code: string, message: string) { super(`${message} 저장하지 못한 입력은 따로 보관해 주세요. 서버 기록은 변경하지 않았어요.`); }
}

// Read counts/UTF-8 byte totals, never load or parse the account's full history.
// A single SELECT sees one revision. saveState's final CAS invalidates this check
// if another writer changes any records before the atomic write batch.
export async function checkSaveCapacity(db: D1Database, user: string, data: SaveStateRequest, replace = false): Promise<boolean> {
  const args: (string | number)[] = [];
  const queries = collections.map(([kind, table, key]) => {
    const replacing = replace && (kind !== 'grammar' || data.grammar !== undefined);
    args.push(user, JSON.stringify(Object.keys(data[kind] ?? {})));
    const rowBytes = `length(CAST(json_quote(${key}) AS BLOB))+1+length(CAST(document AS BLOB))`;
    return `(SELECT count(*) AS n,coalesce(sum(${rowBytes}),0) AS bytes,coalesce(max(${rowBytes}+2),0) AS largest FROM ${table} WHERE user_id=? AND ${key} NOT IN (SELECT value FROM json_each(?))${replacing ? ' AND 0' : ''}) AS ${kind}`;
  });
  const columns = collections.flatMap(([kind]) => [`${kind}.n AS ${kind}_count`, `${kind}.bytes AS ${kind}_bytes`, `${kind}.largest AS ${kind}_largest`]);
  args.push(user);
  const remaining = await db.prepare(`SELECT profile.revision,profile.settings,${columns.join(',')} FROM learner_states AS profile CROSS JOIN ${queries.join(' CROSS JOIN ')} WHERE profile.user_id=?`)
    .bind(...args).first<Aggregate>();
  if (!remaining || remaining.revision !== data.revision) return false;
  for (const [kind] of collections) {
    const entries = Object.entries(data[kind] ?? {});
    remaining[`${kind}_count`] += entries.length;
    for (const [key, row] of entries) {
      const length = bytes(JSON.stringify(key)) + 1 + bytes(JSON.stringify(row));
      remaining[`${kind}_bytes`] += length;
      remaining[`${kind}_largest`] = Math.max(remaining[`${kind}_largest`], length + 2);
    }
  }
  assertCapacity(remaining, data.settings ? JSON.stringify(data.settings) : remaining.settings);
  return true;
}

function assertCapacity(totals: Aggregate, settings: string) {
  let totalBytes = envelopeBytes + bytes(settings);
  for (const [kind] of collections) {
    const count = totals[`${kind}_count`];
    if (count > STATE_COUNTS[kind]) throw new StateCapacityError(`state_${kind}_limit`,
      `${kind === 'progress' ? '단어 기록' : kind === 'sessions' ? '학습 회차' : '품사 수업'}은 계정당 ${STATE_COUNTS[kind].toLocaleString('ko-KR')}개까지 저장할 수 있어요.`);
    const collectionBytes = totals[`${kind}_bytes`] + Math.max(0, count - 1);
    if (totals[`${kind}_largest`] > STATE_PART_BYTES || (kind === 'grammar' && collectionBytes + 2 > STATE_PART_BYTES))
      throw new StateCapacityError('state_record_limit', '한 기록이 복원 가능한 크기를 넘었어요.');
    totalBytes += collectionBytes;
  }
  if (totalBytes > STATE_BACKUP_BYTES) throw new StateCapacityError('state_backup_limit', '전체 기록이 백업·복원 한도 20 MB를 넘었어요.');
}

// Staged restores need the same final-state check, including grammar retained by
// legacy backups. Aggregate compact JSON entries as the commit INSERT will store
// them, rather than trusting client-declared fileBytes or materializing all parts.
export async function checkStagedRestoreCapacity(db: D1Database, user: string, revision: number,
  settings: State['settings'], job: string, preserveGrammar: boolean): Promise<boolean> {
  const args: (string | number)[] = [];
  const queries = collections.map(([kind]) => {
    const kept = kind === 'grammar' && preserveGrammar;
    const key = kept ? 'lesson_id' : 'entry.key', document = kept ? 'document' : 'entry.value';
    const source = kept ? 'grammar_progress WHERE user_id=?' : 'restore_parts AS part,json_each(part.document) AS entry WHERE part.job_id=? AND part.kind=?';
    if (kept) args.push(user); else args.push(job, kind);
    const rowBytes = `length(CAST(json_quote(${key}) AS BLOB))+1+length(CAST(${document} AS BLOB))`;
    return `(SELECT count(*) AS n,coalesce(sum(${rowBytes}),0) AS bytes,coalesce(max(${rowBytes}+2),0) AS largest FROM ${source}) AS ${kind}`;
  });
  args.push(user);
  const columns = collections.flatMap(([kind]) => [`${kind}.n AS ${kind}_count`, `${kind}.bytes AS ${kind}_bytes`, `${kind}.largest AS ${kind}_largest`]);
  const totals = await db.prepare(`SELECT profile.revision,profile.settings,${columns.join(',')} FROM learner_states AS profile CROSS JOIN ${queries.join(' CROSS JOIN ')} WHERE profile.user_id=?`)
    .bind(...args).first<Aggregate>();
  if (!totals || totals.revision !== revision) return false;
  assertCapacity(totals, JSON.stringify(settings));
  return true;
}
