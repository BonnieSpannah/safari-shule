import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  PrismaHealthIndicator,
  HealthIndicatorResult,
} from '@nestjs/terminus';
import Redis from 'ioredis';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../rbac/permission.decorators';
import { PrismaService } from '../../common/prisma/prisma.service';
import { redisOptions } from '../../config/redis.config';

@ApiTags('health')
@Controller('health')
export class HealthController {
  private readonly redis = new Redis(redisOptions());

  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaHealth: PrismaHealthIndicator,
    private readonly prisma: PrismaService,
  ) {}

  @Public()
  @Get()
  @HealthCheck()
  async live() {
    return this.health.check([async () => this.up('process')]);
  }

  @Public()
  @Get('ready')
  @HealthCheck()
  async ready() {
    return this.health.check([
      () => this.prismaHealth.pingCheck('database', this.prisma as any),
      async () => this.pingRedis(),
    ]);
  }

  private up(key: string): HealthIndicatorResult {
    return { [key]: { status: 'up' } };
  }

  private async pingRedis(): Promise<HealthIndicatorResult> {
    const pong = await this.redis.ping();
    return { redis: { status: pong === 'PONG' ? 'up' : 'down' } };
  }
}
