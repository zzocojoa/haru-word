import { requestJson, REQUEST_TIMEOUT_MS } from './client-request.ts';

export type Position = { entryId: string | null; revision: number; updatedAt: string | null };
type Sent = { entryId: string; revision: number };
type Cache = { version: 1; entryId: string | null; revision: number; pending: boolean; sent: Sent | null; needsChoice: boolean };
export type PositionView = Cache & {
  status: 'idle' | 'loading' | 'saved' | 'saving' | 'error' | 'conflict' | 'auth';
  available: boolean; storageWarning: boolean; remote: Position | null; displayVersion: number;
};
type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem'>;
type Transport = (method: 'GET' | 'PUT', owner: string, signal: AbortSignal, sent?: Sent) => Promise<Position>;
export const positionCacheKey = (owner: string) => `haru-image-position-v1:${encodeURIComponent(owner)}`;
const validId = (id: unknown): id is string => typeof id === 'string' && /^[a-f0-9]{16}$/.test(id);
const validRevision = (n: unknown): n is number => Number.isSafeInteger(n) && (n as number) >= 0 && (n as number) < Number.MAX_SAFE_INTEGER;
class PositionHttpError extends Error { constructor(readonly status: number) { super('Position request failed'); } }

export const positionTransport: Transport = async (method, owner, signal, sent) => {
  const { response, data } = await requestJson<Position>('/api/image-practice/position', {
    method, signal, headers: { 'content-type': 'application/json', 'x-image-practice-owner': owner },
    ...(sent ? { body: JSON.stringify(sent) } : {}),
  }, method === 'GET' ? REQUEST_TIMEOUT_MS.load : REQUEST_TIMEOUT_MS.save);
  if (!response.ok) throw new PositionHttpError(response.status);
  if (!data || !validRevision(data.revision) || (data.entryId !== null && !validId(data.entryId)) ||
      (data.revision === 0 ? data.entryId !== null || data.updatedAt !== null : !validId(data.entryId) || typeof data.updatedAt !== 'string' || !Number.isFinite(Date.parse(data.updatedAt))))
    throw new Error('Invalid position response');
  return data;
};

// Kept by the app, not the modal. No image index, learning state, or network work
// is touched until open(). At most one request and one latest pending cursor.
export class ImagePracticePositionController {
  private view: PositionView = { version: 1, entryId: null, revision: 0, pending: false, sent: null, needsChoice: false,
    status: 'idle', available: false, storageWarning: false, remote: null, displayVersion: 0 };
  private listeners = new Set<() => void>();
  private busy = false;
  private stopped = false;
  private started = false;
  private moves = 0;
  private request: AbortController | null = null;
  constructor(readonly owner: string, private storage: () => Storage, private transport: Transport = positionTransport) {}
  getSnapshot = () => this.view;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(update: Partial<PositionView>) {
    this.view = { ...this.view, ...update };
    for (const listener of this.listeners) listener();
  }
  private persist() {
    const { entryId, revision, pending, sent, needsChoice } = this.view;
    try { this.storage().setItem(positionCacheKey(this.owner), JSON.stringify({ version: 1, entryId, revision, pending, sent, needsChoice })); }
    catch { this.publish({ storageWarning: true }); }
  }
  private readCache() {
    try {
      const raw = this.storage().getItem(positionCacheKey(this.owner));
      if (!raw) return;
      const c = JSON.parse(raw);
      if (!c || c.version !== 1 || !validRevision(c.revision) || (c.entryId !== null && !validId(c.entryId)) || typeof c.pending !== 'boolean' ||
          (c.needsChoice !== undefined && typeof c.needsChoice !== 'boolean') || (c.needsChoice && !c.pending) ||
          (c.pending && !validId(c.entryId)) || (c.sent !== null && (!c.sent || !validId(c.sent.entryId) || c.sent.revision !== c.revision || !c.pending)))
        throw new Error('Invalid cached position');
      this.publish({ entryId: c.entryId, revision: c.revision, pending: c.pending, sent: c.sent, needsChoice: c.needsChoice ?? false,
        available: c.entryId !== null });
    } catch { this.publish({ storageWarning: true }); }
  }
  open = () => {
    if (this.stopped) return;
    if (!this.started) { this.started = true; this.readCache(); }
    if (!this.busy && this.view.status !== 'auth') void this.check('resume');
  };
  move = (entryId: string) => {
    if (this.stopped || !validId(entryId) || !this.view.available || this.view.status === 'auth') return;
    this.moves++; this.publish({ entryId, pending: true }); this.persist();
    if (!this.busy && this.view.status === 'saved') void this.flush();
  };
  retry = () => { if (!this.busy && !this.stopped && this.view.status !== 'auth') void this.check('resume'); };
  useRemote = () => { if (!this.busy && !this.stopped) void this.check('remote'); };
  keepCurrent = (entryId = this.view.entryId) => {
    if (!this.busy && !this.stopped && this.view.remote && this.view.status !== 'auth' && validId(entryId)) {
      this.move(entryId); void this.check('current');
    }
  };
  start = () => { this.stopped = false; };
  // Cleanup aborts only this account's transport. Its cache retains pending work.
  stop = () => { this.stopped = true; this.request?.abort(); this.request = null; this.busy = false; };

