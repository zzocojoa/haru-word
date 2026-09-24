'use client';
import { ArrowRight, Check, CheckCircle2, CircleHelp } from 'lucide-react';
import { answerCorrect, firstAnswerLabel, type GrammarQuestion as Question } from '@/lib/grammar/content';
import type { GrammarAnswer } from '@/lib/grammar/model';

type Props = {
  question: Question;
  answer?: GrammarAnswer;
  hinted: boolean;
  selection: number[];
  onOrder: (selection: number[]) => void;
  onAnswer: (answer: string) => void;
  onHint: () => void;
  onNext: () => void;
  disabled: boolean;
};

export function GrammarQuestion({ question, answer, hinted, selection, onOrder, onAnswer, onHint, onNext, disabled }: Props) {
  const correct = !!answer && answerCorrect(question, answer.latest);
  const feedbackTitle = answer ? correct ? '이번 답은 맞아요.' : '다시 확인해 보세요.' : '답을 확인했어요.';
  return <div className="grammar-stage">
    {question.context && <div className="grammar-example"><p lang="en">{question.context}</p><p>{question.translation}</p></div>}
    <h3 className="grammar-question">{question.prompt}</h3>
    {question.kind === 'order'
      ? <OrderAnswer question={question} selection={selection} onOrder={onOrder} onAnswer={onAnswer} disabled={disabled} />
      : <div className="grammar-choices">{question.options.map((option, index) => {
        const selected = answer?.latest === option;
        return <button key={option} disabled={disabled} aria-pressed={selected}
          className={`secondary-button ${selected ? 'is-selected' : ''}`} onClick={() => onAnswer(option)}>
          <span className="grammar-choice-number" aria-hidden="true">{selected ? <Check size={16} /> : index + 1}</span>{option}
        </button>;
      })}</div>}
    <button className="text-button grammar-hint" disabled={disabled || hinted} onClick={onHint}>
      <CircleHelp size={17} aria-hidden="true" />답을 보고 도움받기
    </button>
    {(answer || hinted) && <div className="grammar-feedback" data-tone={answer ? correct ? 'success' : 'review' : 'neutral'} role="status">
      <b className="grammar-feedback-title">
        {correct ? <CheckCircle2 size={19} aria-hidden="true" /> : <CircleHelp size={19} aria-hidden="true" />}{feedbackTitle}
      </b>
      {hinted && <p>답: <span>{question.answer}</span></p>}
      {answer && <p className="small-note">처음 답: {answer.first} · {firstAnswerLabel(question, answer)}{answer.attempts > 1 ? ` · ${answer.attempts}번 시도` : ''}</p>}
      <p>{question.explanation}</p>
    </div>}
    <button className="primary-button" disabled={disabled || !answer} onClick={onNext}>다음<ArrowRight size={18} /></button>
  </div>;
}

function OrderAnswer({ question, selection, onOrder, onAnswer, disabled }: Pick<Props, 'question' | 'selection' | 'onOrder' | 'onAnswer' | 'disabled'>) {
  const selected = selection.filter(index => index < question.options.length);
  const text = selected.map(index => question.options[index]).join(' ');
  return <>
    <p>{question.translation}</p>
    <div className="grammar-order-answer" aria-live="polite" lang={text ? 'en' : 'ko'} data-empty={!text}>{text || '아래 조각을 차례로 눌러 보세요.'}</div>
    <div className="grammar-options">{question.options.map((option, index) =>
      <button className="secondary-button" key={option} disabled={disabled || selected.includes(index)} onClick={() => onOrder([...selected, index])} lang="en">{option}</button>
    )}</div>
    <div className="grammar-actions grammar-order-actions">
      <button className="text-button" disabled={disabled || !selected.length} onClick={() => onOrder(selected.slice(0, -1))}>마지막 조각 취소</button>
      <button className="text-button" disabled={disabled || !selected.length} onClick={() => onOrder([])}>처음부터 놓기</button>
      <button className="secondary-button" disabled={disabled || selected.length !== question.options.length} onClick={() => onAnswer(text)}>정답 확인</button>
    </div>
  </>;
}
