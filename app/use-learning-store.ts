"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import { EMPTY, type State } from '@/lib/learning';
import { stateDelta } from '@/lib/state-delta';
import { InvalidResponseError, RequestTimeoutError } from '@/lib/client-request';
import { loadLearningState, restoreLearningState, saveLearningState } from '@/lib/learning-api';
import { commitRestore } from '@/lib/restore-client';
import type { StateSnapshot } from '@/lib/api-contracts';
import type { GrammarProgress, LessonId } from '@/lib/grammar/model';

type LoadPhase = 'initializing' | 'reloading' | 'idle';

export function useLearningStore() {
  const [state, setState] = useState<State>(() => structuredClone(EMPTY));
  const current = useRef(state);
  const persisted = useRef(state);
  const revision = useRef(0);
  const lock = useRef(false);
  // A single phase keeps loading and splash visibility in sync. Once settled,
  // retries/reloads use the normal recovery surface, never the startup screen.
  const [loadPhase, setLoadPhase] = useState<LoadPhase>('initializing');
  const loading = loadPhase !== 'idle';
  const initializing = loadPhase === 'initializing';
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [unsaved, setUnsaved] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [epoch, setEpoch] = useState(0);

  // Only validated reads/restores replace the entire local snapshot. Saves keep
  // their own acknowledgement path so newer in-flight grammar drafts survive.
  const applySnapshot = useCallback(({ state: next, revision: nextRevision }: StateSnapshot) => {
    revision.current = nextRevision;
    persisted.current = next;
    current.current = next;
    setState(next);
    setUnsaved(false);
    setConflict(false);
    setEpoch(n => n + 1);
  }, []);

  const stageGrammar = useCallback((id: LessonId, draft: GrammarProgress) => {
    const next = { ...current.current, grammar: { ...current.current.grammar, [id]: draft } };
    current.current = next;
    setState(next);
    setUnsaved(true);
  }, []);

  const load = useCallback(async () => {
    if (lock.current) return false;
    lock.current = true;
    setLoadPhase(phase => phase === 'initializing' ? phase : 'reloading');
    setError('');
    try {
      const result = await loadLearningState();
      if (result.response.status === 401) {
        setSignedIn(false);
        return false;
      }
      if (!result.ok) throw new Error(result.data.error || '기록을 불러오지 못했습니다.');
      applySnapshot(result.data);
      setSignedIn(true);
      return true;
    } catch (e) {
      if (e instanceof InvalidResponseError) setConflict(true);
      setError(e instanceof RequestTimeoutError
        ? '기록을 불러오는 데 시간이 오래 걸려요. 연결을 확인하고 다시 시도해 주세요.'
        : e instanceof Error ? e.message : '불러오기 실패');
      return false;
    } finally {
      lock.current = false;
      setLoadPhase('idle');
    }
  }, [applySnapshot]);

  // Load and subscribe to the external account state on mount.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!unsaved && !restoring) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [unsaved, restoring]);

  const save = useCallback(async (next: State) => {
    if (lock.current || conflict) return false;
    if (!signedIn) {
      setError('로그인 후 학습 기록을 저장할 수 있어요.');
      return false;
    }
    lock.current = true;
    setSaving(true);
    setError('');
    current.current = next;
    setState(next);
    setUnsaved(true);
    // Compare with the last acknowledged state, including earlier failed changes.
    const { progress, sessions, settings, grammar } = stateDelta(persisted.current, next);
    try {
      const result = await saveLearningState({ revision: revision.current, settings, progress, sessions, grammar });
      if (!result.ok) {
        setConflict(result.response.status === 409);
        throw new Error(result.data.error || '저장하지 못했습니다.');
      }
      revision.current = result.data.revision;
      persisted.current = next;
      // A grammar draft may have advanced while this snapshot was in flight.
      setUnsaved(current.current !== next);
      setConflict(false);
      return true;
    } catch (e) {
      if (e instanceof InvalidResponseError) setConflict(true);
      setError(e instanceof RequestTimeoutError
        ? '저장 응답이 늦어 결과를 확인하지 못했어요. 입력은 화면에 남아 있어요. 현재 입력을 백업한 뒤 다시 시도해 주세요.'
        : e instanceof Error ? e.message : '저장 실패');
      return false;
    } finally {
      lock.current = false;
      setSaving(false);
    }
  }, [signedIn, conflict]);

  const restore = useCallback(async (next: State, expected: State, jobId?: string) => {
    if (lock.current || !signedIn || unsaved || conflict || current.current !== expected) {
      setError('현재 기록이 바뀌었어요. 복원 미리보기를 다시 열어 주세요.');
      return false;
    }
    lock.current = true;
    setSaving(true);
    setRestoring(true);
    setError('');
    try {
      if (jobId) {
        const receipt = await commitRestore(jobId);
        if (receipt.status !== 'committed' || receipt.baseRevision !== revision.current || receipt.revision !== revision.current + 1) {
          throw new InvalidResponseError();
        }
        const fresh = await loadLearningState();
        if (!fresh.ok || fresh.data.revision < receipt.revision) throw new InvalidResponseError();
        applySnapshot(fresh.data);
        return true;
      }
      const result = await restoreLearningState(next, revision.current);
      if (!result.ok || result.data.revision !== revision.current + 1) {
        setError((!result.ok && result.data.error) || '복원 결과를 확인하지 못했어요. 서버 기록을 확인해 주세요.');
        setConflict(true);
        return false;
      }
      const restored = next.grammar === undefined ? { ...next, grammar: current.current.grammar } : next;
      applySnapshot({ state: restored, revision: result.data.revision });
      return true;
    } catch {
      // An uncertain replacement must be reconciled by loading, never blindly retried.
      setError('연결이 끊기거나 응답이 지연되어 복원 결과를 확인하지 못했어요. 다시 복원하기 전에 서버 기록을 확인해 주세요.');
      setConflict(true);
      return false;
    } finally {
      lock.current = false;
      setSaving(false);
      setRestoring(false);
    }
  }, [signedIn, unsaved, conflict, applySnapshot]);

  return { state, current, stageGrammar, getRevision:()=>revision.current, loading, initializing, saving, error, conflict, signedIn, unsaved, restoring, epoch, save, load, restore, retry: () => save(current.current) };
}
