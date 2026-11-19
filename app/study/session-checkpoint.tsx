"use client";
import {HaruPanel,HaruHeading,HaruParagraph} from '../haru-content';
import {HaruButton} from '../haru-controls';

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
    <HaruPanel className="learning-panel">
      <HaruHeading level={2}>한 묶음을 마쳤어요.</HaruHeading>
      <HaruParagraph className="muted">
        전체 {s.ids.length}개 · 미점검 {reviewRemaining(s)}개.
        건너뛴 항목은 미완료로 남아 다음 묶음에서 이어가요.
      </HaruParagraph>
      <div className="button-row batch-actions">
        <HaruButton label={["저장하고 나가기"].join('')} variant="primary"
          className="haru-migrated primary-button"
          disabled={busy}
          onClick={pauseAndExit}
        >
          저장하고 나가기
        </HaruButton>
        <HaruButton label={["다음 묶음 계속"].join('')} variant="secondary" className="haru-migrated secondary-button" disabled={busy} onClick={resume}>
          다음 묶음 계속
        </HaruButton>
      </div>
    </HaruPanel>
  );
}
