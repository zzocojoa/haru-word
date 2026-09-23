export type NoticeSurface = 'page' | 'settings';
export type SettingsActivity = 'loading' | 'saving' | 'signed-out' | 'unsaved';

/** Display priority only; write permission remains owned by study-availability. */
export function settingsActivity(surface: NoticeSurface, status: {
  loading: boolean; saving: boolean; signedIn: boolean; unsaved: boolean; error: string;
}): SettingsActivity | null {
  if (surface !== 'settings') return null;
  if (status.loading) return 'loading';
  if (status.saving) return 'saving';
  if (!status.signedIn) return 'signed-out';
  if (status.unsaved && !status.error) return 'unsaved';
  return null;
}

export const SETTINGS_ACTIVITY_TEXT: Record<SettingsActivity, string> = {
  loading: '기록을 불러오면 설정을 변경할 수 있어요.',
  saving: '변경한 설정을 저장하고 있어요.',
  'signed-out': '로그인하면 설정을 변경할 수 있어요.',
  unsaved: '변경 내용을 저장한 뒤 설정을 변경할 수 있어요.',
};
