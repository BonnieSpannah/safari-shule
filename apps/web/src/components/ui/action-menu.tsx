import { useState, useRef } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { useClickOutside } from '@/hooks/useDebounce';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';

export interface ActionItem {
  label: string;
  icon?: React.ReactNode;
  /** If specified, item is hidden when user lacks this permission */
  permission?: string;
  onClick: () => void;
  variant?: 'default' | 'destructive';
  disabled?: boolean;
}

interface ActionMenuProps {
  items: ActionItem[];
}

export function ActionMenu({ items }: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const perms = new Set(useAuthStore((s) => s.user?.permissions ?? []));
  const ref = useClickOutside<HTMLDivElement>(() => setOpen(false));

  const visible = items.filter((item) =>
    item.permission ? perms.has(item.permission) : true,
  );

  if (visible.length === 0) return null;

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen((v) => !v)}
        className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-none"
        aria-label="Row actions"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {open && (
        <div className="absolute right-0 top-8 z-50 min-w-[160px] rounded-md border border-border bg-surface shadow-lg">
          {visible.map((item, i) => (
            <button
              key={i}
              disabled={item.disabled}
              onClick={() => {
                setOpen(false);
                item.onClick();
              }}
              className={cn(
                'flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors first:rounded-t-md last:rounded-b-md',
                'hover:bg-muted focus:outline-none disabled:pointer-events-none disabled:opacity-50',
                item.variant === 'destructive'
                  ? 'text-danger hover:bg-danger/10'
                  : 'text-foreground',
              )}
            >
              {item.icon && <span className="h-4 w-4 shrink-0">{item.icon}</span>}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
