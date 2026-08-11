import { renderHook } from '@testing-library/react';
import { describe, expect, it, beforeEach } from 'vitest';
import { usePermission, useAnyPermission } from '@/hooks/usePermission';
import { useAuthStore } from '@/stores/auth.store';

// Helper to set the auth store state directly without going through login
function setPerms(permissions: string[]) {
  useAuthStore.setState({
    user: {
      id: 'u1',
      tenantId: 't1',
      email: 'test@test.com',
      fullName: 'Test User',
      permissions,
      roles: [],
    },
    accessToken: 'tok',
    refreshToken: 'rtok',
    isHydrated: true,
  });
}

describe('usePermission', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, accessToken: null, refreshToken: null, isHydrated: true });
  });

  it('returns true when user has the required permission', () => {
    setPerms(['students.view', 'students.create']);
    const { result } = renderHook(() => usePermission('students.view'));
    expect(result.current).toBe(true);
  });

  it('returns false when user lacks the required permission', () => {
    setPerms(['students.view']);
    const { result } = renderHook(() => usePermission('students.delete'));
    expect(result.current).toBe(false);
  });

  it('returns false when user is not authenticated', () => {
    const { result } = renderHook(() => usePermission('students.view'));
    expect(result.current).toBe(false);
  });

  it('returns true only when ALL listed permissions are present', () => {
    setPerms(['students.view', 'students.create']);
    const { result: all } = renderHook(() => usePermission('students.view', 'students.create'));
    const { result: partial } = renderHook(() => usePermission('students.view', 'students.delete'));
    expect(all.current).toBe(true);
    expect(partial.current).toBe(false);
  });
});

describe('useAnyPermission', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, accessToken: null, refreshToken: null, isHydrated: true });
  });

  it('returns true when user has at least one of the permissions', () => {
    setPerms(['students.view']);
    const { result } = renderHook(() => useAnyPermission('students.view', 'students.create'));
    expect(result.current).toBe(true);
  });

  it('returns false when user has none of the listed permissions', () => {
    setPerms(['vehicles.view']);
    const { result } = renderHook(() => useAnyPermission('students.view', 'students.create'));
    expect(result.current).toBe(false);
  });
});
