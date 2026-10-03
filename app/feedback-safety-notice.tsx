import { FEEDBACK_SAFETY_GUIDANCE, type FeedbackSafetyReason } from '@/lib/feedback-safety';

export function FeedbackSafetyNotice({ reason }: { reason: FeedbackSafetyReason }) {
  const guide = FEEDBACK_SAFETY_GUIDANCE[reason];
  return <div className="notice feedback-safety-notice" role="status">
    <strong>AI 설명 확인 필요</strong>
    <p>{guide.explanation} 내 문장과 저장 기록은 유지돼요.</p>
    <p>{guide.lesson}</p>
    <a href={guide.source} target="_blank" rel="noopener noreferrer">Cambridge 문법 설명 확인</a>
  </div>;
}
