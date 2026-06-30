import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { redisOptions } from '../../config/redis.config';
import { PrismaService } from '../prisma/prisma.service';

const CACHE_TTL_SECONDS = 60;

export interface ResolvedTenant {
  id: string;
  slug: string;
  subdomain: string;
  planTier: string;
  isActive: boolean;
}

@Injectable()
export class TenantResolverService {
  private readonly logger = new Logger(TenantResolverService.name);
  private readonly redis = new Redis(redisOptions());

  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}

  async resolve(host: string | undefined, headerTenantId: string | undefined, headerSlug: string | undefined): Promise<ResolvedTenant | null> {
    const baseDomain = this.config.get<string>('app.baseDomain')!;
    const subdomain = this.extractSubdomain(host, baseDomain) ?? headerSlug ?? null;

    if (subdomain) {
      const cached = await this.fromCache(`subdomain:${subdomain}`);
      if (cached) return cached;
      const tenant = await this.prisma.tenant.findUnique({ where: { subdomain } });
      if (tenant) return this.cacheAndReturn(tenant);
      const bySlug = await this.prisma.tenant.findUnique({ where: { slug: subdomain } });
      if (bySlug) return this.cacheAndReturn(bySlug);
    }

    if (headerTenantId) {
      const cached = await this.fromCache(`id:${headerTenantId}`);
      if (cached) return cached;
      const tenant = await this.prisma.tenant.findUnique({ where: { id: headerTenantId } });
      if (tenant) return this.cacheAndReturn(tenant);
    }

    return null;
  }

  async invalidate(tenant: { id: string; slug: string; subdomain: string }): Promise<void> {
    await Promise.allSettled([
      this.redis.del(`tenant:id:${tenant.id}`),
      this.redis.del(`tenant:subdomain:${tenant.subdomain}`),
      this.redis.del(`tenant:subdomain:${tenant.slug}`),
    ]);
  }

  private extractSubdomain(host: string | undefined, baseDomain: string): string | null {
    if (!host) return null;
    const cleaned = host.split(':')[0]!.toLowerCase();
    if (cleaned === baseDomain || !cleaned.endsWith(`.${baseDomain}`)) return null;
    const sub = cleaned.slice(0, -1 * (baseDomain.length + 1));
    if (!sub || sub.includes('.')) return null;
    return sub;
  }

  private async fromCache(suffix: string): Promise<ResolvedTenant | null> {
    const raw = await this.redis.get(`tenant:${suffix}`);
    return raw ? (JSON.parse(raw) as ResolvedTenant) : null;
  }

  private async cacheAndReturn(tenant: {
    id: string;
    slug: string;
    subdomain: string;
    planTier: string;
    isActive: boolean;
  }): Promise<ResolvedTenant> {
    const value: ResolvedTenant = {
      id: tenant.id,
      slug: tenant.slug,
      subdomain: tenant.subdomain,
      planTier: tenant.planTier,
      isActive: tenant.isActive,
    };
    const json = JSON.stringify(value);
    await Promise.allSettled([
      this.redis.set(`tenant:id:${tenant.id}`, json, 'EX', CACHE_TTL_SECONDS),
      this.redis.set(`tenant:subdomain:${tenant.subdomain}`, json, 'EX', CACHE_TTL_SECONDS),
      this.redis.set(`tenant:subdomain:${tenant.slug}`, json, 'EX', CACHE_TTL_SECONDS),
    ]);
    return value;
  }
}
