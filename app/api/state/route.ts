import { getChatGPTUser } from '@/app/chatgpt-auth';
import { database } from '@/db/store';
import { existingSessionIds, loadState, saveState, validSaveReferences } from '@/db/learning-state';
import { today } from '@/lib/learning';
import { saveSchema } from '@/lib/validation';
import { json, validateJsonMutation } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

export async function GET() {
  const started = Date.now();
  const user = await getChatGPTUser();
  if (!user) return json({ error: '로그인이 필요합니다.' }, 401);
  try {
    const snapshot = await loadState(database(), user.userId);
    console.info(JSON.stringify({ event: 'learning_state_loaded', wordCount: Object.keys(snapshot.state.progress).length, sessionCount: Object.keys(snapshot.state.sessions).length, durationMs: Date.now() - started }));
    return json(snapshot);
  } catch {
    console.error(JSON.stringify({ event: 'learning_state_load_failed', durationMs: Date.now() - started }));
    return json({ error: '기록을 불러오지 못했습니다. 잠시 뒤 다시 시도해 주세요.' }, 503);
  }
}

export async function PUT(request: Request) {
  const started = Date.now();
  const user = await getChatGPTUser();
  if (!user) return json({ error: '로그인이 필요합니다.' }, 401);
  const rejected = validateJsonMutation(request);
  if (rejected) return rejected;
  let body: unknown;
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > 1_800_000) return json({ error: '기록이 너무 큽니다. 회차를 나눠 주세요.' }, 413);
    body = JSON.parse(raw);
  } catch {
    return json({ error: '요청 형식이 잘못되었습니다.' }, 400);
  }
  const parsed = saveSchema.safeParse(body);
  if (!parsed.success) return json({ error: '저장할 기록의 형식을 확인해 주세요.' }, 400);
  const data = parsed.data;
  if (Object.values(data.sessions).some(s => s.reviewEnd !== undefined || (s.kind === 'weekly' && (s.batchStart || 0) > 0)) && request.headers.get('x-study-review-resume') !== '1') {
    return json({ error: '점검 이어가기가 업데이트되었어요. 현재 입력을 백업한 뒤 페이지를 새로고침해 주세요.' }, 426);
  }
  try {
    const db = database();
    if (!await validSaveReferences(db, user.userId, data)) {
      console.warn(JSON.stringify({ event: 'learning_state_invalid_reference' }));
      return json({ error: '이어갈 회차나 개인 단어의 정보가 빠졌어요. 기록을 확인해 주세요.' }, 400);
    }
    if (request.headers.get('x-study-monthly-carryover') !== '1') {
      const monthly = Object.values(data.sessions).filter(s => s.kind === 'monthly').map(s => s.id);
      if (monthly.length && (await existingSessionIds(db, user.userId, monthly)).size) {
        console.warn(JSON.stringify({ event: 'learning_monthly_client_outdated', durationMs: Date.now() - started }));
        return json({ error: '월말 점검 저장 방식이 업데이트되었어요. 현재 입력을 백업한 뒤 페이지를 새로고침해 주세요.' }, 426);
      }
    }
    if (request.headers.get('x-study-server-clock') === '1') {
      const date = today();
      const daily = Object.values(data.sessions).filter(s => s.kind === 'daily' && s.date !== date);
      if (daily.length) {
        const known = await existingSessionIds(db, user.userId, daily.map(s => s.id));
        if (daily.some(s => !known.has(s.id))) {
          console.warn(JSON.stringify({ event: 'learning_day_mismatch', serverStudyDate: date }));
          return json({ error: '한국 날짜가 바뀌었어요. 현재 입력을 보관한 뒤 최신 기록을 불러와 오늘 학습을 다시 시작해 주세요.' }, 409);
        }
      }
    }
    if (!await saveState(db, user.userId, data)) {
      console.warn(JSON.stringify({ event: 'learning_state_conflict', durationMs: Date.now() - started }));
      return json({ error: '다른 기기에서 기록이 바뀌었습니다. 현재 입력을 백업한 뒤 최신 기록을 불러와 주세요.', conflict: true }, 409);
    }
    console.info(JSON.stringify({ event: 'learning_state_saved', wordCount: Object.keys(data.progress).length, sessionCount: Object.keys(data.sessions).length, durationMs: Date.now() - started }));
    return json({ revision: data.revision + 1 });
  } catch {
    console.error(JSON.stringify({ event: 'learning_state_save_failed', durationMs: Date.now() - started, wordCount: Object.keys(data.progress).length, sessionCount: Object.keys(data.sessions).length }));
    return json({ error: '저장하지 못했습니다. 입력은 화면에 남아 있습니다. 다시 저장해 주세요.' }, 503);
  }
}
