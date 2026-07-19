import type { UserPreferences } from '@safari-shule/shared-types';
import { api } from './client';

export interface AuthUser {
  id: string;
  tenantId: string;
  email: string;
  fullName: string;
  phoneE164?: string | null;
  status?: string;
  mustChangePassword?: boolean;
  passwordUpdatedAt?: string;
  passwordExpiresAt?: string;
  passwordExpiresInDays?: number;
  activatedAt?: string | null;
  lastLoginAt?: string | null;
  roles?: string[];
  permissions?: string[];
  preferences?: UserPreferences;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  accessTtlSeconds: number;
  refreshTtlSeconds: number;
  user: AuthUser;
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>('/v1/auth/login', { email, password });
  return data;
}

export async function logout(refreshToken: string): Promise<void> {
  if (!refreshToken) return;
  try {
    await api.post('/v1/auth/logout', { refreshToken });
  } catch {
    // best-effort — local state is cleared regardless
  }
}

/**
 * Fetch the caller's full identity (roles + permissions). Used by the web to
 * hydrate permission-gated navigation right after login.
 */
export async function fetchMe(): Promise<AuthUser> {
  const { data } = await api.get<AuthUser>('/v1/auth/me');
  return data;
}

