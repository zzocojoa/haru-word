import type { SentenceFeedback } from './sentence-feedback';
import type { State } from './learning';

export const FEEDBACK_STRUCTURE_HEADER = 'X-Study-Feedback-Structure';
export const FEEDBACK_STRUCTURE_HEADERS = { [FEEDBACK_STRUCTURE_HEADER]: '1' };
export const FEEDBACK_UPGRADE_MESSAGE = 'AI 문장 구조가 추가되었어요. 현재 입력을 백업한 뒤 페이지를 새로고침해 주세요.';
export const supportsFeedbackStructure = (request?: Request) => request?.headers.get(FEEDBACK_STRUCTURE_HEADER) === '1';

export function legacyFeedback(feedback: SentenceFeedback): SentenceFeedback {
  const legacy = { ...feedback }; delete legacy.structure;
  return legacy;
}
export function hasStructuredFeedback(state: Pick<State, 'sessions' | 'grammar'>) {
  return Object.values(state.sessions).some(s => Object.values(s.records).some(r => !!r.aiFeedback?.structure))
    || Object.values(state.grammar ?? {}).some(p => !!p.feedback?.structure);
}

// Apply only to individual response documents, retaining streaming and avoiding
// a full parsed copy of account history. Stored documents are never modified.
export function legacyFeedbackDocument(raw: string, kind: 'session' | 'grammar') {
  if (!raw.includes('"structure":')) return raw;
  const doc = JSON.parse(raw);
  if (kind === 'session') {
    for (const record of Object.values(doc.records) as { aiFeedback?: SentenceFeedback }[])
      if (record.aiFeedback?.structure) record.aiFeedback = legacyFeedback(record.aiFeedback);
  } else if (doc.feedback?.structure) doc.feedback = legacyFeedback(doc.feedback);
  return JSON.stringify(doc);
}
