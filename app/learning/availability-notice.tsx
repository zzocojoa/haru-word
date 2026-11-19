import { settingsActivity, SETTINGS_ACTIVITY_TEXT, type NoticeSurface } from '@/lib/learning-notices';
import { ClockStatus } from './clock-status';
import { SaveError } from './save-error';
import type { LearningViewProps } from './types';
import {HaruNotice} from '../haru-controls';

type AvailabilityNoticeProps = Pick<LearningViewProps,
  'loading' | 'saving' | 'signedIn' | 'unsaved' | 'error' | 'saveError' | 'conflict' | 'store' | 'state' | 'clock'
> & { surface: NoticeSurface };

/** Mounted on just one surface so recovery controls and alert refs stay unique. */
export function AvailabilityNotice({ surface, ...status }: AvailabilityNoticeProps) {
  const activity = settingsActivity(surface, status);
  return <>
    {status.error && <SaveError {...status} />}
    {!status.loading && status.signedIn && <ClockStatus clock={status.clock} />}
    {activity === 'signed-out' ? (
      <HaruNotice className="notice" status="info" title={SETTINGS_ACTIVITY_TEXT[activity]}>
        <a className="text-button" href="/signin-with-chatgpt?return_to=%2F" target="_top">로그인하기</a>
      </HaruNotice>
    ) : activity ? <HaruNotice className="notice" status="info" role="status" title={SETTINGS_ACTIVITY_TEXT[activity]}/> : null}
  </>;
}
