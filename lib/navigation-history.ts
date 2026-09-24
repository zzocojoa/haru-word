/** In-memory view history. Never put learner records or drafts in history.state. */
export type NavigationGuard = (changed: ReadonlySet<string>) => boolean | Promise<boolean>;
type Values = Record<string, unknown>;
type Entry = { values: Values; position?: unknown };
type Marker = { scope: string; index: number };
export type HistoryPort = {
  state: () => unknown;
  replace: (state: unknown) => void;
  push: (state: unknown) => void;
  go: (delta: number) => void;
  capture: () => unknown;
  restore: (position: unknown) => void;
  report?: (outcome: 'blocked' | 'guard_error') => void;
};
const KEY = 'haruNavigation';

export class NavigationHistory {
  private scope = '';
  private port?: HistoryPort;
  private entries: Entry[] = [];
  private index = 0;
  private physical = 0;
  private values: Values = {};
  private defaults: Values = {};
  private listeners = new Map<string, (value: unknown) => void>();
  private guards = new Set<NavigationGuard>();
  private queued = false;
  private returning = true;
  private pending = false;
  private repairing = false;
  private requested = 0;
  private afterTraversal: Array<() => void> = [];

  start(port: HistoryPort, scope: string) {
    this.port = port;
    this.scope = scope;
    this.entries = [{ values: { ...this.values } }];
    this.index = this.physical = this.requested = 0;
    port.replace(this.marker(0));
  }
  stop() { this.port = undefined; }
  read<T>(key: string, initial: T): T {
    if (!(key in this.defaults)) this.defaults[key] = initial;
    return (key in this.values ? this.values[key] : this.defaults[key]) as T;
  }
  fresh<T>(key: string, initial: T): T {
    this.defaults[key] = initial;
    this.values = { ...this.values, [key]: initial };
    // A remounted destructive confirmation has no retained file/preview.
    // Forward may reopen the tool, but must require a fresh confirmation.
    if (this.entries[this.index]) this.entries[this.index].values = { ...this.values };
    return initial;
  }
  subscribe(key: string, listener: (value: unknown) => void) {
    this.listeners.set(key, listener);
    return () => { if (this.listeners.get(key) === listener) this.listeners.delete(key); };
  }
  guard(guard: NavigationGuard) {
    this.guards.add(guard);
    return () => { this.guards.delete(guard); };
  }
  reset(preserve: readonly string[]) {
    const clean = (values: Values) => Object.fromEntries(Object.entries(values).filter(([key]) => preserve.includes(key)));
    this.values = clean(this.values);
    for (const entry of this.entries) entry.values = clean(entry.values);
    for (const [key, listener] of this.listeners) if (!preserve.includes(key)) listener(this.read(key, this.defaults[key]));
  }
  change<T>(key: string, update: T | ((previous: T) => T)) {
    // A second action must not race an asynchronous leave/save decision.
    if (this.repairing) { this.afterTraversal.push(() => this.change(key, update)); return; }
    if (this.pending) return;
    const previous = this.read<T>(key, undefined as T);
    const next = typeof update === 'function' ? (update as (value: T) => T)(previous) : update;
    if (Object.is(previous, next)) return;
    if (!this.queued) {
      this.returning = true;
      if (this.port) this.entries[this.index].position = this.port.capture();
    }
    if (next !== null && next !== false) this.returning = false;
    this.values = { ...this.values, [key]: next };
    this.listeners.get(key)?.(next);
    if (!this.queued) {
      this.queued = true;
      // One click can update a tab, close a dialog and open a lesson together.
      queueMicrotask(() => this.commit());
    }
  }
  private changed(a: Values, b: Values) {
    return new Set(Object.keys(this.defaults).filter(key =>
      !Object.is(key in a ? a[key] : this.defaults[key], key in b ? b[key] : this.defaults[key])));
  }
  private marker(index: number) {
    const state = this.port?.state();
    return { ...(state && typeof state === 'object' ? state : {}), [KEY]: { scope: this.scope, index } };
  }
  private commit() {
    if (!this.queued) return;
    this.queued = false;
    if (!this.port || !this.changed(this.entries[this.index].values, this.values).size) return;
    // Existing Back/Close buttons consume the same entry instead of adding a
    // second entry that would reopen the screen on the next browser Back.
    let match = this.returning ? this.index - 1 : -1;
    while (match >= 0 && this.changed(this.entries[match].values, this.values).size) match--;
    if (match >= 0) {
      this.repairing = true;
      const delta = match - this.physical;
      this.index = match;
      this.port.go(delta);
    } else {
      this.entries.splice(this.index + 1);
      this.entries.push({ values: { ...this.values } });
      this.index++;
      this.physical = this.index;
      this.port.push(this.marker(this.index));
    }
  }
  async pop(state: unknown) {
    const marker = state && typeof state === 'object' ? (state as Record<string, Marker>)[KEY] : undefined;
    // Entries from before a reload are intentionally not replayed. Native Back
    // can continue out of the site; no dummy entry traps the visitor at home.
    if (!marker || marker.scope !== this.scope || !Number.isInteger(marker.index) || !this.entries[marker.index]) return;
    this.physical = marker.index;
    if (this.repairing) {
      if (this.physical === this.index) {
        this.repairing = false;
        const waiting = this.afterTraversal.splice(0);
        for (const change of waiting) change();
      }
      else this.port?.go(this.index - this.physical);
      return;
    }
    this.requested = marker.index;
    if (this.pending) return;
    this.pending = true;
    this.entries[this.index].position = this.port?.capture();
    try {
      let target: number;
      let allowed: boolean;
      do {
        target = this.requested;
        const changed = this.changed(this.values, this.entries[target].values);
        allowed = true;
        for (const guard of this.guards) {
          try { if (!await guard(changed)) { allowed = false; break; } }
          catch { this.port?.report?.('guard_error'); allowed = false; break; }
        }
      } while (allowed && target !== this.requested);
      if (!this.port) return;
      if (!allowed) {
        this.port.report?.('blocked');
        this.repairing = this.physical !== this.index;
        if (this.repairing) this.port.go(this.index - this.physical);
        return;
      }
      this.index = target;
      this.values = { ...this.entries[target].values };
      for (const [key, listener] of this.listeners) listener(this.read(key, this.defaults[key]));
      this.port.restore(this.entries[target].position);
    } finally { this.pending = false; }
  }
}
