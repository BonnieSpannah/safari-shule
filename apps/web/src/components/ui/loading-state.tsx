import { cn } from '@/lib/utils';

interface LoadingStateProps {
  title?: string;
  description?: string;
  className?: string;
}

export function LoadingState({ title = 'Loading…', description, className }: LoadingStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 py-16 text-center', className)}>
      <div className="flex items-center gap-2">
        <div className="h-2 w-2 rounded-full bg-muted-foreground/60 animate-pulse"></div>
        <div className="h-2 w-2 rounded-full bg-muted-foreground/60 animate-pulse delay-100"></div>
        <div className="h-2 w-2 rounded-full bg-muted-foreground/60 animate-pulse delay-200"></div>
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
    </div>
  );
}
