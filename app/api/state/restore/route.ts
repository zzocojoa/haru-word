import { getChatGPTUser } from '@/app/chatgpt-auth';
import { database } from '@/db/store';
import { restoreState } from '@/db/learning-state';
import { MAX_BACKUP_BYTES, parseBackup } from '@/lib/backup';
import { json, validateJsonMutation } from '@/lib/server/http';
import { largeRestoreEnabled } from '@/lib/server/restore-http';
import { LARGE_BACKUP_BYTES, RESTORE_PART_BYTES } from '@/lib/restore-protocol';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!await getChatGPTUser()) return json({ error: '로그인이 필요합니다.' }, 401);
  const enabled = largeRestoreEnabled();
  return json({ enabled, maxBytes: enabled ? LARGE_BACKUP_BYTES : MAX_BACKUP_BYTES, partBytes: RESTORE_PART_BYTES });
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return json({ error: '로그인이 필요합니다.' }, 401);
  const rejected = validateJsonMutation(request);
  if (rejected) return rejected;
  const revision = Number(request.headers.get('x-study-revision'));
  if (!request.headers.has('x-study-revision') || !Number.isSafeInteger(revision) || revision < 0) {
    return json({ error: '현재 기록을 다시 불러와 주세요.' }, 400);
  }
  let raw = '';
  const reader = request.body?.getReader();
  if (!reader) return json({ error: '백업 파일이 비어 있어요.' }, 400);
  try {
    let length = 0;
    const decoder = new TextDecoder('utf-8', { fatal: true });
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_BACKUP_BYTES) {
        await reader.cancel();
        return json({ error: '백업 파일은 8 MB까지 복원할 수 있어요.' }, 413);
      }
      raw += decoder.decode(value, { stream: true });
    }
    raw += decoder.decode();
  } catch {
    return json({ error: '백업 파일을 읽지 못했어요.' }, 400);
  }
  let state;
  try { state = parseBackup(raw).state; }
  catch (e) { return json({ error: e instanceof Error ? e.message : '백업 파일을 확인해 주세요.' }, 400); }
  const started = Date.now();
  try {
    if (!await restoreState(database(), user.userId, revision, state)) {
      return json({ error: '다른 기기에서 기록이 바뀌었어요. 최신 기록을 확인하고 다시 복원해 주세요.', conflict: true }, 409);
    }
    console.info(JSON.stringify({ event: 'learning_backup_restored', words: Object.keys(state.progress).length, sessions: Object.keys(state.sessions).length, durationMs: Date.now() - started }));
    return json({ revision: revision + 1 });
  } catch {
    console.error(JSON.stringify({ event: 'learning_backup_restore_failed', durationMs: Date.now() - started }));
    return json({ error: '복원을 완료하지 못했어요. 서버 기록을 확인한 뒤 다시 시도해 주세요.' }, 503);
  }
}
