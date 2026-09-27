import type { GrammarProgress } from './model';

export const GRAMMAR_UPGRADE_MESSAGE = '품사 수업이 업데이트되었어요. 현재 입력을 백업한 뒤 페이지를 새로고침해 주세요.';
export function hasModernGrammar(p: GrammarProgress) {
  return p.contentVersion === 2 || p.review?.contentVersion === 2 || !!p.schedule || !!p.checks || !!p.observation || !!p.frame
    || !!p.clues || p.choice !== undefined || !!p.review?.clues || p.review?.choice !== undefined;
}
// A v1 reader must never interpret v2 answer strings against its old questions.
// New lessons are omitted; old lesson answers remain visible, without v2 review.
export function legacyGrammarDocument(p: GrammarProgress): GrammarProgress | undefined {
  if (p.contentVersion === 2) return undefined;
  const { stage, answers, sentence, check, feedback, completedAt, updatedAt, hints, order } = p;
  const review = p.review?.contentVersion === 2 ? undefined : p.review;
  return { stage, answers, sentence, check, feedback, completedAt, updatedAt, hints, order,
    ...(review ? { review: { index: review.index, answers: review.answers, hints: review.hints, order: review.order, completedAt: review.completedAt } } : {}),
  };
}
