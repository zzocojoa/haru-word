"use client";
import { createContext, useContext, useLayoutEffect, useRef, type ReactNode } from 'react';
import type { State } from '@/lib/learning';

type Capture = (state: State) => State;
type Recovery = { current: Capture | null };
const StudyRecovery = createContext<Recovery | null>(null);

// Drafts stay local during typing. Read the last committed render only when the
// user exports a recovery copy; never run a save/grade command while exporting.
export function StudyRecoveryProvider({ children }: { children: ReactNode }) {
  const recoveryRef = useRef<Capture | null>(null);
  return <StudyRecovery.Provider value={recoveryRef}>{children}</StudyRecovery.Provider>;
}

export function useStudyRecoveryDraft(capture: Capture) {
  const recoveryRef = useContext(StudyRecovery);
  useLayoutEffect(() => {
    if (!recoveryRef) return;
    recoveryRef.current = capture;
    return () => { if (recoveryRef.current === capture) recoveryRef.current = null; };
  }, [recoveryRef, capture]);
}

export function useStudyRecoverySnapshot(): Capture {
  const recoveryRef = useContext(StudyRecovery);
  return state => recoveryRef?.current?.(state) ?? state;
}
