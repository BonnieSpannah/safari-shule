import type {
  UpdateProfileInput,
  ChangePasswordInput,
  UserPreferences,
  UserSession,
} from '@safari-shule/shared-types';
import type { AuthUser } from './auth';
import { api } from './client';

export async function updateProfile(input: UpdateProfileInput) {
  const { data } = await api.patch<AuthUser>('/v1/auth/me', input);
  return data;
}

export async function changePassword(input: ChangePasswordInput) {
  const { data } = await api.post<{ changedAt: string }>('/v1/auth/me/password', input);
  return data;
}

export async function listSessions(currentRefreshTokenHash?: string) {
  const { data } = await api.get<{ sessions: UserSession[] }>('/v1/auth/me/sessions', {
    headers: currentRefreshTokenHash
      ? { 'x-refresh-token-hash': currentRefreshTokenHash }
      : undefined,
  });
  return data.sessions;
}

export async function revokeSession(id: string) {
  const { data } = await api.delete<{ revokedAt: string }>(`/v1/auth/me/sessions/${id}`);
  return data;
}

export async function revokeAllSessions(currentRefreshToken?: string) {
  const { data } = await api.post<{ revoked: number; revokedAt: string }>(
    '/v1/auth/me/sessions/revoke-all',
    { keepCurrent: !!currentRefreshToken, currentRefreshToken },
  );
  return data;
}

export async function getPreferences() {
  const { data } = await api.get<UserPreferences>('/v1/auth/me/preferences');
  return data;
}

export async function updatePreferences(patch: Partial<UserPreferences>) {
  const { data } = await api.patch<UserPreferences>('/v1/auth/me/preferences', patch);
  return data;
}

/**
 * SHA-256 hex of the caller's refresh token — passed as `X-Refresh-Token-Hash`
 * to `/v1/auth/me/sessions` so the server can flag which returned session is
 * the one making the request. Purely a UI convenience.
 */
export async function hashRefreshToken(token: string): Promise<string> {
  if (typeof crypto === 'undefined' || !crypto.subtle) return '';
  const bytes = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
