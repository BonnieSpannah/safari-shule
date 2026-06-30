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
  planTier: PlanTier;
  initialAdmin: { email: string; fullName: string; phone?: string; password: string };
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

  createTenant(input: BootstrapTenantInput) {
    return runWithBypass(async () => {
      const tenant = await this.prisma.tenant.create({
        data: {
          slug: input.slug,
          subdomain: input.subdomain,
          name: input.name,
          contactEmail: input.contactEmail,
          planTier: input.planTier as any,
        },
      });

      await this.rbac.seedTenant(tenant.id);
      await this.flags.seedTenant(tenant.id, input.planTier);

      const passwordHash = await this.auth.hashPassword(input.initialAdmin.password);
      const user = await this.prisma.user.create({
        data: {
          tenantId: tenant.id,
          email: input.initialAdmin.email.toLowerCase(),
          phoneE164: input.initialAdmin.phone ?? null,
          passwordHash,
          status: 'active',
          fullName: input.initialAdmin.fullName,
        },
      });

      const schoolMgrRole = await this.prisma.role.findUniqueOrThrow({
        where: { tenantId_key: { tenantId: tenant.id, key: 'school_manager' } },
      });
      await this.prisma.userRole.create({
        data: { tenantId: tenant.id, userId: user.id, roleId: schoolMgrRole.id },
      });

      return { tenant, adminUser: { id: user.id, email: user.email } };
    });
  }
}
