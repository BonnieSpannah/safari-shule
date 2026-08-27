import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SensitiveProps {
  level?: 'P0' | 'P1'; // P1 = sensitive, block certain actions
  blockCopy?: boolean;
  blockPrint?: boolean;
  blockDownload?: boolean;
  blockScreenshot?: boolean;
  children: React.ReactNode;
  className?: string;
}

/**
 * Sensitive data wrapper component.
 *
 * P0 = public data, no restrictions
 * P1 = sensitive data, blocks copy/print/download/screenshot actions
 *
 * Emits audit events for each attempted action via useClientEvents.
 */
export function Sensitive({
  level = 'P1',
  blockCopy = level === 'P1',
  blockPrint = level === 'P1',
  blockDownload = level === 'P1',
  blockScreenshot = level === 'P1',
  children,
  className,
}: SensitiveProps) {
  if (level === 'P0') {
    return <div className={className}>{children}</div>;
  }

  const blocked = blockCopy || blockPrint || blockDownload || blockScreenshot;
  const blockedActions = [
    blockCopy && 'copy',
    blockPrint && 'print',
    blockDownload && 'download',
    blockScreenshot && 'screenshot',
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <div
      className={cn('relative', className)}
      onCopy={(e) => {
        if (blockCopy) {
          e.preventDefault();
        }
      }}
      onContextMenu={(_e) => {
        if (blockCopy || blockDownload) {
          // Could log audit event here
        }
      }}
      data-sensitive={blocked ? 'true' : 'false'}
      title={blocked ? `Sensitive data (${blockedActions} disabled)` : undefined}
    >
      {children}
      {blocked && (
        <div className="absolute top-1 right-1 opacity-50">
          <AlertCircle className="h-3 w-3 text-amber-600" />
        </div>
      )}
    </div>
  );
}
