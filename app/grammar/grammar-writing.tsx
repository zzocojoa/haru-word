'use client';
import { useState } from 'react';
import { Check, Sparkles } from 'lucide-react';
import type { GrammarLesson } from '@/lib/grammar/content';
import type { GrammarProgress } from '@/lib/grammar/model';
import type { SentenceFeedback } from '@/lib/sentence-feedback';
import { CHECK_TEXT, SELF_CHECKS } from './grammar-presentation';
import type { FeedbackIssue } from '@/lib/feedback-issue';
import { FeedbackIssueNotice } from '../feedback-issue-notice';
import { AiUseNotice } from '../ai-use-notice';
import { FeedbackDetail } from '../feedback-detail';
import { frameSentence } from '@/lib/grammar/content-v2';
import { practiceForVersion } from '@/lib/grammar/content-v4';
import { Speak } from '../ui';
import { FeedbackCorrection } from '../feedback-correction';
import {currentFeedback} from '@/lib/feedback-selection';
import {feedbackMatchesContext} from '@/lib/feedback-context';

type Props = {
  lesson: GrammarLesson;
  progress: GrammarProgress;
  retainedFeedback?:SentenceFeedback;
  draftFeedback?:SentenceFeedback;
  currentModelId?:string;
  contextFingerprint?:string;
  canSave: boolean;
  aiPending: boolean;
  recoveryPending?:boolean;
  aiError: FeedbackIssue | null;
  onAi: () => void;
  onSentence: (sentence: string) => void;
  onCheck: (check: NonNullable<GrammarProgress['check']>) => void;
  onChecks: (key: 'meaning' | 'form', value: NonNullable<GrammarProgress['check']>) => void;
  onFrame: (values: string[]) => void;
  onExplain: () => void;
  onComplete: () => void;
};

export function GrammarWriting({ lesson, progress,retainedFeedback,draftFeedback,recoveryPending,currentModelId,contextFingerprint, canSave, aiPending, aiError, onAi, onSentence, onCheck, onChecks, onFrame, onExplain, onComplete }: Props) {
  const { sentence, check } = progress;
  const feedback=currentFeedback([progress.feedback,draftFeedback,retainedFeedback],sentence,currentModelId??'',contextFingerprint);
  const [proposal, setProposal] = useState({ lessonId: lesson.id, feedback });
  let visibleFeedback = proposal.feedback;
  if (proposal.lessonId !== lesson.id || feedback && feedback !== proposal.feedback) {
    visibleFeedback = feedback; setProposal({ lessonId: lesson.id, feedback });
  }
  const practice = practiceForVersion(lesson.id,progress.contentVersion), values = practice.frame.slots.map((slot, i) => progress.frame?.[i] ?? slot.options[0]);
  const frame = frameSentence(practice.frame, values);
  return <div className="grammar-stage">
    <p className="grammar-question">{lesson.writing}</p>
    {!!progress.contentVersion ? <details className="grammar-frame" open={!sentence}><summary>문장 틀로 시작하기</summary>
      <div className="grammar-frame-slots">{practice.frame.slots.map((slot, i) => <fieldset key={slot.label}><legend>{slot.label}</legend><div className="grammar-options">{slot.options.map(option => <button key={option} className="secondary-button" aria-pressed={values[i] === option} disabled={!canSave} onClick={() => onFrame(values.map((v, j) => j === i ? option : v))} lang="en">{option}</button>)}</div></fieldset>)}</div>
      <p lang="en">{frame}</p><Speak text={frame} /><button className="secondary-button" disabled={!canSave} onClick={() => onSentence(frame)}>{sentence ? '문장 틀로 바꾸기' : '이 문장으로 시작'}</button>
    </details> : <div className="grammar-example"><small>문장 틀</small><p lang="en">{lesson.stem}</p><Speak text={lesson.stem} /></div>}
    <div className="grammar-writing-area">
      <label className="grammar-writing">내 문장<textarea lang="en" aria-describedby="grammar-sentence-count" maxLength={2000} rows={4}
        value={sentence} onChange={event => onSentence(event.target.value)} placeholder="내 생활에 맞는 문장을 써 보세요." /></label>
      <p id="grammar-sentence-count" className="small-note grammar-character-count">{sentence.length}/2,000자</p>
    </div>
    <div className="grammar-ai-action">
      <button className="secondary-button" disabled={aiPending || !sentence.trim() || !canSave} onClick={onAi}>
        <Sparkles size={18} aria-hidden="true" />{aiPending ? '참고 의견을 요청하고 있어요' : recoveryPending?'이전 AI 요청 결과 확인':'AI 참고 의견 요청'}
      </button>
      <AiUseNotice grammar />
    </div>
    <FeedbackIssueNotice issue={aiError} />
    {visibleFeedback && <Feedback feedback={visibleFeedback} sentence={sentence} onSentence={onSentence} busy={!canSave || aiPending} current={feedbackMatchesContext(visibleFeedback,sentence,currentModelId??'',contextFingerprint)} />}
    {!!progress.contentVersion ? <div className="grammar-self-checks"><h3>스스로 점검하기</h3>{(['meaning', 'form'] as const).map((key, i) => <fieldset className="grammar-check" key={key}><legend>{practice.checks[i]}</legend><div className="grammar-check-options">{SELF_CHECKS.map(value => <label key={value}><input type="radio" name={`grammar-${lesson.id}-${key}`} checked={progress.checks?.[key] === value} onChange={() => onChecks(key, value)} />{value === 'appropriate' ? '확인했어요' : value === 'needs_work' ? '보완 필요' : '모르겠어요'}</label>)}</div></fieldset>)}</div> : <fieldset className="grammar-check">
      <legend>스스로 점검하기</legend><p>{lesson.check}</p>
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

function Feedback({ feedback, sentence, onSentence, busy,current }: { feedback: SentenceFeedback; sentence: string; onSentence: Props['onSentence']; busy: boolean;current:boolean }) {
  return <div className="grammar-feedback" data-tone="neutral">
    {!current && <p className="notice">이전 문장·목표·모델·문맥에 대한 의견이거나 이전 버전의 기록이에요. 현재 조건으로 다시 요청해 주세요.</p>}
    {feedback.contextNote&&<details><summary>이 의견에 전달한 문맥</summary><p>{feedback.contextNote}</p></details>}
    <FeedbackDetail feedback={feedback} grammarTarget suggestionAction={<FeedbackCorrection feedback={feedback} sentence={sentence} contextCurrent={current} busy={busy} onApply={onSentence} />} />
  </div>;
}
