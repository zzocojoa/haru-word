import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { database } from '@/db/store';
import { recordFeedbackAttempt } from '@/db/feedback';
import { today } from '@/lib/learning';
import { LESSON_MAP } from '@/lib/grammar/content';
import { lessonForVersion } from '@/lib/grammar/content-v4';
import { grammarClientVersion, grammarUnsupported } from '@/lib/grammar/compatibility';
import { grammarProgressSchema } from '@/lib/grammar/model';
import { generateGrammarFeedback, grammarFeedbackRequestSchema } from '@/lib/grammar/feedback';
import { FeedbackError } from '@/lib/gemini-feedback';
import { feedbackErrorBody } from '@/lib/feedback-issue';
import { feedbackProvider } from '@/lib/sentence-feedback';
import { json, validateJsonMutation } from '@/lib/server/http';
import { legacyFeedback, supportsFeedbackStructure } from '@/lib/feedback-compatibility';
import { FEEDBACK_BODY_LIMITS, logBodyRejection, readBoundedJsonText, RequestBodyError } from '@/lib/server/request-body';
import { feedbackSafetyIssue } from '@/lib/feedback-safety';

export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  const started = Date.now(), user = await getChatGPTUser();
  if (!user) return json(feedbackErrorBody('login_required'), 401);
  const rejected = validateJsonMutation(request);
  if (rejected) return rejected;
  let body: unknown;
  try {
    const text = await readBoundedJsonText(request, FEEDBACK_BODY_LIMITS);
    body = JSON.parse(text);
  } catch (error) {
    logBodyRejection(error, 'grammar_feedback');
    return json(feedbackErrorBody('invalid_request'), error instanceof RequestBodyError ? error.status : 400);
  }
  const parsed = grammarFeedbackRequestSchema.safeParse(body);
  if (!parsed.success) return json(feedbackErrorBody('invalid_request'), 400);
  if (env.grammar_enabled !== 'true' || env.google_ai_enabled !== 'true') return json(feedbackErrorBody('disabled'), 503);
  try {
    const { lessonId, sentence } = parsed.data, db = database();
    const row = await db.prepare('SELECT document FROM grammar_progress WHERE user_id=? AND lesson_id=?').bind(user.userId, lessonId).first<{ document: string }>();
    if (!row) return json(feedbackErrorBody('save_required'), 404);
    const progress = grammarProgressSchema.parse(JSON.parse(row.document));
    const contentVersion=progress.contentVersion??1;
    // Existing v2 clients did not send a capability header on AI requests.
    if(grammarUnsupported(progress,grammarClientVersion(request.headers.get('x-study-grammar')??'2'))){
      console.warn(JSON.stringify({event:'grammar_client_outdated',contentVersion,code:'grammar_client_outdated'}));
      return json(feedbackErrorBody('grammar_client_outdated'),426);
    }
    if (progress.stage !== 5 || !sentence.trim() || progress.sentence !== sentence) return json(feedbackErrorBody('stale_input'), 409);
    await recordFeedbackAttempt(db, user.userId, today(), Date.now());
    const feedback = await generateGrammarFeedback({ google_api: env.google_api, groq_api: env.groq_api, groq_ai_enabled: env.groq_ai_enabled, feedback_original_sentence_enabled: env.feedback_original_sentence_enabled, feedback_chunked_enabled: env.feedback_chunked_enabled, feedback_coherent_enabled: env.feedback_coherent_enabled, signal: request.signal }, lessonForVersion(LESSON_MAP.get(lessonId)!, progress.contentVersion), sentence);
    const safetyIssue = feedbackSafetyIssue(feedback);
    if (safetyIssue) {
      console.warn(JSON.stringify({ event: 'grammar_feedback_withheld', code: 'analysis_conflict', reason: safetyIssue, contentVersion }));
      return json(feedbackErrorBody('analysis_conflict'), 422);
    }
    console.info(JSON.stringify({ event: 'grammar_feedback_succeeded', model: feedback.model, provider: feedbackProvider(feedback), lessonId, contentVersion, durationMs: Date.now() - started }));
    return json({ feedback: supportsFeedbackStructure(request) ? feedback : legacyFeedback(feedback) });
  } catch (e) {
    const known = e instanceof FeedbackError;
    console.error(JSON.stringify({ event: 'grammar_feedback_failed', code: known ? e.code : 'storage_or_internal', ...(known && e.issue.previous ? { primaryCode: e.issue.previous.code } : {}), durationMs: Date.now() - started }));
    return json(known ? feedbackErrorBody(e.code, e.issue) : feedbackErrorBody('site_error'), known ? e.status : 503);
  }
}
