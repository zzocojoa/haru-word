'use client';
import { createContext, useContext, useLayoutEffect, useCallback, useRef, useState, type ReactNode, type Dispatch, type SetStateAction } from 'react';
import { NavigationHistory, type NavigationGuard } from '@/lib/navigation-history';
import { recordNavigationDiagnostic } from '@/lib/client-diagnostics';

const NavigationContext = createContext<NavigationHistory | null>(null);
type Position = { top: number; focus: HTMLElement | null };

export function NavigationProvider({ children }: { children: ReactNode }) {
  const [navigation] = useState(() => new NavigationHistory());
  useLayoutEffect(() => {
    const previousScroll = history.scrollRestoration;
    let frame = 0;
    history.scrollRestoration = 'manual';
    navigation.start({
      state: () => history.state,
      replace: state => history.replaceState(state, ''),
      push: state => history.pushState(state, ''),
      go: delta => history.go(delta),
      report: recordNavigationDiagnostic,
      capture: (): Position => {
        let focus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        // Pointer focus may already be on the destination tab before its value
        // changes. Keep the source tab's focus with the source history entry.
        if (focus?.matches('[role="tab"][aria-selected="false"]')) {
          focus = focus.closest('[role="tablist"]')?.querySelector<HTMLElement>('[aria-selected="true"]') ?? null;
        }
        return { top: window.scrollY, focus };
      },
      restore: position => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => { frame = requestAnimationFrame(() => {
          const saved = position as Position | undefined;
          const target = saved?.focus;
          // Radix tabs activate on focus. Restoring an inactive tab would
          // navigate away again after an otherwise successful Back.
          if (target?.isConnected && target.getClientRects().length && !target.matches('[role="tab"][aria-selected="false"]')) target.focus({ preventScroll: true });
          else document.querySelector<HTMLElement>('[role="dialog"] h2, main h1')?.focus({ preventScroll: true });
          window.scrollTo({ top: saved?.top ?? 0, behavior: 'instant' });
        }); });
      },
    }, crypto.randomUUID());
    const pop = (event: PopStateEvent) => { void navigation.pop(event.state); };
    window.addEventListener('popstate', pop);
    return () => {
      navigation.stop(); cancelAnimationFrame(frame);
      window.removeEventListener('popstate', pop);
      history.scrollRestoration = previousScroll;
    };
  }, [navigation]);
  return <NavigationContext.Provider value={navigation}>{children}</NavigationContext.Provider>;
}

/** Only screen identifiers belong here. Answers, filters and progress stay in their existing stores. */
export function useNavigationState<T>(key: string, initial: T, fresh = false): [T, Dispatch<SetStateAction<T>>] {
  const navigation = useContext(NavigationContext);
  const [value, setValue] = useState(() => navigation ? fresh ? navigation.fresh(key, initial) : navigation.read(key, initial) : initial);
  useLayoutEffect(() => navigation?.subscribe(key, next => setValue(next as T)), [key, navigation]);
  const change = useCallback<Dispatch<SetStateAction<T>>>(next => {
    if (navigation) navigation.change(key, next); else setValue(next);
  }, [key, navigation]);
  return [value, change];
}

export function useNavigationGuard(guard: NavigationGuard) {
  const navigation = useContext(NavigationContext);
  const latest = useRef(guard);
  useLayoutEffect(() => { latest.current = guard; });
  useLayoutEffect(() => navigation?.guard(changed => latest.current(changed)), [navigation]);
}

/** Account reload/restore invalidates views of the replaced records, including Forward entries. */
export function useNavigationEpoch(epoch: number) {
  const navigation = useContext(NavigationContext);
  useLayoutEffect(() => {
    navigation?.reset(['app.tab', 'app.settings', 'app.about', 'app.backup']);
  }, [epoch, navigation]);
}
