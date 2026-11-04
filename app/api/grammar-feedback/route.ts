import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { database } from '@/db/store';
import { loadFeedbackContext } from '@/db/feedback';
import { LESSON_MAP } from '@/lib/grammar/content';
import { lessonForVersion } from '@/lib/grammar/content-v4';
import { grammarClientVersion, grammarUnsupported } from '@/lib/grammar/compatibility';
import { grammarProgressSchema } from '@/lib/grammar/model';
import { generateGrammarFeedback, grammarFeedbackRequestSchema } from '@/lib/grammar/feedback';
import { FeedbackError } from '@/lib/provider-feedback-error';
import { isAiModelEnabled } from '@/lib/ai-models';
import { feedbackErrorBody } from '@/lib/feedback-issue';
import { json, validateJsonMutation } from '@/lib/server/http';
import { supportsFeedbackStructure } from '@/lib/feedback-compatibility';
import { FEEDBACK_BODY_LIMITS, logBodyRejection, readBoundedJsonText, RequestBodyError } from '@/lib/server/request-body';
import { supportsAiContract } from '@/lib/ai-contract';
import { executeFeedbackRequest } from '@/lib/server/feedback-generation';
import {grammarFeedbackInput,legacyGrammarFeedbackInput,grammarInstruction,legacyGrammarInstruction} from '@/lib/grammar/feedback';
import {feedbackContextFingerprint} from '@/lib/feedback-context';

export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  const started = Date.now(), user = await getChatGPTUser();
  if (!user) return json(feedbackErrorBody('login_required'), 401);
  const rejected = validateJsonMutation(request);
  if (rejected) return rejected;
  if (!supportsAiContract(request)) return json(feedbackErrorBody('ai_client_outdated'), 426);
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
  if (env.grammar_enabled !== 'true' || env.ai_feedback_enabled !== 'true') return json(feedbackErrorBody('disabled'), 503);
  try {
    const { lessonId, sentence, expectedModelId,contextNote,expectedContextFingerprint,contextKind } = parsed.data, db = database();
    const context = await loadFeedbackContext(db, user.userId, 'grammar', lessonId);
    if (!context.document) return json(feedbackErrorBody('save_required'), 404);
    if (context.modelId !== expectedModelId) return json(feedbackErrorBody('model_changed'), 409);
    if (!isAiModelEnabled(context.modelId, env.OPENAI_ALLOWED_MODELS)) return json(feedbackErrorBody('model_unavailable'), 503);
    if (!env.OPENAI_API_KEY?.trim()) return json(feedbackErrorBody('not_configured'), 503);
    const progress = grammarProgressSchema.parse(JSON.parse(context.document));
    const contentVersion=progress.contentVersion??1;
    // Existing v2 clients did not send a capability header on AI requests.
    if(grammarUnsupported(progress,grammarClientVersion(request.headers.get('x-study-grammar')??'2'))){
      console.warn(JSON.stringify({event:'grammar_client_outdated',contentVersion,code:'grammar_client_outdated'}));
      return json(feedbackErrorBody('grammar_client_outdated'),426);
    }
    if (progress.stage !== 5 || !sentence.trim() || progress.sentence !== sentence) return json(feedbackErrorBody('stale_input'), 409);
    const lesson=lessonForVersion(LESSON_MAP.get(lessonId)!,progress.contentVersion),judgmentEnabled=env.feedback_judgment_enabled==='true';
    if(judgmentEnabled&&!supportsAiContract(request,4))return json(feedbackErrorBody('ai_client_outdated'),426);
    if(expectedContextFingerprint&&!judgmentEnabled)return json(feedbackErrorBody('disabled'),503);
    const input=grammarFeedbackInput(lesson,sentence,contextNote,contextKind);
    const contextFingerprint=await feedbackContextFingerprint('grammar',JSON.stringify([lessonId,contentVersion]),input,expectedModelId);
    if(expectedContextFingerprint&&expectedContextFingerprint!==contextFingerprint)return json(feedbackErrorBody('stale_input'),409);
    return await executeFeedbackRequest({ db, userId: user.userId, request, receipt: parsed.data, started, contextFingerprint, contextNote,
      grammar: { lessonId, contentVersion },
      scope: {domain:'grammar',targetId:lessonId,revision:context.revision,
        fingerprint:[contentVersion,judgmentEnabled?input:legacyGrammarFeedbackInput(lesson,sentence),expectedModelId,judgmentEnabled?grammarInstruction:legacyGrammarInstruction,supportsFeedbackStructure(request),supportsAiContract(request,3)]},
    }, () => generateGrammarFeedback({ apiKey: env.OPENAI_API_KEY, modelId: context.modelId, allowedModels: env.OPENAI_ALLOWED_MODELS, signal: request.signal, judgmentEnabled,contextNote,contextKind }, lesson, sentence));
  } catch (e) {
    const known = e instanceof FeedbackError;
    console.error(JSON.stringify({ event: 'grammar_feedback_failed', code: known ? e.code : 'storage_or_internal', ...(known && e.validationStage ? { validationStage: e.validationStage } : {}),...(known&&e.judgmentReason?{judgmentReason:e.judgmentReason}:{}), durationMs: Date.now() - started }));
    return json(known ? feedbackErrorBody(e.code, e.issue) : feedbackErrorBody('site_error'), known ? e.status : 503);
  }
}
