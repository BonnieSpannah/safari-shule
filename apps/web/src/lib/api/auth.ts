import { api } from './client';

export interface AuthUser {
  id: string;
  tenantId: string;
  email: string;
  fullName: string;
  roles?: string[];
  permissions?: string[];
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
