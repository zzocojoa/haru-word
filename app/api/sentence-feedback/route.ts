import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { database } from '@/db/store';
import { loadFeedbackSession, loadPersonalWord, recordFeedbackAttempt } from '@/db/feedback';
import { WORD_MAP } from '@/lib/catalog';
import { currentId, entryIdFor, today } from '@/lib/learning';
import { FEEDBACK_MODEL, feedbackRequestSchema, feedbackProvider } from '@/lib/sentence-feedback';
import { FeedbackError } from '@/lib/gemini-feedback';
import { generateSentenceFeedbackWithFallback } from '@/lib/feedback-fallback';
import { feedbackErrorBody } from '@/lib/feedback-issue';
import { json, validateJsonMutation } from '@/lib/server/http';
import { legacyFeedback, supportsFeedbackStructure } from '@/lib/feedback-compatibility';
import { FEEDBACK_BODY_LIMITS, logBodyRejection, readBoundedJsonText, RequestBodyError } from '@/lib/server/request-body';

export const dynamic = 'force-dynamic';
const enabled = () => env.google_ai_enabled === 'true';

export async function GET() {
  if (!await getChatGPTUser()) return json(feedbackErrorBody('login_required'), 401);
  const configured = !!env.google_api?.trim() || (!!env.groq_api?.trim() && env.groq_ai_enabled !== 'false');
  return json({ available: enabled() && configured, configured, model: FEEDBACK_MODEL });
}

export async function POST(request: Request) {
  const started = Date.now();
  const user = await getChatGPTUser();
  if (!user) return json(feedbackErrorBody('login_required'), 401);
  const rejected = validateJsonMutation(request);
  if (rejected) return rejected;
  let raw: unknown;
  try {
    const text = await readBoundedJsonText(request, FEEDBACK_BODY_LIMITS);
    raw = JSON.parse(text);
  } catch (error) {
    logBodyRejection(error, 'sentence_feedback');
    return json(feedbackErrorBody('invalid_request'), error instanceof RequestBodyError ? error.status : 400);
  }
  const parsed = feedbackRequestSchema.safeParse(raw);
  if (!parsed.success) return json(feedbackErrorBody('invalid_request'), 400);
  if (!enabled()) return json(feedbackErrorBody('disabled'), 503);
  const { sessionId, entryId, sentence } = parsed.data;
  try {
    const db = database();
    const session = await loadFeedbackSession(db, user.userId, sessionId);
    if (!session) return json(feedbackErrorBody('save_required'), 404);
    if (session.finished || session.stage !== 'sentence' || currentId(session) !== entryId) {
      return json(feedbackErrorBody('stale_input'), 409);
    }
    const wordId = entryIdFor(session, entryId);
    const word = WORD_MAP.get(wordId) ?? await loadPersonalWord(db, user.userId, wordId);
    const meaning = session.records[entryId]?.meaning;
    if (!word || !meaning) return json(feedbackErrorBody('save_required'), 400);
    const now = Date.now();
    await recordFeedbackAttempt(db, user.userId, today(), now);
    const feedback = await generateSentenceFeedbackWithFallback({ google_api: env.google_api, groq_api: env.groq_api, groq_ai_enabled: env.groq_ai_enabled, feedback_original_sentence_enabled: env.feedback_original_sentence_enabled, signal: request.signal }, { word: word.word, pos: word.pos, meaning, sentence });
    console.info(JSON.stringify({ event: 'sentence_feedback_succeeded', model: feedback.model, provider: feedbackProvider(feedback), durationMs: Date.now() - started }));
    return json({ feedback: supportsFeedbackStructure(request) ? feedback : legacyFeedback(feedback) });
  } catch (error) {
    const known = error instanceof FeedbackError;
    console.error(JSON.stringify({ event: 'sentence_feedback_failed', durationMs: Date.now() - started, code: known ? error.code : 'storage_or_internal', ...(known && error.issue.previous ? { primaryCode: error.issue.previous.code } : {}) }));
    return json(known ? feedbackErrorBody(error.code, error.issue) : feedbackErrorBody('site_error'), known ? error.status : 503);
  }
}
