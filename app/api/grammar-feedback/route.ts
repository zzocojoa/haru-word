import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { database } from '@/db/store';
import { recordFeedbackAttempt } from '@/db/feedback';
import { today } from '@/lib/learning';
import { LESSON_MAP } from '@/lib/grammar/content';
import { grammarProgressSchema } from '@/lib/grammar/model';
import { generateGrammarFeedback, grammarFeedbackRequestSchema } from '@/lib/grammar/feedback';
import { FeedbackError } from '@/lib/gemini-feedback';
import { FEEDBACK_MODEL } from '@/lib/sentence-feedback';
import { json, validateJsonMutation } from '@/lib/server/http';

export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  const started = Date.now(), user = await getChatGPTUser();
  if (!user) return json({ error: '로그인이 필요합니다.' }, 401);
  const rejected = validateJsonMutation(request);
  if (rejected) return rejected;
  let body: unknown;
  try {
    const text = await request.text();
    if (text.length > 12000) return json({ error: '문장이 너무 깁니다.' }, 413);
    body = JSON.parse(text);
  } catch { return json({ error: '요청 형식이 잘못되었습니다.' }, 400); }
  const parsed = grammarFeedbackRequestSchema.safeParse(body);
  if (!parsed.success) return json({ error: '수업과 문장을 확인해 주세요.' }, 400);
  if (env.grammar_enabled !== 'true' || env.google_ai_enabled !== 'true' || !env.google_api?.trim()) return json({ error: 'AI 점검을 사용할 수 없어요. 자기 점검으로 계속할 수 있어요.' }, 503);
  try {
    const { lessonId, sentence } = parsed.data, db = database();
    const row = await db.prepare('SELECT document FROM grammar_progress WHERE user_id=? AND lesson_id=?').bind(user.userId, lessonId).first<{ document: string }>();
    if (!row) return json({ error: '저장된 수업이 없어요. 먼저 문장을 저장해 주세요.' }, 404);
    const progress = grammarProgressSchema.parse(JSON.parse(row.document));
    if (progress.stage !== 5 || !sentence.trim() || progress.sentence !== sentence) return json({ error: '문장이 바뀌었어요. 현재 문장을 저장한 뒤 다시 점검해 주세요.' }, 409);
    await recordFeedbackAttempt(db, user.userId, today(), Date.now());
    const feedback = await generateGrammarFeedback(env.google_api, LESSON_MAP.get(lessonId)!, sentence);
    console.info(JSON.stringify({ event: 'grammar_feedback_succeeded', model: FEEDBACK_MODEL, lessonId, durationMs: Date.now() - started }));
    return json({ feedback });
  } catch (e) {
    const known = e instanceof FeedbackError;
    console.error(JSON.stringify({ event: 'grammar_feedback_failed', code: known ? e.code : 'storage_or_internal', durationMs: Date.now() - started }));
    return json({ error: known ? e.message : '점검을 준비하지 못했어요. 자기 점검으로 계속할 수 있어요.' }, known ? e.status : 503);
  }
}
