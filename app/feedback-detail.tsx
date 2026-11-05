import type { ReactNode } from 'react';
import type { SentenceFeedback } from '@/lib/sentence-feedback';
import { FeedbackAttribution } from './feedback-attribution';
import { feedbackSafetyIssue } from '@/lib/feedback-safety';
import { FeedbackSafetyNotice } from './feedback-safety-notice';
import { RecordText } from './record-text';

// Read-only output: history must not depend on request hooks or write commands.
const OPINION_TEXT = { appropriate: '수정 제안 없음', natural: '수정 제안 없음', needs_work: '확인 필요', uncertain: '판단 어려움' };

export function FeedbackDetail({ feedback, suggestionAction, grammarTarget = false }: {
  feedback: SentenceFeedback;
  suggestionAction?: ReactNode;
  grammarTarget?: boolean;
}) {
  const safetyIssue = feedbackSafetyIssue(feedback);
  if (safetyIssue) return <FeedbackSafetyNotice reason={safetyIssue} />;
  return <div className="ai-feedback-result">
    <p className="small-note"><strong>AI 참고 의견 · 정답 판정은 아니에요</strong></p>
    <div className="feedback-assessments"><span>{grammarTarget ? '수업 목표' : '뜻·용법'} · {OPINION_TEXT[feedback.meaningUsage]}</span><span>문법 · {OPINION_TEXT[feedback.grammar]}</span></div>
    {grammarTarget&&['judgment-v4','judgment-v5','judgment-v6'].includes(feedback.validationVersion??'')&&<p className="small-note">수업 목표는 해당 표현을 알맞게 사용했는지에 대한 의견이에요.</p>}
    <p className="small-note">AI에 보낸 문장</p><div className="feedback-record"><RecordText text={feedback.original} label="AI에 보낸 문장" lang="en" /></div>
    {feedback.correctedSentence && <><p className="small-note">AI 교정 제안</p><div className="corrected-sentence feedback-record"><RecordText text={feedback.correctedSentence} label="AI 교정 제안" lang="en" /></div></>}
    {suggestionAction}
    {['judgment-v3','judgment-v4','judgment-v5','judgment-v6'].includes(feedback.validationVersion??'')&&<p className="small-note">교정 참고 설명은 검토한 규칙 범위에서 제공해요.</p>}
    <div className="feedback-record"><RecordText text={feedback.explanation} label={['judgment-v3','judgment-v4','judgment-v5','judgment-v6'].includes(feedback.validationVersion??'')?'판정·교정 참고':'AI 설명'} /></div>
    <FeedbackAttribution feedback={feedback} showCaution={false} />
  </div>;
}
