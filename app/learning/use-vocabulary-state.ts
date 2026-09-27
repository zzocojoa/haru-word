"use client";
import { useMemo } from 'react';
import type { State } from '@/lib/learning';

/** Read-only input for vocabulary selectors. Never use this slice for saving. */
export function useVocabularyState({ settings, progress, sessions }: State) {
  return useMemo(() => ({ settings, progress, sessions }), [settings, progress, sessions]);
}
