'use client';
import { useLayoutEffect, useMemo } from 'react';
import { ImagePracticePositionController } from '@/lib/image-practice-position';

export function useImagePracticePosition(owner: string | null) {
  const controller = useMemo(() => owner ? new ImagePracticePositionController(owner, () => window.localStorage) : null, [owner]);
  useLayoutEffect(() => {
    controller?.start();
    return () => controller?.stop();
  }, [controller]);
  return controller;
}
