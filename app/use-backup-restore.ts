'use client';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { backupSummary, replacementChanges } from '@/lib/backup';
import { restoreCapabilities, pendingRestore, startRestore, sendRestorePart, checkRestore, cancelRestore, RestoreRequestError } from '@/lib/restore-client';
import type { RestoreJob, RestoreCapabilities } from '@/lib/restore-protocol';
import type { AnalyzedBackup } from '@/lib/backup-analysis';
import type { State } from '@/lib/learning';
import { inspectBackupFile } from './backup-worker-client';
import { useBackupPreview } from './use-backup-preview';
import { useNavigationState } from './navigation';
import { download } from './ui';

export type BackupRestoreProps = {
  date: string; now: () => number; state: State; getRevision?: () => number;
  busy: boolean; restoring: boolean; error: string; conflict: boolean;
  onClose: () => void; onRestore: (state: State, expected: State, jobId?: string) => Promise<boolean>;
  onReload: () => Promise<boolean>; onComplete: () => void;
};
type Stage = { kind: 'idle' | 'reading' | 'starting' | 'cancelling' | 'reloading' | 'applying' | 'complete' }
  | { kind: 'uploading' | 'validating'; current: number; total: number };
type Selection = { name: string; analysis: AnalyzedBackup; baseline: State };

