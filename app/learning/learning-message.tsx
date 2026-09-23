"use client";
import { X } from 'lucide-react';
import { useEffect, useState } from 'react';

const READING_TIME_MS = 10_000;

/** Transient learning feedback only; save errors and recovery controls stay persistent. */
export function LearningMessage({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(() => typeof document !== 'undefined' && document.hidden);
  useEffect(() => {
    const visibilityChanged = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', visibilityChanged);
    return () => document.removeEventListener('visibilitychange', visibilityChanged);
  }, []);
  useEffect(() => {
    if (hovered || focused || hidden) return;
    const timer = window.setTimeout(onDismiss, READING_TIME_MS);
    return () => window.clearTimeout(timer);
  }, [message, onDismiss, hovered, focused, hidden]);
  return <div className="notice learning-message"
    onPointerEnter={event => { if (event.pointerType === 'mouse') setHovered(true); }}
    onPointerLeave={() => setHovered(false)}
    onFocus={() => setFocused(true)}
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}
    onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); onDismiss(); } }}>
    <p role="status" aria-atomic="true">{message}</p>
    <button type="button" className="learning-message-close" aria-label="안내 닫기" onClick={onDismiss}>
      <X size={20} aria-hidden="true" />
    </button>
  </div>;
}
