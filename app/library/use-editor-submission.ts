"use client";
import { useRef, useState } from 'react';

// The lock belongs to this editor mount, never to the next opened word.
export function useEditorSubmission() {
  const lock = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  // Only this mount's own failed save can enable its in-editor retry.
  const [failed, setFailed] = useState(false);
  async function submit(save: () => Promise<boolean>) {
    if (lock.current) return false;
    lock.current = true;
    setSubmitting(true);
    try {
      const saved = await save();
      setFailed(!saved);
      return saved;
    }
    finally { lock.current = false; setSubmitting(false); }
  }
  return { submitting, failed, submit };
}
