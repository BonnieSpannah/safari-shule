import * as React from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
}

export interface SearchableSelectProps {
  value?: string;
  onChange?: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  invalid?: boolean;
  disabled?: boolean;
  className?: string;
  /** Hide search box when option count is below this threshold. Default 6. */
  searchThreshold?: number;
}

export const SearchableSelect = React.forwardRef<HTMLButtonElement, SearchableSelectProps>(
  (
    {
      value,
      onChange,
      options,
      placeholder = 'Select…',
      searchPlaceholder = 'Search…',
      invalid,
      disabled,
      className,
      searchThreshold = 6,
    },
    ref,
  ) => {
    const [open, setOpen] = React.useState(false);
    const [query, setQuery] = React.useState('');
    const containerRef = React.useRef<HTMLDivElement>(null);
    const searchRef = React.useRef<HTMLInputElement>(null);
    const listRef = React.useRef<HTMLUListElement>(null);
    const [highlighted, setHighlighted] = React.useState(0);

    const selected = options.find((o) => o.value === value);

    const filtered = React.useMemo(
      () =>
        query.trim()
          ? options.filter(
              (o) =>
                o.label.toLowerCase().includes(query.toLowerCase()) ||
                o.description?.toLowerCase().includes(query.toLowerCase()),
            )
          : options,
      [options, query],
    );

    const showSearch = options.length >= searchThreshold;

    // Close on outside click
    React.useEffect(() => {
      if (!open) return;
      const handler = (e: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
          setOpen(false);
        }
      };
      document.addEventListener('mousedown', handler);
      return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    // Focus search when dropdown opens
    React.useEffect(() => {
      if (open) {
        setQuery('');
        setHighlighted(0);
        setTimeout(() => searchRef.current?.focus(), 0);
      }
    }, [open]);

    const select = (option: SelectOption) => {
      onChange?.(option.value);
      setOpen(false);
    };

    const onKeyDown = (e: React.KeyboardEvent) => {
      if (!open) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
          e.preventDefault();
          setOpen(true);
        }
        return;
      }
      if (e.key === 'Escape') { setOpen(false); return; }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlighted((h) => Math.min(h + 1, filtered.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlighted((h) => Math.max(h - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filtered[highlighted]) select(filtered[highlighted]);
      }
    };

    return (
      <div ref={containerRef} className="relative">
        {/* Trigger */}
        <button
          ref={ref}
          type="button"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          onKeyDown={onKeyDown}
          className={cn(
            'flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
            invalid && 'border-danger focus-visible:ring-danger',
            className,
          )}
        >
          <span className={cn('truncate', !selected && 'text-muted-foreground')}>
            {selected ? selected.label : placeholder}
          </span>
          <ChevronDown
            className={cn('ml-2 h-4 w-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')}
          />
        </button>

        {/* Dropdown */}
        {open && (
          <div
            className="absolute z-50 mt-1 w-full rounded-md border border-border bg-card shadow-lg"
            role="dialog"
          >
            {showSearch && (
              <div className="flex items-center gap-2 border-b border-border px-3 py-2">
                <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <input
                  ref={searchRef}
                  type="text"
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setHighlighted(0); }}
                  onKeyDown={onKeyDown}
                  placeholder={searchPlaceholder}
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
              </div>
            )}

            <ul ref={listRef} role="listbox" className="max-h-60 overflow-y-auto p-1">
              {filtered.length === 0 ? (
                <li className="px-3 py-2 text-sm text-muted-foreground">No options found.</li>
              ) : (
                filtered.map((option, idx) => (
                  <li
                    key={option.value}
                    role="option"
                    aria-selected={option.value === value}
                    onClick={() => select(option)}
                    onMouseEnter={() => setHighlighted(idx)}
                    className={cn(
                      'flex cursor-pointer select-none items-center justify-between rounded-sm px-3 py-2 text-sm transition-colors',
                      idx === highlighted && 'bg-accent/10',
                      option.value === value && 'font-medium',
                    )}
                  >
                    <div>
                      <div>{option.label}</div>
                      {option.description && (
                        <div className="text-xs text-muted-foreground">{option.description}</div>
                      )}
                    </div>
                    {option.value === value && <Check className="h-4 w-4 text-primary" />}
                  </li>
                ))
              )}
            </ul>
          </div>
        )}
      </div>
    );
  },
);
SearchableSelect.displayName = 'SearchableSelect';
