'use client';
import {HaruParagraph,HaruHeading} from '../haru-content';
import {HaruButton} from '../haru-controls';

import { HaruIcon } from '@/components/icons/haru-icon';
import { answerCorrect, firstAnswerLabel, type GrammarLesson, type GrammarQuestion } from '@/lib/grammar/content';
import { QUESTION_KEYS, type GrammarProgress } from '@/lib/grammar/model';
import { CHECK_TEXT } from './grammar-presentation';
import { FeedbackAttribution } from '../feedback-attribution';
import { practiceForVersion, legacyNowNote, legacyContentNote } from '@/lib/grammar/content-v4';
import { grammarReviewStatus, questionsFor } from '@/lib/grammar/practice';

type Props = {
  lesson: GrammarLesson;
  progress: GrammarProgress;
  dirty: boolean;
  error: string;
  canSave: boolean;
  date: string;
  onReview: () => void;
  onWriting: () => void;
  onWords: () => void;
};

export function GrammarSummary({ lesson, progress, dirty, error, canSave, date, onReview, onWriting, onWords }: Props) {
  const message = dirty ? error ? '완료 기록을 저장해 주세요.' : '완료 기록을 저장하고 있어요.' : '수업을 마쳤어요.';
  const icon = dirty ? error ? 'cloud-unsaved' : 'loading' : 'check-circle';
  return <div className="grammar-stage">
    <div className="grammar-summary-heading" data-pending={dirty}>
      <HaruIcon name={icon} size={26} />
      <div><HaruParagraph className="grammar-role" role="status">{message}</HaruParagraph><HaruParagraph className="small-note">수업을 마쳐도 내용을 모두 익혔다는 뜻은 아니에요.</HaruParagraph></div>
    </div>
    <HaruParagraph className="small-note">살펴보기 · {progress.contentVersion ? firstAnswerLabel(practiceForVersion(lesson.id,progress.contentVersion).observation, progress.observation) : '아직 확인 안 함 · 이전 수업 기록'}</HaruParagraph>
    {legacyNowNote(lesson.id,progress.contentVersion,false,2)&&<HaruParagraph className="small-note">{legacyNowNote(lesson.id,progress.contentVersion,false,2)}</HaruParagraph>}
    <ResultList questions={questionsFor(lesson.id, progress)} answers={progress.answers} title="처음 연습" />
    {progress.review?.completedAt && <ResultList questions={questionsFor(lesson.id, progress, true)} answers={progress.review.answers} title={progress.review.mode === 'extra' ? '최근 추가 연습' : '최근 다시 확인'} />}
    {progress.review?.completedAt && legacyContentNote(lesson.id,progress.review.contentVersion,true,2,progress.review.setId) && <HaruParagraph className="small-note">{legacyContentNote(lesson.id,progress.review.contentVersion,true,2,progress.review.setId)}</HaruParagraph>}
    <div className="grammar-example"><small>내 문장</small><HaruParagraph lang="en">{progress.sentence}</HaruParagraph><small>자기 점검 · {progress.check && CHECK_TEXT[progress.check]}</small></div>
    {progress.feedback && <FeedbackAttribution feedback={progress.feedback} />}
    <HaruParagraph className="grammar-review-recommendation">{grammarReviewStatus(lesson.id, progress, date).text || '원할 때 다른 문맥으로 확인해 보세요.'}</HaruParagraph>
    {progress.check !== 'appropriate' && <HaruParagraph className="small-note">다음 할 일 · 내 문장의 뜻과 형태를 보완해 보세요.</HaruParagraph>}
    <div className="grammar-actions">
      <HaruButton label={["다른 3문제로 확인"].join('')} variant="secondary" icon={<HaruIcon name="repeat" size={17} />} className="haru-migrated secondary-button" disabled={!canSave || dirty} onClick={onReview}>다른 3문제로 확인</HaruButton>
      <HaruButton label={["내 문장 보완"].join('')} variant="ghost" className="haru-migrated text-button" onClick={onWriting}>내 문장 보완</HaruButton>
    </div>
    <HaruButton label={["같은 품사의 단어 보기"].join('')} variant="primary" endContent={<HaruIcon name="arrow-right" size={18} />} className="haru-migrated primary-button" onClick={onWords}>같은 품사의 단어 보기</HaruButton>
  </div>;
}

function ResultList({ questions, answers, title }: { questions: GrammarQuestion[]; answers: GrammarProgress['answers']; title: string }) {
  return <div className="grammar-results"><HaruHeading level={3}>{title}</HaruHeading><ul>{questions.map((question, index) => {
    const answer = answers[QUESTION_KEYS[index]];
    const independent = !!answer && answerCorrect(question, answer.first) && answerCorrect(question, answer.latest) && !answer.helped;
    return <li key={index}>
      <span className="grammar-result-icon" data-independent={independent} aria-hidden="true"><HaruIcon name={independent ? 'check' : 'repeat'} size={18} /></span>
      <div><span>{index + 1}. {firstAnswerLabel(question, answer)}</span><HaruParagraph>{answer && answerCorrect(question, answer.latest) ? '최근 답을 확인했어요.' : question.explanation}</HaruParagraph></div>
    </li>;
  })}</ul></div>;
}
