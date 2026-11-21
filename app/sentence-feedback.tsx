"use client";
import {HaruPanel,HaruHeading,HaruParagraph} from './haru-content';
import {HaruButton} from './haru-controls';

import type {ReactNode} from 'react';
import { HaruIcon } from '@/components/icons/haru-icon';
import type { SentenceFeedback } from '@/lib/sentence-feedback';
import { sentenceFeedbackPresentation } from '@/lib/sentence-feedback-presentation';
import { useSentenceFeedback } from './study/use-sentence-feedback';
import { FeedbackIssueNotice } from './feedback-issue-notice';
import { AiUseNotice } from './ai-use-notice';
import { FeedbackDetail } from './feedback-detail';
import { FeedbackCorrection } from './feedback-correction';
import {currentFeedback} from '@/lib/feedback-selection';
import {wordFeedbackInput,feedbackMatchesContext} from '@/lib/feedback-context';
import {useFeedbackContext} from './use-feedback-context';
import {FeedbackContextInput} from './feedback-context-input';
import {useAiRequests} from './ai-request-context';

type Props = {
  sessionId: string;
  entryId: string;
  target:{word:string;pos:string;meaning:string;expression:string};
  sentence: string;
  children?: ReactNode;
  feedback?: SentenceFeedback;
  draftFeedback?:SentenceFeedback;
  busy: boolean;
  onPending: (value: boolean) => void;
  onFeedback: (feedback: SentenceFeedback) => Promise<boolean>;
  onUse: (sentence: string) => void;
};

export function SentenceFeedbackPanel({ sessionId, entryId,target, sentence, children, feedback:storedFeedback,draftFeedback, busy, onPending, onFeedback, onUse }: Props) {
  const {modelId}=useAiRequests();
  const context=useFeedbackContext('word',JSON.stringify([sessionId,entryId]),wordFeedbackInput(target,target.meaning,sentence,'',target.expression),modelId);
  const { pending, error, check,retainedFeedback,recoveryPending } = useSentenceFeedback({ sessionId, entryId, sentence, busy, onPending, onFeedback,context:{contextNote:context.note.trim(),contextKind:context.kind,contextRole:'intended_korean',expectedContextFingerprint:context.fingerprint} });
  const feedback=currentFeedback([storedFeedback,draftFeedback,retainedFeedback],sentence,modelId,context.fingerprint);
  const view = sentenceFeedbackPresentation({ sentence, feedback, busy, pending });
  const current=!!feedback&&feedbackMatchesContext(feedback,sentence,modelId,context.fingerprint);
  const checkingPrevious = !pending && recoveryPending;
  const actionLabel = checkingPrevious ? '이전 AI 요청 결과 확인' : view.label;
  return <>
    <FeedbackContextInput context={context} wordIntent disabled={busy||pending}/>
    {children}
    <HaruPanel role="region" className="ai-feedback-panel" aria-label="AI 참고 의견">
    <HaruHeading className="ai-feedback-heading" level={3}><HaruIcon name="ai-feedback" size={17} /> AI 참고 의견</HaruHeading>
    <FeedbackIssueNotice issue={error} compact />
    {feedback && <section aria-live="polite">
      {!current && <HaruParagraph className="notice">이전 문장·목표·모델·문맥에 대한 의견이거나 이전 버전의 기록이에요. 현재 조건으로 다시 요청해 주세요.</HaruParagraph>}
      <FeedbackDetail feedback={feedback} compact suggestionAction={<FeedbackCorrection compact feedback={feedback} sentence={sentence} contextCurrent={current} busy={busy || pending} onApply={onUse} />} />
    </section>}
    <HaruButton label={actionLabel} variant="secondary" icon={pending && <HaruIcon name="loading" size={16} className="spin" />} type="button" className="haru-migrated secondary-button" disabled={view.disabled||!context.fingerprint||(!context.note.trim()&&!recoveryPending)} onClick={check}>
      {actionLabel}
    </HaruButton>
    <AiUseNotice recovery={checkingPrevious} compact />
  </HaruPanel></>;
}
