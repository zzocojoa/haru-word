'use client';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { DEFAULT_AI_MODEL } from '@/lib/ai-models';

const AiRequestContext = createContext({ modelId: DEFAULT_AI_MODEL as string, pendingCount: 0,
  beginRequest: (): (() => void) => () => {} });

export function AiRequestProvider({ modelId, children }: { modelId: string; children: ReactNode }) {
  const [pendingCount, setPendingCount] = useState(0);
  const beginRequest = useCallback(() => {
    setPendingCount(value => value + 1);
    let active = true;
    return () => {
      if (!active) return;
      active = false;
      setPendingCount(value => Math.max(0, value - 1));
    };
  }, []);
  const value = useMemo(() => ({ modelId, pendingCount, beginRequest }), [modelId, pendingCount, beginRequest]);
  return <AiRequestContext.Provider value={value}>{children}</AiRequestContext.Provider>;
}
export const useAiRequests = () => useContext(AiRequestContext);
