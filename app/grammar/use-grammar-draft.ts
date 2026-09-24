'use client';
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { State } from '@/lib/learning';
import { newGrammarProgress, type GrammarProgress, type LessonId } from '@/lib/grammar/model';

export type GrammarLeave = () => Promise<boolean>;
export type GrammarPersistence = {
  currentState: RefObject<State>;
  save: (state: State) => Promise<boolean>;
  stage: (id: LessonId, progress: GrammarProgress) => void;
  canSave: boolean;
  saved: boolean;
  registerLeave: (leave: GrammarLeave) => () => void;
};

// Latest local input remains editable while each snapshot is acknowledged in order.
// A failed save pauses the queue; retry is explicit, and navigation waits for the queue.
export function useGrammarDraft(id: LessonId, { currentState, save, stage, canSave, saved }: GrammarPersistence) {
  const [draft, setDraft] = useState(() => currentState.current.grammar?.[id] ?? newGrammarProgress());
  const latest = useRef(draft), version = useRef(0), acknowledged = useRef(0);
  const task = useRef<Promise<boolean> | null>(null), alive = useRef(true), allowed = useRef(canSave);
  const [dirty, setDirty] = useState(false), [saving, setSaving] = useState(false), [error, setError] = useState('');
  useEffect(() => { allowed.current = canSave; }, [canSave]);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    // The shared error banner can retry this same staged snapshot. Acknowledge
    // that success too, but never a response for an older local sentence.
    if (!saved || currentState.current.grammar?.[id] !== latest.current || acknowledged.current === version.current) return;
    acknowledged.current = version.current;
    setDirty(false);
    setError('');
  }, [saved, currentState, id]);
  const change = useCallback((update: (p: GrammarProgress) => GrammarProgress) => {
    const next = { ...update(latest.current), updatedAt: new Date().toISOString() };
    latest.current = next; version.current++; setDraft(next); setDirty(true);
    // Global emergency/whole backups must contain the latest input, not only
    // the last snapshot that happened to reach the network.
    stage(id, next);
  }, [id, stage]);
  const flush = useCallback((): Promise<boolean> => {
    if (task.current) return task.current;
    if (version.current === acknowledged.current) return Promise.resolve(true);
    if (!allowed.current) return Promise.resolve(false);
    setSaving(true); setError('');
    const work = async () => {
      try {
        while (alive.current && acknowledged.current < version.current) {
          if (!allowed.current) return false;
          const submitted = version.current, snapshot = latest.current, root = currentState.current;
          if (!await save({ ...root, grammar: { ...root.grammar, [id]: snapshot } })) {
            if (alive.current) setError('저장을 마치지 못했어요. 입력은 그대로 있어요. 다시 저장해 주세요.');
            return false;
          }
          acknowledged.current = submitted;
        }
        if (alive.current) setDirty(false);
        return true;
      } finally { task.current = null; if (alive.current) setSaving(false); }
    };
    task.current = work();
    return task.current;
  }, [currentState, id, save]);
  useEffect(() => {
    if (!dirty || error || !canSave) return;
    const timer = window.setTimeout(() => { void flush(); }, 500);
    return () => clearTimeout(timer);
  }, [draft, dirty, error, canSave, flush]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  return { draft, latest, change, flush, dirty, saving, error };
}
