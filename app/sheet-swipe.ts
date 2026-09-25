import { completesSheetSwipe, sheetSwipeDirection } from '@/lib/sheet-swipe';

const controls = 'input,textarea,select,button,a,[contenteditable=true],[role=combobox],[role=listbox],[role=menu]';
const visible = (el: HTMLElement) => !!el.getClientRects().length && !el.closest('[aria-hidden=true],[hidden]');

/** Header/handle only. Never converts the content's scroll into dismissal. */
export function installSheetSwipe(element: HTMLElement, close: () => Promise<boolean>, blocked: () => boolean) {
  let drag: { id: number; x: number; y: number; dx: number; dy: number; moving: boolean; handle: boolean; height: number; transform: string; transition: string; base: string } | undefined;
  let timer = 0, settling = false, disposed = false, suppressClickUntil = 0;
  function reset() {
    clearTimeout(timer);
    if (drag) { element.style.transform = drag.transform; element.style.transition = drag.transition; }
    drag = undefined; settling = false;
    element.removeAttribute('data-sheet-dragging');
  }
  function home() {
    if (!drag) return;
    element.style.transition = 'transform 160ms ease-out';
    element.style.transform = drag.base;
    settling = true;
    timer = window.setTimeout(reset, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 170);
  }
  function start(e: TouchEvent) {
    if (drag || settling || blocked() || !matchMedia('(max-width:640px)').matches ||
      !e.cancelable || e.touches.length !== 1 || (visualViewport?.scale ?? 1) !== 1 ||
      document.documentElement.hasAttribute('data-swiping') || document.querySelector('.shell[data-keyboard=open]')) return;
    const target = e.target;
    if (!(target instanceof HTMLElement) || !target.closest('[data-sheet-handle],[data-slot=dialog-header]')) return;
    if (!target.closest('[data-sheet-handle]') && target.closest(controls)) return;
    const top = [...document.querySelectorAll<HTMLElement>('[role=dialog],[role=alertdialog],[role=listbox],[role=menu]')].filter(visible).at(-1);
    if (top !== element) return;
    const t = e.touches[0];
    // Existing left-edge Back owns its 24px strip; these recognizers cannot race.
    if (t.clientX <= 24 || t.clientX >= innerWidth - 24) return;
    e.preventDefault();
    drag = { id: t.identifier, x: t.clientX, y: t.clientY, dx: 0, dy: 0, moving: false, handle: !!target.closest('[data-sheet-handle]'),
      height: element.getBoundingClientRect().height, transform: element.style.transform,
      transition: element.style.transition, base: getComputedStyle(element).transform };
  }
  function move(e: TouchEvent) {
    if (!drag || settling) return;
    if (e.touches.length !== 1 || blocked()) { reset(); return; }
    const t = [...e.touches].find(t => t.identifier === drag!.id);
    if (!t) { reset(); return; }
    drag.dx = t.clientX - drag.x; drag.dy = t.clientY - drag.y;
    const direction = sheetSwipeDirection(drag.dx, drag.dy);
    if (direction === 'cancel') { reset(); return; }
    if (direction === 'pending') return;
    if (e.cancelable) e.preventDefault();
    drag.moving = true; element.setAttribute('data-sheet-dragging', '');
    const dy = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : Math.min(drag.dy, drag.height);
    element.style.transition = 'none';
    element.style.transform = `translateY(${dy}px) ${drag.base === 'none' ? '' : drag.base}`;
  }
  async function end(e: TouchEvent) {
    if (!drag || settling) return;
    const t = [...e.changedTouches].find(t => t.identifier === drag!.id);
    if (!t) { reset(); return; }
    if (!drag.moving) {
      const tap = drag.handle && Math.max(Math.abs(t.clientX - drag.x), Math.abs(t.clientY - drag.y)) < 10;
      reset();
      if (tap) { suppressClickUntil = performance.now() + 500; await close(); }
      return;
    }
    suppressClickUntil = performance.now() + 500;
    if (e.cancelable) e.preventDefault();
    if (blocked() || !completesSheetSwipe(t.clientX - drag.x, t.clientY - drag.y, drag.height)) { home(); return; }
    // Return the sheet before showing an unsaved-input confirmation.
    reset(); settling = true;
    try { await close(); } finally { if (!disposed) reset(); }
  }
  const cancel = () => reset();
  const click = (e: MouseEvent) => {
    const ghostTap = e.detail !== 0 && performance.now() < suppressClickUntil && e.target instanceof Element && e.target.closest('[data-sheet-handle]');
    if (settling || drag?.moving || ghostTap) { e.preventDefault(); e.stopPropagation(); }
  };
  element.addEventListener('touchstart', start, { passive: false });
  element.addEventListener('touchmove', move, { passive: false });
  element.addEventListener('touchend', end, { passive: false });
  element.addEventListener('touchcancel', cancel);
  element.addEventListener('click', click, true);
  window.addEventListener('resize', cancel);
  visualViewport?.addEventListener('resize', cancel);
  return () => {
    disposed = true; reset();
    element.removeEventListener('touchstart', start); element.removeEventListener('touchmove', move);
    element.removeEventListener('touchend', end); element.removeEventListener('touchcancel', cancel);
    element.removeEventListener('click', click, true); window.removeEventListener('resize', cancel);
    visualViewport?.removeEventListener('resize', cancel);
  };
}
