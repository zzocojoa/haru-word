"use client";
import { useCallback, useState } from 'react';

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
