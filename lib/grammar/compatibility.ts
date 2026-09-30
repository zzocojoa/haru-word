import type { GrammarProgress } from './model';

export const GRAMMAR_UPGRADE_MESSAGE = '품사 수업이 업데이트되었어요. 현재 입력을 백업한 뒤 페이지를 새로고침해 주세요.';
export function hasModernGrammar(p: GrammarProgress) {
  return !!p.contentVersion || !!p.review?.contentVersion || !!p.schedule || !!p.checks || !!p.observation || !!p.frame
    || !!p.clues || p.choice !== undefined || !!p.review?.clues || p.review?.choice !== undefined;
}
// A v1 reader must never interpret v2 answer strings against its old questions.
// New lessons are omitted; old lesson answers remain visible, without v2 review.
export function legacyGrammarDocument(p: GrammarProgress): GrammarProgress | undefined {
  if (p.contentVersion) return undefined;
  const { stage, answers, sentence, check, feedback, completedAt, updatedAt, hints, order } = p;
  const review = p.review?.contentVersion ? undefined : p.review;
  return { stage, answers, sentence, check, feedback, completedAt, updatedAt, hints, order,
    ...(review ? { review: { index: review.index, answers: review.answers, hints: review.hints, order: review.order, completedAt: review.completedAt } } : {}),
  };
}
export type GrammarClientVersion=1|2|3;
export const GRAMMAR_CLIENT_HEADERS={'X-Study-Grammar':'3'};
export function grammarClientVersion(value:string|null|undefined):GrammarClientVersion {
  return value==='3'?3:value==='2'?2:1;
}
export function requiredGrammarVersion(p:GrammarProgress):GrammarClientVersion {
  return p.contentVersion===3||p.review?.contentVersion===3?3:hasModernGrammar(p)?2:1;
}
export function grammarUnsupported(p:GrammarProgress,supported:GrammarClientVersion) {
  return requiredGrammarVersion(p)>supported;
}
export function grammarDocumentForClient(p:GrammarProgress,supported:GrammarClientVersion):GrammarProgress|undefined {
  if(supported===3)return p;
  if(supported===1)return legacyGrammarDocument(p);
  if(p.contentVersion===3)return undefined;
  if(p.review?.contentVersion!==3)return p;
  // Keep original first answers and schedule; do not recalculate the result of
  // a hidden newer review against this client's older questions.
  const {review: omitted,...base}=p;
  void omitted;
  return base;
}
