import { useCallback } from 'react';
import { api } from '@/lib/api/client';
import { toast } from 'sonner';

export type ClientEventAction = 'view' | 'print' | 'download' | 'copy' | 'screenshot';

interface ClientEventPayload {
  action: ClientEventAction;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Hook for emitting client-side audit events.
 * These are sent to the API for compliance and audit trail purposes.
 *
 * Usage:
 *   const { emit } = useClientEvents();
 *   emit('view', { entityType: 'vehicle', entityId: vehicle.id });
 */
export function useClientEvents() {
  const emit = useCallback(
    async (action: ClientEventAction, payload: Omit<ClientEventPayload, 'action'> = {}) => {
      try {
        await api.post('/v1/audit/events', {
          action,
          timestamp: new Date().toISOString(),
          ...payload,
        });
      } catch (error) {
        // Silently fail — don't disrupt the user experience for audit logging
        console.warn('[audit] Failed to emit event:', { action, error });
      }
    },
    [],
  );

  const handleCopy = useCallback(
    (data: string, metadata?: Record<string, unknown>) => {
      navigator.clipboard.writeText(data);
      emit('copy', { metadata });
      toast.success('Copied to clipboard');
    },
    [emit],
  );

  const handleDownload = useCallback(
    (filename: string, content: string, mimeType = 'text/plain', metadata?: Record<string, unknown>) => {
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      URL.revokeObjectURL(url);
      document.body.removeChild(link);
      emit('download', { metadata: { filename, ...metadata } });
    },
    [emit],
  );

  const handlePrint = useCallback(
    (metadata?: Record<string, unknown>) => {
      window.print();
      emit('print', { metadata });
    },
    [emit],
  );

  return { emit, handleCopy, handleDownload, handlePrint };
}
