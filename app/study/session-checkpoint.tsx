"use client";
import { reviewRemaining } from '@/lib/learning';
import type { StudySessionController } from "./use-study-session-controller";
type SessionCheckpointProps = Pick<
  StudySessionController,
  "s" | "busy" | "pauseAndExit" | "resume"
>;
export function SessionCheckpoint({
  s,
  busy,
  pauseAndExit,
  resume,
}: SessionCheckpointProps) {
  return (
    <section className="learning-panel">
      <h2>한 묶음을 마쳤어요.</h2>
      <p className="muted">
        전체 {s.ids.length}개 · 미점검 {reviewRemaining(s)}개.
        건너뛴 항목은 미완료로 남아 다음 묶음에서 이어가요.
      </p>
      <div className="button-row batch-actions">
        <button
          className="primary-button"
          disabled={busy}
          onClick={pauseAndExit}
        >
          오늘 종료 · 저장
        </button>
        <button className="secondary-button" disabled={busy} onClick={resume}>
          다음 묶음 계속
        </button>
      </div>
    </section>
  );
}
