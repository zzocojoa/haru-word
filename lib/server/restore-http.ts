import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { database } from '@/db/store';
import { cleanupRestoreJobs, RestoreError } from '@/db/restore-jobs';
import { json, validateJsonMutation } from './http';
import { RequestBodyError, type BodyMetrics } from './request-body';
export { readBoundedJsonText } from './request-body';
export const largeRestoreEnabled = () => env.large_backup_restore_enabled === 'true';
export type RestoreMetrics = BodyMetrics;
export async function restoreEndpoint(request: Request, operation: string, action: (db: D1Database, user: string, metrics: RestoreMetrics) => Promise<unknown>) {
  const user = await getChatGPTUser(); if (!user) return json({ error: '로그인이 필요합니다.' }, 401);
  if (request.method !== 'GET') { const rejected = validateJsonMutation(request); if (rejected) return rejected; }
  if (!largeRestoreEnabled() && request.method !== 'GET' && request.method !== 'DELETE') return json({ error: '대용량 복원을 잠시 사용할 수 없어요. 현재 기록은 유지됩니다.' }, 503);
  const started = Date.now(), metrics: RestoreMetrics = { bytes: 0 };
  try {
    const db = database(); await cleanupRestoreJobs(db, user.userId);
    const result = await action(db, user.userId, metrics);
    console.info(JSON.stringify({ event: 'learning_restore_job', operation, outcome: 'success', bytes: metrics.bytes, durationMs: Date.now() - started }));
    return json(result);
  } catch (error) {
    const known = error instanceof RestoreError || error instanceof RequestBodyError;
    const status = known ? error.status : 503;
    const code = known ? error.code : 'internal_error';
    console.warn(JSON.stringify({ event: 'learning_restore_job', operation, outcome: 'failure', status, code, bytes: metrics.bytes, durationMs: Date.now() - started }));
    return json({ error: known ? error.message : '복원 작업을 처리하지 못했어요. 진행 상태를 확인한 뒤 다시 시도해 주세요.', code, ...(code === 'revision_conflict' ? { conflict: true } : {}) }, status);
  }
}
