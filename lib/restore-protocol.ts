import type { State } from './learning';
export { STATE_BACKUP_BYTES as LARGE_BACKUP_BYTES, STATE_PART_BYTES as RESTORE_PART_BYTES } from './state-limits';
export const RESTORE_JOB_TTL = 24 * 60 * 60 * 1000;
export const RESTORE_RECEIPT_TTL = 7 * RESTORE_JOB_TTL;
export type RestorePart = { kind: 'progress' | 'sessions' | 'grammar'; bytes: number; hash: string; count: number };
export type RestoreManifest = { fileHash: string; fileBytes: number; settings: State['settings']; parts: RestorePart[] };
export type RestoreJobState = 'uploading' | 'validating' | 'ready' | 'committed' | 'cancelled';
export type RestoreJob = { id: string; baseRevision: number; fileHash: string; status: RestoreJobState; received: number[]; validated: number; total: number; expiresAt: number; revision: number | null };
export type RestoreCapabilities = { enabled: boolean; maxBytes: number; partBytes: number };
export const utf8Bytes = (raw: string) => new TextEncoder().encode(raw).byteLength;
export async function sha256(raw: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, '0')).join('');
}
