/** Tab-local UI history only. Never stores answers or writes browser history. */
export type NavigationGuard = (changed: ReadonlySet<string>) => boolean | Promise<boolean>;
type Values = Record<string, unknown>;
type Entry = { before: Values; keys: Set<string>; position: unknown };
export type HistoryPort = {
  capture: () => unknown;
  restore: (position: unknown) => void;
  report?: (outcome: 'blocked' | 'guard_error') => void;
};
const TAB = 'app.tab';

export class NavigationHistory {
  private port?: HistoryPort;
  private stacks = new Map<string, Entry[]>();
  private values: Values = {};
  private defaults: Values = {};
  private listeners = new Map<string, (value: unknown) => void>();
  private guards = new Set<NavigationGuard>();
  private batch?: { before: Values; position: unknown };
  private pending = false;
  private generation = 0;

  start(port: HistoryPort) { this.port = port; }
  stop() { this.generation++; this.port = undefined; }
  read<T>(key: string, initial: T): T {
    if (!(key in this.defaults)) this.defaults[key] = initial;
    return this.value(this.values, key) as T;
  }
  fresh<T>(key: string, initial: T): T {
    this.defaults[key] = initial;
    this.values = { ...this.values, [key]: initial };
    // Remounting a confirmation must never restore an earlier approval.
    for (const stack of this.stacks.values()) for (const entry of stack) entry.before[key] = initial;
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
    this.generation++;
    this.batch = undefined;
    this.stacks.clear();
    this.values = Object.fromEntries(Object.entries(this.values).filter(([key]) => preserve.includes(key)));
    // Account refresh may keep Settings/Backup open. Rebase those tools onto
    // the fresh tab root so they can still be dismissed without reviving records.
    const keys = this.changed({}, this.values);
    if (keys.size) this.stack().push({ before: {}, keys, position: this.port?.capture() });
    for (const [key, listener] of this.listeners) listener(this.value(this.values, key));
  }
  change<T>(key: string, update: T | ((previous: T) => T)) {
    if (this.pending) return;
    const previous = this.read<T>(key, undefined as T);
    const next = typeof update === 'function' ? (update as (value: T) => T)(previous) : update;
    if (Object.is(previous, next)) return;
    if (!this.batch) {
      this.batch = { before: { ...this.values }, position: this.port?.capture() };
      queueMicrotask(() => this.commit());
    }
    this.values = { ...this.values, [key]: next };
    this.listeners.get(key)?.(next);
  }
  private value(values: Values, key: string) { return key in values ? values[key] : this.defaults[key]; }
  private changed(a: Values, b: Values) {
    return new Set(Object.keys(this.defaults).filter(key => key !== TAB && !Object.is(this.value(a, key), this.value(b, key))));
  }
  private tab() { return this.read(TAB, 'today'); }
  private stack() {
    const tab = this.tab();
    if (!this.stacks.has(tab)) this.stacks.set(tab, []);
    return this.stacks.get(tab)!;
  }
  private commit() {
    const batch = this.batch;
    if (!batch) return;
    this.batch = undefined;
    const keys = this.changed(batch.before, this.values);
    // Cross-tab commands must not reopen a dialog from the source tab.
    if (this.value(batch.before, TAB) !== this.tab()) {
      for (const key of keys) if (this.value(this.values, key) === null || this.value(this.values, key) === false) keys.delete(key);
    }
    if (!keys.size) return; // Main tab visits are never Back entries.
    const stack = this.stack();
    const candidate = { ...batch.before };
    for (let i = stack.length - 1; i >= 0; i--) {
      for (const key of stack[i].keys) candidate[key] = this.value(stack[i].before, key);
      if (!this.changed(candidate, this.values).size) {
        const position = stack[i].position;
        stack.splice(i); // Existing Back/Close buttons consume the same path.
        this.port?.restore(position);
        return;
      }
    }
    stack.push({ before: batch.before, keys, position: batch.position });
  }
  canBack() {
    this.commit();
    const stack = this.stack();
    while (stack.length && [...stack.at(-1)!.keys].every(key => Object.is(this.value(stack.at(-1)!.before, key), this.value(this.values, key)))) stack.pop();
    return !this.pending && stack.length > 0;
  }
  async back(): Promise<boolean> {
    this.commit();
    if (!this.canBack()) return false;
    const stack = this.stack(), entry = stack.at(-1)!;
    const generation = this.generation;
    this.pending = true;
    try {
      for (const guard of this.guards) {
        let allowed = false;
        try { allowed = await guard(entry.keys); }
        catch { this.port?.report?.('guard_error'); }
        if (!allowed) { this.port?.report?.('blocked'); return false; }
        if (generation !== this.generation || !this.port) return false;
      }
      if (generation !== this.generation || !this.port) return false;
      stack.pop();
      // Restore only this step's keys; other tabs keep their current views.
      for (const key of entry.keys) this.values[key] = this.value(entry.before, key);
      for (const key of entry.keys) this.listeners.get(key)?.(this.value(this.values, key));
      this.port.restore(entry.position);
      return true;
    } finally { this.pending = false; }
  }
}
