"use client";
import { Loader2, Sparkles } from 'lucide-react';
import type { SentenceFeedback } from '@/lib/sentence-feedback';
import { sentenceFeedbackPresentation } from '@/lib/sentence-feedback-presentation';
import { useSentenceFeedback } from './study/use-sentence-feedback';
import { FeedbackIssueNotice } from './feedback-issue-notice';
import { AiUseNotice } from './ai-use-notice';
import { FeedbackDetail } from './feedback-detail';

type Props = {
  sessionId: string;
  entryId: string;
  sentence: string;
  feedback?: SentenceFeedback;
  busy: boolean;
  onPending: (value: boolean) => void;
  onFeedback: (feedback: SentenceFeedback) => Promise<boolean>;
  onUse: (sentence: string) => void;
};

export function SentenceFeedbackPanel({ sessionId, entryId, sentence, feedback, busy, onPending, onFeedback, onUse }: Props) {
  const { pending, error, check } = useSentenceFeedback({ sessionId, entryId, sentence, busy, onPending, onFeedback });
  const view = sentenceFeedbackPresentation({ sentence, feedback, busy, pending });
  return <section className="ai-feedback-panel" aria-label="AI 참고 의견">
    <div className="ai-feedback-heading"><h3><Sparkles size={17} /> AI 참고 의견</h3><span className="small-note">선택</span></div>
    <AiUseNotice />
    <button type="button" className="secondary-button" disabled={view.disabled} onClick={check}>
      {pending && <Loader2 size={16} className="spin" />}{view.label}
    </button>
    <FeedbackIssueNotice issue={error} />
    {feedback && <div aria-live="polite">
      {!view.unchanged && <p className="notice">수정 전 문장의 교정 결과예요.</p>}
      <FeedbackDetail feedback={feedback} suggestionAction={view.canApply &&
        <button type="button" className="text-button" disabled={busy || pending} onClick={() => onUse(feedback.correctedSentence)}>
          교정 제안을 내 문장에 적용
        </button>
      } />
    </div>}
  </section>;
}
