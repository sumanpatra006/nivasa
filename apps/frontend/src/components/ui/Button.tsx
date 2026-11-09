import React from 'react';
import { clsx } from 'clsx';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost' | 'amber';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      className,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      disabled,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none rounded-control active:scale-[0.99]';

    const variants = {
      primary: 'bg-sage-500 hover:bg-sage-700 text-white focus:ring-sage-500 shadow-sm',
      secondary: 'bg-walnut-500 hover:bg-walnut-700 text-white focus:ring-walnut-500 shadow-sm',
      amber: 'bg-amber-500 hover:bg-amber-700 text-white focus:ring-amber-500 shadow-sm',
      outline:
        'border border-border-strong bg-surface text-text-primary hover:bg-surface-alt focus:ring-sage-500',
      danger: 'bg-status-danger hover:bg-red-700 text-white focus:ring-red-500 shadow-sm',
      ghost: 'bg-transparent text-text-secondary hover:text-text-primary hover:bg-surface-alt',
    };

    const sizes = {
      sm: 'h-9 px-3 text-xs gap-1.5 min-h-[36px]',
      md: 'h-11 px-4 text-sm gap-2 min-h-[44px]', // 44px touch target per DESIGN.md
      lg: 'h-13 px-6 text-base gap-2.5 min-h-[48px]',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={clsx(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-current" />
        ) : (
          leftIcon && <span className="inline-flex shrink-0">{leftIcon}</span>
        )}
        <span>{children}</span>
        {!isLoading && rightIcon && <span className="inline-flex shrink-0">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';

