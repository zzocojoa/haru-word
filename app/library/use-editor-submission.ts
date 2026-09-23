"use client";
import { useRef, useState } from 'react';

// The lock belongs to this editor mount, never to the next opened word.
export function useEditorSubmission() {
  const lock = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  async function submit(save: () => Promise<boolean>) {
    if (lock.current) return false;
    lock.current = true;
    setSubmitting(true);
    try { return await save(); }
    finally { lock.current = false; setSubmitting(false); }
  }
  return { submitting, submit };
}
