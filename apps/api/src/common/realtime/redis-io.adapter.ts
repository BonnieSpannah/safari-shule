import { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { redisOptions } from '../../config/redis.config';

export class RedisIoAdapter extends IoAdapter {
  private adapterCtor?: ReturnType<typeof createAdapter>;

  constructor(app: INestApplicationContext) {
    super(app);
  }

  async connectToRedis(): Promise<void> {
    const pub = new Redis(redisOptions());
    const sub = pub.duplicate();
    await Promise.all([pub.connect().catch(() => undefined), sub.connect().catch(() => undefined)]);
    this.adapterCtor = createAdapter(pub, sub);
  }

  override createIOServer(port: number, options?: ServerOptions): unknown {
    const server = super.createIOServer(port, { ...options, cors: { origin: true, credentials: true } });
    if (this.adapterCtor) (server as any).adapter(this.adapterCtor);
    return server;
  }
}
