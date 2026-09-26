"use client";

import { useEffect } from 'react';

// Optional typography must never block the server-rendered loading screen.
// Keep the existing families, weights and swap behavior once they are available.
const stylesheetUrl = 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Noto+Sans+KR:wght@400;500;600;700;800&display=swap';

export function WebFonts() {
  useEffect(() => {
    const stylesheet = document.createElement('link');
    stylesheet.rel = 'stylesheet';
    stylesheet.href = stylesheetUrl;
    stylesheet.dataset.webFonts = '';
    document.head.appendChild(stylesheet);
    // A failed request simply leaves the system fallback in use.
    return () => { stylesheet.remove(); };
  }, []);

  return null;
}
