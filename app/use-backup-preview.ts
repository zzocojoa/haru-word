'use client';
import { useEffect, useState } from 'react';
import type { State } from '@/lib/learning';
import { inspectBackupExport } from './backup-worker-client';

type Preview = { state: State; limit: number; raw: string; bytes: number; error: string };
export function useBackupPreview(state: State, now: () => number, limit: number | undefined, enabled = true) {
  const [preview, setPreview] = useState<Preview | null>(null);
  useEffect(() => {
    if (!enabled || !limit) return;
    const controller = new AbortController();
    void inspectBackupExport(state, now(), limit, controller.signal).then(result => {
      if (!controller.signal.aborted) setPreview({ ...result, state, limit });
    }).catch(error => {
      if (!controller.signal.aborted) setPreview({ state, limit, raw: '', bytes: 0, error: error instanceof Error ? error.message : '백업을 확인하지 못했어요.' });
    });
    return () => controller.abort();
  }, [state, now, limit, enabled]);
  return enabled && preview?.state === state && preview.limit === limit ? preview : null;
}
