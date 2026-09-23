import type { ReactNode } from 'react';

/** Supplementary guidance is optional; failures and unsaved data stay inline. */
export function HelpDetails({ title, children, className = '' }: { title: string; children: ReactNode; className?: string }) {
  return <details className={`help-details ${className}`}><summary>{title}</summary><div className="help-content">{children}</div></details>;
}
