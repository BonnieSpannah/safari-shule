import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useClientEvents } from '../useClientEvents';

// Mock the API client
vi.mock('@/lib/api/client', () => ({
  api: {
    post: vi.fn(),
  },
}));

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
  },
}));

describe('useClientEvents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('emits client events', async () => {
    const { result } = renderHook(() => useClientEvents());
    const { api } = await import('@/lib/api/client');

    await act(async () => {
      await result.current.emit('view', {
        entityType: 'vehicle',
        entityId: '123',
      });
    });

    expect(api.post).toHaveBeenCalledWith(
      '/v1/audit/events',
      expect.objectContaining({
        action: 'view',
        entityType: 'vehicle',
        entityId: '123',
      }),
    );
  });

  it('handles copy action', async () => {
    const { result } = renderHook(() => useClientEvents());
    const { toast } = await import('sonner');

    // Mock clipboard
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn(() => Promise.resolve()),
      },
    });

    await act(async () => {
      await result.current.handleCopy('test data');
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('test data');
    expect(toast.success).toHaveBeenCalledWith('Copied to clipboard');
  });

  it('handles download action', async () => {
    const { result } = renderHook(() => useClientEvents());

    // Mock URL and DOM methods
    const mockUrl = 'blob:mock-url';
    global.URL.createObjectURL = vi.fn(() => mockUrl);
    global.URL.revokeObjectURL = vi.fn();

    const mockClick = vi.fn();
    Object.defineProperty(HTMLAnchorElement.prototype, 'click', {
      configurable: true,
      value: mockClick,
    });

    await act(async () => {
      await result.current.handleDownload(
        'test.txt',
        'test content',
        'text/plain',
      );
    });

    expect(global.URL.createObjectURL).toHaveBeenCalled();
    expect(mockClick).toHaveBeenCalled();
    expect(global.URL.revokeObjectURL).toHaveBeenCalledWith(mockUrl);
  });

  it('handles print action', async () => {
    const { result } = renderHook(() => useClientEvents());
    const windowPrintSpy = vi.spyOn(window, 'print').mockImplementation(() => {});

    await act(async () => {
      await result.current.handlePrint();
    });

    expect(windowPrintSpy).toHaveBeenCalled();
  });

  it('silently fails on API error', async () => {
    const { result } = renderHook(() => useClientEvents());
    const { api } = await import('@/lib/api/client');

    vi.mocked(api.post).mockRejectedValueOnce(new Error('Network error'));
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await act(async () => {
      await result.current.emit('view');
    });

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      '[audit] Failed to emit event:',
      expect.objectContaining({
        action: 'view',
      }),
    );
  });

  it('includes timestamp in emitted events', async () => {
    const { result } = renderHook(() => useClientEvents());
    const { api } = await import('@/lib/api/client');

    await act(async () => {
      await result.current.emit('copy');
    });

    const call = vi.mocked(api.post).mock.calls[0];
    expect(call[1]).toHaveProperty('timestamp');
    expect(typeof call[1].timestamp).toBe('string');
  });
});
