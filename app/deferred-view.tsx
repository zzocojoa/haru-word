'use client';
import { Component, createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type ComponentType, type ReactNode } from 'react';
import { staticModuleUrls } from '@/lib/deferred-assets';

export const DeferredReloadBlocked = createContext(false);

function ReloadMaterial({ label, blocked }: { label: string; blocked: boolean }) {
  const [pending, setPending] = useState(false);
  const button = useRef<HTMLButtonElement>(null), latestBlocked = useRef(blocked), inFlight = useRef(false);
  useLayoutEffect(() => { latestBlocked.current = blocked; }, [blocked]);
  async function reload() {
    if (inFlight.current || blocked) return;
    inFlight.current = true;
    setPending(true);
    try {
      // WebKit may keep a failed module's network cache across document reloads.
      // Refresh only same-origin static JS, then let native import run normally.
      // No answers, state APIs, eval, module rewriting or automatic retries.
      const urls = staticModuleUrls(performance.getEntriesByType('resource').map(entry => entry.name), window.location.origin);
      await Promise.all(urls.map(async url => {
        const response = await fetch(url, { cache: 'reload', signal: AbortSignal.timeout(15000) });
        if (!response.ok) throw new Error('Static material unavailable');
        await response.arrayBuffer();
      }));
      // A tab switch or an intervening save must not reload a different view.
      if (!latestBlocked.current && button.current?.getClientRects().length) window.location.reload();
    } catch { /* Keep the original view and its drafts for an explicit retry. */ }
    finally { inFlight.current = false; setPending(false); }
  }
  return <div role="alert"><p>{label} 자료를 불러오지 못했어요.</p><button ref={button} type="button" className="secondary-button" disabled={blocked || pending} onClick={() => { void reload(); }}>{pending ? '다시 불러오는 중' : '다시 불러오기'}</button></div>;
}

class LoadBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return this.props.fallback;
    return this.props.children;
  }
}

// One stable wrapper per feature keeps an already mounted lesson/editor alive
// across tab switches. Loading never creates or modifies learner records.
export function deferredView<Feature, Props extends object>(load: () => Promise<Feature>, select: (feature: Feature) => ComponentType<Props>, label: string,
  placeholder: (props: Props, status: ReactNode) => ReactNode = (_props, status) => status) {
  let resolved: ComponentType<Props> | undefined, request: Promise<ComponentType<Props>> | undefined;
  function resolve() { return request ??= load().then(feature => { resolved = select(feature); return resolved; }); }
  return function DeferredView(props: Props) {
    const blocked = useContext(DeferredReloadBlocked);
    const [View, setView] = useState<ComponentType<Props> | undefined>(() => resolved);
    const [failed, setFailed] = useState(false);
    useEffect(() => {
      let current = true;
      if (!View) void resolve().then(view => { if (current) setView(() => view); }, () => { if (current) setFailed(true); });
      return () => { current = false; };
    }, [View]);
    const failure = placeholder(props, <ReloadMaterial label={label} blocked={blocked} />);
    return <LoadBoundary fallback={failure}>
      {failed ? failure : View ? <View {...props} /> : placeholder(props, <p role="status" aria-busy="true">{label} 자료를 불러오는 중이에요.</p>)}
    </LoadBoundary>;
  };
}
