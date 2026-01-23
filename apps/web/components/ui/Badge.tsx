import { HTMLAttributes, forwardRef } from 'react';

import { cn } from '@/lib/utils';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?:
    | 'high'
    | 'medium'
    | 'low'
    | 'success'
    | 'error'
    | 'warning'
    | 'secondary';
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'secondary', children, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border transition-calm',
          {
            'priority-high': variant === 'high',
            'priority-medium': variant === 'medium',
            'priority-low': variant === 'low',
            'status-success': variant === 'success',
            'status-error': variant === 'error',
            'status-pending': variant === 'warning',
            'bg-secondary text-secondary-foreground border-border':
              variant === 'secondary',
          },
          className
        )}
        {...props}
      >
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';
