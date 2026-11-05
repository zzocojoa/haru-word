import { getChatGPTUser } from '@/app/chatgpt-auth';
import { env } from 'cloudflare:workers';
import { database } from '@/db/store';
import { existingSessionIds, loadStateDocuments, saveState, validSaveReferences } from '@/db/learning-state';
import { stateResponse } from '@/lib/server/state-response';
import { today } from '@/lib/learning';
import { saveSchema } from '@/lib/validation';
import { json, validateJsonMutation } from '@/lib/server/http';
import { GRAMMAR_UPGRADE_MESSAGE, grammarClientVersion, grammarUnsupported, grammarDocumentForClient } from '@/lib/grammar/compatibility';
import { hasSavedUnsupportedGrammar } from '@/db/grammar-compatibility';
import { grammarProgressSchema } from '@/lib/grammar/model';
import { FEEDBACK_UPGRADE_MESSAGE, hasStructuredFeedback, supportsFeedbackStructure } from '@/lib/feedback-compatibility';
import { hasSavedStructuredFeedback } from '@/db/feedback-compatibility';
import { assertStateDataKeys, hasLiteralPrototypeSense, supportsSenseKeys, SENSE_KEY_UPGRADE_MESSAGE } from '@/lib/state-data-keys';
import { hasSavedLiteralPrototypeSense } from '@/db/sense-key-compatibility';
import { StateCapacityError } from '@/db/state-capacity';
import { logBodyRejection, readBoundedJsonText, RequestBodyError } from '@/lib/server/request-body';
import { STATE_PART_BYTES } from '@/lib/state-limits';
import { AI_UPGRADE_MESSAGE, requiresAiContractDocument, requiresAiContractState, aiContractVersion } from '@/lib/ai-contract';
import { hasSavedAiContract } from '@/db/ai-compatibility';
import { loadFeedbackModel } from '@/db/feedback';
import { isAiModelEnabled, selectedAiModel } from '@/lib/ai-models';

export const dynamic = 'force-dynamic';

export async function GET(request?: Request) {
  const started = Date.now();
  const user = await getChatGPTUser();
  if (!user) return json({ error: '로그인한 뒤 다시 시도해 주세요.' }, 401);
  try {
    const grammarVersion = request?.headers.get('x-study-grammar');
    if (!supportsSenseKeys(request) && await hasSavedLiteralPrototypeSense(database(), user.userId))
      return json({ error: SENSE_KEY_UPGRADE_MESSAGE }, 426);
    // Read all domains atomically before legacy projection, including hidden grammar.
    const snapshot = await loadStateDocuments(database(), user.userId, true);
    const grammarClient=grammarClientVersion(grammarVersion);
    if(grammarClient<5&&snapshot.grammar?.some(row=>grammarUnsupported(grammarProgressSchema.parse(JSON.parse(row.document)),4)))
      return json({error:GRAMMAR_UPGRADE_MESSAGE,code:'grammar_client_outdated'},426);
    const aiVersion=aiContractVersion(request);
    if (requiresAiContractDocument(snapshot.settings, 'settings',aiVersion)
      || snapshot.sessions.some(row => requiresAiContractDocument(row.document, 'session',aiVersion))
      || snapshot.grammar?.some(row => requiresAiContractDocument(row.document, 'grammar',aiVersion)))
      return json({ error: AI_UPGRADE_MESSAGE, code: 'ai_client_outdated' }, 426);
    if (!['1','2','3','4','5'].includes(grammarVersion ?? '')) snapshot.grammar = undefined;
    if (grammarVersion !== '4' && snapshot.grammar) snapshot.grammar = snapshot.grammar.flatMap(row => {
      const legacy = grammarDocumentForClient(grammarProgressSchema.parse(JSON.parse(row.document)),grammarClientVersion(grammarVersion));
      return legacy ? [{ ...row, document: JSON.stringify(legacy) }] : [];
    });
    const wordCount = snapshot.progress.length, sessionCount = snapshot.sessions.length, grammarCount = snapshot.grammar?.length;
    return stateResponse(snapshot,
      bytes => console.info(JSON.stringify({ event: 'learning_state_loaded', wordCount, sessionCount, grammarCount, bytes, durationMs: Date.now() - started })),
      () => console.error(JSON.stringify({ event: 'learning_state_load_failed', durationMs: Date.now() - started })), supportsFeedbackStructure(request));
  } catch {
    console.error(JSON.stringify({ event: 'learning_state_load_failed', durationMs: Date.now() - started }));
    return json({ error: '기록을 불러오지 못했습니다. 잠시 뒤 다시 시도해 주세요.' }, 503);
  }
}

