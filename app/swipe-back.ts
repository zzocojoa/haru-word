import type { NavigationHistory } from '@/lib/navigation-history';
import { SWIPE_EDGE, completesSwipe, swipeDirection } from '@/lib/swipe-back';

type Surface = { element: HTMLElement; transform: string; transition: string; base: string };
type Drag = { id: number; x: number; y: number; dx: number; dy: number; moving: boolean; surfaces: Surface[] };
const visible = (node: HTMLElement) => !!node.getClientRects().length && !node.closest('[hidden], [aria-hidden="true"]');
const interactive = 'input, textarea, select, button, a, [contenteditable="true"], [role="slider"], [role="listbox"], [role="menu"]';
const dismissConfirmation = (target: EventTarget | null) => target instanceof Element && !!target.closest('.sheet-discard-confirm');

/** Own only the body's narrow left-edge gesture, not scrolling or browser toolbar Back. */
export function installSwipeBack(navigation: NavigationHistory) {
  let drag: Drag | undefined, settling = false, timer = 0, disposed = false;
  let releaseInert = () => {};
  const cue = document.createElement('div');
  cue.className = 'navigation-swipe-cue';
  cue.setAttribute('aria-hidden', 'true');
  cue.textContent = '‹';

  function reset() {
    clearTimeout(timer);
    for (const s of drag?.surfaces ?? []) {
      s.element.style.transform = s.transform;
      s.element.style.transition = s.transition;
    }
    drag = undefined; settling = false;
    document.documentElement.removeAttribute('data-swiping');
    cue.remove(); releaseInert(); releaseInert = () => {};
  }
  function animateHome() {
    if (!drag) return;
    for (const s of drag.surfaces) {
      s.element.style.transition = 'transform 160ms ease-out';
      s.element.style.transform = s.base;
    }
    timer = window.setTimeout(reset, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 170);
  }
  function surfaces(target: HTMLElement, y: number): HTMLElement[] | null {
    const dialogs = [...document.querySelectorAll<HTMLElement>('[role="dialog"], [role="alertdialog"]')].filter(visible);
    if (dialogs.length) {
      const dialog = dialogs.at(-1)!;
      if (dialog.matches('.sheet-discard-confirm')) return null;
      const bounds = dialog.getBoundingClientRect();
      // Portalled dialogs keep their existing Back/Close and the same save guards.
      return y >= bounds.top && y <= bounds.bottom && (dialog.contains(target) || !!target.closest('[data-slot="dialog-overlay"], [data-slot="alert-dialog-overlay"]')) ? [dialog] : null;
    }
    if (target.closest('.topbar, .main-nav') || !target.closest('.shell')) return null;
    const header = document.querySelector('.topbar')?.getBoundingClientRect();
    const nav = document.querySelector('.main-nav')?.getBoundingClientRect();
    if (header && y < header.bottom || nav && y >= nav.top && y <= nav.bottom) return null;
    return [...document.querySelectorAll<HTMLElement>('.page-heading, .navigation-body, .page-wrap > footer')].filter(visible);
  }
  function start(event: TouchEvent) {
    if (settling) { if (!dismissConfirmation(event.target) && event.cancelable) event.preventDefault(); return; }
    if (drag) { reset(); return; }
    if (event.touches.length !== 1 || !event.cancelable || (window.visualViewport?.scale ?? 1) !== 1) return;
    const touch = event.touches[0], target = event.target;
    if (touch.clientX < 0 || touch.clientX > SWIPE_EDGE || !(target instanceof HTMLElement) || target.closest(interactive)) return;
    // Do not turn horizontally scrollable controls into navigation.
    for (let parent: HTMLElement | null = target; parent && !parent.matches('.shell'); parent = parent.parentElement) {
      if (parent.scrollWidth > parent.clientWidth + 2 && /auto|scroll/.test(getComputedStyle(parent).overflowX)) return;
    }
    const elements = surfaces(target, touch.clientY);
    // iOS decides native history-swipe at touchstart. Cancelling here prevents
    // full-page snapshots from moving the header/nav, including at tab roots.
    if (!elements?.length) {
      if (target.closest('.shell, [data-slot="dialog-overlay"], [data-slot="alert-dialog-overlay"]')) event.preventDefault();
      return;
    }
    event.preventDefault();
    if (!navigation.canBack()) return;
    drag = { id: touch.identifier, x: touch.clientX, y: touch.clientY, dx: 0, dy: 0, moving: false,
      surfaces: elements.map(element => ({ element, transform: element.style.transform, transition: element.style.transition, base: getComputedStyle(element).transform })) };
  }
  function move(event: TouchEvent) {
    if (!drag || settling) return;
    if (event.touches.length !== 1) { reset(); return; }
    const touch = [...event.touches].find(t => t.identifier === drag!.id);
    if (!touch) { reset(); return; }
    drag.dx = touch.clientX - drag.x; drag.dy = touch.clientY - drag.y;
    const direction = swipeDirection(drag.dx, drag.dy);
    if (direction === 'cancel') { reset(); return; }
    if (direction === 'pending') return;
    if (event.cancelable) event.preventDefault();
    drag.moving = true;
    document.documentElement.setAttribute('data-swiping', '');
    if (!cue.isConnected) document.body.appendChild(cue);
    cue.style.top = Math.min(innerHeight - 100, Math.max(100, drag.y)) + 'px';
    cue.style.opacity = String(Math.min(1, drag.dx / 72));
    const offset = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : Math.min(drag.dx, innerWidth * .65);
    for (const s of drag.surfaces) {
      s.element.style.transition = 'none';
      s.element.style.transform = 'translateX(' + offset + 'px) ' + (s.base === 'none' ? '' : s.base);
    }
  }
  async function end(event: TouchEvent) {
    if (!drag || settling) return;
    const touch = [...event.changedTouches].find(t => t.identifier === drag!.id);
    if (!touch) { reset(); return; }
    drag.dx = touch.clientX - drag.x; drag.dy = touch.clientY - drag.y;
    if (!drag.moving || !completesSwipe(drag.dx, drag.dy, innerWidth)) { animateHome(); return; }
    if (event.cancelable) event.preventDefault();
    settling = true;
    // Freeze interaction only while the existing asynchronous leave/save guard
    // decides. A late response cannot dismiss newly edited content or a new tab.
    const locked = [...new Set([...drag.surfaces.map(s => s.element), ...document.querySelectorAll<HTMLElement>('.topbar, .main-nav')])];
    const inert = locked.map(element => element.inert);
    locked.forEach(element => { element.inert = true; });
    releaseInert = () => locked.forEach((element, index) => { element.inert = inert[index]; });
    const allowed = await navigation.back();
    if (disposed) return;
    if (allowed) reset(); else animateHome();
  }
  const cancel = () => { if (!settling) reset(); };
  const click = (event: MouseEvent) => { if (!dismissConfirmation(event.target) && (settling || drag?.moving)) { event.preventDefault(); event.stopPropagation(); } };
  document.addEventListener('touchstart', start, { passive: false, capture: true });
  document.addEventListener('touchmove', move, { passive: false, capture: true });
  document.addEventListener('touchend', end, { passive: false, capture: true });
  document.addEventListener('touchcancel', cancel, true);
  document.addEventListener('click', click, true);
  window.addEventListener('resize', cancel);
  return () => {
    disposed = true; reset();
    document.removeEventListener('touchstart', start, true);
    document.removeEventListener('touchmove', move, true);
    document.removeEventListener('touchend', end, true);
    document.removeEventListener('touchcancel', cancel, true);
    document.removeEventListener('click', click, true);
    window.removeEventListener('resize', cancel);
  };
}
