'use client';
import {HaruParagraph,HaruHeading} from '../haru-content';
import {HaruButton,HaruTextArea} from '../haru-controls';
import {RadioList,RadioListItem} from '@astryxdesign/core/RadioList';

import { useMemo, useState } from 'react';
import { HaruIcon } from '@/components/icons/haru-icon';
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
  inputLocked?:boolean;
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

export function GrammarWriting({ lesson, progress,retainedFeedback,draftFeedback,recoveryPending,currentModelId,contextFingerprint, canSave,inputLocked=false, aiPending, aiError, onAi, onSentence, onCheck, onChecks, onFrame, onExplain, onComplete }: Props) {
  const { sentence, check } = progress;
  const feedback=currentFeedback([progress.feedback,draftFeedback,retainedFeedback],sentence,currentModelId??'',contextFingerprint);
  const [proposal, setProposal] = useState({ lessonId: lesson.id, feedback });
  let visibleFeedback = proposal.feedback;
  if (proposal.lessonId !== lesson.id || feedback && feedback !== proposal.feedback) {
    visibleFeedback = feedback; setProposal({ lessonId: lesson.id, feedback });
  }
  const practice = practiceForVersion(lesson.id,progress.contentVersion);
  const values = useMemo(() => practice.frame.slots.map((slot, i) => progress.frame?.[i] ?? slot.options[0]), [practice.frame, progress.frame]);
  const frame = frameSentence(practice.frame, values);
  const frameChoices = useMemo(() => <>
    <div className="grammar-frame-slots">{practice.frame.slots.map((slot, i) => <fieldset key={slot.label}><legend>{slot.label}</legend><div className="grammar-options">{slot.options.map(option => <HaruButton label={[(option)].join('')} variant="secondary" key={option} className="haru-migrated secondary-button" aria-pressed={values[i] === option} disabled={!canSave} onClick={() => onFrame(values.map((v, j) => j === i ? option : v))} lang="en">{option}</HaruButton>)}</div></fieldset>)}</div>
    <HaruParagraph lang="en">{frame}</HaruParagraph><Speak text={frame} />
  </>, [practice.frame, values, frame, canSave, onFrame]);
  const meaningCheck = progress.checks?.meaning ?? '', formCheck = progress.checks?.form ?? '';
  const selfChecks = useMemo(() => !!progress.contentVersion ? <div className="grammar-self-checks"><HaruHeading level={3}>스스로 점검하기</HaruHeading>{(['meaning', 'form'] as const).map((key, i) => <fieldset className="grammar-check" key={key}><legend>{practice.checks[i]}</legend>
    <RadioList size="sm" label={practice.checks[i]} isLabelHidden htmlName={'grammar-'+lesson.id+'-'+key} value={key === 'meaning' ? meaningCheck : formCheck} onChange={value => onChecks(key, value as NonNullable<GrammarProgress['check']>)} containerClassName="haru-grammar-radio" controlClassName="grammar-check-options" orientation="horizontal">
      {SELF_CHECKS.map(value => <RadioListItem key={value} value={value} label={<span className="grammar-radio-label">{value === 'appropriate' ? '확인했어요' : value === 'needs_work' ? '보완 필요' : '모르겠어요'}</span>} />)}
    </RadioList>
  </fieldset>)}</div> : <fieldset className="grammar-check">
    <legend>스스로 점검하기</legend><HaruParagraph>{lesson.check}</HaruParagraph>
    <RadioList size="sm" label="스스로 점검하기" isLabelHidden htmlName={'grammar-check-'+lesson.id} value={check ?? ''} onChange={value => onCheck(value as NonNullable<GrammarProgress['check']>)} containerClassName="haru-grammar-radio">
      {SELF_CHECKS.map(value => <RadioListItem key={value} value={value} label={<span className="grammar-radio-label">{CHECK_TEXT[value]}</span>} />)}
    </RadioList>
  </fieldset>, [progress.contentVersion, lesson.id, lesson.check, practice.checks, meaningCheck, formCheck, check, onCheck, onChecks]);
  return <div className="grammar-stage">
    <HaruParagraph className="grammar-question">{lesson.writing}</HaruParagraph>
    {!!progress.contentVersion ? <details className="grammar-frame" open={!sentence}><summary>문장 틀로 시작하기</summary>
      {frameChoices}<HaruButton label={[(sentence ? '문장 틀로 바꾸기' : '이 문장으로 시작')].join('')} variant="secondary" className="haru-migrated secondary-button" disabled={!canSave} onClick={() => onSentence(frame)}>{sentence ? '문장 틀로 바꾸기' : '이 문장으로 시작'}</HaruButton>
    </details> : <div className="grammar-example"><small>문장 틀</small><HaruParagraph lang="en">{lesson.stem}</HaruParagraph><Speak text={lesson.stem} /></div>}
    <div className="grammar-writing-area">
      <HaruTextArea label="내 문장" containerClassName="haru-grammar-writing grammar-writing" lang="en" aria-describedby="grammar-sentence-count" maxLength={2000} rows={4}
        value={sentence} disabled={inputLocked} onChange={event => onSentence(event.target.value)} placeholder="내 생활에 맞는 문장을 써 보세요."  />
      <HaruParagraph id="grammar-sentence-count" className="small-note grammar-character-count">{sentence.length}/2,000자</HaruParagraph>
    </div>
    <div className="grammar-ai-action">
      <HaruButton label={[(aiPending ? '참고 의견을 요청하고 있어요' : recoveryPending?'이전 AI 요청 결과 확인':'AI 참고 의견 요청')].join('')} variant="secondary" icon={<HaruIcon name="ai-feedback" size={18} />} className="haru-migrated secondary-button" disabled={aiPending || !sentence.trim() || !canSave} onClick={onAi}>
        {aiPending ? '참고 의견을 요청하고 있어요' : recoveryPending?'이전 AI 요청 결과 확인':'AI 참고 의견 요청'}
      </HaruButton>
      <AiUseNotice grammar recovery={!aiPending && recoveryPending} />
    </div>
    <FeedbackIssueNotice issue={aiError} />
    {visibleFeedback && <Feedback feedback={visibleFeedback} sentence={sentence} onSentence={onSentence} busy={!canSave || aiPending} current={feedbackMatchesContext(visibleFeedback,sentence,currentModelId??'',contextFingerprint)} />}
    {selfChecks}
    <div className="grammar-actions">
      <HaruButton label={["설명 다시 보기"].join('')} variant="ghost" className="haru-migrated text-button" onClick={onExplain}>설명 다시 보기</HaruButton>
      <HaruButton label={["수업 마치기"].join('')} variant="primary" endContent={<HaruIcon name="check" size={18} />} className="haru-migrated primary-button" disabled={!sentence.trim() || !check || !canSave || aiPending} onClick={onComplete}>수업 마치기</HaruButton>
    </div>
  </div>;
}

function Feedback({ feedback, sentence, onSentence, busy,current }: { feedback: SentenceFeedback; sentence: string; onSentence: Props['onSentence']; busy: boolean;current:boolean }) {
  return <div className="grammar-feedback" data-tone="neutral">
    {!current && <HaruParagraph className="notice">이전 문장·목표·모델·문맥에 대한 의견이거나 이전 버전의 기록이에요. 현재 조건으로 다시 요청해 주세요.</HaruParagraph>}
    {feedback.contextNote&&<details><summary>이 의견에 전달한 문맥</summary><HaruParagraph>{feedback.contextNote}</HaruParagraph></details>}
    <FeedbackDetail feedback={feedback} grammarTarget suggestionAction={<FeedbackCorrection feedback={feedback} sentence={sentence} contextCurrent={current} busy={busy} onApply={onSentence} />} />
  </div>;
}
