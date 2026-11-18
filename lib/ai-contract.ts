import { z } from 'zod';
import type { State } from './learning';
import type { SentenceFeedback } from './sentence-feedback';
import { FEEDBACK_MODEL, GROQ_FEEDBACK_MODEL } from './learning/feedback-identity.ts';

export const storedAiModelSchema = z.string().min(1).max(128).regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/);
export const AI_CONTRACT_HEADER = 'X-Study-AI-Contract';
export const AI_CONTRACT_HEADERS = { [AI_CONTRACT_HEADER]: '4' };
export const AI_UPGRADE_MESSAGE = 'AI 모델 설정이 업데이트됐어요. 현재 입력을 백업한 뒤 페이지를 새로고침해 주세요.';
export const aiContractVersion = (request?: Request) => {
  const value = request?.headers.get(AI_CONTRACT_HEADER);
  return value === '4' ? 4 : value === '3' ? 3 : value === '2' ? 2 : 1;
};
export const supportsAiContract = (request?: Request, minimum = 2) => aiContractVersion(request) >= minimum;

export function requiresAiContractFeedback(feedback?: SentenceFeedback, supported = 1) {
  if(supported<4&&['judgment-v4','judgment-v5','judgment-v6','judgment-v7','judgment-v8','judgment-v9','judgment-v10'].includes(feedback?.validationVersion??''))return true;
  if (supported >= 3) return false;
  if (supported === 2) return !!feedback && (feedback.contextFingerprint !== undefined || feedback.contextNote !== undefined);
  return !!feedback && (feedback.model !== FEEDBACK_MODEL && feedback.model !== GROQ_FEEDBACK_MODEL
    || feedback.provider !== undefined || feedback.requestedModel !== undefined
    || feedback.promptVersion !== undefined || feedback.validationVersion !== undefined);
}
export function requiresAiContractState(state: Pick<State, 'sessions' | 'grammar'> & { settings?: State['settings'] }, supported = 1) {
  return supported < 2 && state.settings?.aiModelId !== undefined
    || Object.values(state.sessions).some(s => Object.values(s.records).some(r => requiresAiContractFeedback(r.aiFeedback, supported)))
    || Object.values(state.grammar ?? {}).some(p => requiresAiContractFeedback(p.feedback, supported));
}
// Old clients only: inspect one snapshot document at a time before any projection.
export function requiresAiContractDocument(raw: string, kind: 'settings' | 'session' | 'grammar', supported = 1) {
  const doc = JSON.parse(raw);
  if (kind === 'settings') return supported < 2 && doc.aiModelId !== undefined;
  if (kind === 'grammar') return requiresAiContractFeedback(doc.feedback, supported);
  return Object.values(doc.records as State['sessions'][string]['records']).some(r => requiresAiContractFeedback(r.aiFeedback, supported));
}
