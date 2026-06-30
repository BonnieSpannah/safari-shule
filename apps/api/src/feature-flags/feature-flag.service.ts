import { Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { PrismaService } from '../common/prisma/prisma.service';
import { redisOptions } from '../config/redis.config';
import { FEATURE_KEYS, type FeatureKey, type PlanTier } from '@safari-shule/shared-types';
import { runWithBypass } from '../common/context/request-context';

const CACHE_TTL = 60;

const PLAN_DEFAULTS: Record<PlanTier, Partial<Record<FeatureKey, { enabled: boolean; limits?: Record<string, number> }>>> = {
  basic: {
    sms_broadcast: { enabled: true, limits: { monthly_sms_quota: 500 } },
    email_statements: { enabled: true },
    parent_otp_login: { enabled: true },
  },
  pro: {
    mpesa_payments: { enabled: true },
    sms_broadcast: { enabled: true, limits: { monthly_sms_quota: 5000 } },
    email_statements: { enabled: true },
    parent_otp_login: { enabled: true },
    rfid_ingestion: { enabled: true },
    live_gps: { enabled: true },
    incident_matrix: { enabled: true },
  },
  enterprise: {
    mpesa_payments: { enabled: true },
    sms_broadcast: { enabled: true, limits: { monthly_sms_quota: 50000 } },
    email_statements: { enabled: true },
    parent_otp_login: { enabled: true },
    rfid_ingestion: { enabled: true },
    live_gps: { enabled: true },
    incident_matrix: { enabled: true },
  },
};

@Injectable()
export class FeatureFlagService {
  private readonly redis = new Redis(redisOptions());

  constructor(private readonly prisma: PrismaService) {}

  async isEnabled(tenantId: string, key: FeatureKey): Promise<boolean> {
    const map = await this.getAll(tenantId);
    const entry = map[key];
    if (!entry) return false;
    if (entry.expiresAt && new Date(entry.expiresAt) < new Date()) return false;
    return entry.enabled;
  }

  async getLimit(tenantId: string, key: FeatureKey, limit: string): Promise<number | null> {
    const map = await this.getAll(tenantId);
    const v = map[key]?.limits?.[limit];
    return typeof v === 'number' ? v : null;
  }

  async getAll(tenantId: string): Promise<Record<string, { enabled: boolean; limits: Record<string, unknown>; expiresAt: string | null }>> {
    const cacheKey = `features:${tenantId}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const rows = await runWithBypass(() =>
      this.prisma.tenantFeature.findMany({ where: { tenantId } }),
    );
    const map: Record<string, { enabled: boolean; limits: Record<string, unknown>; expiresAt: string | null }> = {};
    for (const r of rows) {
      map[r.featureKey] = {
        enabled: r.enabled,
        limits: (r.limits as Record<string, unknown>) ?? {},
        expiresAt: r.expiresAt?.toISOString() ?? null,
      };
    }
    await this.redis.set(cacheKey, JSON.stringify(map), 'EX', CACHE_TTL);
    return map;
  }

  async setFlag(
    tenantId: string,
    key: FeatureKey,
    patch: { enabled?: boolean; limits?: Record<string, unknown>; expiresAt?: Date | null },
  ): Promise<void> {
    await runWithBypass(() =>
      this.prisma.tenantFeature.upsert({
        where: { tenantId_featureKey: { tenantId, featureKey: key } },
        update: {
          ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
          ...(patch.limits !== undefined ? { limits: patch.limits as any } : {}),
          ...(patch.expiresAt !== undefined ? { expiresAt: patch.expiresAt } : {}),
        },
        create: {
          tenantId,
          featureKey: key,
          enabled: patch.enabled ?? false,
          limits: (patch.limits ?? {}) as any,
          expiresAt: patch.expiresAt ?? null,
        },
      }),
    );
    await this.invalidate(tenantId);
  }

  async invalidate(tenantId: string): Promise<void> {
    await this.redis.del(`features:${tenantId}`);
  }

  async seedTenant(tenantId: string, planTier: PlanTier): Promise<void> {
    const defaults = PLAN_DEFAULTS[planTier] ?? {};
    await runWithBypass(async () => {
      for (const key of FEATURE_KEYS) {
        const def = defaults[key];
        await this.prisma.tenantFeature.upsert({
          where: { tenantId_featureKey: { tenantId, featureKey: key } },
          update: {},
          create: {
            tenantId,
            featureKey: key,
            enabled: def?.enabled ?? false,
            limits: (def?.limits ?? {}) as any,
          },
        });
      }
    });
    await this.invalidate(tenantId);
  }
}
