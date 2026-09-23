"use client";
import { useCallback, useRef } from 'react';

export type StudyLeaveHandler = () => Promise<boolean>;
export function useStudyTransition() {
  const handler = useRef<StudyLeaveHandler | null>(null);
  const locked = useRef(false);
  const register = useCallback((next: StudyLeaveHandler) => {
    handler.current = next;
    return () => { if (handler.current === next) handler.current = null; };
  }, []);
  const prepare = useCallback(async () => {
    if (locked.current) return false;
    locked.current = true;
    try { return await handler.current?.() ?? true; }
    finally { locked.current = false; }
  }, []);
  return { register, prepare };
}
