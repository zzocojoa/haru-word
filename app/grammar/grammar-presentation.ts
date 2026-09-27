import { GRAMMAR_LESSONS } from '@/lib/grammar/content';
import { grammarReviewStatus } from '@/lib/grammar/practice';
import { today } from '@/lib/learning/dates';
import type { GrammarProgress, GrammarState } from '@/lib/grammar/model';
import type { SentenceFeedback } from '@/lib/sentence-feedback';

export type GrammarFilter = 'all' | 'continue' | 'review';
export const GRAMMAR_FILTERS = [['all', '전체'], ['continue', '이어 하기'], ['review', '다시 확인']] as const;
export const SELF_CHECKS = ['appropriate', 'needs_work', 'uncertain'] as const;
export const CHECK_TEXT = {
  appropriate: '뜻과 형태를 확인했어요',
  needs_work: '아직 보완할 부분이 있어요',
  uncertain: '판단이 어려워요',
} satisfies Record<NonNullable<GrammarProgress['check']>, string>;
const STEPS = ['살펴보기', '이해하기', '연습 1', '연습 2', '연습 3', '써 보기', '정리하기'];
const PHASES = ['살펴보기', '이해하기', '연습하기', '써 보기', '정리하기'];
const REVIEW_STEPS = ['문제 1', '문제 2', '문제 3'];
const GROUPS = [...new Set(GRAMMAR_LESSONS.map(lesson => lesson.group))];

export function grammarStep(progress: GrammarProgress) {
  const review = progress.review && !progress.review.completedAt ? progress.review : undefined;
  const index = review ? review.index : progress.stage - 2;
  return {
    reviewing: !!review,
    index,
    answers: review ? review.answers : progress.answers,
    hints: (review ? review.hints : progress.hints) ?? [],
    selection: (review ? review.order : progress.order) ?? [],
    label: review ? `다시 확인 ${index + 1}/3` : STEPS[progress.stage],
    steps: review ? REVIEW_STEPS : PHASES,
    phase: review ? index : progress.stage < 2 ? progress.stage : progress.stage < 5 ? 2 : progress.stage - 2,
    percent: review ? index / 3 * 100 : progress.stage / 6 * 100,
  };
}

// Counts, badges and visible rows share the same projection. A pending review
// keeps its existing "이어 하기" status; display filters never modify progress.
export function grammarCatalog(progress: GrammarState, filter: GrammarFilter, date = today()) {
  const counts = { all: 0, continue: 0, review: 0, complete: 0 };
  const lessons = GRAMMAR_LESSONS.map(lesson => {
    const saved = progress[lesson.id];
    const complete = !!saved?.completedAt && !(saved.review && !saved.review.completedAt);
    const continuing = !!saved && !complete;
    const recommendation = grammarReviewStatus(lesson.id, saved, date);
    const review = recommendation.needsWork || recommendation.due;
    counts.all++;
    if (complete) counts.complete++;
    if (continuing) counts.continue++;
    if (review) counts.review++;
    return { lesson, complete, continuing, review, recommendation };
  });
  const visible = lessons.filter(lesson => filter === 'all' || (filter === 'continue' ? lesson.continuing : lesson.review));
  const groups = GROUPS.map((title, index) => ({
    title, number: String(index + 1).padStart(2, '0'),
    entries: visible.filter(lesson => lesson.lesson.group === title),
  })).filter(group => group.entries.length > 0);
  return { counts, groups, visibleCount: visible.length };
}

export function grammarFeedbackTone(feedback: Pick<SentenceFeedback, 'meaningUsage' | 'grammar'>) {
  if (feedback.meaningUsage === 'appropriate' && feedback.grammar === 'natural') return 'success';
  if (feedback.meaningUsage === 'needs_work' || feedback.grammar === 'needs_work') return 'review';
  return 'neutral';
}