/** Owns the restore operation. Display text never determines its next action. */
export function useBackupRestore({ date, now, state, getRevision = () => 0, busy, restoring, conflict,
  onClose, onRestore, onReload, onComplete }: BackupRestoreProps) {
  const [selection, setSelection] = useState<Selection | null>(null);
  const [stage, setStage] = useState<Stage>({ kind: 'idle' });
  const [fileError, setFileError] = useState('');
  const [backedUpState, setBackedUpState] = useState<State | null>(null);
  const [safetyError, setSafetyError] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [confirm, setConfirm] = useNavigationState('backup.confirm', false, true);
  const [caps, setCaps] = useState<RestoreCapabilities | null>(null);
  const [job, setJob] = useState<RestoreJob | null>(null);
  const [reloadRequired, setReloadRequired] = useState(false);
  const task = useRef<AbortController | null>(null), current = useRef(state), alive = useRef(true);
  const analysis = selection?.analysis, backup = analysis?.parsed, baseline = selection?.baseline;
  const reading = stage.kind === 'reading', success = stage.kind === 'complete';
  const working = !['idle', 'reading', 'complete'].includes(stage.kind);
  const safetyPreview = useBackupPreview(state, now, caps?.maxBytes, !!backup);
  useLayoutEffect(() => { current.current = state; }, [state]);
  useEffect(() => {
    alive.current = true;
    let cancelled = false;
    void Promise.all([restoreCapabilities(), pendingRestore()]).then(([c, p]) => {
      if (!cancelled) { setCaps(c); setJob(p.job); }
    }).catch(() => { if (!cancelled) setFileError('복원 도구를 열지 못했어요. 창을 닫고 다시 열어 주세요.'); });
    return () => { cancelled = true; alive.current = false; task.current?.abort(); };
  }, []);
  const active = (controller: AbortController) => alive.current && task.current === controller && !controller.signal.aborted;
  function begin(next: Stage) {
    if (!alive.current || task.current) return null;
    const controller = new AbortController(); task.current = controller; setStage(next); return controller;
  }
  function finish(controller: AbortController, next: Stage = { kind: 'idle' }) {
    if (active(controller)) setStage(next);
    if (task.current === controller) task.current = null;
  }
  const stale = !!baseline && baseline !== state && !success;
  const backedUp = backedUpState === state;
  const allowed = !!backup && !!caps && backedUp && acknowledged && !busy && !restoring
    && !working && !reading && !stale && !conflict && !reloadRequired && !success;
  const readyToConfirm = job?.status === 'ready' && job.fileHash === analysis?.manifest.fileHash && allowed;

  async function select(file: File | undefined) {
    if (!caps || busy || restoring || conflict || reloadRequired) return;
    const controller = begin({ kind: 'reading' }); if (!controller) return;
    setSelection(null); setBackedUpState(null); setSafetyError(''); setAcknowledged(false); setConfirm(false); setFileError('');
    try {
      if (!file) return;
      const result = await inspectBackupFile(file, caps.maxBytes, controller.signal);
      if (active(controller)) setSelection({ name: file.name, analysis: result, baseline: state });
    } catch (e) { if (active(controller)) setFileError(e instanceof Error ? e.message : '파일을 읽지 못했어요.'); }
    finally { finish(controller); }
  }
  function saveSafetyBackup() {
    setBackedUpState(null); setAcknowledged(false); setSafetyError('');
    if (!baseline || baseline !== state || busy || working || reading || conflict || reloadRequired || !safetyPreview || safetyPreview.error) return;
    try { download('haru-before-restore-' + date + '.json', safetyPreview.raw); setBackedUpState(state); }
    catch (e) { setSafetyError('안전 백업을 준비하지 못해 기록 교체를 막았어요. ' + (e instanceof Error ? e.message : '백업을 내려받지 못했어요. 다시 시도해 주세요.')); }
  }
  async function prepare() {
    if (!allowed || !analysis || !caps) return;
    if (!caps.enabled) { setConfirm(true); return; }
    const controller = begin({ kind: 'starting' }); if (!controller) return;
    setFileError('');
    try {
      let next = await startRestore(getRevision(), analysis.manifest, controller.signal);
      if (!active(controller)) return; setJob(next);
      for (let i = 0; i < analysis.parts.length; i++) if (!next.received.includes(i)) {
        setStage({ kind: 'uploading', current: i + 1, total: analysis.parts.length });
        next = await sendRestorePart(next.id, i, analysis.parts[i], controller.signal);
        if (!active(controller)) return; setJob(next);
      }
      while (next.status !== 'ready') {
        if (!['uploading', 'validating'].includes(next.status)) throw new Error('진행 상태가 바뀌었어요. 파일을 다시 선택해 주세요.');
        setStage({ kind: 'validating', current: next.validated, total: next.total });
        next = await checkRestore(next.id, controller.signal);
        if (!active(controller)) return; setJob(next);
      }
      if (current.current !== baseline) throw new Error('현재 기록이 바뀌었어요. 창을 닫고 다시 진행해 주세요.');
      setConfirm(true);
    } catch (e) {
      if (active(controller)) {
        if (e instanceof RestoreRequestError && e.code === 'revision_conflict') setReloadRequired(true);
        setFileError(e instanceof Error ? e.message : '전송을 마치지 못했어요. 같은 파일로 이어갈 수 있어요.');
        const pending = await pendingRestore().catch(() => null);
        if (active(controller) && pending) setJob(pending.job);
      }
    } finally { finish(controller); }
  }
  async function cancel() {
    if (!job || working || restoring || conflict) return;
    const controller = begin({ kind: 'cancelling' }); if (!controller) return;
    try { await cancelRestore(job.id); if (active(controller)) { setJob(null); if (!reloadRequired) setFileError(''); } }
    catch (e) { if (active(controller)) setFileError(e instanceof Error ? e.message : '취소하지 못했어요.'); }
    finally { finish(controller); }
  }
  async function reload() {
    const controller = begin({ kind: 'reloading' }); if (!controller) return;
    try {
      // Never cancel an uncertain commit; only obsolete pre-commit staging can be discarded.
      if (reloadRequired && !conflict && job) await cancelRestore(job.id);
      if (active(controller) && await onReload() && active(controller)) { onComplete(); onClose(); }
    } catch { if (active(controller)) setFileError('최신 기록을 불러오지 못했어요. 다시 시도해 주세요.'); }
    finally { finish(controller); }
  }
  async function apply() {
    setConfirm(false);
    if (!allowed || !backup || !baseline || caps?.enabled && !readyToConfirm) return;
    const controller = begin({ kind: 'applying' }); if (!controller) return;
    let completed = false;
    try {
      completed = await onRestore(backup.state, baseline, caps?.enabled ? job?.id : undefined);
      if (active(controller) && completed) onComplete();
    } finally { finish(controller, { kind: completed ? 'complete' : 'idle' }); }
  }
  function defer() { if (stage.kind !== 'applying' && !restoring) { task.current?.abort(); onClose(); } }
  const before = useMemo(() => backupSummary(baseline || state), [baseline, state]);
  const after = useMemo(() => success ? backupSummary(state) : backup ? backupSummary(backup.state) : null, [backup, state, success]);
  const changes = useMemo(() => backup && baseline ? replacementChanges(baseline, backup.state) : null, [backup, baseline]);
  const recent = useMemo(() => backup ? Object.values(backup.state.sessions).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 3) : [], [backup]);
  const phase = stage.kind === 'starting' ? '전송 준비' : stage.kind === 'uploading' ? `전송 중 ${stage.current}/${stage.total}`
    : stage.kind === 'validating' ? `파일 확인 ${stage.current}/${stage.total}` : '';
  const applying = restoring || stage.kind === 'applying';
  const step = success ? '6/6 · 반영 완료' : applying ? '5/6 · 서버에 반영 중' : confirm || readyToConfirm ? '5/6 · 최종 확인'
    : stage.kind === 'validating' ? '4/6 · 전체 기록 확인' : ['starting', 'uploading'].includes(stage.kind) ? '3/6 · 전송'
      : backup ? '2/6 · 안전 백업 보관' : '1/6 · 파일 확인';
  return { backup, baseline, name: selection?.name ?? '', reading, fileError, safetyError, acknowledged, setAcknowledged,
    confirm, setConfirm, success, caps, analysis, job, working, phase, reloadRequired, safetyPreview, stale, backedUp,
    allowed, step, applying, before, after, changes, recent, select, saveSafetyBackup, prepare, cancel, reload, apply, defer };
}
