import type { RedisOptions } from 'ioredis';

export function redisOptions(): RedisOptions {
  const url = process.env.REDIS_URL;
  if (url) {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: Number(parsed.port || 6379),
      password: parsed.password || undefined,
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
    };
  }
  return {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: Number(process.env.REDIS_PORT ?? 6379),
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  };
}