  private async check(choice: 'resume' | 'remote' | 'current' | 'conflict') {
    this.busy = true; const expectedRemote = this.view.remote, moves = this.moves;
    this.publish({ status: 'loading' }); const request = new AbortController(); this.request = request;
    try {
      const remote = await this.transport('GET', this.owner, request.signal);
      if (this.stopped || this.request !== request) return;
      const { sent, pending, revision } = this.view;
      const acknowledged = sent && remote.revision === sent.revision + 1 && remote.entryId === sent.entryId;
      if (choice === 'conflict' || (choice === 'resume' && this.view.needsChoice)) {
        // A definite 409 always needs a choice, even if this read is stale.
        // Never turn a stale GET into an automatic PUT/409/GET loop.
        this.publish({ remote, status: 'conflict', available: true, needsChoice: true });
      } else if ((choice === 'remote' && moves === this.moves) || !pending) {
        this.publish({ entryId: remote.entryId, revision: remote.revision, pending: false, sent: null, remote: null, available: true, status: 'saved', needsChoice: false,
          displayVersion: this.view.displayVersion + 1 });
      } else if (choice === 'current' ? remote.revision === expectedRemote?.revision : remote.revision === revision || acknowledged) {
        // A lost response can acknowledge only the exact sent revision and ID.
        this.publish({ revision: remote.revision, sent: null, remote: null, available: true, needsChoice: false,
          pending: this.view.entryId !== remote.entryId, status: 'saved' });
      } else this.publish({ remote, status: 'conflict', available: true, needsChoice: true });
      this.persist();
    } catch (error) { if (this.request !== request) return; this.fail(error); }
    finally { if (this.request === request) { this.busy = false; this.request = null; } }
    if (!this.stopped && this.view.status === 'saved' && this.view.pending) void this.flush();
  }
  private fail(error: unknown) {
    if (this.stopped) return;
    const status = error instanceof PositionHttpError ? error.status : 0;
    this.publish({ status: status === 401 ? 'auth' : status === 409 ? 'conflict' : 'error', needsChoice: status === 409 || this.view.needsChoice });
    this.persist();
  }
  private async flush() {
    if (this.busy || this.stopped || !this.view.pending || !this.view.entryId) return;
    this.busy = true;
    const sent = { entryId: this.view.entryId, revision: this.view.revision };
    this.publish({ sent, status: 'saving' }); this.persist(); const request = new AbortController(); this.request = request;
    let conflict = false;
    try {
      const saved = await this.transport('PUT', this.owner, request.signal, sent);
      if (this.stopped || this.request !== request) return;
      if (saved.entryId !== sent.entryId || saved.revision !== sent.revision + 1) throw new Error('Invalid save receipt');
      const pending = this.view.entryId !== sent.entryId;
      this.publish({ revision: saved.revision, sent: null, pending, status: pending ? 'saving' : 'saved' }); this.persist();
    } catch (error) { if (this.request !== request) return; this.fail(error); conflict = !this.stopped && this.view.status === 'conflict'; }
    finally { if (this.request === request) { this.busy = false; this.request = null; } }
    if (conflict) void this.check('conflict');
    else if (!this.stopped && this.view.status === 'saving') void this.flush();
  }
}

// A removed/excluded cursor is displayed at the next original entry, without
// writing that fallback merely because a dialog was opened.
export function resolvePracticeEntry(savedId: string | null, orderedIds: readonly string[], eligibleIds: readonly string[]) {
  if (!eligibleIds.length) return { entryId: null, fallback: savedId !== null };
  const eligible = new Set(eligibleIds);
  if (savedId && eligible.has(savedId)) return { entryId: savedId, fallback: false };
  const original = savedId ? orderedIds.indexOf(savedId) : -1;
  const next = original < 0 ? undefined : orderedIds.slice(original + 1).find(id => eligible.has(id));
  return { entryId: next ?? eligibleIds[0], fallback: savedId !== null };
}
export function practiceNumber(value: string, count: number) {
  if (!/^\d+$/.test(value.trim())) return null;
  const n = Number(value);
  return Number.isSafeInteger(n) && n >= 1 && n <= count ? n - 1 : null;
}
