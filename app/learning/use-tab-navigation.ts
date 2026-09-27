"use client";
import { useCallback, useLayoutEffect, useRef } from 'react';
import type { View } from './types';

/** Explicit tab visits share exit preparation; internal lesson commands keep their own transitions. */
export function useTabNavigation(view: View, epoch: number, blocked: boolean,
  prepare: () => Promise<boolean>, visit: (view: View) => boolean) {
  const latest = useRef({ view, epoch, blocked, prepare, visit });
  const pending = useRef(false);
  const alive = useRef(true);
  useLayoutEffect(() => { latest.current = { view, epoch, blocked, prepare, visit }; });
  useLayoutEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  return useCallback(async (next: View) => {
    const from = latest.current;
    if (!alive.current || pending.current || from.blocked) return false;
    if (next === from.view) return true;
    pending.current = true;
    try {
      if (!await from.prepare() || !alive.current || latest.current.blocked
        || latest.current.epoch !== from.epoch || latest.current.view !== from.view) return false;
      return latest.current.visit(next);
    } finally { pending.current = false; }
  }, []);
}
