"use client";

import { useEffect } from 'react';

// Optional typography must never block the server-rendered loading screen.
// Keep the fallback when a font arrives late: swapping subsets can move a
// button between pointerdown and pointerup and lose the user's click.
const stylesheetUrl = 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Noto+Sans+KR:wght@400;500;600;700;800&display=optional';

export function WebFonts() {
  useEffect(() => {
    const stylesheet = document.createElement('link');
    stylesheet.rel = 'stylesheet';
    stylesheet.href = stylesheetUrl;
    stylesheet.dataset.webFonts = '';
    // A late stylesheet can introduce even cached fonts during a click. Keep
    // the current fallback for this page if interaction precedes its arrival.
    const stopListening = () => {
      document.removeEventListener('pointerdown', keepFallback, true);
      document.removeEventListener('keydown', keepFallback, true);
    };
    const keepFallback = () => { stylesheet.remove(); stopListening(); };
    stylesheet.addEventListener('load', stopListening, { once: true });
    stylesheet.addEventListener('error', keepFallback, { once: true });
    document.addEventListener('pointerdown', keepFallback, true);
    document.addEventListener('keydown', keepFallback, true);
    document.head.appendChild(stylesheet);
    // A failed request simply leaves the system fallback in use.
    return () => { stopListening(); stylesheet.remove(); };
  }, []);

  return null;
}
