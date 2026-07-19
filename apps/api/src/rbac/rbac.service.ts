import { Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { PrismaService } from '../common/prisma/prisma.service';
import { redisOptions } from '../config/redis.config';
import {
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSIONS,
  PERMISSION_BUNDLES,
  ROLE_KEYS,
  type PermissionKey,
  type RoleKey,
} from '@safari-shule/shared-types';
import { runWithBypass } from '../common/context/request-context';

const CACHE_TTL = 60;

/**
 * Extended system roles seeded per tenant on top of the six ROLE_KEYS.
 * Kept here (not in shared-types) because these role identifiers are DB rows,
 * not runtime type constraints — the permission strings they reference all
 * live in the shared PERMISSIONS catalog.
 */
const EXTENDED_ROLES: Array<{ key: string; label: string; bundle: readonly string[] }> = [
  { key: 'transport_admin', label: 'Transport Admin', bundle: PERMISSION_BUNDLES.transportAdmin },
  { key: 'finance_admin', label: 'Finance Admin', bundle: PERMISSION_BUNDLES.financeAdmin },
  { key: 'hr_admin', label: 'HR Admin', bundle: PERMISSION_BUNDLES.hrAdmin },
  { key: 'compliance_officer', label: 'Compliance Officer', bundle: PERMISSION_BUNDLES.complianceOfficer },
  { key: 'dispatcher', label: 'Dispatcher', bundle: PERMISSION_BUNDLES.dispatcher },
];

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
      for (const key of PERMISSIONS) {
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

        // system_admin gets the FULL catalog (every permission in PERMISSIONS),
        // not just the legacy DEFAULT_ROLE_PERMISSIONS.system_admin subset.
        // That guarantees a super admin can access every capability the app
        // will ever expose without a per-permission grant dance.
        const defaults =
          roleKey === 'system_admin'
            ? (PERMISSIONS as unknown as readonly PermissionKey[])
            : DEFAULT_ROLE_PERMISSIONS[roleKey];
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

      for (const { key, label, bundle } of EXTENDED_ROLES) {
        const role = await this.prisma.role.upsert({
          where: { tenantId_key: { tenantId, key } },
          update: {},
          create: { tenantId, key, label, isSystem: true },
        });
        for (const permKey of bundle) {
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

  private describePermission(key: string): string {
    const parts = key.split('.');
    const resource = parts[0]?.replace(/[_-]/g, ' ') ?? 'resource';
    const action = parts.slice(1).join('.') || 'access';
    return `${action} ${resource}`;
  }

  private describeRole(key: RoleKey): string {
    return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
}
