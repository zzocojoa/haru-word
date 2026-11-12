import type { ReactNode } from 'react';
import { HaruIcon } from '@/components/icons/haru-icon';

export function StatusBadge({ tone = 'neutral', icon, children }: { tone?: 'success' | 'warning' | 'neutral'; icon?: ReactNode; children: ReactNode }) {
  const iconName = tone === 'success' ? 'check' : tone === 'warning' ? 'alert-circle' : 'unassessed';
  return <span className={`status-badge ${tone === 'success' ? 'status-good' : tone === 'warning' ? 'status-warn' : 'status-neutral'}`}>
    {icon ?? <HaruIcon name={iconName} size={14} />}{children}
  </span>;
}

/** Supplementary guidance is optional; failures and unsaved data stay inline. */
export function HelpDetails({ title, children, className = '' }: { title: string; children: ReactNode; className?: string }) {
  return <details className={`help-details ${className}`}><summary>{title}</summary><div className="help-content">{children}</div></details>;
}
