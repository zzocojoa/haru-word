import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { database } from '@/db/store';
import { cleanupRestoreJobs, RestoreError } from '@/db/restore-jobs';
import { json, validateJsonMutation } from './http';
export const largeRestoreEnabled = () => env.large_backup_restore_enabled === 'true';
export async function readBoundedJsonText(request: Request, limit: number) {
  const reader = request.body?.getReader();
  if (!reader) throw new RestoreError('요청 내용이 비어 있어요.');
  let raw = '', bytes = 0; const decoder = new TextDecoder('utf-8', { fatal: true });
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      bytes += value.byteLength;
      if (bytes > limit) { await reader.cancel(); throw new RestoreError('전송 크기 한도를 넘었어요.', 413); }
      raw += decoder.decode(value, { stream: true });
    }
    return raw + decoder.decode();
  } catch (error) { if (error instanceof RestoreError) throw error; throw new RestoreError('요청 내용을 읽지 못했어요.'); }
  finally { reader.releaseLock(); }
}
export async function restoreEndpoint(request: Request, operation: string, action: (db: D1Database, user: string) => Promise<unknown>) {
  const user = await getChatGPTUser(); if (!user) return json({ error: '로그인이 필요합니다.' }, 401);
  if (request.method !== 'GET') { const rejected = validateJsonMutation(request); if (rejected) return rejected; }
  if (!largeRestoreEnabled() && request.method !== 'GET' && request.method !== 'DELETE') return json({ error: '대용량 복원을 잠시 사용할 수 없어요. 현재 기록은 유지됩니다.' }, 503);
  const started = Date.now();
  try {
    const db = database(); await cleanupRestoreJobs(db, user.userId);
    const result = await action(db, user.userId);
    console.info(JSON.stringify({ event: 'learning_restore_job', operation, outcome: 'success', durationMs: Date.now() - started }));
    return json(result);
  } catch (error) {
    const status = error instanceof RestoreError ? error.status : 503;
    console.warn(JSON.stringify({ event: 'learning_restore_job', operation, outcome: 'failure', status, durationMs: Date.now() - started }));
    return json({ error: error instanceof RestoreError ? error.message : '복원 작업을 처리하지 못했어요. 진행 상태를 확인한 뒤 다시 시도해 주세요.', ...(status === 409 ? { conflict: true } : {}) }, status);
  }
}
