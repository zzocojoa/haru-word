import type { State } from '@/lib/learning';
import { catalogIds, parsePart } from '@/lib/restore-validation';
import { RESTORE_JOB_TTL, RESTORE_RECEIPT_TTL, sha256, utf8Bytes, type RestoreJob, type RestoreManifest } from '@/lib/restore-protocol';

export class RestoreError extends Error {
  constructor(message: string, public status = 400, public code = 'invalid_restore') { super(message); }
}
type JobRow = { id: string; user_id: string; base_revision: number; manifest: string; file_hash: string; status: RestoreJob['status']; validated: number; expires_at: number; committed_revision: number | null };
const changed = () => new RestoreError('현재 기록이 바뀌었어요. 최신 기록을 불러와 안전 백업부터 다시 진행해 주세요.', 409, 'revision_conflict');

export async function cleanupRestoreJobs(db: D1Database, owner: string, now = Date.now()) {
  // Bounded global cleanup plus this owner's expired slot. FK cascade owns parts.
  await db.prepare('DELETE FROM restore_jobs WHERE id IN (SELECT id FROM restore_jobs WHERE expires_at<=? ORDER BY expires_at LIMIT 2) OR (active_owner=? AND expires_at<=?)').bind(now, owner, now).run();
}
async function row(db: D1Database, user: string, id: string): Promise<JobRow> {
  const job = await db.prepare('SELECT * FROM restore_jobs WHERE id=? AND user_id=?').bind(id, user).first<JobRow>();
  if (!job) throw new RestoreError('복원 작업을 찾을 수 없어요. 파일을 다시 선택해 주세요.', 404);
  if (job.expires_at <= Date.now()) throw new RestoreError('복원 작업이 만료됐어요. 파일을 다시 선택해 주세요.', 410);
  return job;
}
async function view(db: D1Database, job: JobRow): Promise<RestoreJob> {
  const parts = await db.prepare('SELECT part_index FROM restore_parts WHERE job_id=? ORDER BY part_index').bind(job.id).all<{ part_index: number }>();
  return { id: job.id, baseRevision: job.base_revision, fileHash: job.file_hash, status: job.status, received: parts.results.map(p => p.part_index), validated: job.validated, total: (JSON.parse(job.manifest) as RestoreManifest).parts.length, expiresAt: job.expires_at, revision: job.committed_revision };
}
export async function getRestoreJob(db: D1Database, user: string, id: string) { return view(db, await row(db, user, id)); }
export async function activeRestoreJob(db: D1Database, user: string) {
  const job = await db.prepare('SELECT * FROM restore_jobs WHERE active_owner=? AND expires_at>?').bind(user, Date.now()).first<JobRow>();
  return job ? view(db, job) : null;
}
async function checkRevision(db: D1Database, user: string, revision: number) {
  const state = await db.prepare('SELECT revision FROM learner_states WHERE user_id=?').bind(user).first<{ revision: number }>();
  if (state?.revision !== revision) throw changed();
}
export async function createRestoreJob(db: D1Database, user: string, revision: number, manifest: RestoreManifest) {
  await checkRevision(db, user, revision);
  const existing = await db.prepare('SELECT * FROM restore_jobs WHERE active_owner=?').bind(user).first<JobRow>();
  const raw = JSON.stringify(manifest);
  if (existing) {
    if (existing.base_revision === revision && existing.manifest === raw) return view(db, existing);
    throw new RestoreError('이어서 할 복원이 있어요. 기존 작업을 취소한 뒤 다시 시작해 주세요.', 409);
  }
  const id = crypto.randomUUID();
  await db.prepare("INSERT INTO restore_jobs(id,user_id,active_owner,base_revision,manifest,file_hash,status,validated,expires_at) SELECT ?,?,?,?,?,?,'uploading',0,? WHERE EXISTS(SELECT 1 FROM learner_states WHERE user_id=? AND revision=?) ON CONFLICT DO NOTHING")
    .bind(id, user, user, revision, raw, manifest.fileHash, Date.now() + RESTORE_JOB_TTL, user, revision).run();
  const created = await db.prepare('SELECT * FROM restore_jobs WHERE active_owner=?').bind(user).first<JobRow>();
  if (!created || created.base_revision !== revision || created.manifest !== raw) throw changed();
  return view(db, created);
}
export async function uploadRestorePart(db: D1Database, user: string, id: string, index: number, raw: string) {
  const job = await row(db, user, id), manifest = JSON.parse(job.manifest) as RestoreManifest, expected = manifest.parts[index];
  if (!Number.isSafeInteger(index) || index < 0 || !expected) throw new RestoreError('전송 순서가 잘못되었어요.');
  if (utf8Bytes(raw) !== expected.bytes || await sha256(raw) !== expected.hash) throw new RestoreError('전송한 내용이 원본과 달라요. 같은 파일을 다시 선택해 주세요.');
  const existing = await db.prepare('SELECT hash FROM restore_parts WHERE job_id=? AND part_index=?').bind(id, index).first<{ hash: string }>();
  if (existing?.hash === expected.hash) return view(db, job);
  if (job.status !== 'uploading') throw new RestoreError('이 작업에는 더 이상 기록을 전송할 수 없어요.', 409);
  await checkRevision(db, user, job.base_revision);
  try { parsePart(raw, expected); } catch (e) { throw new RestoreError(e instanceof Error ? e.message : '기록 검증에 실패했어요.'); }
  await db.prepare("INSERT INTO restore_parts(job_id,part_index,kind,hash,document) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM restore_jobs WHERE id=? AND user_id=? AND status='uploading' AND expires_at>?) ON CONFLICT DO NOTHING")
    .bind(id, index, expected.kind, expected.hash, raw, id, user, Date.now()).run();
  return getRestoreJob(db, user, id);
}

