"use client";
import { useEffect, useState } from 'react';

// Mobile keyboard: release sticky actions rather than covering the answer.
export function useKeyboardInset() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const viewport = window.visualViewport;
    const root = document.documentElement;
    const update = () => {
      const editing = document.activeElement?.matches('input:not([type=checkbox]):not([type=radio]), textarea');
      const visible = Boolean(editing && viewport && window.innerWidth <= 640 && window.innerHeight - viewport.height > 120);
      if (visible && viewport) {
        root.style.setProperty('--visual-viewport-height', `${viewport.height}px`);
        root.style.setProperty('--visual-viewport-top', `${viewport.offsetTop}px`);
      } else {
        root.style.removeProperty('--visual-viewport-height');
        root.style.removeProperty('--visual-viewport-top');
      }
      setOpen(visible);
    };
    viewport?.addEventListener('resize', update);
    viewport?.addEventListener('scroll', update);
    document.addEventListener('focusin', update);
    document.addEventListener('focusout', update);
    window.addEventListener('resize', update);
    return () => {
      viewport?.removeEventListener('resize', update);
      viewport?.removeEventListener('scroll', update);
      document.removeEventListener('focusin', update);
      document.removeEventListener('focusout', update);
      window.removeEventListener('resize', update);
      root.style.removeProperty('--visual-viewport-height');
      root.style.removeProperty('--visual-viewport-top');
    };
  }, []);
  return open;
}
