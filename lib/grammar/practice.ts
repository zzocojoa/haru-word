import { LESSON_MAP, answerCorrect, needsGrammarReview, type GrammarQuestion } from './content';
import { PRACTICE_LESSONS } from './content-v2';
import { newGrammarProgress, QUESTION_KEYS, type GrammarProgress, type LessonId } from './model';
import { today } from '../learning/dates';

const ids = (questions: GrammarQuestion[]) => questions.map(q => q.id!) as [string, string, string];
export function newLessonProgress(id: LessonId, now = new Date().toISOString()): GrammarProgress {
  return { ...newGrammarProgress(now), contentVersion: 2, questionIds: ids(PRACTICE_LESSONS[id].questions) };
}
export function questionsFor(id: LessonId, progress: GrammarProgress, reviewing = false): GrammarQuestion[] {
  const legacy = LESSON_MAP.get(id)!;
  if (reviewing) return progress.review?.contentVersion === 2
    ? PRACTICE_LESSONS[id].reviews[progress.review.setId!] : legacy.review;
  return progress.contentVersion === 2 ? PRACTICE_LESSONS[id].questions : legacy.questions;
}
function afterDays(date: string, days: number) {
  const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10);
}
export function completeLesson(progress: GrammarProgress, date: string, now = new Date().toISOString()): GrammarProgress {
  return { ...progress, stage: 6, completedAt: now, schedule: progress.schedule ?? {
    nextDate: afterDays(date, 1), lastDate: date, passed: 0, nextSet: 'a', used: { a: 0, b: 0 },
  } };
}
export function startGrammarReview(id: LessonId, progress: GrammarProgress, date: string): GrammarProgress {
  if (!progress.completedAt || progress.review && !progress.review.completedAt) return progress;
  // Old results are not retested against new answers. A new review uses v2;
  // a review already in progress keeps its original content until completion.
  const schedule = progress.schedule ?? {
    nextDate: afterDays(today(new Date(progress.completedAt)), 1),
    lastDate: today(new Date(progress.completedAt)), passed: 0, nextSet: 'a' as const, used: { a: 0, b: 0 },
  };
  const setId = schedule.nextSet;
  return { ...progress, schedule, review: {
    contentVersion: 2, questionIds: ids(PRACTICE_LESSONS[id].reviews[setId]), setId,
    mode: schedule.nextDate && date >= schedule.nextDate && date > schedule.lastDate ? 'scheduled' : 'extra',
    startedOn: date, reused: schedule.used[setId] > 0, index: 0, answers: {},
  } };
}
export function finishGrammarReview(id: LessonId, progress: GrammarProgress, date: string, now = new Date().toISOString()): GrammarProgress {
  if (!progress.review || progress.review.completedAt) return progress;
  const review = { ...progress.review, index: 3, order: undefined, choice: undefined, completedAt: now };
  if (review.contentVersion !== 2 || !progress.schedule || !review.setId) return { ...progress, review };
  const independent = questionsFor(id, progress, true).every((q, i) => {
    const key = QUESTION_KEYS[i], a = review.answers[key];
    return a && !a.helped && !review.hints?.includes(key) && !review.clues?.includes(key)
      && answerCorrect(q, a.first) && answerCorrect(q, a.latest);
  });
  const schedule = { ...progress.schedule, used: { ...progress.schedule.used, [review.setId]: Math.min(10000, progress.schedule.used[review.setId] + 1) }, nextSet: review.setId === 'a' ? 'b' as const : 'a' as const };
  if (review.mode === 'scheduled' && date > schedule.lastDate && date >= (schedule.nextDate ?? date)) {
    schedule.passed = independent ? Math.min(2, schedule.passed + 1) : schedule.passed;
    schedule.lastDate = date;
    schedule.nextDate = schedule.passed === 2 ? undefined : afterDays(date, independent ? 7 : 1);
  }
  return { ...progress, review, schedule };
}
export function grammarReviewStatus(id: LessonId, progress?: GrammarProgress, date = today()) {
  if (!progress) return { needsWork: false, due: false, text: '' };
  const questions = questionsFor(id, progress, !!progress.review?.completedAt);
  // The latest review can resolve an earlier observation error without
  // rewriting the first answer. Writing self-checks remain a separate concern.
  const observation = progress.observation;
  const observationNeedsWork = !progress.review?.completedAt && !!observation &&
    (observation.helped || !answerCorrect(PRACTICE_LESSONS[id].observation, observation.first)
      || !answerCorrect(PRACTICE_LESSONS[id].observation, observation.latest));
  const needsWork = needsGrammarReview(LESSON_MAP.get(id)!, progress, questions) || observationNeedsWork;
  const due = !!progress.schedule?.nextDate && progress.schedule.nextDate <= date;
  const text = progress.schedule?.nextDate ? due ? '다른 날 다시 확인할 차례예요.' : `${progress.schedule.nextDate} 다시 확인 추천`
    : progress.schedule?.passed === 2 ? '두 차례 확인했어요 · 자유 연습 가능' : '';
  return { needsWork, due, text };
}
