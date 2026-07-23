import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RbacService } from '../../rbac/rbac.service';
import { FeatureFlagService } from '../../feature-flags/feature-flag.service';
import { AuthService } from '../../auth/auth.service';
import { runWithBypass } from '../../common/context/request-context';
import type { PlanTier } from '@safari-shule/shared-types';

export interface BootstrapTenantInput {
  slug: string;
  subdomain: string;
  name: string;
  contactEmail: string;
  contactPhone?: string;
  planTier: PlanTier;
  initialAdmin: {
    email: string;
    fullName: string;
    phone?: string;
    password: string;
    /**
     * Which system role to grant the initial admin. Defaults to `school_manager`
     * (safe: no cross-tenant permissions). Only pass `system_admin` when
     * bootstrapping the dedicated `platform` tenant.
     */
    roleKey?: string;
    /**
     * When true, the admin is forced to rotate their password on first login.
     * Defaults to true — safe for admin-created accounts. The core seed
     * passes false so the super admin can log in with the credentials the
     * operator already knows.
     */
    mustChangePassword?: boolean;
  };
}

@Injectable()
export class TenantAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rbac: RbacService,
    private readonly flags: FeatureFlagService,
    private readonly auth: AuthService,
  ) {}

  listTenants() {
    return runWithBypass(() =>
      this.prisma.tenant.findMany({ orderBy: { createdAt: 'desc' } }),
    );
  }

  getTenantDetail(id: string) {
    return runWithBypass(() =>
      this.prisma.tenant.findUniqueOrThrow({
        where: { id },
        include: {
          _count: {
            select: {
              users: true,
              staff: true,
              students: true,
              vehicles: true,
              routes: true,
            },
          },
          users: {
            orderBy: { createdAt: 'desc' },
            take: 30,
            select: {
              id: true,
              email: true,
              fullName: true,
              phoneE164: true,
              status: true,
              createdAt: true,
              lastLoginAt: true,
              userRoles: {
                select: { role: { select: { key: true, label: true } } },
              },
            },
          },
          students: {
            orderBy: { createdAt: 'desc' },
            take: 50,
            select: {
              id: true,
              legalName: true,
              admissionNumber: true,
              classroom: true,
              gender: true,
              dateOfBirth: true,
              createdAt: true,
              parents: {
                take: 1,
                select: {
                  relation: true,
                  parent: { select: { legalName: true, phoneE164: true } },
                },
              },
            },
          },
          staff: {
            orderBy: { createdAt: 'desc' },
            take: 30,
            select: {
              id: true,
              legalName: true,
              employeeNumber: true,
              position: true,
              phoneE164: true,
              email: true,
              gender: true,
              createdAt: true,
            },
          },
          vehicles: {
            orderBy: { createdAt: 'desc' },
            take: 50,
            select: {
              id: true,
              registration: true,
              make: true,
              model: true,
              year: true,
              capacity: true,
              ownership: true,
              status: true,
              createdAt: true,
            },
          },
          routes: {
            orderBy: { createdAt: 'desc' },
            take: 50,
            select: {
              id: true,
              name: true,
              description: true,
              isActive: true,
              createdAt: true,
              _count: {
                select: { busStops: true, studentAssignments: true },
              },
              assignments: {
                orderBy: { validFrom: 'desc' },
                take: 1,
                select: {
                  vehicle: { select: { make: true, model: true, registration: true } },
                },
              },
            },
          },
        },
      }),
    );
  }

  updateTenant(
    id: string,
    input: { name?: string; contactEmail?: string; contactPhone?: string | null; planTier?: string },
  ) {
    return runWithBypass(() =>
      this.prisma.tenant.update({
        where: { id },
        data: {
          ...(input.name !== undefined && { name: input.name }),
          ...(input.contactEmail !== undefined && { contactEmail: input.contactEmail }),
          ...('contactPhone' in input && { contactPhone: input.contactPhone }),
          ...(input.planTier !== undefined && { planTier: input.planTier as any }),
        },
      }),
    );
  }

  async setTenantStatus(id: string, status: 'active' | 'suspended' | 'deactivated' | 'deleted') {
    const now = new Date();
    const current = await runWithBypass(() =>
      this.prisma.tenant.findUnique({ where: { id }, select: { deletedAt: true } }),
    );
    const isRestore = status === 'active' && current?.deletedAt != null;
    const extra: Record<string, unknown> = {
      active: { isActive: true, activatedAt: now, suspendedAt: null, deletedAt: null, ...(isRestore ? { restoredAt: now } : {}) },
      suspended: { isActive: false, suspendedAt: now },
      deactivated: { isActive: false, suspendedAt: null },
      deleted: { isActive: false, deletedAt: now },
    };
    return runWithBypass(() =>
      this.prisma.tenant.update({
        where: { id },
        data: { status, ...(extra[status] ?? {}) },
      }),
    );
  }

  createTenant(input: BootstrapTenantInput) {
    return runWithBypass(async () => {
      const now = new Date();
      const tenant = await this.prisma.tenant.create({
        data: {
          slug: input.slug,
          subdomain: input.subdomain,
          name: input.name,
          contactEmail: input.contactEmail,
          contactPhone: input.contactPhone ?? null,
          planTier: input.planTier as any,
          status: 'active',
          isActive: true,
          activatedAt: now,
        },
      });

      await this.rbac.seedTenant(tenant.id);
      await this.flags.seedTenant(tenant.id, input.planTier);

      const passwordHash = await this.auth.hashPassword(input.initialAdmin.password);
      const mustChangePassword = input.initialAdmin.mustChangePassword ?? true;
      const user = await this.prisma.user.create({
        data: {
          tenantId: tenant.id,
          email: input.initialAdmin.email.toLowerCase(),
          phoneE164: input.initialAdmin.phone ?? null,
          passwordHash,
          status: 'active',
          fullName: input.initialAdmin.fullName,
          mustChangePassword,
          passwordUpdatedAt: now,
          activatedAt: now,
        },
      });

      // Record the initial password in history so a future rotation can't
      // re-use it.
      await this.prisma.passwordHistory.create({
        data: {
          tenantId: tenant.id,
          userId: user.id,
          passwordHash,
          reason: 'initial',
        },
      });

      const roleKey = input.initialAdmin.roleKey ?? 'school_manager';
      const role = await this.prisma.role.findUniqueOrThrow({
        where: { tenantId_key: { tenantId: tenant.id, key: roleKey } },
      });
      await this.prisma.userRole.create({
        data: { tenantId: tenant.id, userId: user.id, roleId: role.id },
      });

      // Send activation email to all new users who are expected to set their
      // own password on first login. The super admin (platform seed) is
      // provisioned with mustChangePassword=false and a known password, so
      // we skip the email for them.
      if (mustChangePassword) {
        await this.auth.issueActivationToken(
          tenant.id,
          user.id,
          user.email,
          user.fullName,
          tenant.name,
          tenant.slug,
        );
      }

      return { tenant, adminUser: { id: user.id, email: user.email } };
    });
  }
}