export async function validateRestoreJob(db: D1Database, user: string, id: string) {
  let job = await row(db, user, id);
  if (job.status === 'ready' || job.status === 'committed') return view(db, job);
  if (!['uploading', 'validating'].includes(job.status)) throw new RestoreError('취소된 복원 작업이에요.', 409);
  await checkRevision(db, user, job.base_revision);
  const manifest = JSON.parse(job.manifest) as RestoreManifest;
  const received = await db.prepare('SELECT count(*) AS n FROM restore_parts WHERE job_id=?').bind(id).first<{ n: number }>();
  if (received?.n !== manifest.parts.length) throw new RestoreError('아직 전송하지 않은 기록이 있어요.', 409);
  await db.prepare("UPDATE restore_jobs SET status='validating' WHERE id=? AND user_id=? AND status='uploading'").bind(id, user).run();
  job = await row(db, user, id);
  // Only identifiers cross chunk boundaries. No full history is materialized.
  const keys = await db.prepare('SELECT p.kind,e.key AS id FROM restore_parts p,json_each(p.document) e WHERE p.job_id=?').bind(id).all<{ kind: string; id: string }>();
  const progress = new Set<string>(), sessions = new Set<string>();
  for (const item of keys.results) {
    const set = item.kind === 'progress' ? progress : sessions;
    if (set.has(item.id)) throw new RestoreError('여러 전송 조각에 같은 기록이 중복되어 있어요.');
    set.add(item.id);
  }
  if (manifest.settings.activeSessionId && !sessions.has(manifest.settings.activeSessionId)) throw new RestoreError('이어갈 학습 회차가 빠졌어요.');
  if (job.validated < manifest.parts.length) {
    const part = await db.prepare('SELECT document FROM restore_parts WHERE job_id=? AND part_index=?').bind(id, job.validated).first<{ document: string }>();
    if (!part) throw new RestoreError('검증할 전송 기록이 없어졌어요.', 409);
    const descriptor = manifest.parts[job.validated];
    let entries: Record<string, unknown>;
    try { entries = parsePart(part.document, descriptor); } catch (e) { throw new RestoreError(e instanceof Error ? e.message : '기록 검증에 실패했어요.'); }
    if (descriptor.kind === 'sessions') for (const s of Object.values(entries) as State['sessions'][string][]) {
      for (const entry of [...s.ids.map(k => s.records[k].entryId || k), ...s.warmupIds])
        if (!catalogIds.has(entry) && !progress.has(entry)) throw new RestoreError('회차에서 사용하는 개인 단어가 빠졌어요.');
    }
    await db.prepare("UPDATE restore_jobs SET validated=validated+1 WHERE id=? AND user_id=? AND status='validating' AND validated=? AND expires_at>?").bind(id, user, job.validated, Date.now()).run();
  }
  await db.prepare("UPDATE restore_jobs SET status='ready' WHERE id=? AND user_id=? AND status='validating' AND validated=? AND expires_at>?").bind(id, user, manifest.parts.length, Date.now()).run();
  return getRestoreJob(db, user, id);
}

