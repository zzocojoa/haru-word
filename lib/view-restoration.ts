export type RestorationKind = 'view' | 'history' | 'destination';
type Frames = { request: (callback: () => void) => number; cancel: (id: number) => void };
type Request = { kind: RestorationKind; apply: () => void };
const priority: Record<RestorationKind, number> = { view: 0, history: 1, destination: 2 };

/** Coalesce one transition's focus/scroll requests; explicit destinations win. */
export class ViewRestoration {
  private pending: Request | undefined;
  private frame: number | undefined;
  private frames: Frames;

  constructor(frames: Frames) { this.frames = frames; }

  schedule(kind: RestorationKind, apply: () => void): () => void {
    if (this.pending && priority[this.pending.kind] > priority[kind]) return () => {};
    this.cancel();
    const request = { kind, apply };
    this.pending = request;
    // Let React commit and native pointer/Tab focus finish before restoring.
    this.frame = this.frames.request(() => {
      if (this.pending !== request) return;
      this.frame = this.frames.request(() => {
        if (this.pending !== request) return;
        this.pending = undefined;
        this.frame = undefined;
        request.apply();
      });
    });
    return () => { if (this.pending === request) this.cancel(); };
  }

  cancel() {
    if (this.frame !== undefined) this.frames.cancel(this.frame);
    this.frame = undefined;
    this.pending = undefined;
  }
}
