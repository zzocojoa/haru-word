import { feedbackProvider, GROQ_FEEDBACK_MODEL, type SentenceFeedback } from '@/lib/sentence-feedback';

export function FeedbackAttribution({ feedback, showCaution = true }: { feedback: SentenceFeedback; showCaution?: boolean }) {
  return <p className="small-note" data-feedback-provider={feedbackProvider(feedback)}>
    <strong>{feedbackProvider(feedback)}로 점검</strong>
    {feedback.model === GROQ_FEEDBACK_MODEL && <> · Google 응답 실패 후 전환</>}
    {showCaution && <><br />AI 참고 의견 · 최종 기록은 직접 확인해 주세요.</>}
  </p>;
}
