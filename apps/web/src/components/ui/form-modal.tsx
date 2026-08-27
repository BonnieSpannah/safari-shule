import { X, ChevronRight, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './dialog';
import { Button } from './button';
import { cn } from '@/lib/utils';

export interface FormModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  /** sm=max-w-md  md=max-w-lg  lg=max-w-2xl  xl=max-w-4xl */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  onSubmit: (e: React.FormEvent) => void;
  submitLabel?: string;
  submitting?: boolean;
  cancelLabel?: string;
  children: React.ReactNode;
}

const SIZE: Record<string, string> = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export function FormModal({
  open,
  onClose,
  title,
  subtitle,
  size = 'lg',
  onSubmit,
  submitLabel = 'Save',
  submitting = false,
  children,
}: FormModalProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !submitting) onClose(); }}>
      <DialogContent hideCloseButton className={cn(SIZE[size], 'p-0 gap-0 overflow-hidden')}>
        {/* Header */}
        <div className="border-b border-border bg-muted/30 px-6 py-4">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">{title}</DialogTitle>
            {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
          </DialogHeader>
        </div>

        {/* Body */}
        <form onSubmit={onSubmit} noValidate>
          <div className="max-h-[calc(85vh-140px)] overflow-y-auto px-6 py-5">
            {children}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-border bg-muted/20 px-6 py-4">
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="gap-1.5"
              onClick={onClose}
              disabled={submitting}
            >
              <X className="h-3.5 w-3.5" />
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={submitting}
              className="gap-1.5 bg-green-600 hover:bg-green-700 focus-visible:ring-green-600"
            >
              {submitLabel}
              {submitting
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <ChevronRight className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
