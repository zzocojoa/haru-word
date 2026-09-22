"use client";
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
      <p className="eyebrow">BATCH SAVED</p>
      <h2>한 묶음을 마쳤어요.</h2>
      <p className="muted">
        {s.ids.length}개 중 {s.index}개를 확인했어요. 남은{" "}
        {s.ids.length - s.index}개는 정해진 순서대로 이어집니다. 확인하지 않은
        항목은 미측정이에요.
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
