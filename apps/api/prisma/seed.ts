/* eslint-disable no-console */
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { TenantAdminService } from '../src/modules/tenant-admin/tenant-admin.service';
import { runWithBypass } from '../src/common/context/request-context';

const log = new Logger('seed');

// ---------------------------------------------------------------------------
// Configuration — every value reads from the environment with a safe default.
// See .env.example for the full reference and where to change these.
// ---------------------------------------------------------------------------
const APP_BASE_DOMAIN = process.env.APP_BASE_DOMAIN ?? 'safarishule.test';
const WEB_PUBLIC_URL = process.env.WEB_PUBLIC_URL ?? 'http://localhost:5173';
const DEFAULT_EMAIL = `admin@${APP_BASE_DOMAIN}`;

/**
 * The `platform` tenant is a technical container that holds Safari Shule's
 * super admin, all permission definitions, and every system role. End users
 * never see it — schools ("real" tenants) get created later by the super
 * admin from the UI. This is the only tenant a fresh install ever creates.
 */
const PLATFORM_TENANT = {
  slug: 'platform',
  subdomain: 'platform',
  name: 'Safari Shule Platform',
  contactEmail: process.env.SUPER_ADMIN_EMAIL ?? DEFAULT_EMAIL,
  planTier: 'enterprise' as const,
};

const SUPER_ADMIN = {
  email: process.env.SUPER_ADMIN_EMAIL ?? DEFAULT_EMAIL,
  fullName: process.env.SUPER_ADMIN_FULL_NAME ?? 'Safari Shule Super Admin',
  phone: process.env.SUPER_ADMIN_PHONE ?? '+254700000000',
  password: process.env.SUPER_ADMIN_PASSWORD ?? 'ChangeMe!Now1',
  roleKey: 'system_admin' as const,
  /**
   * The seeded super admin knows their password already — no forced rotation.
   * Every subsequent user provisioned by an admin defaults to `true`.
   */
  mustChangePassword: false,
};

async function main(): Promise<void> {
  log.log('Bootstrapping core seed (platform + super admin only)...');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  const prisma = app.get(PrismaService);
  const tenantAdmin = app.get(TenantAdminService);

  try {
    const existing = await runWithBypass(() =>
      prisma.tenant.findUnique({ where: { slug: PLATFORM_TENANT.slug } }),
    );

    if (existing) {
      log.warn('Platform tenant already exists — seed is idempotent, nothing to do.');
      log.log('');
      log.log(' Sign in with the credentials from your previous seed run:');
      log.log(`   URL      : ${WEB_PUBLIC_URL}`);
      log.log(`   Email    : ${SUPER_ADMIN.email}`);
      log.log(`   Tenant   : ${PLATFORM_TENANT.slug}  (sent as X-Tenant-Slug header)`);
      log.log('');
      log.log(' To wipe and re-seed cleanly:');
      log.log('   pnpm --filter @safari-shule/api exec prisma migrate reset --force --skip-seed');
      log.log('   pnpm --filter @safari-shule/api run db:seed');
      return;
    }

    log.log('Creating platform tenant + super admin...');
    log.log(' → all permissions upserted');
    log.log(' → 11 system roles seeded (system_admin, school_manager, driver, assistant,');
    log.log('   parent, caretaker, transport_admin, finance_admin, hr_admin,');
    log.log('   compliance_officer, dispatcher)');
    log.log(' → 1 super admin user assigned system_admin role');

    await tenantAdmin.createTenant({
      slug: PLATFORM_TENANT.slug,
      subdomain: PLATFORM_TENANT.subdomain,
      name: PLATFORM_TENANT.name,
      contactEmail: PLATFORM_TENANT.contactEmail,
      planTier: PLATFORM_TENANT.planTier,
      initialAdmin: SUPER_ADMIN,
    });

    log.log('');
    log.log('=========================================================');
    log.log(' Core seed complete.');
    log.log('');
    log.log(' Super admin credentials:');
    log.log(`   URL      : ${WEB_PUBLIC_URL}`);
    log.log(`   Email    : ${SUPER_ADMIN.email}`);
    log.log(`   Password : ${SUPER_ADMIN.password}`);
    log.log(`   Tenant   : ${PLATFORM_TENANT.slug}  (sent as X-Tenant-Slug header)`);
    log.log('');
    log.log(' On first login you can create schools, invite users, and');
    log.log(' change every setting from the UI. Rotate your password from');
    log.log(' Profile → Security.');
    log.log('=========================================================');
  } catch (err) {
    log.error('Seed failed', err as Error);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

void main();

