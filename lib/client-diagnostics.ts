// A bounded, memory-only troubleshooting journal. Never records URLs, request
// bodies, account/session IDs, answers, error messages, credentials or provider text.
export const DIAGNOSTIC_EVENT_LIMIT = 120;
type Operation = "load" | "save" | "restore" | "feedback" | "clock";
type Outcome = "started" | "success" | "http_error" | "timeout" | "cancelled" | "invalid_response" | "network_error";
type Gates = {
  loading?: boolean; saving?: boolean; signedIn?: boolean; unsaved?: boolean;
  conflict?: boolean; clockReady?: boolean; clockSyncing?: boolean; storeBusy?: boolean;
  aiPending?: boolean; answerPresent?: boolean; hinted?: boolean; revealed?: boolean;
};
type Event = { at: string } & (
  | { type: "request"; request: number; operation: Operation; outcome: Outcome; durationMs?: number; status?: number }
  | { type: "availability"; surface: "app" | "lesson"; stage?: string; gates: Gates }
  | { type: "navigation"; outcome: "blocked" | "guard_error" }
);
const events: Event[] = [];
let sequence = 0;
const lastAvailability = new Map<string, string>();
const allowedGates = ["loading", "saving", "signedIn", "unsaved", "conflict", "clockReady", "clockSyncing", "storeBusy", "aiPending", "answerPresent", "hinted", "revealed"] as const;
const stages = new Set(["warmup", "learn", "en", "ko", "sentence", "checkpoint", "done"]);
function append(event: Event) {
  events.push(event);
  if (events.length > DIAGNOSTIC_EVENT_LIMIT) events.splice(0, events.length - DIAGNOSTIC_EVENT_LIMIT);
}
export function beginRequestDiagnostic(url: string, method = "GET") {
  const operation: Operation | undefined = url === "/api/state"
    ? method === "PUT" ? "save" : method === "GET" ? "load" : undefined
    : url === "/api/state/restore" || url.startsWith('/api/state/restore/jobs') ? "restore"
    : url === "/api/sentence-feedback" ? "feedback"
    : url === "/api/study-clock" ? "clock" : undefined;
  if (!operation) return () => {};
  const request = ++sequence, start = performance.now();
  append({ at: new Date().toISOString(), type: "request", request, operation, outcome: "started" });
  let done = false;
  return (outcome: Exclude<Outcome, "started">, status?: number) => {
    if (done) return;
    done = true;
    append({ at: new Date().toISOString(), type: "request", request, operation, outcome,
      durationMs: Math.round(Math.max(0, performance.now() - start)),
      ...(Number.isInteger(status) && status! >= 100 && status! <= 599 ? { status } : {}),
    });
  };
}
export function recordAvailability(surface: "app" | "lesson", values: Gates, stage?: string) {
  const gates: Gates = {};
  for (const key of allowedGates) if (typeof values[key] === "boolean") gates[key] = values[key];
  const safeStage = stage && stages.has(stage) ? stage : undefined;
  const signature = JSON.stringify({ stage: safeStage, gates });
  if (lastAvailability.get(surface) === signature) return;
  lastAvailability.set(surface, signature);
  append({ at: new Date().toISOString(), type: "availability", surface, ...(safeStage ? { stage: safeStage } : {}), gates });
}
export function exportClientDiagnostics() {
  return JSON.stringify({ format: "haru-diagnostics-v1", exportedAt: new Date().toISOString(), events }, null, 2);
}
export function recordNavigationDiagnostic(outcome: 'blocked' | 'guard_error') {
  append({ at: new Date().toISOString(), type: 'navigation', outcome });
}
