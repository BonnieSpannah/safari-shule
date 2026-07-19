import * as React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input, type InputProps } from './input';
import { cn } from '@/lib/utils';

export interface PasswordInputProps extends Omit<InputProps, 'type'> {
  /** When true, shows the visibility toggle button. Default true. */
  showToggle?: boolean;
}

/**
 * Password input with a show/hide eye toggle. Used everywhere a password is
 * entered — login, activation, reset, change, invites. Keeps focus inside
 * the field when toggling so keyboard-only users don't lose their place.
 */
export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, showToggle = true, disabled, ...props }, ref) => {
    const [visible, setVisible] = React.useState(false);
    const innerRef = React.useRef<HTMLInputElement | null>(null);

    React.useImperativeHandle(ref, () => innerRef.current as HTMLInputElement);

    const toggle = () => {
      const el = innerRef.current;
      const start = el?.selectionStart;
      const end = el?.selectionEnd;
      setVisible((v) => !v);
      requestAnimationFrame(() => {
        el?.focus();
        if (typeof start === 'number' && typeof end === 'number') {
          el?.setSelectionRange(start, end);
        }
      });
    };

    return (
      <div className="relative">
        <Input
          ref={innerRef}
          type={visible ? 'text' : 'password'}
          className={cn(showToggle && 'pr-10', className)}
          disabled={disabled}
          autoComplete={props.autoComplete ?? 'current-password'}
          {...props}
        />
        {showToggle && (
          <button
            type="button"
            tabIndex={-1}
            onClick={toggle}
            disabled={disabled}
            aria-label={visible ? 'Hide password' : 'Show password'}
            className="absolute right-1 top-1/2 -translate-y-1/2 inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>
    );
  },
);
PasswordInput.displayName = 'PasswordInput';