export async function PUT(request: Request) {
  const started = Date.now();
  const user = await getChatGPTUser();
  if (!user) return json({ error: '로그인한 뒤 다시 시도해 주세요.' }, 401);
  const rejected = validateJsonMutation(request);
  if (rejected) return rejected;
  let body: unknown;
  try {
    const raw = await readBoundedJsonText(request, { bytes: STATE_PART_BYTES });
    body = JSON.parse(raw);
    assertStateDataKeys(body);
  } catch (error) {
    logBodyRejection(error, 'save');
    if (error instanceof RequestBodyError && error.status === 413)
      return json({ error: '기록이 너무 큽니다. 회차를 나눠 주세요.' }, 413);
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
    if (requiresAiContractState(data,aiContractVersion(request)) || await hasSavedAiContract(db, user.userId,aiContractVersion(request)))
      return json({ error: AI_UPGRADE_MESSAGE, code: 'ai_client_outdated' }, 426);
    if (data.settings) {
      const previousModel = await loadFeedbackModel(db, user.userId), nextModel = selectedAiModel(data.settings);
      // Preserve inactive historical settings during ordinary saves. A new choice
      // must be an explicitly enabled server model; restore remains archival.
      if (nextModel !== previousModel && !isAiModelEnabled(nextModel, env.OPENAI_ALLOWED_MODELS))
        return json({ error: '선택한 AI 모델을 현재 사용할 수 없어요. 학습 설정에서 사용 가능한 모델을 확인해 주세요.', code: 'model_unavailable' }, 400);
    }
    if (!supportsSenseKeys(request) && (hasLiteralPrototypeSense(data.progress) || await hasSavedLiteralPrototypeSense(db, user.userId, Object.keys(data.progress))))
      return json({ error: SENSE_KEY_UPGRADE_MESSAGE }, 426);
    if (!supportsFeedbackStructure(request) && (hasStructuredFeedback(data) ||
      await hasSavedStructuredFeedback(db, user.userId, Object.keys(data.sessions), Object.keys(data.grammar ?? {})))) {
      console.warn(JSON.stringify({ event: 'feedback_client_outdated', version: 1 }));
      return json({ error: FEEDBACK_UPGRADE_MESSAGE }, 426);
    }
    const supportedGrammar=grammarClientVersion(request.headers.get('x-study-grammar'));
    if (data.grammar && supportedGrammar<5 &&
        (Object.values(data.grammar).some(p=>grammarUnsupported(p,supportedGrammar)) || await hasSavedUnsupportedGrammar(db, user.userId, supportedGrammar,Object.keys(data.grammar)))) {
      console.warn(JSON.stringify({ event: 'grammar_client_outdated', version: supportedGrammar, code:'grammar_client_outdated' }));
      return json({ error: GRAMMAR_UPGRADE_MESSAGE }, 426);
    }
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
    console.info(JSON.stringify({ event: 'learning_state_saved', wordCount: Object.keys(data.progress).length, sessionCount: Object.keys(data.sessions).length, grammarCount: Object.keys(data.grammar ?? {}).length, durationMs: Date.now() - started }));
    return json({ revision: data.revision + 1 });
  } catch (error) {
    if (error instanceof StateCapacityError) {
      console.warn(JSON.stringify({ event: 'learning_state_capacity_rejected', code: error.code, durationMs: Date.now() - started }));
      return json({ error: error.message, code: error.code }, 413);
    }
    console.error(JSON.stringify({ event: 'learning_state_save_failed', durationMs: Date.now() - started, wordCount: Object.keys(data.progress).length, sessionCount: Object.keys(data.sessions).length }));
    return json({ error: '저장하지 못했습니다. 입력은 화면에 남아 있습니다. 다시 저장해 주세요.' }, 503);
  }
}
