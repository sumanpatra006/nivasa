import React from 'react';
import { clsx } from 'clsx';

export type BadgeVariant =
  | 'paid'
  | 'success'
  | 'overdue'
  | 'danger'
  | 'pending'
  | 'warning'
  | 'suggested'
  | 'in-progress'
  | 'assigned'
  | 'info'
  | 'neutral'
  | 'critical';

interface StatusBadgeProps {
  variant: BadgeVariant;
  label?: string;
  children?: React.ReactNode;
  className?: string;
  dot?: boolean;
}

export function StatusBadge({ variant, label, children, className, dot = true }: StatusBadgeProps) {
  const styles = {
    paid: 'bg-status-success-bg text-status-success border-emerald-200',
    success: 'bg-status-success-bg text-status-success border-emerald-200',
    overdue: 'bg-status-danger-bg text-status-danger border-rose-200 font-semibold',
    danger: 'bg-status-danger-bg text-status-danger border-rose-200',
    critical: 'bg-status-danger text-white border-status-danger font-bold animate-pulse',
    pending: 'bg-status-warning-bg text-status-warning border-amber-200 font-medium',
    warning: 'bg-status-warning-bg text-status-warning border-amber-200',
    suggested: 'bg-amber-50 text-amber-700 border-amber-200 font-medium',
    'in-progress': 'bg-status-info-bg text-status-info border-sky-200',
    assigned: 'bg-status-info-bg text-status-info border-sky-200',
    info: 'bg-status-info-bg text-status-info border-sky-200',
    neutral: 'bg-surface-alt text-text-secondary border-border',
  };

  const dotColors = {
    paid: 'bg-status-success',
    success: 'bg-status-success',
    overdue: 'bg-status-danger',
    danger: 'bg-status-danger',
    critical: 'bg-white',
    pending: 'bg-status-warning',
    warning: 'bg-status-warning',
    suggested: 'bg-amber-600',
    'in-progress': 'bg-status-info',
    assigned: 'bg-status-info',
    info: 'bg-status-info',
    neutral: 'bg-text-muted',
  };

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs border tracking-tight',
        styles[variant],
        className
      )}
    >
      {dot && <span className={clsx('h-1.5 w-1.5 rounded-full shrink-0', dotColors[variant])} />}
      <span>{label || children}</span>
    </span>
  );
}

