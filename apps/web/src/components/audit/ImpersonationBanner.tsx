import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ImpersonationBannerProps {
  impersonatedUserEmail: string;
  approverEmail: string;
  onEnd: () => void;
  className?: string;
}

export function ImpersonationBanner({
  impersonatedUserEmail,
  approverEmail,
  onEnd,
  className,
}: ImpersonationBannerProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between bg-amber-50 px-4 py-3 border-b border-amber-200',
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse"></div>
        <div className="flex flex-col gap-0.5">
          <p className="text-xs font-medium text-amber-900">
            👁️ Impersonating <strong>{impersonatedUserEmail}</strong>
          </p>
          <p className="text-xs text-amber-700">Approved by {approverEmail}</p>
        </div>
      </div>
      <Button
        onClick={onEnd}
        size="sm"
        variant="ghost"
        className="h-auto px-2 py-1 text-xs text-amber-700 hover:bg-amber-100"
      >
        End <X className="ml-1 h-3 w-3" />
      </Button>
    </div>
  );
}
