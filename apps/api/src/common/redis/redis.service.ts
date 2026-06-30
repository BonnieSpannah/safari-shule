import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import { redisOptions } from '../../config/redis.config';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  readonly client: Redis;

  constructor() {
    this.client = new Redis(redisOptions());
    this.client.on('error', (err) => this.logger.error(`Redis error: ${err.message}`));
  }

  async onModuleInit(): Promise<void> {
    if (this.client.status === 'wait') {
      await this.client.connect().catch((err) => {
        this.logger.warn(`Initial Redis connect failed: ${err.message}`);
      });
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit().catch(() => undefined);
  }

  get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  set(key: string, value: string, mode?: 'EX', ttlSeconds?: number): Promise<'OK' | null> {
    if (mode === 'EX' && typeof ttlSeconds === 'number') {
      return this.client.set(key, value, 'EX', ttlSeconds);
    }
    return this.client.set(key, value);
  }

  del(...keys: string[]): Promise<number> {
    if (keys.length === 0) return Promise.resolve(0);
    return this.client.del(...keys);
  }

  ping(): Promise<string> {
    return this.client.ping();
  }
}
