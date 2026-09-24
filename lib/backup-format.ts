import type { State } from './learning';

export function makeBackup(state: State, now = new Date()) {
  return { format: 'haru-words-v1' as const, exportedAt: now.toISOString(), state };
}

// Preserve every record without whitespace overhead. Validation stays in the
// restore flow so exporting an archive never discards otherwise unsavable data.
export function serializeBackup(state: State, now = new Date()): string {
  return JSON.stringify(makeBackup(state, now));
}
