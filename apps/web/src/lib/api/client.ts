import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import { env, resolveTenantSlugFromHost } from '@/lib/env';
import { useAuthStore } from '@/stores/auth.store';

type RetryConfig = InternalAxiosRequestConfig & { _retry?: boolean };

const TENANT_SLUG_STORAGE_KEY = 'safari.last_tenant_slug';

let refreshPromise: Promise<string | null> | null = null;

function generateTraceId(): string {
  return crypto.randomUUID();
}

/** Persist the tenant slug the user just chose (typically at login). */
export function rememberTenantSlug(slug: string): void {
  if (typeof window === 'undefined') return;
  if (!slug) {
    localStorage.removeItem(TENANT_SLUG_STORAGE_KEY);
    return;
  }
  localStorage.setItem(TENANT_SLUG_STORAGE_KEY, slug);
}

/** Read the previously-chosen tenant slug, if any. */
export function readRememberedTenantSlug(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TENANT_SLUG_STORAGE_KEY);
}

/**
 * Resolve the tenant slug for the current request in priority order:
 *   1) subdomain of the current hostname (e.g. hillcrest.safarishule.test)
 *   2) the slug the user chose on the last login (localStorage)
 *   3) the VITE_TENANT_SLUG env default (fallback for first-run localhost)
 */
function currentTenantSlug(): string {
  if (typeof window !== 'undefined') {
    const fromHost = resolveTenantSlugFromHost(window.location.hostname);
    if (fromHost) return fromHost;
    const persisted = readRememberedTenantSlug();
    if (persisted) return persisted;
  }
  return env.tenantSlug;
}

async function refreshAccessToken(client: AxiosInstance): Promise<string | null> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const currentRefresh = useAuthStore.getState().refreshToken;
    if (!currentRefresh) {
      useAuthStore.getState().clear();
      return null;
    }
    try {
      const { data } = await client.post<{ accessToken: string; refreshToken: string }>(
        '/v1/auth/refresh',
        { refreshToken: currentRefresh },
        { _retry: true } as RetryConfig,
      );
      useAuthStore.getState().setTokens(data.accessToken, data.refreshToken);
      return data.accessToken;
    } catch {
      useAuthStore.getState().clear();
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export function createApiClient(): AxiosInstance {
  const client = axios.create({
    baseURL: env.apiUrl || '/',
    withCredentials: true,
    timeout: 30_000,
  });

  client.interceptors.request.use((config) => {
    const { accessToken } = useAuthStore.getState();
    if (accessToken && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    config.headers['X-Trace-Id'] = generateTraceId();
    config.headers['X-Tenant-Slug'] = currentTenantSlug();
    return config;
  });

  client.interceptors.response.use(
    (r) => r,
    async (error: AxiosError) => {
      const original = error.config as RetryConfig | undefined;
      if (!original || original._retry) throw error;
      if (error.response?.status !== 401) throw error;
      if (original.url?.includes('/v1/auth/login') || original.url?.includes('/v1/auth/refresh')) {
        throw error;
      }

      const token = await refreshAccessToken(client);
      if (!token) throw error;

      original._retry = true;
      original.headers = original.headers ?? {};
      original.headers.Authorization = `Bearer ${token}`;
      return client(original);
    },
  );

  return client;
}

export const api = createApiClient();
