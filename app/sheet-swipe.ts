import { completesSheetSwipe, sheetSwipeDirection } from '@/lib/sheet-swipe';

const controls = 'input,textarea,select,button,a,summary,[contenteditable=true],[role=combobox],[role=listbox],[role=menu]';
const visible = (el: HTMLElement) => !!el.getClientRects().length && !el.closest('[aria-hidden=true],[hidden]');
type Close = (beforeClose?: () => Promise<boolean>) => Promise<boolean>;

/** The body can dismiss only when the gesture starts at its scroll boundary. */
export function installSheetSwipe(element: HTMLElement, close: Close, blocked: () => boolean, dirty: () => boolean) {
  let drag: { id: number; x: number; y: number; height: number; moving: boolean; body: boolean } | undefined;
  let animation: Animation | undefined;
  let offset = 0, settling = false, disposed = false;
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  function position(y: number) {
    offset = y;
    element.style.setProperty('--sheet-offset', `${y}px`);
    element.setAttribute('data-sheet-touched', '');
    element.setAttribute('data-sheet-motion', '');
  }
  function reset() {
    animation?.cancel(); animation = undefined;
    drag = undefined; settling = false; offset = 0;
    element.style.removeProperty('--sheet-offset');
    for (const attr of ['data-sheet-motion', 'data-sheet-dragging', 'data-sheet-dismissed']) element.removeAttribute(attr);
  }
  async function animateTo(y: number, duration: number) {
    if (!drag || disposed) return false;
    if (reduced()) { position(y); return true; }
    const current = element.animate([
      { transform: `translateY(${offset}px)` }, { transform: `translateY(${y}px)` },
    ], { duration, easing: 'cubic-bezier(.22, .61, .36, 1)', fill: 'forwards' });
    animation = current;
    try {
      await current.finished;
      if (disposed || animation !== current || !drag) return false;
      position(y); current.cancel(); animation = undefined; return true;
    } catch { return false; } // Touch/viewport cancellation keeps the dialog open.
  }
  async function home() {
    const current = drag;
    if (!current) return;
    settling = true;
    await animateTo(0, 180);
    if (drag === current && !disposed) reset();
  }
  function start(e: TouchEvent) {
    if (drag || settling || blocked() || !matchMedia('(max-width:640px)').matches ||
      !e.cancelable || e.touches.length !== 1 || (visualViewport?.scale ?? 1) !== 1 ||
      document.documentElement.hasAttribute('data-swiping') || document.querySelector('.shell[data-keyboard=open]')) return;
    const target = e.target;
    if (!(target instanceof HTMLElement) || target.closest(controls)) return;
    const header = target.closest('[data-sheet-handle],[data-slot=dialog-header]');
    const body = target.closest('.dialog-scroll');
    if (!header) {
      if (!body || !element.contains(body)) return;
      // Do not take over a scroll that started below the top, even if it reaches
      // the boundary later. Nested scrollers and text selection keep ownership.
      if (window.getSelection()?.isCollapsed === false) return;
      for (let node: HTMLElement | null = target; node && node !== element; node = node.parentElement) {
        if (node.scrollTop > 1) return;
      }
    }
    const top = [...document.querySelectorAll<HTMLElement>('[role=dialog],[role=alertdialog],[role=listbox],[role=menu]')].filter(visible).at(-1);
    if (top !== element) return;
    const t = e.touches[0];
    // Existing left-edge Back owns its 24px strip; these recognizers cannot race.
    if (t.clientX <= 24 || t.clientX >= innerWidth - 24) return;
    // Body taps and upward scrolling stay native. Claim only a downward move;
    // the handle/header retain their existing touchstart gesture ownership.
    if (header) e.preventDefault();
    drag = { id: t.identifier, x: t.clientX, y: t.clientY, height: element.getBoundingClientRect().height, moving: false, body: !header };
  }
  function move(e: TouchEvent) {
    if (!drag || settling) return;
    if (e.touches.length !== 1 || blocked()) { reset(); return; }
    const t = [...e.touches].find(t => t.identifier === drag!.id);
    if (!t) { reset(); return; }
    const dx = t.clientX - drag.x, dy = t.clientY - drag.y;
    const direction = sheetSwipeDirection(dx, dy);
    if (direction === 'cancel') { if (drag.body && !drag.moving) reset(); else void home(); return; }
    if (direction === 'pending') {
      // Reserve the first small downward move at the top before the browser
      // starts rubber-band scrolling. Upward/horizontal moves are untouched.
      if (drag.body && dy > 0 && dy > Math.abs(dx) * 1.5 && e.cancelable) e.preventDefault();
      return;
    }
    if (e.cancelable) e.preventDefault();
    drag.moving = true; element.setAttribute('data-sheet-dragging', '');
    position(reduced() ? 0 : Math.min(dy, drag.height));
  }
  async function end(e: TouchEvent) {
    if (!drag || settling) return;
    const t = [...e.changedTouches].find(t => t.identifier === drag!.id);
    if (!t) { reset(); return; }
    if (!drag.moving) { reset(); return; } // A handle tap is never a close command.
    if (e.cancelable) e.preventDefault();
    if (blocked() || !completesSheetSwipe(t.clientX - drag.x, t.clientY - drag.y, drag.height)) { await home(); return; }
    settling = true;
    // Restore only when an input-discard question is needed. Clean dismissal
    // continues from the release position instead of jumping back to the top.
    if (dirty() && !await animateTo(0, 180)) return;
    const allowed = await close(async () => {
      if (!drag || blocked() || disposed) return false;
      if (!await animateTo(drag.height + 24, 220)) return false;
      element.setAttribute('data-sheet-dismissed', ''); // No second Radix exit animation.
      return true;
    });
    if (!allowed && !disposed) await home();
  }
  const cancel = () => reset();
  const click = (e: MouseEvent) => {
    if (settling || drag?.moving) { e.preventDefault(); e.stopPropagation(); }
  };
  element.addEventListener('touchstart', start, { passive: false });
  element.addEventListener('touchmove', move, { passive: false });
  element.addEventListener('touchend', end, { passive: false });
  element.addEventListener('touchcancel', cancel);
  element.addEventListener('click', click, true);
  window.addEventListener('resize', cancel);
  visualViewport?.addEventListener('resize', cancel);
  return () => {
    disposed = true;
    // A closing Radix node can survive until its presence cleanup. Keep its
    // offscreen pose so disposing the listener cannot flash it back onscreen.
    if (element.hasAttribute('data-sheet-dismissed')) animation?.cancel(); else reset();
    element.removeEventListener('touchstart', start); element.removeEventListener('touchmove', move);
    element.removeEventListener('touchend', end); element.removeEventListener('touchcancel', cancel);
    element.removeEventListener('click', click, true); window.removeEventListener('resize', cancel);
    visualViewport?.removeEventListener('resize', cancel);
  };
}
