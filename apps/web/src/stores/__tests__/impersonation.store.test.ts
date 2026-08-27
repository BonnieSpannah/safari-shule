import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useImpersonationStore } from '../impersonation.store';

describe('useImpersonationStore', () => {
  beforeEach(() => {
    // Clear the store before each test
    useImpersonationStore.setState({
      isImpersonating: false,
      impersonatedUserId: null,
      impersonatedUserEmail: null,
      approverEmail: null,
    });
  });

  it('initializes with no impersonation', () => {
    const { result } = renderHook(() => useImpersonationStore());
    expect(result.current.isImpersonating).toBe(false);
    expect(result.current.impersonatedUserId).toBeNull();
    expect(result.current.impersonatedUserEmail).toBeNull();
    expect(result.current.approverEmail).toBeNull();
  });

  it('starts impersonation', () => {
    const { result } = renderHook(() => useImpersonationStore());

    act(() => {
      result.current.startImpersonation('user123', 'user@example.com', 'admin@example.com');
    });

    expect(result.current.isImpersonating).toBe(true);
    expect(result.current.impersonatedUserId).toBe('user123');
    expect(result.current.impersonatedUserEmail).toBe('user@example.com');
    expect(result.current.approverEmail).toBe('admin@example.com');
  });

  it('ends impersonation', () => {
    const { result } = renderHook(() => useImpersonationStore());

    // Start impersonation
    act(() => {
      result.current.startImpersonation('user123', 'user@example.com', 'admin@example.com');
    });

    expect(result.current.isImpersonating).toBe(true);

    // End impersonation
    act(() => {
      result.current.endImpersonation();
    });

    expect(result.current.isImpersonating).toBe(false);
    expect(result.current.impersonatedUserId).toBeNull();
    expect(result.current.impersonatedUserEmail).toBeNull();
    expect(result.current.approverEmail).toBeNull();
  });

  it('persists impersonation state to localStorage', () => {
    const { result } = renderHook(() => useImpersonationStore());

    act(() => {
      result.current.startImpersonation('user456', 'driver@example.com', 'principal@example.com');
    });

    const stored = localStorage.getItem('safari.impersonation');
    expect(stored).toBeTruthy();

    const parsed = JSON.parse(stored!);
    expect(parsed.state.isImpersonating).toBe(true);
    expect(parsed.state.impersonatedUserEmail).toBe('driver@example.com');
  });
});
