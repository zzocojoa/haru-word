import type { LearningController } from "./use-learning-controller";

export function ClockStatus({ clock }: Pick<LearningController, "clock">) {
  if (clock.ready) return null;
  return (
    <div className="notice" role={clock.error ? "alert" : "status"}>
      {clock.error ? (
        <>
          <p>한국 시간을 확인하지 못했어요. 기록은 보존돼요. 연결을 확인한 뒤 다시 시도해 주세요.</p>
          <button className="text-button" disabled={clock.syncing} onClick={() => void clock.refresh()}>
            시간 다시 확인
          </button>
        </>
      ) : (
        <p>한국 시간을 확인하고 있어요. 확인이 끝나면 학습을 계속할 수 있어요.</p>
      )}
    </div>
  );
}
