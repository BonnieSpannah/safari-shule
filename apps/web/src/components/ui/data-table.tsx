import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Column definition ────────────────────────────────────────────────────────

export interface Column<T> {
  key: string;
  header: string;
  /** Width class e.g. "w-40" or "w-[120px]". Omit for auto. */
  width?: string;
  render: (row: T) => React.ReactNode;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  /** Number of skeleton rows shown while loading. Default 6. */
  skeletonRows?: number;
  empty?: React.ReactNode;
  /** Extra classes on the wrapping div */
  className?: string;
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function SkeletonRow({ cols }: { cols: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="py-3 pr-4">
          <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
        </td>
      ))}
    </tr>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading = false,
  skeletonRows = 6,
  empty,
  className,
}: DataTableProps<T>) {
  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {columns.map((col) => (
              <th key={col.key} className={cn('py-2 pr-4 font-medium', col.width)}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            Array.from({ length: skeletonRows }).map((_, i) => (
              <SkeletonRow key={i} cols={columns.length} />
            ))
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length}>
                {empty ?? (
                  <div className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground">
                    No records found.
                  </div>
                )}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={rowKey(row)}
                className="border-b border-border/50 last:border-0 hover:bg-muted/20"
              >
                {columns.map((col) => (
                  <td key={col.key} className="py-2.5 pr-4">
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>

      {loading && (
        <div className="flex items-center justify-center py-4 text-xs text-muted-foreground gap-1.5">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
        </div>
      )}
    </div>
  );
}
