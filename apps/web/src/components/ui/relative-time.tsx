import * as React from 'react';
import { formatDistanceToNow, format, isValid } from 'date-fns';

export interface RelativeTimeProps extends React.HTMLAttributes<HTMLTimeElement> {
  /** ISO string, Date, or null/undefined. */
  date: string | Date | null | undefined;
  /** Fallback text when the date is absent or invalid. Default '—'. */
  fallback?: string;
  /** Adds a suffix like " ago" / " from now". Default true. */
  addSuffix?: boolean;
  /** Refresh interval in ms. Default 60_000 (once a minute). */
  refreshEveryMs?: number;
}

/**
 * Renders "3 minutes ago" style relative times, with the absolute timestamp
 * exposed via the `title` attribute for hover discovery. Re-renders on an
 * interval so long-lived views stay fresh.
 */
export function RelativeTime({
  date,
  fallback = '—',
  addSuffix = true,
  refreshEveryMs = 60_000,
  ...rest
}: RelativeTimeProps) {
  const parsed = React.useMemo(() => {
    if (!date) return null;
    const d = typeof date === 'string' ? new Date(date) : date;
    return isValid(d) ? d : null;
  }, [date]);

  const [, tick] = React.useReducer((x: number) => x + 1, 0);
  React.useEffect(() => {
    if (!parsed) return;
    const id = window.setInterval(tick, refreshEveryMs);
    return () => window.clearInterval(id);
  }, [parsed, refreshEveryMs]);

  if (!parsed) return <span {...(rest as React.HTMLAttributes<HTMLSpanElement>)}>{fallback}</span>;

  const relative = formatDistanceToNow(parsed, { addSuffix });
  const absolute = format(parsed, 'PPpp'); // e.g. "Sep 30, 2025 at 3:04 PM"

  return (
    <time dateTime={parsed.toISOString()} title={absolute} {...rest}>
      {relative}
    </time>
  );
}
