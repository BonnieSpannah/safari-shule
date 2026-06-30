import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { TenantAdminService } from '../src/modules/tenant-admin/tenant-admin.service';
import { AuthService } from '../src/auth/auth.service';
import { runWithBypass } from '../src/common/context/request-context';
import { bootstrapTestApp, cleanupTenant, seedTenantWithRoles, SeededTenant } from './helpers';

describe('SOS incident flow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tenantAdmin: TenantAdminService;
  let auth: AuthService;
  let tenant: SeededTenant;

  beforeAll(async () => {
    ({ app, prisma, tenantAdmin, auth } = await bootstrapTestApp());
    tenant = await seedTenantWithRoles(prisma, tenantAdmin, auth, 'sos');

    // Register at least one emergency contact so the SMS leg has somewhere to dispatch.
    await runWithBypass(() =>
      prisma.incidentEmergencyContact.create({
        data: {
          tenantId: tenant.tenantId,
          label: 'Headteacher',
          phoneE164: '+254712999000',
          priority: 1,
        },
      }),
    );
  });

  afterAll(async () => {
    await cleanupTenant(prisma, tenant.tenantId);
    await app.close();
  });

  it('driver SOS returns 202 with per-leg statuses + persists an incident row', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/incidents/sos')
      .set('Authorization', `Bearer ${tenant.driverAccessToken}`)
      .set('x-tenant-id', tenant.tenantId)
      .send({
        description: 'Vehicle stopped, hazard lights on, driver requesting help.',
        location: { lat: -1.2864, lng: 36.8219 },
      });

    expect([200, 201, 202]).toContain(res.status);
    expect(res.body).toHaveProperty('legs');
    expect(res.body.legs).toHaveProperty('persist');
    expect(res.body.legs).toHaveProperty('broadcast');
    expect(res.body.legs).toHaveProperty('sms');

    const incidents = await runWithBypass(() =>
      prisma.incident.findMany({
        where: { tenantId: tenant.tenantId, kind: 'sos' },
        orderBy: { occurredAt: 'desc' },
        take: 1,
      }),
    );
    expect(incidents.length).toBe(1);
    expect(incidents[0]!.severity).toBe('critical');
    expect(incidents[0]!.status).toBe('reported');
  });

  it('SOS without a registered emergency contact still persists the incident', async () => {
    // Wipe contacts then try again.
    await runWithBypass(() =>
      prisma.incidentEmergencyContact.deleteMany({ where: { tenantId: tenant.tenantId } }),
    );

    const res = await request(app.getHttpServer())
      .post('/v1/incidents/sos')
      .set('Authorization', `Bearer ${tenant.driverAccessToken}`)
      .set('x-tenant-id', tenant.tenantId)
      .send({
        description: 'Test - no contacts',
        location: { lat: -1.2864, lng: 36.8219 },
      });

    expect([200, 201, 202]).toContain(res.status);
    // Persist leg should still succeed even when SMS leg has nothing to send.
    expect(res.body?.legs?.persist).toMatch(/ok|fulfilled/i);
  });
});
