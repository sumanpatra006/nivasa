import React from 'react';
import { Button } from './Button.js';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center rounded-surface border border-dashed border-border-strong bg-surface-alt/40 my-6">
      {icon && <div className="p-3 bg-surface rounded-full shadow-xs mb-3 text-text-muted">{icon}</div>}
      <h3 className="text-base font-semibold text-text-primary">{title}</h3>
      <p className="mt-1 text-sm text-text-secondary max-w-sm">{description}</p>
      {actionLabel && onAction && (
        <Button size="sm" variant="outline" className="mt-4" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

