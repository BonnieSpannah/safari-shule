import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';

export interface ActionItem {
  label: string;
  icon?: React.ReactNode;
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
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const perms = new Set(useAuthStore((s) => s.user?.permissions ?? []));

  const visible = items.filter((item) =>
    item.permission ? perms.has(item.permission) : true,
  );

  // Position the portal menu below the trigger button
  const openMenu = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const menuWidth = 176; // min-w-[176px]
    const spaceRight = window.innerWidth - rect.right;
    const left = spaceRight >= menuWidth ? rect.right - menuWidth : rect.left;
    setPos({ top: rect.bottom + 4, left });
    setOpen(true);
  };

  // Close on outside click or scroll
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('scroll', close, true);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('scroll', close, true);
    };
  }, [open]);

  if (visible.length === 0) return null;

  return (
    <>
      <button
        ref={triggerRef}
        onClick={openMenu}
        className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-none"
        aria-label="Row actions"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {open && createPortal(
        <div
          ref={menuRef}
          onMouseDown={(e) => e.stopPropagation()}
          style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999 }}
          className="min-w-[176px] overflow-hidden rounded-md border border-border bg-card shadow-xl"
        >
          {visible.map((item, i) => (
            <button
              key={i}
              disabled={item.disabled}
              onClick={() => {
                setOpen(false);
                item.onClick();
              }}
              className={cn(
                'flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors',
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
        </div>,
        document.body,
      )}
    </>
  );
}

