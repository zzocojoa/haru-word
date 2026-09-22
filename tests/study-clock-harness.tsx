import React, { useLayoutEffect } from "react";
import { createRoot } from "react-dom/client";
import { useStudyDate } from "../app/use-study-date";

const INITIAL = Date.parse("2026-09-22T14:59:00Z");
type Clock = ReturnType<typeof useStudyDate>;
const requests: { signal?: AbortSignal | null; resolve: (response: Response) => void; reject: (error: Error) => void }[] = [];
window.fetch = async (_url, init) => new Promise<Response>((resolve, reject) => {
  // Control late completions explicitly, including a response already in flight at cancellation.
  requests.push({ signal: init?.signal, resolve, reject });
});
declare global {
  interface Window {
    clockHarness: { clock: Clock; count: () => number; resolve: (index: number, time?: number) => void; fail: (index: number) => void; aborted: (index: number) => boolean; visibility: (state: "visible" | "hidden") => void; unmount: () => void };
  }
}
function Harness() {
  const clock = useStudyDate(INITIAL);
  useLayoutEffect(() => {
    window.clockHarness = {
      clock, count: () => requests.length,
      resolve: (index, time = INITIAL) => requests[index].resolve(Response.json({ serverTime: time })),
      fail: index => requests[index].reject(new Error("Controlled clock failure")),
      aborted: index => !!requests[index].signal?.aborted,
      visibility: state => {
        Object.defineProperty(document, "visibilityState", { configurable: true, value: state });
        document.dispatchEvent(new Event("visibilitychange"));
      },
      unmount: () => root.unmount(),
    };
  });
  return <main><p id="clock-state">{JSON.stringify({ date: clock.date, ready: clock.ready, error: clock.error })}</p><button onClick={() => void clock.refresh()}>refresh</button></main>;
}
const root = createRoot(document.getElementById("root")!);
root.render(<Harness />);
