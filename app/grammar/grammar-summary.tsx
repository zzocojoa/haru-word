'use client';
import { ArrowRight, Check, CheckCircle2, CircleHelp, LoaderCircle, RotateCcw } from 'lucide-react';
import { answerCorrect, firstAnswerLabel, type GrammarLesson, type GrammarQuestion } from '@/lib/grammar/content';
import { QUESTION_KEYS, type GrammarProgress } from '@/lib/grammar/model';
import { CHECK_TEXT } from './grammar-presentation';
import { FeedbackAttribution } from '../feedback-attribution';

type Props = {
  lesson: GrammarLesson;
  progress: GrammarProgress;
  dirty: boolean;
  error: string;
  canSave: boolean;
  onReview: () => void;
  onWriting: () => void;
  onWords: () => void;
};

export function GrammarSummary({ lesson, progress, dirty, error, canSave, onReview, onWriting, onWords }: Props) {
  const message = dirty ? error ? '완료 기록을 저장해 주세요.' : '완료 기록을 저장하고 있어요.' : '수업을 마쳤어요.';
  const StatusIcon = dirty ? error ? CircleHelp : LoaderCircle : CheckCircle2;
  return <div className="grammar-stage">
    <div className="grammar-summary-heading" data-pending={dirty}>
      <StatusIcon size={26} aria-hidden="true" />
      <div><p className="grammar-role" role="status">{message}</p><p className="small-note">수업 마침은 숙달 판정이 아니에요.</p></div>
    </div>
    <ResultList questions={lesson.questions} answers={progress.answers} title="처음 연습" />
    {progress.review?.completedAt && <ResultList questions={lesson.review} answers={progress.review.answers} title="최근 다시 확인" />}
    <div className="grammar-example"><small>내 문장</small><p lang="en">{progress.sentence}</p><small>자기 점검 · {progress.check && CHECK_TEXT[progress.check]}</small></div>
    {progress.feedback && <FeedbackAttribution feedback={progress.feedback} />}
    <div className="grammar-actions">
      <button className="secondary-button" disabled={!canSave} onClick={onReview}><RotateCcw size={17} />다른 3문제로 확인</button>
      <button className="text-button" onClick={onWriting}>내 문장 보완</button>
    </div>
    <button className="primary-button" onClick={onWords}>같은 품사의 단어 보기<ArrowRight size={18} /></button>
  </div>;
}

function ResultList({ questions, answers, title }: { questions: GrammarQuestion[]; answers: GrammarProgress['answers']; title: string }) {
  return <div className="grammar-results"><h3>{title}</h3><ul>{questions.map((question, index) => {
    const answer = answers[QUESTION_KEYS[index]];
    const independent = !!answer && answerCorrect(question, answer.first) && answerCorrect(question, answer.latest) && !answer.helped;
    return <li key={index}>
      <span className="grammar-result-icon" data-independent={independent} aria-hidden="true">{independent ? <Check size={18} /> : <RotateCcw size={18} />}</span>
      <div><span>{index + 1}. {firstAnswerLabel(question, answer)}</span><p>{answer && answerCorrect(question, answer.latest) ? '최근 답을 확인했어요.' : question.explanation}</p></div>
    </li>;
  })}</ul></div>;
}
