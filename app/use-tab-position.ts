"use client";
import { useLayoutEffect, useRef } from "react";
import type { View } from "./learning/types";

/** Restore positions for explicit tab visits, without moving programmatic lesson transitions. */
export function useTabPosition(view: View, epoch: number, setView: (view: View) => boolean) {
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
    const top = window.scrollY;
    if (!setView(next)) return false;
    if (next === view) return true;
    positions.current[view] = top;
    pending.current = { view: next, top: positions.current[next] ?? 0 };
    return true;
  };
}
