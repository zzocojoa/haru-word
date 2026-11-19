import type { LearningViewProps } from "./types";
import {HaruNotice,HaruButton} from '../haru-controls';

export function ClockStatus({ clock }: Pick<LearningViewProps, "clock">) {
  if (clock.ready) return null;
  return (
    <HaruNotice className="notice" status={clock.error?'error':'info'} role={clock.error?undefined:'status'} title={clock.error?
      '한국 시간을 확인하지 못했어요. 기록은 보존돼요. 연결을 확인한 뒤 다시 시도해 주세요.':
      '한국 시간을 확인하고 있어요. 확인이 끝나면 학습을 계속할 수 있어요.'}>
      {clock.error&&<HaruButton label="시간 다시 확인" variant="ghost" disabled={clock.syncing} onClick={() => clock.refresh()} />}
    </HaruNotice>
  );
}
