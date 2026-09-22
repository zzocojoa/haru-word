import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { database } from '@/db/store';
import { loadFeedbackSession, loadPersonalWord, recordFeedbackAttempt } from '@/db/feedback';
import { WORD_MAP } from '@/lib/catalog';
import { currentId, entryIdFor, today } from '@/lib/learning';
import { FEEDBACK_MODEL, feedbackRequestSchema } from '@/lib/sentence-feedback';
import { FeedbackError, generateSentenceFeedback } from '@/lib/gemini-feedback';
import { json, validateJsonMutation } from '@/lib/server/http';

export const dynamic = 'force-dynamic';
const enabled = () => !!env.google_api?.trim() && env.google_ai_enabled === 'true';

export async function GET() {
  if (!await getChatGPTUser()) return json({ error: '로그인이 필요합니다.' }, 401);
  return json({ available: enabled(), configured: !!env.google_api?.trim(), model: FEEDBACK_MODEL });
}

export async function POST(request: Request) {
  const started = Date.now();
  const user = await getChatGPTUser();
  if (!user) return json({ error: '로그인이 필요합니다.' }, 401);
  const rejected = validateJsonMutation(request);
  if (rejected) return rejected;
  let raw: unknown;
  try {
    const text = await request.text();
    if (text.length > 12000) return json({ error: '문장이 너무 깁니다.' }, 413);
    raw = JSON.parse(text);
  } catch {
    return json({ error: '요청 형식이 잘못되었습니다.' }, 400);
  }
  const parsed = feedbackRequestSchema.safeParse(raw);
  if (!parsed.success) return json({ error: '문장을 2,000자 이내로 입력해 주세요.' }, 400);
  if (!enabled()) return json({ error: 'AI 교정이 아직 활성화되지 않았어요. 지금은 자기 점검으로 이어가세요.' }, 503);
  const { sessionId, entryId, sentence } = parsed.data;
  try {
    const db = database();
    const session = await loadFeedbackSession(db, user.userId, sessionId);
    if (!session) return json({ error: '학습 회차를 찾지 못했습니다.' }, 404);
    if (session.finished || session.stage !== 'sentence' || currentId(session) !== entryId) {
      return json({ error: '현재 문장 연습에서만 교정할 수 있어요.' }, 409);
    }
    const wordId = entryIdFor(session, entryId);
    const word = WORD_MAP.get(wordId) ?? await loadPersonalWord(db, user.userId, wordId);
    const meaning = session.records[entryId]?.meaning;
    if (!word || !meaning) return json({ error: '단어와 오늘의 뜻을 먼저 저장해 주세요.' }, 400);
    const now = Date.now();
    await recordFeedbackAttempt(db, user.userId, today(), now);
    const feedback = await generateSentenceFeedback(env.google_api!, { word: word.word, pos: word.pos, meaning, sentence });
    console.info(JSON.stringify({ event: 'sentence_feedback_succeeded', model: FEEDBACK_MODEL, durationMs: Date.now() - started }));
    return json({ feedback });
  } catch (error) {
    const known = error instanceof FeedbackError;
    console.error(JSON.stringify({ event: 'sentence_feedback_failed', durationMs: Date.now() - started, code: known ? error.code : 'storage_or_internal' }));
    return json({ error: known ? error.message : '교정을 준비하지 못했어요. 자기 점검으로 계속할 수 있어요.' }, known ? error.status : 503);
  }
}