export async function commitRestoreJob(db: D1Database, user: string, id: string) {
  const job = await row(db, user, id);
  if (job.status === 'committed') return view(db, job);
  if (job.status !== 'ready') throw new RestoreError('전체 검증이 끝난 후 복원할 수 있어요.', 409);
  const manifest = JSON.parse(job.manifest) as RestoreManifest;
  const condition = "EXISTS(SELECT 1 FROM restore_jobs WHERE id=? AND user_id=? AND status='committing')";
  // The transient marker exists only inside this transaction. If any statement
  // fails, even deletions and the receipt roll back together.
  await db.batch([
    db.prepare("UPDATE restore_jobs SET status='committing' WHERE id=? AND user_id=? AND status='ready' AND expires_at>? AND EXISTS(SELECT 1 FROM learner_states WHERE user_id=? AND revision=?)").bind(id, user, Date.now(), user, job.base_revision),
    db.prepare(`DELETE FROM word_progress WHERE user_id=? AND ${condition}`).bind(user, id, user),
    db.prepare(`DELETE FROM study_sessions WHERE user_id=? AND ${condition}`).bind(user, id, user),
    db.prepare(`INSERT INTO word_progress(user_id,entry_id,document) SELECT ?,e.key,e.value FROM restore_parts p,json_each(p.document) e WHERE p.job_id=? AND p.kind='progress' AND ${condition}`).bind(user, id, id, user),
    db.prepare(`INSERT INTO study_sessions(user_id,session_id,document) SELECT ?,e.key,e.value FROM restore_parts p,json_each(p.document) e WHERE p.job_id=? AND p.kind='sessions' AND ${condition}`).bind(user, id, id, user),
    db.prepare(`UPDATE learner_states SET settings=?,revision=revision+1,updated_at=? WHERE user_id=? AND revision=? AND ${condition}`).bind(JSON.stringify(manifest.settings), new Date().toISOString(), user, job.base_revision, id, user),
    db.prepare("UPDATE restore_jobs SET status='committed',committed_revision=?,active_owner=NULL,expires_at=? WHERE id=? AND user_id=? AND status='committing'").bind(job.base_revision + 1, Date.now() + RESTORE_RECEIPT_TTL, id, user),
    db.prepare("DELETE FROM restore_parts WHERE job_id=? AND EXISTS(SELECT 1 FROM restore_jobs WHERE id=? AND user_id=? AND status='committed')").bind(id, id, user),
  ]);
  const result = await getRestoreJob(db, user, id);
  if (result.status !== 'committed') throw changed();
  return result;
}
export async function cancelRestoreJob(db: D1Database, user: string, id: string) {
  await row(db, user, id);
  await db.batch([
    db.prepare("UPDATE restore_jobs SET status='cancelled',active_owner=NULL WHERE id=? AND user_id=? AND status IN ('uploading','validating','ready')").bind(id, user),
    db.prepare("DELETE FROM restore_parts WHERE job_id=? AND EXISTS(SELECT 1 FROM restore_jobs WHERE id=? AND user_id=? AND status='cancelled')").bind(id, id, user),
  ]);
  return getRestoreJob(db, user, id);
}
