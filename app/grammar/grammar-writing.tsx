'use client';
import { Check, Sparkles } from 'lucide-react';
import type { GrammarLesson } from '@/lib/grammar/content';
import type { GrammarProgress } from '@/lib/grammar/model';
import { GRAMMAR_TEXT, type SentenceFeedback } from '@/lib/sentence-feedback';
import { CHECK_TEXT, SELF_CHECKS, grammarFeedbackTone } from './grammar-presentation';
import type { FeedbackIssue } from '@/lib/feedback-issue';
import { FeedbackIssueNotice } from '../feedback-issue-notice';
import { AiUseNotice } from '../ai-use-notice';
import { FeedbackAttribution } from '../feedback-attribution';
import { PRACTICE_LESSONS, frameSentence } from '@/lib/grammar/content-v2';
import { Speak } from '../ui';
import { SentenceStructureView } from '../sentence-structure';

type Props = {
  lesson: GrammarLesson;
  progress: GrammarProgress;
  canSave: boolean;
  aiPending: boolean;
  aiError: FeedbackIssue | null;
  onAi: () => void;
  onSentence: (sentence: string) => void;
  onCheck: (check: NonNullable<GrammarProgress['check']>) => void;
  onChecks: (key: 'meaning' | 'form', value: NonNullable<GrammarProgress['check']>) => void;
  onFrame: (values: string[]) => void;
  onExplain: () => void;
  onComplete: () => void;
};

export function GrammarWriting({ lesson, progress, canSave, aiPending, aiError, onAi, onSentence, onCheck, onChecks, onFrame, onExplain, onComplete }: Props) {
  const { sentence, check, feedback } = progress;
  const practice = PRACTICE_LESSONS[lesson.id], values = practice.frame.slots.map((slot, i) => progress.frame?.[i] ?? slot.options[0]);
  const frame = frameSentence(practice.frame, values);
  return <div className="grammar-stage">
    <p className="grammar-question">{lesson.writing}</p>
    {progress.contentVersion === 2 ? <details className="grammar-frame" open={!sentence}><summary>문장 틀로 시작하기</summary>
      <div className="grammar-frame-slots">{practice.frame.slots.map((slot, i) => <fieldset key={slot.label}><legend>{slot.label}</legend><div className="grammar-options">{slot.options.map(option => <button key={option} className="secondary-button" aria-pressed={values[i] === option} disabled={!canSave} onClick={() => onFrame(values.map((v, j) => j === i ? option : v))} lang="en">{option}</button>)}</div></fieldset>)}</div>
      <p lang="en">{frame}</p><Speak text={frame} /><button className="secondary-button" disabled={!canSave} onClick={() => onSentence(frame)}>{sentence ? '이 틀로 내 문장 바꾸기' : '이 문장으로 시작'}</button>
    </details> : <div className="grammar-example"><small>문장 틀</small><p lang="en">{lesson.stem}</p><Speak text={lesson.stem} /></div>}
    <div className="grammar-writing-area">
      <label className="grammar-writing">내 문장<textarea lang="en" aria-describedby="grammar-sentence-count" maxLength={2000} rows={4}
        value={sentence} onChange={event => onSentence(event.target.value)} placeholder="내 생활에 맞는 문장을 써 보세요." /></label>
      <p id="grammar-sentence-count" className="small-note grammar-character-count">{sentence.length}/2,000자</p>
    </div>
    <div className="grammar-ai-action">
      <button className="secondary-button" disabled={aiPending || !sentence.trim() || !canSave} onClick={onAi}>
        <Sparkles size={18} aria-hidden="true" />{aiPending ? '문장을 점검하고 있어요' : 'AI로 문장 점검'}
      </button>
      <AiUseNotice grammar />
    </div>
    <FeedbackIssueNotice issue={aiError} />
    {feedback && <Feedback feedback={feedback} sentence={sentence} onSentence={onSentence} />}
    {progress.contentVersion === 2 ? <div className="grammar-self-checks"><h3>내가 점검하기</h3>{(['meaning', 'form'] as const).map((key, i) => <fieldset className="grammar-check" key={key}><legend>{practice.checks[i]}</legend><div className="grammar-check-options">{SELF_CHECKS.map(value => <label key={value}><input type="radio" name={`grammar-${lesson.id}-${key}`} checked={progress.checks?.[key] === value} onChange={() => onChecks(key, value)} />{value === 'appropriate' ? '확인했어요' : value === 'needs_work' ? '보완 필요' : '모르겠어요'}</label>)}</div></fieldset>)}</div> : <fieldset className="grammar-check">
      <legend>내가 점검하기</legend><p>{lesson.check}</p>
      {SELF_CHECKS.map(value => <label key={value}>
        <input type="radio" name={`grammar-check-${lesson.id}`} checked={check === value} onChange={() => onCheck(value)} />{CHECK_TEXT[value]}
      </label>)}
    </fieldset>}
    <div className="grammar-actions">
      <button className="text-button" onClick={onExplain}>설명 다시 보기</button>
      <button className="primary-button" disabled={!sentence.trim() || !check || !canSave || aiPending} onClick={onComplete}>수업 마치기<Check size={18} /></button>
    </div>
  </div>;
}

function Feedback({ feedback, sentence, onSentence }: { feedback: SentenceFeedback; sentence: string; onSentence: Props['onSentence'] }) {
  const { meaningUsage, grammar, explanation, correctedSentence } = feedback;
  const meaningLabel = meaningUsage === 'appropriate' ? '목표 문법에 맞아요' : meaningUsage === 'needs_work' ? '목표 문법을 확인해요' : '목표 문법 판단이 어려워요';
  return <div className="grammar-feedback" data-tone={grammarFeedbackTone(feedback)}>
    <h3>AI 의견</h3><p>{meaningLabel} · {GRAMMAR_TEXT[grammar]}</p><p>{explanation}</p>
    <FeedbackAttribution feedback={feedback} />
    {correctedSentence && <>
      <p className="small-note">AI 교정 제안</p><p lang="en">{correctedSentence}</p>
      {correctedSentence !== sentence && <button className="secondary-button" onClick={() => onSentence(correctedSentence)}>수정안 사용하기</button>}
    </>}
    {(correctedSentence || feedback.structure) && <SentenceStructureView structure={feedback.structure} />}
  </div>;
}
