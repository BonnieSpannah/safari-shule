import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * The full status vocabulary used across the platform. Kept broader than any
 * one resource so we can reuse the same badge everywhere (users, tenants,
 * trips, invitations, DSRs, etc.). The colour scheme is intentional:
 *   emerald = healthy / approved / active
 *   amber   = attention / transitional (pending, suspended)
 *   sky     = informational neutral (invited, scheduled)
 *   zinc    = closed / inactive but not adversarial
 *   rose    = adversarial / terminal (blocked, deleted, rejected)
 */
const VARIANTS: Record<string, string> = {
  // healthy
  active: 'bg-emerald-500/15 text-emerald-700 ring-emerald-500/30 dark:text-emerald-300',
  approved: 'bg-emerald-500/15 text-emerald-700 ring-emerald-500/30 dark:text-emerald-300',
  completed: 'bg-emerald-500/15 text-emerald-700 ring-emerald-500/30 dark:text-emerald-300',
  // transitional / attention
  pending: 'bg-amber-500/15 text-amber-800 ring-amber-500/30 dark:text-amber-300',
  invited: 'bg-sky-500/15 text-sky-700 ring-sky-500/30 dark:text-sky-300',
  suspended: 'bg-amber-500/15 text-amber-800 ring-amber-500/30 dark:text-amber-300',
  expired: 'bg-amber-500/15 text-amber-800 ring-amber-500/30 dark:text-amber-300',
  // closed but recoverable
  inactive: 'bg-zinc-500/15 text-zinc-700 ring-zinc-400/30 dark:text-zinc-300',
  deactivated: 'bg-zinc-500/15 text-zinc-700 ring-zinc-400/30 dark:text-zinc-300',
  cancelled: 'bg-zinc-500/15 text-zinc-700 ring-zinc-400/30 dark:text-zinc-300',
  // adversarial / terminal
  blocked: 'bg-rose-500/15 text-rose-700 ring-rose-500/30 dark:text-rose-300',
  deleted: 'bg-rose-500/15 text-rose-700 ring-rose-500/30 dark:text-rose-300',
  rejected: 'bg-rose-500/15 text-rose-700 ring-rose-500/30 dark:text-rose-300',
  locked: 'bg-rose-500/15 text-rose-700 ring-rose-500/30 dark:text-rose-300',
};

const DEFAULT = 'bg-zinc-500/15 text-zinc-700 ring-zinc-400/30 dark:text-zinc-300';

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: string;
  /** Override the visible text. Defaults to a Title-Cased version of `status`. */
  label?: string;
}

export function StatusBadge({ status, label, className, ...rest }: StatusBadgeProps) {
  const key = status?.toLowerCase() ?? '';
  const styles = VARIANTS[key] ?? DEFAULT;
  const text = label ?? (status ? status.charAt(0).toUpperCase() + status.slice(1) : '—');
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset capitalize',
        styles,
        className,
      )}
      {...rest}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" aria-hidden />
      {text}
    </span>
  );
}
