import * as React from 'react';
import { Check, ChevronRight, Loader2, X } from 'lucide-react';
import { Button, type ButtonProps } from './button';
import { cn } from '@/lib/utils';

/**
 * Universal footer for every write form (create/update/settings). Convention:
 *   • Left  — Cancel  (ghost, red X icon, non-destructive: just discards edits)
 *   • Right — Submit  (primary emerald, chevron/check icon, disabled while pending)
 *
 * Use `sticky` to pin to the bottom of scrollable containers.
 */
export interface FormActionsProps extends React.HTMLAttributes<HTMLDivElement> {
  onCancel?: () => void;
  cancelLabel?: string;
  submitLabel?: string;
  submitIcon?: 'chevron' | 'check' | 'none';
  submitting?: boolean;
  /** When true, the submit button is disabled regardless of `submitting`. */
  disabled?: boolean;
  /** Fully custom form ID for the submit button's `form=` attribute. */
  formId?: string;
  /** Extra props forwarded to the submit `<Button>`. */
  submitButtonProps?: Omit<ButtonProps, 'children' | 'type'>;
  /** Sticky-pin the bar to its container's bottom edge. */
  sticky?: boolean;
}

export function FormActions({
  onCancel,
  cancelLabel = 'Cancel',
  submitLabel = 'Save changes',
  submitIcon = 'chevron',
  submitting = false,
  disabled = false,
  formId,
  submitButtonProps,
  sticky = false,
  className,
  ...rest
}: FormActionsProps) {
  const SubmitIcon =
    submitIcon === 'chevron' ? ChevronRight : submitIcon === 'check' ? Check : null;

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-2 border-t border-border bg-surface-1/95 px-4 py-3 backdrop-blur',
        sticky && 'sticky bottom-0 z-10 -mx-6 mt-6 px-6',
        className,
      )}
      {...rest}
    >
      {onCancel ? (
        <Button
          type="button"
          variant="destructive"
          onClick={onCancel}
          disabled={submitting}
          className="gap-1.5"
        >
          <X className="h-4 w-4" />
          {cancelLabel}
        </Button>
      ) : (
        <span />
      )}
      <Button
        type="submit"
        form={formId}
        disabled={disabled || submitting}
        className="gap-1.5 bg-green-600 hover:bg-green-700 focus-visible:ring-green-600"
        {...submitButtonProps}
      >
        {submitting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : null}
        {submitLabel}
        {!submitting && SubmitIcon && <SubmitIcon className="h-4 w-4" />}
      </Button>
    </div>
  );
}
