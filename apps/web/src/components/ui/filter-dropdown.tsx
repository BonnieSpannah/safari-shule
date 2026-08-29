import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface FilterOption {
  value: string;
  label: string;
}

interface FilterDropdownProps {
  label: string;
  options: FilterOption[];
  selected: string[];
  onChange: (values: string[]) => void;
  className?: string;
}

/** Pill-style multi-select filter — matches the TenantsPage filter pattern. */
export function FilterDropdown({ label, options, selected, onChange, className }: FilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const toggle = (v: string) =>
    onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);

  const active = selected.length > 0;

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex h-8 items-center gap-1.5 rounded-md border px-3 text-xs font-medium transition-colors',
          active
            ? 'border-primary bg-primary/10 text-primary'
            : 'border-border bg-background text-muted-foreground hover:bg-muted',
        )}
      >
        {label}
        {active && (
          <span className="rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">
            {selected.length}
          </span>
        )}
        <ChevronDown className="h-3 w-3 opacity-60" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 min-w-[10rem] rounded-lg border border-border bg-card shadow-lg">
          <div className="p-1">
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggle(opt.value)}
                className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-xs hover:bg-muted"
              >
                <span
                  className={cn(
                    'flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded border',
                    selected.includes(opt.value)
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-muted-foreground/40',
                  )}
                >
                  {selected.includes(opt.value) && <Check className="h-2.5 w-2.5" />}
                </span>
                {opt.label}
              </button>
            ))}
            {active && (
              <button
                type="button"
                onClick={() => onChange([])}
                className="mt-1 w-full rounded border-t border-border px-2.5 pt-2 pb-1 text-xs text-muted-foreground hover:text-foreground"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
