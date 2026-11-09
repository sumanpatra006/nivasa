import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, description, children, footer }: ModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#232820]/50 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Dialog Surface */}
      <div className="relative w-full max-w-lg rounded-modal bg-surface p-6 shadow-xl border border-border z-10 animate-in fade-in-0 zoom-in-95 duration-150">
        <div className="flex items-start justify-between pb-3 border-b border-border">
          <div>
            <h3 className="text-lg font-bold text-walnut-900">{title}</h3>
            {description && <p className="mt-0.5 text-xs text-text-secondary">{description}</p>}
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-control text-text-muted hover:text-text-primary hover:bg-surface-alt transition-colors"
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="py-4 text-sm text-text-primary">{children}</div>

        {footer && <div className="mt-4 pt-3 border-t border-border flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

