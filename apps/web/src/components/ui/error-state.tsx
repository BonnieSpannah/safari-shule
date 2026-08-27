import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';

interface ErrorStateProps {
  title?: string;
  description?: string;
  error?: Error | unknown;
  onRetry?: () => void;
  action?: React.ReactNode;
  className?: string;
}

export function ErrorState({
  title = 'Something went wrong',
  description,
  error,
  onRetry,
  action,
  className,
}: ErrorStateProps) {
  const errorMessage = error instanceof Error ? error.message : undefined;
  const finalDescription =
    description ||
    errorMessage ||
    'An unexpected error occurred while loading this data. Please try again.';

  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 py-16 text-center', className)}>
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
        <AlertCircle className="h-6 w-6 text-destructive" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {finalDescription && <p className="text-xs text-muted-foreground">{finalDescription}</p>}
      </div>
      {(onRetry || action) && (
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          {onRetry && (
            <Button onClick={onRetry} size="sm" variant="outline">
              Try again
            </Button>
          )}
          {action && <div>{action}</div>}
        </div>
      )}
    </div>
  );
}
