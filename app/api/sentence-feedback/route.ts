import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { database } from '@/db/store';
import { loadFeedbackContext, loadFeedbackModel, loadPersonalWord } from '@/db/feedback';
import { WORD_MAP } from '@/lib/catalog';
import { currentId, entryIdFor, type Session } from '@/lib/learning';
import { feedbackRequestSchema } from '@/lib/sentence-feedback';
import { FeedbackError } from '@/lib/provider-feedback-error';
import { generateOpenAiFeedback, generateStructuredOpenAiFeedback } from '@/lib/openai-feedback';
import { systemInstruction, legacySystemInstruction } from '@/lib/feedback-prompts';
import { AI_MODELS, AI_MODEL_PRICE_DATE, isAiModelEnabled } from '@/lib/ai-models';
import { feedbackErrorBody } from '@/lib/feedback-issue';
import { json, validateJsonMutation } from '@/lib/server/http';
import { supportsFeedbackStructure } from '@/lib/feedback-compatibility';
import { FEEDBACK_BODY_LIMITS, logBodyRejection, readBoundedJsonText, RequestBodyError } from '@/lib/server/request-body';
import { supportsAiContract } from '@/lib/ai-contract';
import { executeFeedbackRequest } from '@/lib/server/feedback-generation';
import {wordFeedbackInput,feedbackContextFingerprint} from '@/lib/feedback-context';

export const dynamic = 'force-dynamic';
const enabled = () => env.ai_feedback_enabled === 'true';

export async function GET(request?: Request) {
  const user = await getChatGPTUser();
  if (!user) return json(feedbackErrorBody('login_required'), 401);
  if (!supportsAiContract(request)) return json(feedbackErrorBody('ai_client_outdated'), 426);
  try {
    const model = await loadFeedbackModel(database(), user.userId), configured = !!env.OPENAI_API_KEY?.trim();
    return json({ available: enabled() && configured && isAiModelEnabled(model, env.OPENAI_ALLOWED_MODELS), configured, enabled: enabled(), model,
      priceDate: AI_MODEL_PRICE_DATE, models: AI_MODELS.map(item => ({ ...item, enabled: isAiModelEnabled(item.id, env.OPENAI_ALLOWED_MODELS) })) });
  } catch { return json(feedbackErrorBody('site_error'), 503); }
}

export async function POST(request: Request) {
  const started = Date.now();
  const user = await getChatGPTUser();
  if (!user) return json(feedbackErrorBody('login_required'), 401);
  const rejected = validateJsonMutation(request);
  if (rejected) return rejected;
  if (!supportsAiContract(request)) return json(feedbackErrorBody('ai_client_outdated'), 426);
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
  const { sessionId, entryId, sentence, expectedModelId, contextNote, expectedContextFingerprint,contextKind } = parsed.data;
  try {
    const db = database();
    const context = await loadFeedbackContext(db, user.userId, 'word', sessionId);
    const session = context.document ? JSON.parse(context.document) as Session : null;
    if (!session) return json(feedbackErrorBody('save_required'), 404);
    if (context.modelId !== expectedModelId) return json(feedbackErrorBody('model_changed'), 409);
    if (!isAiModelEnabled(context.modelId, env.OPENAI_ALLOWED_MODELS)) return json(feedbackErrorBody('model_unavailable'), 503);
    if (!env.OPENAI_API_KEY?.trim()) return json(feedbackErrorBody('not_configured'), 503);
    if (session.finished || session.stage !== 'sentence' || currentId(session) !== entryId) {
      return json(feedbackErrorBody('stale_input'), 409);
    }
    const wordId = entryIdFor(session, entryId);
    const word = WORD_MAP.get(wordId) ?? await loadPersonalWord(db, user.userId, wordId);
    const meaning = session.records[entryId]?.meaning;
    if (!word || !meaning) return json(feedbackErrorBody('save_required'), 400);
    const judgmentEnabled = env.feedback_judgment_enabled === 'true';
    if (judgmentEnabled && !supportsAiContract(request,4)) return json(feedbackErrorBody('ai_client_outdated'),426);
    if(expectedContextFingerprint&&!judgmentEnabled)return json(feedbackErrorBody('disabled'),503);
    const input=wordFeedbackInput(word,meaning,sentence,contextNote,session.records[entryId]?.material?.expression || word.word,contextKind);
    const contextFingerprint=await feedbackContextFingerprint('word',JSON.stringify([sessionId,entryId]),input,expectedModelId);
    if (expectedContextFingerprint && expectedContextFingerprint!==contextFingerprint) return json(feedbackErrorBody('stale_input'),409);
    return await executeFeedbackRequest({ db, userId: user.userId, request, receipt: parsed.data, started, contextFingerprint, contextNote,
      scope: {domain:'word',targetId:sessionId,revision:context.revision,
        fingerprint:[entryId,wordId,input,expectedModelId,judgmentEnabled?systemInstruction:legacySystemInstruction,supportsFeedbackStructure(request),supportsAiContract(request,3)]},
    }, () => {
      const generate = judgmentEnabled ? generateOpenAiFeedback : generateStructuredOpenAiFeedback;
      return generate({ apiKey: env.OPENAI_API_KEY, modelId: context.modelId, allowedModels: env.OPENAI_ALLOWED_MODELS, signal: request.signal }, judgmentEnabled?input:{word:word.word,pos:word.pos,meaning,sentence}, judgmentEnabled ? systemInstruction : legacySystemInstruction);
    });
  } catch (error) {
    const known = error instanceof FeedbackError;
    console.error(JSON.stringify({ event: 'sentence_feedback_failed', durationMs: Date.now() - started, code: known ? error.code : 'storage_or_internal', ...(known && error.validationStage ? { validationStage: error.validationStage } : {}),...(known&&error.judgmentReason?{judgmentReason:error.judgmentReason}:{}) }));
    return json(known ? feedbackErrorBody(error.code, error.issue) : feedbackErrorBody('site_error'), known ? error.status : 503);
  }
}
