/* eslint-disable no-console */
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { TenantAdminService } from '../src/modules/tenant-admin/tenant-admin.service';
import { AuthService } from '../src/auth/auth.service';
import { runWithBypass } from '../src/common/context/request-context';
import { encryptSecret, sha256 } from '../src/common/crypto/secret-encryption';

const log = new Logger('seed');

const DEMO_TENANT = {
  slug: 'hillcrest',
  subdomain: 'hillcrest',
  name: 'Hillcrest Academy',
  contactEmail: 'admin@hillcrest.ac.ke',
  planTier: 'pro' as const,
  admin: {
    email: 'admin@hillcrest.ac.ke',
    fullName: 'Wanjiku Kamau',
    phone: '+254712000001',
    password: 'Demo!Password1',
  },
};

const ROLE_USERS = [
  { roleKey: 'system_admin', email: 'sysadmin@hillcrest.ac.ke', fullName: 'System Admin', phone: '+254712000002' },
  { roleKey: 'driver', email: 'driver1@hillcrest.ac.ke', fullName: 'Joseph Mwangi', phone: '+254712000003' },
  { roleKey: 'driver', email: 'driver2@hillcrest.ac.ke', fullName: 'Peter Otieno', phone: '+254712000004' },
  { roleKey: 'assistant', email: 'assistant1@hillcrest.ac.ke', fullName: 'Grace Achieng', phone: '+254712000005' },
  { roleKey: 'parent', email: 'parent1@hillcrest.ac.ke', fullName: 'Mary Wanjiru', phone: '+254712000006' },
  { roleKey: 'caretaker', email: 'caretaker1@hillcrest.ac.ke', fullName: 'Jane Akinyi', phone: '+254712000007' },
];

const VEHICLES = [
  { registration: 'KAA 001A', make: 'Toyota', model: 'Coaster', year: 2018, capacity: 33 },
  { registration: 'KAA 002B', make: 'Isuzu', model: 'NQR', year: 2020, capacity: 40 },
  { registration: 'KAA 003C', make: 'Mitsubishi', model: 'Rosa', year: 2021, capacity: 25 },
];

const ROUTES = [
  {
    name: 'Westlands Loop',
    description: 'Westlands -> Parklands -> School',
    startPoint: { lat: -1.2676, lng: 36.8108 },
    endPoint: { lat: -1.2865, lng: 36.8219 },
    stops: [
      { name: 'Westlands Mall', lat: -1.2676, lng: 36.8108, order: 1, pickup: '06:30', dropoff: '15:45' },
      { name: 'Parklands Plaza', lat: -1.2628, lng: 36.8167, order: 2, pickup: '06:45', dropoff: '15:30' },
      { name: 'School Gate', lat: -1.2865, lng: 36.8219, order: 3, pickup: '07:15', dropoff: '15:00' },
    ],
  },
  {
    name: 'Karen Loop',
    description: 'Karen -> Lang\'ata -> School',
    startPoint: { lat: -1.3197, lng: 36.7062 },
    endPoint: { lat: -1.2865, lng: 36.8219 },
    stops: [
      { name: 'Karen Shopping', lat: -1.3197, lng: 36.7062, order: 1, pickup: '06:25', dropoff: '15:50' },
      { name: "Lang'ata Roundabout", lat: -1.3389, lng: 36.7456, order: 2, pickup: '06:50', dropoff: '15:25' },
      { name: 'School Gate', lat: -1.2865, lng: 36.8219, order: 3, pickup: '07:20', dropoff: '15:00' },
    ],
  },
];

