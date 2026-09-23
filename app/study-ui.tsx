import type { ReactNode } from 'react';
import { Check, CircleAlert, CircleDashed } from 'lucide-react';

export function StatusBadge({ tone = 'neutral', children }: { tone?: 'success' | 'warning' | 'neutral'; children: ReactNode }) {
  const Icon = tone === 'success' ? Check : tone === 'warning' ? CircleAlert : CircleDashed;
  return <span className={`status-badge ${tone === 'success' ? 'status-good' : tone === 'warning' ? 'status-warn' : 'status-neutral'}`}>
    <Icon size={14} aria-hidden="true" />{children}
  </span>;
}

/** Supplementary guidance is optional; failures and unsaved data stay inline. */
export function HelpDetails({ title, children, className = '' }: { title: string; children: ReactNode; className?: string }) {
  return <details className={`help-details ${className}`}><summary>{title}</summary><div className="help-content">{children}</div></details>;
}
