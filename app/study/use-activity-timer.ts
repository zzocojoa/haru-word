"use client";
import type { Session } from "@/lib/learning";
import { useEffect, useState } from "react";
// The keyed session owns this hook. Saving or switching tabs must not reset elapsed time.
export function useActivityTimer(
  s: Pick<Session, "elapsed" | "paused" | "finished" | "stage">,
  showSummary: boolean,
  visible: boolean,
) {
  const [seconds, setSeconds] = useState(s.elapsed);
  const [paused, setPaused] = useState(s.paused);
  const [boutStart, setBoutStart] = useState(s.elapsed);
  useEffect(() => {
    if (
      paused ||
      s.finished ||
      s.stage === "checkpoint" ||
      showSummary ||
      !visible
    )
      return;
    let tick = performance.now();
    const timer = setInterval(() => {
      const delta = Math.floor((performance.now() - tick) / 1000);
      if (delta > 0) {
        tick += delta * 1000;
        if (document.visibilityState === "visible")
          setSeconds((previous) => previous + delta);
      }
    }, 1000);
    const visibilityChanged = () => {
      tick = performance.now();
    };
    document.addEventListener("visibilitychange", visibilityChanged);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visibilityChanged);
    };
  }, [paused, s.finished, s.stage, showSummary, visible]);
  return { seconds, paused, boutStart, setPaused, setBoutStart };
}
