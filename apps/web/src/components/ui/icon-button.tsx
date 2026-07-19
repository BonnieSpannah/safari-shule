import type { ComponentType, SVGProps } from 'react';
import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
  /** Optional unread badge count. Falsy → no badge. 99+ shown as "99+". */
  badgeCount?: number;
  /** Force badge as a plain dot regardless of count (used for "new" without a number). */
  dot?: boolean;
}

/**
 * Header-cluster icon button with an unread badge affordance.
 * Used for Messages, Notifications, Theme, Search-actions, etc.
 */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon: Icon, label, badgeCount, dot, className, ...props }, ref) => {
    const showBadge = dot || (typeof badgeCount === 'number' && badgeCount > 0);
    const badgeText =
      typeof badgeCount === 'number' && badgeCount > 0
        ? badgeCount > 99
          ? '99+'
          : String(badgeCount)
        : null;
    return (
      <button
        ref={ref}
        type="button"
        aria-label={label}
        title={label}
        className={cn(
          'relative inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground',
          'transition-colors hover:bg-accent/10 hover:text-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          className,
        )}
        {...props}
      >
        <Icon className="h-4 w-4" />
        {showBadge && (
          <span
            className={cn(
              'absolute right-1.5 top-1.5 inline-flex items-center justify-center rounded-full bg-danger text-[10px] font-semibold leading-none text-danger-foreground shadow-sm',
              badgeText ? 'min-w-4 h-4 px-1' : 'h-2 w-2',
            )}
            aria-live="polite"
            aria-atomic="true"
          >
            {badgeText}
          </span>
        )}
      </button>
    );
  },
);
IconButton.displayName = 'IconButton';
