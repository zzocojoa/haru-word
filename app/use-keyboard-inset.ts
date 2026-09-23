"use client";
import { useEffect, useState } from 'react';

// Mobile keyboard: release sticky actions rather than covering the answer.
export function useKeyboardInset() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const viewport = window.visualViewport;
    const update = () => {
      const editing = document.activeElement?.matches('input:not([type=checkbox]):not([type=radio]), textarea');
      setOpen(Boolean(editing && viewport && window.innerWidth <= 640 && window.innerHeight - viewport.height > 120));
    };
    viewport?.addEventListener('resize', update);
    document.addEventListener('focusin', update);
    document.addEventListener('focusout', update);
    window.addEventListener('resize', update);
    return () => {
      viewport?.removeEventListener('resize', update);
      document.removeEventListener('focusin', update);
      document.removeEventListener('focusout', update);
      window.removeEventListener('resize', update);
    };
  }, []);
  return open;
}
