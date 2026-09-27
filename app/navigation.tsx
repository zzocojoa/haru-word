'use client';
import { createContext, useContext, useLayoutEffect, useCallback, useRef, useState, type ReactNode, type SetStateAction } from 'react';
import { NavigationHistory, type NavigationGuard } from '@/lib/navigation-history';
import { recordNavigationDiagnostic } from '@/lib/client-diagnostics';
import { installSwipeBack } from './swipe-back';
import { createViewRestoration, ViewRestorationContext } from './use-view-restoration';

const NavigationContext = createContext<NavigationHistory | null>(null);
type Position = { top: number; focus: HTMLElement | null };

export function NavigationProvider({ children }: { children: ReactNode }) {
  const [navigation] = useState(() => new NavigationHistory());
  const [restoration] = useState(createViewRestoration);
  useLayoutEffect(() => {
    navigation.start({
      report: recordNavigationDiagnostic,
      capture: (): Position => {
        restoration.cancel();
        let focus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        // Pointer focus may already be on the destination tab before its value
        // changes. Keep the source tab's focus with the source history entry.
        if (focus?.matches('[role="tab"][aria-selected="false"]')) {
          focus = focus.closest('[role="tablist"]')?.querySelector<HTMLElement>('[aria-selected="true"]') ?? null;
        }
        return { top: window.scrollY, focus };
      },
      restore: position => {
        restoration.schedule('history', () => {
          const saved = position as Position | undefined;
          const target = saved?.focus;
          // Radix tabs activate on focus. Restoring an inactive tab would
          // navigate away again after an otherwise successful Back.
          if (target?.isConnected && target.getClientRects().length && !target.matches('[role="tab"][aria-selected="false"]')) target.focus({ preventScroll: true });
          else document.querySelector<HTMLElement>('[role="dialog"] h2, main h1')?.focus({ preventScroll: true });
          window.scrollTo({ top: saved?.top ?? 0, behavior: 'instant' });
        });
      },
    });
    const removeSwipe = installSwipeBack(navigation);
    return () => {
      navigation.stop(); restoration.cancel();
      removeSwipe();
    };
  }, [navigation, restoration]);
  return <NavigationContext.Provider value={navigation}><ViewRestorationContext.Provider value={restoration}>{children}</ViewRestorationContext.Provider></NavigationContext.Provider>;
}

/** Only screen identifiers belong here. Answers, filters and progress stay in their existing stores. */
type NavigationSetter<T> = (next: SetStateAction<T>) => boolean;
export function useNavigationState<T>(key: string, initial: T, fresh = false): [T, NavigationSetter<T>] {
  const navigation = useContext(NavigationContext);
  const [value, setValue] = useState(() => navigation ? fresh ? navigation.fresh(key, initial) : navigation.read(key, initial) : initial);
  useLayoutEffect(() => navigation?.subscribe(key, next => setValue(next as T)), [key, navigation]);
  const change = useCallback<NavigationSetter<T>>(next => {
    if (navigation) return navigation.change(key, next);
    setValue(next);
    return true;
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
