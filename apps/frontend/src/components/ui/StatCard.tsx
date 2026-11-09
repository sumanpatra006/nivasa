import React from 'react';
import { clsx } from 'clsx';

interface StatCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  unit?: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  variant?: 'default' | 'accent' | 'warning' | 'danger';
  className?: string;
}

export function StatCard({
  label,
  value,
  subValue,
  unit,
  icon,
  badge,
  variant = 'default',
  className,
}: StatCardProps) {
  const borderVariants = {
    default: 'border-border bg-surface',
    accent: 'border-sage-300 bg-sage-50/40',
    warning: 'border-amber-300 bg-amber-50/40',
    danger: 'border-rose-300 bg-status-danger-bg/40',
  };

  return (
    <div
      className={clsx(
        'rounded-surface border p-5 shadow-sm transition-shadow hover:shadow',
        borderVariants[variant],
        className
      )}
    >
      <div className="flex items-center justify-between text-text-secondary">
        <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">{label}</span>
        {icon && <span className="text-text-muted">{icon}</span>}
      </div>

      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="text-2xl sm:text-3xl font-bold tracking-tight text-text-primary tabular-nums">
          {value}
        </span>
        {unit && <span className="text-xs text-text-muted font-normal">{unit}</span>}
      </div>

      {(subValue || badge) && (
        <div className="mt-2 flex items-center justify-between text-xs text-text-secondary pt-2 border-t border-border/60">
          <span>{subValue}</span>
          {badge}
        </div>
      )}
    </div>
  );
}

