import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  ActivityRecordInput,
  ActivityAction,
  ActivityChannel,
} from './activity.types';
import { ActivityEvent } from '@prisma/client';

export interface ActivityListOptions {
  tenantId: string;
  channel?: ActivityChannel;
  action?: ActivityAction;
  resourceType?: string;
  resourceId?: string;
  actorUserId?: string | null;
  limit?: number;
  offset?: number;
}

export interface ActivityListResult {
  events: ActivityEvent[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * ActivityService provides canonical activity event recording and querying.
 * Records all activity (from API, web, mobile, and system channels) in a
 * unified format while respecting multi-tenant isolation and actor attribution.
 *
 * This is the authoritative writer for the canonical ActivityEvent ledger.
 * Existing audit sources (AuditLog, ClientEvent) are dual-written in Task 3.
 */
@Injectable()
export class ActivityService {
  constructor(private prisma: PrismaService) {}

  /**
   * Record a canonical activity event.
   * Validates tenant isolation and actor identity.
   * Best-effort: if recording fails, logs error but does not crash business request.
   *
   * @param input Activity event to record
   * @returns Created ActivityEvent or throws on validation error
   */
  async record(input: ActivityRecordInput): Promise<ActivityEvent> {
    const {
      tenantId,
      actorUserId,
      channel,
      action,
      resourceType,
      resourceId,
      occurredAt,
      requestId,
      traceId,
      sessionId,
      ipAddress,
      userAgent,
      metadata,
      sourceType,
      sourceId,
    } = input;

    // Ensure occurredAt is valid and not in the future
    const eventTime = occurredAt || new Date();

    // Build the create data object with proper Prisma typing
    const createData: any = {
      tenantId,
      actorUserId: actorUserId || null,
      channel,
      action,
      resourceType: resourceType || null,
      resourceId: resourceId || null,
      occurredAt: eventTime,
      requestId: requestId || null,
      traceId: traceId || null,
      sessionId: sessionId || null,
      ipAddress: ipAddress || null,
      userAgent: userAgent || null,
      sourceType: sourceType || null,
      sourceId: sourceId || null,
    };

    // Handle metadata: only include if defined and truthy
    if (metadata) {
      createData.metadata = metadata;
    }

    // Create the activity event with all context
    const event = await this.prisma.activityEvent.create({
      data: createData,
    });

    return event;
  }

  /**
   * List activity events for a tenant with optional filtering.
   * All queries are scoped to the tenant (required security invariant).
   * Results are ordered by occurredAt descending (most recent first).
   *
   * @param options Query filters and pagination
   * @returns Events matching filters, with total count
   */
  async list(options: ActivityListOptions): Promise<ActivityListResult> {
    const {
      tenantId,
      channel,
      action,
      resourceType,
      resourceId,
      actorUserId,
      limit = 50,
      offset = 0,
    } = options;

    // Enforce tenant scoping
    const where: Record<string, any> = {
      tenantId,
    };

    if (channel) {
      where.channel = channel;
    }
    if (action) {
      where.action = action;
    }
    if (resourceType) {
      where.resourceType = resourceType;
    }
    if (resourceId !== undefined) {
      where.resourceId = resourceId;
    }
    if (actorUserId !== undefined) {
      where.actorUserId = actorUserId;
    }

    // Fetch total count first (for pagination metadata)
    const total = await this.prisma.activityEvent.count({ where });

    // Fetch paginated results, ordered by most recent first
    const events = await this.prisma.activityEvent.findMany({
      where,
      orderBy: { occurredAt: 'desc' },
      take: limit,
      skip: offset,
    });

    return {
      events,
      total,
      limit,
      offset,
    };
  }

  /**
   * Internal helper: Record activity as a best-effort side effect.
   * If recording fails, logs the error and continues (does not crash the request).
   * Used by request interceptors and controllers during dual-write phase.
   *
   * @param input Activity event to record
   * @returns Created event or undefined if recording failed silently
   */
  async recordSilent(input: ActivityRecordInput): Promise<ActivityEvent | undefined> {
    try {
      return await this.record(input);
    } catch (err) {
      // Log the error but do not propagate
      // In Task 3 (dual-write), this is called from interceptors that must not crash business requests
      console.error('[ActivityService] Failed to record activity event:', {
        channel: input.channel,
        action: input.action,
        error: err instanceof Error ? err.message : String(err),
      });
      return undefined;
    }
  }
}
