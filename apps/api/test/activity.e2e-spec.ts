import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { ActivityService } from '../src/audit/activity/activity.service';
import { ActivityChannel } from '../src/audit/activity/activity.types';

describe('Activity Logging (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let activityService: ActivityService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);
    activityService = app.get(ActivityService);

    // Clear activity logs before tests
    await prisma.activityEvent.deleteMany({});
  });

  afterAll(async () => {
    await app.close();
  });

  describe('ActivityService.record() - Canonical activity writer', () => {
    it('should record a basic view action with minimal fields', async () => {
      const result = await activityService.record({
        tenantId: 'tenant-1',
        actorUserId: 'user-1',
        channel: 'api' as ActivityChannel,
        action: 'view',
        resourceType: 'Trip',
        resourceId: 'trip-123',
        occurredAt: new Date('2026-09-09T10:00:00Z'),
      });

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.tenantId).toBe('tenant-1');
      expect(result.actorUserId).toBe('user-1');
      expect(result.channel).toBe('api');
      expect(result.action).toBe('view');
      expect(result.resourceType).toBe('Trip');
      expect(result.resourceId).toBe('trip-123');
    });

    it('should record with full context including request correlation', async () => {
      const result = await activityService.record({
        tenantId: 'tenant-1',
        actorUserId: 'user-2',
        channel: 'web' as ActivityChannel,
        action: 'update',
        resourceType: 'Student',
        resourceId: 'student-456',
        occurredAt: new Date('2026-09-09T10:05:00Z'),
        requestId: 'req-abc123',
        traceId: 'trace-def456',
        sessionId: 'session-ghi789',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0...',
        metadata: { field: 'name', oldValue: 'John', newValue: 'Jane' },
        sourceType: 'ClientEvent',
        sourceId: 'ce-001',
      });

      expect(result).toBeDefined();
      expect(result.requestId).toBe('req-abc123');
      expect(result.traceId).toBe('trace-def456');
      expect(result.sessionId).toBe('session-ghi789');
      expect(result.ipAddress).toBe('192.168.1.1');
      expect(result.metadata).toEqual({
        field: 'name',
        oldValue: 'John',
        newValue: 'Jane',
      });
    });

    it('should support system channel without actorUserId', async () => {
      const result = await activityService.record({
        tenantId: 'tenant-1',
        actorUserId: null, // system background job
        channel: 'system' as ActivityChannel,
        action: 'notification_sent',
        resourceType: 'Parent',
        resourceId: 'parent-789',
        occurredAt: new Date('2026-09-09T10:10:00Z'),
        metadata: { via: 'SMS', messageId: 'msg-001' },
      });

      expect(result).toBeDefined();
      expect(result.actorUserId).toBeNull();
      expect(result.channel).toBe('system');
    });

    it('should enforce tenantId isolation when recording', async () => {
      await activityService.record({
        tenantId: 'tenant-1',
        actorUserId: 'user-1',
        channel: 'api' as ActivityChannel,
        action: 'create',
        resourceType: 'Trip',
        resourceId: 'trip-t1-001',
        occurredAt: new Date('2026-09-09T10:15:00Z'),
      });

      await activityService.record({
        tenantId: 'tenant-2',
        actorUserId: 'user-2',
        channel: 'api' as ActivityChannel,
        action: 'create',
        resourceType: 'Trip',
        resourceId: 'trip-t2-001',
        occurredAt: new Date('2026-09-09T10:20:00Z'),
      });

      // Verify isolation at DB level
      const tenant1Events = await prisma.activityEvent.findMany({
        where: { tenantId: 'tenant-1' },
      });
      const tenant2Events = await prisma.activityEvent.findMany({
        where: { tenantId: 'tenant-2' },
      });

      expect(tenant1Events.length).toBeGreaterThan(0);
      expect(tenant2Events.length).toBeGreaterThan(0);
      expect(tenant1Events.every((e) => e.tenantId === 'tenant-1')).toBe(true);
      expect(tenant2Events.every((e) => e.tenantId === 'tenant-2')).toBe(true);
    });
  });

  describe('ActivityService.list() - Query canonical activity', () => {
    beforeEach(async () => {
      // Seed activity for querying
      await prisma.activityEvent.deleteMany({});
      await activityService.record({
        tenantId: 'query-tenant-1',
        actorUserId: 'user-a',
        channel: 'api' as ActivityChannel,
        action: 'view',
        resourceType: 'Trip',
        resourceId: 'trip-001',
        occurredAt: new Date('2026-09-09T08:00:00Z'),
      });
      await activityService.record({
        tenantId: 'query-tenant-1',
        actorUserId: 'user-b',
        channel: 'web' as ActivityChannel,
        action: 'create',
        resourceType: 'Trip',
        resourceId: 'trip-002',
        occurredAt: new Date('2026-09-09T09:00:00Z'),
      });
      await activityService.record({
        tenantId: 'query-tenant-1',
        actorUserId: 'user-a',
        channel: 'api' as ActivityChannel,
        action: 'update',
        resourceType: 'Student',
        resourceId: 'student-001',
        occurredAt: new Date('2026-09-09T10:00:00Z'),
      });
    });

    it('should list all activity for a tenant', async () => {
      const result = await activityService.list({
        tenantId: 'query-tenant-1',
      });

      expect(result.total).toBeGreaterThanOrEqual(3);
      expect(result.events.length).toBeGreaterThan(0);
    });

    it('should filter activity by channel', async () => {
      const result = await activityService.list({
        tenantId: 'query-tenant-1',
        channel: 'api' as ActivityChannel,
      });

      expect(result.events.every((e) => e.channel === 'api')).toBe(true);
    });

    it('should filter activity by action', async () => {
      const result = await activityService.list({
        tenantId: 'query-tenant-1',
        action: 'view',
      });

      expect(result.events.every((e) => e.action === 'view')).toBe(true);
    });

    it('should filter activity by resourceType and resourceId', async () => {
      const result = await activityService.list({
        tenantId: 'query-tenant-1',
        resourceType: 'Trip',
        resourceId: 'trip-001',
      });

      expect(result.events.length).toBeGreaterThan(0);
      expect(result.events.every((e) => e.resourceType === 'Trip' && e.resourceId === 'trip-001')).toBe(true);
    });

    it('should filter activity by actorUserId', async () => {
      const result = await activityService.list({
        tenantId: 'query-tenant-1',
        actorUserId: 'user-a',
      });

      expect(result.events.every((e) => e.actorUserId === 'user-a')).toBe(true);
    });

    it('should return events in descending order by occurredAt', async () => {
      const result = await activityService.list({
        tenantId: 'query-tenant-1',
      });

      for (let i = 0; i < result.events.length - 1; i++) {
        expect(result.events[i].occurredAt.getTime()).toBeGreaterThanOrEqual(
          result.events[i + 1].occurredAt.getTime(),
        );
      }
    });

    it('should support pagination', async () => {
      const page1 = await activityService.list({
        tenantId: 'query-tenant-1',
        limit: 1,
        offset: 0,
      });

      const page2 = await activityService.list({
        tenantId: 'query-tenant-1',
        limit: 1,
        offset: 1,
      });

      expect(page1.events.length).toBeLessThanOrEqual(1);
      expect(page2.events.length).toBeLessThanOrEqual(1);
      if (page1.total > 1) {
        expect(page1.events[0].id).not.toBe(page2.events[0]?.id);
      }
    });
  });
});
