import { LESSON_MAP, answerCorrect, needsGrammarReview, type GrammarQuestion } from './content';
import { practiceForVersion } from './content-v4';
import { newGrammarProgress, QUESTION_KEYS, type GrammarProgress, type LessonId } from './model';
import { today } from '../learning/dates';

const ids = (questions: GrammarQuestion[]) => questions.map(q => q.id!) as [string, string, string];
export function newLessonProgress(id: LessonId, now = new Date().toISOString(), contentVersion:2|3|4=2): GrammarProgress {
  return { ...newGrammarProgress(now), contentVersion, questionIds: ids(practiceForVersion(id,contentVersion).questions) };
}
export function questionsFor(id: LessonId, progress: GrammarProgress, reviewing = false): GrammarQuestion[] {
  const legacy = LESSON_MAP.get(id)!;
  if (reviewing) return progress.review?.contentVersion
    ? practiceForVersion(id,progress.review.contentVersion).reviews[progress.review.setId!] : legacy.review;
  return progress.contentVersion ? practiceForVersion(id,progress.contentVersion).questions : legacy.questions;
}
function afterDays(date: string, days: number) {
  const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10);
}
function reviewSchedule(progress: GrammarProgress) {
  if (progress.schedule) return progress.schedule;
  if (!progress.completedAt) return undefined;
  const lastDate = today(new Date(progress.review?.completedAt ?? progress.completedAt));
  // Legacy completion is a known date, not evidence of an independent v2 pass.
  return { nextDate: afterDays(lastDate, 1), lastDate, passed: 0, nextSet: 'a' as const, used: { a: 0, b: 0 } };
}
export function completeLesson(progress: GrammarProgress, date: string, now = new Date().toISOString()): GrammarProgress {
  return { ...progress, stage: 6, completedAt: now, schedule: progress.schedule ?? {
    nextDate: afterDays(date, 1), lastDate: date, passed: 0, nextSet: 'a', used: { a: 0, b: 0 },
  } };
}
export function startGrammarReview(id: LessonId, progress: GrammarProgress, date: string, contentVersion:2|3|4=2): GrammarProgress {
  if (!progress.completedAt || progress.review && !progress.review.completedAt) return progress;
  // Old results are not retested against new answers. New reviews use the enabled version;
  // a review already in progress keeps its original content until completion.
  const schedule = reviewSchedule(progress)!;
  const scheduled = !!schedule.nextDate && date >= schedule.nextDate && date > schedule.lastDate;
  const latestSet = progress.review?.completedAt && progress.review.contentVersion ? progress.review.setId : undefined;
  // Extras alternate too, but must not consume the set reserved for a later day.
  const setId = scheduled || !latestSet ? schedule.nextSet : latestSet === 'a' ? 'b' : 'a';
  return { ...progress, schedule, review: {
    contentVersion, questionIds: ids(practiceForVersion(id,contentVersion).reviews[setId]), setId,
    mode: scheduled ? 'scheduled' : 'extra',
    startedOn: date, reused: schedule.used[setId] > 0, index: 0, answers: {},
  } };
}
export function finishGrammarReview(id: LessonId, progress: GrammarProgress, date: string, now = new Date().toISOString()): GrammarProgress {
  if (!progress.review || progress.review.completedAt) return progress;
  const review = { ...progress.review, index: 3, order: undefined, choice: undefined, completedAt: now };
  if (!review.contentVersion || !progress.schedule || !review.setId) return { ...progress, review };
  const independent = questionsFor(id, progress, true).every((q, i) => {
    const key = QUESTION_KEYS[i], a = review.answers[key];
    return a && !a.helped && !review.hints?.includes(key) && !review.clues?.includes(key)
      && answerCorrect(q, a.first) && answerCorrect(q, a.latest);
  });
  const schedule = { ...progress.schedule, used: { ...progress.schedule.used, [review.setId]: Math.min(10000, progress.schedule.used[review.setId] + 1) } };
  if (review.mode === 'scheduled' && date > schedule.lastDate && date >= (schedule.nextDate ?? date)) {
    schedule.nextSet = review.setId === 'a' ? 'b' : 'a';
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
    (observation.helped || !answerCorrect(practiceForVersion(id,progress.contentVersion).observation, observation.first)
      || !answerCorrect(practiceForVersion(id,progress.contentVersion).observation, observation.latest));
  const needsWork = needsGrammarReview(LESSON_MAP.get(id)!, progress, questions) || observationNeedsWork;
  const schedule = reviewSchedule(progress);
  const due = !!schedule?.nextDate && schedule.nextDate <= date;
  const text = schedule?.nextDate ? due ? '다른 날 다시 확인할 차례예요.' : `${schedule.nextDate} 다시 확인 추천`
    : schedule?.passed === 2 ? '두 차례 확인했어요 · 자유 연습 가능' : '';
  return { needsWork, due, text };
}
