"use client";
import { Loader2, Sparkles } from 'lucide-react';
import type { SentenceFeedback } from '@/lib/sentence-feedback';
import { sentenceFeedbackPresentation } from '@/lib/sentence-feedback-presentation';
import { useSentenceFeedback } from './study/use-sentence-feedback';
import { FeedbackIssueNotice } from './feedback-issue-notice';
import { AiUseNotice } from './ai-use-notice';
import { FeedbackDetail } from './feedback-detail';
import { FeedbackCorrection } from './feedback-correction';
import {currentFeedback} from '@/lib/recoverable-feedback';
import {wordFeedbackInput,feedbackMatchesContext} from '@/lib/feedback-context';
import {useFeedbackContext} from './use-feedback-context';
import {FeedbackContextInput} from './feedback-context-input';
import {useAiRequests} from './ai-request-context';

type Props = {
  sessionId: string;
  entryId: string;
  target:{word:string;pos:string;meaning:string;expression:string};
  sentence: string;
  feedback?: SentenceFeedback;
  draftFeedback?:SentenceFeedback;
  busy: boolean;
  onPending: (value: boolean) => void;
  onFeedback: (feedback: SentenceFeedback) => Promise<boolean>;
  onUse: (sentence: string) => void;
};

export function SentenceFeedbackPanel({ sessionId, entryId,target, sentence, feedback:storedFeedback,draftFeedback, busy, onPending, onFeedback, onUse }: Props) {
  const {modelId}=useAiRequests();
  const context=useFeedbackContext('word',JSON.stringify([sessionId,entryId]),wordFeedbackInput(target,target.meaning,sentence,'',target.expression),modelId);
  const { pending, error, check,retainedFeedback,recoveryPending } = useSentenceFeedback({ sessionId, entryId, sentence, busy, onPending, onFeedback,context:{contextNote:context.note.trim(),contextKind:context.kind,expectedContextFingerprint:context.fingerprint} });
  const feedback=currentFeedback([storedFeedback,draftFeedback,retainedFeedback],sentence,modelId,context.fingerprint);
  const view = sentenceFeedbackPresentation({ sentence, feedback, busy, pending });
  const current=!!feedback&&feedbackMatchesContext(feedback,sentence,modelId,context.fingerprint);
  return <section className="ai-feedback-panel" aria-label="AI 참고 의견">
    <div className="ai-feedback-heading"><h3><Sparkles size={17} /> AI 참고 의견</h3><span className="small-note">선택</span></div>
    <FeedbackContextInput context={context} disabled={busy||pending}/>
    <button type="button" className="secondary-button" disabled={view.disabled||!context.fingerprint} onClick={check}>
      {pending && <Loader2 size={16} className="spin" />}{!pending&&recoveryPending?'이전 AI 요청 결과 확인':view.label}
    </button>
    <AiUseNotice />
    <FeedbackIssueNotice issue={error} />
    {feedback && <div aria-live="polite">
      {!current && <p className="notice">이전 문장·목표·모델·문맥에 대한 의견이거나 이전 버전의 기록이에요. 현재 조건으로 다시 요청해 주세요.</p>}
      {feedback.contextNote&&<details><summary>이 의견에 전달한 문맥</summary><p>{feedback.contextNote}</p></details>}
      <FeedbackDetail feedback={feedback} suggestionAction={<FeedbackCorrection feedback={feedback} sentence={sentence} contextCurrent={current} busy={busy || pending} onApply={onUse} />} />
    </div>}
  </section>;
}
