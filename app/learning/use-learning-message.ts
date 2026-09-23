"use client";
import { useCallback, useEffect, useState, type HTMLAttributes } from 'react';

const READING_TIME_MS = 10_000;

type ReadingInteractions = Pick<HTMLAttributes<HTMLDivElement>,
  'onPointerEnter' | 'onPointerLeave' | 'onFocus' | 'onBlur' | 'onKeyDown'>;

export function useLearningMessage() {
  const [notice, setNotice] = useState({ id: 0, text: '' });
  const setMessage = useCallback((text: string) => {
    // Repeating the same action must get a fresh reading interval.
    setNotice(previous => ({ id: previous.id + 1, text }));
  }, []);
  const dismissMessage = useCallback(() => {
    // A previous notice's timeout must not dismiss a newer message.
    setNotice(current => current.id === notice.id ? { ...current, text: '' } : current);
  }, [notice.id]);
  return { message: notice.text, messageId: notice.id, setMessage, dismissMessage };
}

/** Scoped to one displayed message; each new message mounts a fresh lifetime. */
export function useLearningMessageLifetime(onDismiss: () => void): ReadingInteractions {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(() => typeof document !== 'undefined' && document.hidden);
  const paused = hovered || focused || hidden;

  useEffect(() => {
    const visibilityChanged = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', visibilityChanged);
    return () => document.removeEventListener('visibilitychange', visibilityChanged);
  }, []);

  useEffect(() => {
    if (paused) return;
    // Resume with a full reading interval, only after every pause reason clears.
    const timer = window.setTimeout(onDismiss, READING_TIME_MS);
    return () => window.clearTimeout(timer);
  }, [onDismiss, paused]);

  return {
    onPointerEnter: event => {
      if (event.pointerType === 'mouse') setHovered(true);
    },
    onPointerLeave: () => setHovered(false),
    onFocus: () => setFocused(true),
    onBlur: event => {
      if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
    },
    onKeyDown: event => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      onDismiss();
    },
  };
}
