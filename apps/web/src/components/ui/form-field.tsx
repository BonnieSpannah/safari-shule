import { Label } from './label';
import { cn } from '@/lib/utils';

interface FormFieldProps {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}

export function FormField({ label, required, error, hint, children, className }: FormFieldProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label className="text-sm font-medium text-foreground">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      {children}
      {error
        ? <p className="text-xs text-destructive">{error}</p>
        : hint
        ? <p className="text-xs text-muted-foreground">{hint}</p>
        : null}
    </div>
  );
}
