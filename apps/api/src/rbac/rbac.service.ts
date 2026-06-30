import { Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { PrismaService } from '../common/prisma/prisma.service';
import { redisOptions } from '../config/redis.config';
import {
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSION_KEYS,
  ROLE_KEYS,
  type PermissionKey,
  type RoleKey,
} from '@safari-shule/shared-types';
import { runWithBypass } from '../common/context/request-context';

const CACHE_TTL = 60;

@Injectable()
export class RbacService {
  private readonly logger = new Logger(RbacService.name);
  private readonly redis = new Redis(redisOptions());

  constructor(private readonly prisma: PrismaService) {}

  async getUserPermissions(tenantId: string, userId: string): Promise<Set<PermissionKey>> {
    const key = `rbac:perms:${tenantId}:${userId}`;
    const cached = await this.redis.get(key);
    if (cached) return new Set(JSON.parse(cached) as PermissionKey[]);

    const rows = await runWithBypass(() =>
      this.prisma.userRole.findMany({
        where: { tenantId, userId },
        select: {
          role: { select: { rolePermissions: { select: { permission: { select: { key: true } } } } } },
        },
      }),
    );

    const set = new Set<PermissionKey>();
    for (const ur of rows) {
      for (const rp of ur.role.rolePermissions) {
        set.add(rp.permission.key as PermissionKey);
      }
    }

    await this.redis.set(key, JSON.stringify([...set]), 'EX', CACHE_TTL);
    return set;
  }

  async invalidateUser(tenantId: string, userId: string): Promise<void> {
    await this.redis.del(`rbac:perms:${tenantId}:${userId}`);
  }

  async invalidateTenant(tenantId: string): Promise<void> {
    const keys = await this.redis.keys(`rbac:perms:${tenantId}:*`);
    if (keys.length) await this.redis.del(...keys);
  }

  /**
   * Seed the canonical permission catalog + role-permission defaults for a
   * freshly-created tenant. Idempotent: re-running fills in anything missing
   * without overwriting tenant-level customizations.
   */
  async seedTenant(tenantId: string): Promise<void> {
    await runWithBypass(async () => {
      for (const key of PERMISSION_KEYS) {
        await this.prisma.permission.upsert({
          where: { tenantId_key: { tenantId, key } },
          update: {},
          create: { tenantId, key, description: this.describePermission(key) },
        });
      }

      const allPerms = await this.prisma.permission.findMany({
        where: { tenantId },
        select: { id: true, key: true },
      });
      const permByKey = new Map(allPerms.map((p) => [p.key, p.id]));

      for (const roleKey of ROLE_KEYS) {
        const role = await this.prisma.role.upsert({
          where: { tenantId_key: { tenantId, key: roleKey } },
          update: {},
          create: {
            tenantId,
            key: roleKey,
            label: this.describeRole(roleKey),
            isSystem: true,
          },
        });

        const defaults = DEFAULT_ROLE_PERMISSIONS[roleKey];
        for (const permKey of defaults) {
          const permId = permByKey.get(permKey);
          if (!permId) continue;
          await this.prisma.rolePermission.upsert({
            where: {
              tenantId_roleId_permissionId: {
                tenantId,
                roleId: role.id,
                permissionId: permId,
              },
            },
            update: {},
            create: { tenantId, roleId: role.id, permissionId: permId },
          });
        }
      }
    });
  }

  private describePermission(key: PermissionKey): string {
    const [scope, verb] = key.split('.');
    return `${verb ?? 'access'} ${scope?.replace(/_/g, ' ') ?? 'resource'}`;
  }

  private describeRole(key: RoleKey): string {
    return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
}