async function main(): Promise<void> {
  log.log('Bootstrapping Nest standalone context for seeding...');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn', 'log'] });
  const prisma = app.get(PrismaService);
  const tenantAdmin = app.get(TenantAdminService);
  const auth = app.get(AuthService);

  try {
    await runWithBypass(async () => {
      const existing = await prisma.tenant.findUnique({ where: { slug: DEMO_TENANT.slug } });
      if (existing) {
        log.warn(`Tenant '${DEMO_TENANT.slug}' already exists — skipping bootstrap. Run prisma migrate reset to wipe.`);
        return;
      }
    });

    const existing = await runWithBypass(() =>
      prisma.tenant.findUnique({ where: { slug: DEMO_TENANT.slug } }),
    );
    if (existing) {
      await app.close();
      return;
    }

    log.log(`Creating tenant '${DEMO_TENANT.slug}'...`);
    const { tenant } = await tenantAdmin.createTenant({
      slug: DEMO_TENANT.slug,
      subdomain: DEMO_TENANT.subdomain,
      name: DEMO_TENANT.name,
      contactEmail: DEMO_TENANT.contactEmail,
      planTier: DEMO_TENANT.planTier,
      initialAdmin: DEMO_TENANT.admin,
    });

    await runWithBypass(async () => {
      const passwordHash = await auth.hashPassword('Demo!Password1');

      log.log('Creating role users (1 per role)...');
      const userIdsByRole: Record<string, string> = {};
      for (const u of ROLE_USERS) {
        const role = await prisma.role.findUniqueOrThrow({
          where: { tenantId_key: { tenantId: tenant.id, key: u.roleKey } },
        });
        const user = await prisma.user.create({
          data: {
            tenantId: tenant.id,
            email: u.email,
            phoneE164: u.phone,
            passwordHash,
            status: 'active',
            fullName: u.fullName,
          },
        });
        await prisma.userRole.create({
          data: { tenantId: tenant.id, userId: user.id, roleId: role.id },
        });
        userIdsByRole[u.roleKey] ??= user.id;
      }

      log.log('Creating vehicles...');
      const driver1 = userIdsByRole['driver']!;
      const assistant1 = userIdsByRole['assistant']!;
      const vehicleIds: string[] = [];
      for (let i = 0; i < VEHICLES.length; i++) {
        const v = VEHICLES[i]!;
        const veh = await prisma.vehicle.create({
          data: {
            tenantId: tenant.id,
            registration: v.registration,
            make: v.make,
            model: v.model,
            year: v.year,
            capacity: v.capacity,
            ownership: 'school',
            status: 'active',
            assignedDriverId: i === 0 ? driver1 : null,
            assignedAssistantId: i === 0 ? assistant1 : null,
            odometerKm: 50000 + i * 10000,
          },
        });
        vehicleIds.push(veh.id);
      }

      log.log('Creating routes + bus stops (with PostGIS geography)...');
      const routeIds: string[] = [];
      const stopIdsByRoute: Record<string, string[]> = {};
      for (const r of ROUTES) {
        const routeId = randomUUID();
        await prisma.$executeRaw`
          INSERT INTO routes (id, "tenantId", name, description, "isActive", "startPoint", "endPoint", "createdAt", "updatedAt")
          VALUES (
            ${routeId}::uuid, ${tenant.id}::uuid, ${r.name}, ${r.description}, true,
            ST_SetSRID(ST_MakePoint(${r.startPoint.lng}, ${r.startPoint.lat}), 4326)::geography,
            ST_SetSRID(ST_MakePoint(${r.endPoint.lng}, ${r.endPoint.lat}), 4326)::geography,
            NOW(), NOW()
          );
        `;
        routeIds.push(routeId);
        stopIdsByRoute[routeId] = [];
        for (const s of r.stops) {
          const stopId = randomUUID();
          await prisma.$executeRaw`
            INSERT INTO bus_stops (id, "tenantId", "routeId", name, "pickupOrder", "scheduledPickupTime", "scheduledDropoffTime", location)
            VALUES (
              ${stopId}::uuid, ${tenant.id}::uuid, ${routeId}::uuid, ${s.name}, ${s.order},
              ${s.pickup}, ${s.dropoff},
              ST_SetSRID(ST_MakePoint(${s.lng}, ${s.lat}), 4326)::geography
            );
          `;
          stopIdsByRoute[routeId]!.push(stopId);
        }
      }

      log.log('Creating attribute definitions for students (allergies, blood_group)...');
      await prisma.attributeDefinition.create({
        data: {
          tenantId: tenant.id,
          targetEntity: 'student',
          slug: 'allergies',
          label: 'Known Allergies',
          fieldType: 'string',
          isRequired: false,
          sortOrder: 1,
        },
      });
      await prisma.attributeDefinition.create({
        data: {
          tenantId: tenant.id,
          targetEntity: 'student',
          slug: 'blood_group',
          label: 'Blood Group',
          fieldType: 'select',
          isRequired: false,
          sortOrder: 2,
          options: ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'],
        },
      });

      log.log('Creating 20 students with RFID tags + route assignments...');
      const studentRows: Array<{ id: string; legalName: string }> = [];
      for (let i = 1; i <= 20; i++) {
        const student = await prisma.student.create({
          data: {
            tenantId: tenant.id,
            admissionNumber: `ADM${String(i).padStart(4, '0')}`,
            legalName: STUDENT_NAMES[i - 1] ?? `Student ${i}`,
            dateOfBirth: new Date(`${2014 + (i % 4)}-0${(i % 9) + 1}-15`),
            gender: i % 2 === 0 ? 'male' : 'female',
            classroom: `Grade ${1 + (i % 6)}`,
            flexibleAttributes: { allergies: i % 5 === 0 ? 'peanuts' : null, blood_group: 'O+' },
          },
        });
        studentRows.push({ id: student.id, legalName: student.legalName });

        const routeIdx = i % ROUTES.length;
        const routeId = routeIds[routeIdx]!;
        const stops = stopIdsByRoute[routeId]!;
        await prisma.studentRouteAssignment.create({
          data: {
            tenantId: tenant.id,
            studentId: student.id,
            routeId,
            busStopId: stops[i % (stops.length - 1)]!,
            validFrom: new Date('2026-01-01'),
            validTo: null,
          },
        });

        await prisma.rfidTag.create({
          data: {
            tenantId: tenant.id,
            studentId: student.id,
            tagUid: `04${(i * 1117).toString(16).padStart(10, '0').toUpperCase()}`,
            issuedAt: new Date('2026-01-01'),
          },
        });
      }

      log.log('Creating one parent linked to first 4 students...');
      const parent = await prisma.parent.create({
        data: {
          tenantId: tenant.id,
          legalName: 'Mary Wanjiru',
          phoneE164: '+254712000006',
          email: 'parent1@hillcrest.ac.ke',
          dateOfBirth: new Date('1985-03-12'),
          gender: 'female',
          userId: userIdsByRole['parent'] ?? null,
        },
      });
      for (let i = 0; i < 4; i++) {
        await prisma.parentStudent.create({
          data: {
            tenantId: tenant.id,
            parentId: parent.id,
            studentId: studentRows[i]!.id,
            relation: 'mother',
            isPrimary: i === 0,
          },
        });
      }

      log.log('Registering one RFID device on vehicle #1...');
      const rawApiKey = randomBytes(24).toString('hex');
      const rawHmac = randomBytes(32).toString('hex');
      const deviceId = 'RFID-DEMO-001';
      await prisma.rfidDevice.create({
        data: {
          tenantId: tenant.id,
          deviceId,
          vehicleId: vehicleIds[0]!,
          apiKeyHash: sha256(rawApiKey),
          hmacSecretEncrypted: encryptSecret(rawHmac),
          status: 'active',
        },
      });

      log.log('Creating an in-progress morning trip on vehicle #1 with 5 attendance events...');
      const trip = await prisma.trip.create({
        data: {
          tenantId: tenant.id,
          routeId: routeIds[0]!,
          vehicleId: vehicleIds[0]!,
          driverUserId: driver1,
          assistantUserId: assistant1,
          scheduledStart: new Date(),
          direction: 'morning_pickup',
          status: 'in_progress',
          startedAt: new Date(),
        },
      });
      const tags = await prisma.rfidTag.findMany({
        where: { tenantId: tenant.id },
        take: 5,
        orderBy: { issuedAt: 'asc' },
      });
      for (const tag of tags) {
        await prisma.attendanceEvent.create({
          data: {
            tenantId: tenant.id,
            tripId: trip.id,
            studentId: tag.studentId,
            tagId: tag.id,
            deviceId: (await prisma.rfidDevice.findFirstOrThrow({ where: { tenantId: tenant.id } })).id,
            direction: 'boarding',
            scannedAt: new Date(),
            rawPayload: { source: 'seed' },
          },
        });
      }

      log.log('Adding sample fuel + repair logs on vehicle #1...');
      await prisma.fuelLog.create({
        data: {
          tenantId: tenant.id,
          vehicleId: vehicleIds[0]!,
          driverUserId: driver1,
          liters: 50 as any,
          costKes: 8500,
          station: 'Shell Westlands',
          odometerKm: 50250,
          occurredAt: new Date(Date.now() - 86400_000),
        },
      });
      await prisma.repairLog.create({
        data: {
          tenantId: tenant.id,
          vehicleId: vehicleIds[0]!,
          reportedByUserId: driver1,
          description: 'Front brake pad replacement',
          vendor: 'Auto-Xpress',
          costKes: 12000,
          occurredOn: new Date(Date.now() - 7 * 86400_000),
        },
      });

      log.log('=========================================================');
      log.log(' Seed complete!');
      log.log(`  Tenant     : ${tenant.slug} (${tenant.id})`);
      log.log(`  Admin login: admin@hillcrest.ac.ke / Demo!Password1`);
      log.log(`  Driver     : driver1@hillcrest.ac.ke / Demo!Password1`);
      log.log(`  Parent     : parent1@hillcrest.ac.ke / Demo!Password1`);
      log.log(`  RFID device: ${deviceId}`);
      log.log(`    API key  : ${rawApiKey}`);
      log.log(`    HMAC key : ${rawHmac}`);
      log.log('  (Save these — they are NOT shown again.)');
      log.log('=========================================================');
    });
  } catch (err) {
    log.error('Seed failed', err as Error);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

const STUDENT_NAMES = [
  'Amani Otieno', 'Zawadi Wanjiku', 'Kamau Njoroge', 'Aisha Hassan',
  'Brian Kipchoge', 'Catherine Achieng', 'David Mwangi', 'Esther Wairimu',
  'Felix Kariuki', 'Grace Adhiambo', 'Henry Omondi', 'Imani Nyambura',
  'James Kiprop', 'Kendi Mutua', 'Linda Akinyi', 'Mark Wekesa',
  'Nadia Wambui', 'Otieno Onyango', 'Phoebe Njeri', 'Quincy Kibet',
];

void main();
