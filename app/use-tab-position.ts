"use client";
import { useLayoutEffect, useRef } from "react";
import type { View } from "./learning/types";

/** Restore positions for explicit tab visits, without moving programmatic lesson transitions. */
export function useTabPosition(view: View, epoch: number, setView: (view: View) => void) {
  const positions = useRef<Partial<Record<View, number>>>({});
  const pending = useRef<{ view: View; top: number } | null>(null);
  useLayoutEffect(() => {
    positions.current = {};
    pending.current = null;
  }, [epoch]);
  useLayoutEffect(() => {
    if (pending.current?.view !== view) return;
    window.scrollTo({ top: pending.current.top, behavior: "instant" });
    pending.current = null;
  }, [view]);
  return (next: View) => {
    if (next === view) return;
    positions.current[view] = window.scrollY;
    pending.current = { view: next, top: positions.current[next] ?? 0 };
    setView(next);
  };
}
