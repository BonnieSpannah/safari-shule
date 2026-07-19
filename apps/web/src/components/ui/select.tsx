import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Native `<select>` styled to match Input. Deliberately not a Radix popover —
 * for short lists the OS select is faster on mobile and accessible for free.
 * For searchable long lists we ship a separate <SearchableSelect>.
 */
export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, invalid, children, ...props }, ref) => (
    <select
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        'flex h-10 w-full appearance-none rounded-md border border-input bg-background px-3 py-2 pr-8 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50',
        // arrow via background-image so we don't need lucide icons here
        'bg-[url("data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns=\'http://www.w3.org/2000/svg\'%20viewBox=\'0%200%2020%2020\'%20fill=\'%236b7280\'%3E%3Cpath%20fill-rule=\'evenodd\'%20d=\'M5.23%207.21a.75.75%200%20011.06.02L10%2011.06l3.71-3.83a.75.75%200%20111.08%201.04l-4.25%204.39a.75.75%200%2001-1.08%200L5.21%208.27a.75.75%200%2001.02-1.06z\'%20clip-rule=\'evenodd\'%20/%3E%3C/svg%3E")]',
        'bg-[length:1.25rem_1.25rem] bg-[right_0.5rem_center] bg-no-repeat',
        invalid && 'border-danger focus-visible:ring-danger',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  ),
);
Select.displayName = 'Select';
