import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import { env } from '@/lib/env';
import { useAuthStore } from '@/stores/auth.store';

type RetryConfig = InternalAxiosRequestConfig & { _retry?: boolean };

let refreshPromise: Promise<string | null> | null = null;

function generateTraceId(): string {
  return crypto.randomUUID();
}

async function refreshAccessToken(client: AxiosInstance): Promise<string | null> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const { data } = await client.post<{ accessToken: string }>(
        '/v1/auth/refresh',
        {},
        { withCredentials: true, _retry: true } as RetryConfig,
      );
      useAuthStore.getState().setAccessToken(data.accessToken);
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
