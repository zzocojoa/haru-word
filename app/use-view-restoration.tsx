'use client';
import { createContext, useContext, useLayoutEffect, useState } from 'react';
import { ViewRestoration } from '@/lib/view-restoration';

export const ViewRestorationContext = createContext<ViewRestoration | null>(null);

export function createViewRestoration() {
  return new ViewRestoration({
    request: callback => requestAnimationFrame(callback),
    cancel: id => cancelAnimationFrame(id),
  });
}

/** Standalone component previews retain the same cancellation semantics. */
export function useViewRestoration() {
  const shared = useContext(ViewRestorationContext);
  const [local] = useState(createViewRestoration);
  useLayoutEffect(() => () => local.cancel(), [local]);
  return shared ?? local;
}
