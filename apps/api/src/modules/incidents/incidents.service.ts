import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CommunicationsService } from '../../comms/communications.service';
import { TripGateway } from '../telemetry/trip.gateway';
import { paginated, buildPagination } from '../../common/pagination/pagination';
import { getContext, requireTenantId, runWithBypass } from '../../common/context/request-context';
import { renderTemplate } from '../../comms/templates/registry';
import type { IncidentInput, LatLng, PaginationQuery } from '@safari-shule/shared-types';

@Injectable()
export class IncidentsService {
  private readonly logger = new Logger(IncidentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly comms: CommunicationsService,
    private readonly gateway: TripGateway,
  ) {}

  async list(q: PaginationQuery & { status?: string; tripId?: string }) {
    const where: any = {};
    if (q.status) where.status = q.status as any;
    if (q.tripId) where.tripId = q.tripId;
    const [total, data] = await Promise.all([
      this.prisma.incident.count({ where }),
      this.prisma.incident.findMany({
        where,
        ...buildPagination(q),
        orderBy: { occurredAt: 'desc' },
      }),
    ]);
    return paginated(data, total, q);
  }

  async create(input: IncidentInput) {
    const tenantId = requireTenantId();
    const reportedByUserId = getContext()?.userId ?? null;
    const id = randomUUID();
    const occurredAt = input.occurredAt ? new Date(input.occurredAt) : new Date();
    if (input.location) {
      await this.prisma.$executeRaw`
        INSERT INTO incidents
          (id, tenant_id, trip_id, kind, severity, status, reported_by_user_id, description, location, occurred_at, created_at, updated_at)
        VALUES (
          ${id}::uuid,
          ${tenantId}::uuid,
          ${input.tripId}::uuid,
          ${input.kind}::"IncidentKind",
          ${input.severity}::"IncidentSeverity",
          'reported'::"IncidentStatus",
          ${reportedByUserId}::uuid,
          ${input.description},
          ST_SetSRID(ST_MakePoint(${input.location.lng}, ${input.location.lat}), 4326)::geography,
          ${occurredAt},
          NOW(),
          NOW()
        );
      `;
    } else {
      await this.prisma.$executeRaw`
        INSERT INTO incidents
          (id, tenant_id, trip_id, kind, severity, status, reported_by_user_id, description, occurred_at, created_at, updated_at)
        VALUES (
          ${id}::uuid,
          ${tenantId}::uuid,
          ${input.tripId}::uuid,
          ${input.kind}::"IncidentKind",
          ${input.severity}::"IncidentSeverity",
          'reported'::"IncidentStatus",
          ${reportedByUserId}::uuid,
          ${input.description},
          ${occurredAt},
          NOW(),
          NOW()
        );
      `;
    }
    return { id };
  }

  async acknowledge(id: string) {
    return this.prisma.incident.update({
      where: { id },
      data: { status: 'acknowledged' as any, acknowledgedAt: new Date() },
    });
  }

  async resolve(id: string, resolution: string) {
    return this.prisma.incident.update({
      where: { id },
      data: { status: 'resolved' as any, resolvedAt: new Date(), resolutionNotes: resolution },
    });
  }

  async sos(input: { tripId: string; location: LatLng; description?: string }) {
    const tenantId = requireTenantId();
    const trip = await this.prisma.trip.findFirst({
      where: { id: input.tripId },
      include: { vehicle: true, route: true },
    });
    if (!trip) throw new NotFoundException();

    const incidentInput: IncidentInput = {
      tripId: trip.id,
      kind: 'sos',
      severity: 'critical',
      description: input.description ?? `SOS triggered for trip ${trip.id}`,
      location: input.location,
      occurredAt: new Date().toISOString(),
    };

    const [persistRes, broadcastRes, notifyRes] = await Promise.allSettled([
      this.create(incidentInput),
      Promise.resolve().then(() =>
        this.gateway.broadcastIncident(tenantId, trip.id, {
          kind: 'sos',
          tripId: trip.id,
          location: input.location,
          occurredAt: new Date().toISOString(),
        }),
      ),
      runWithBypass(async () => {
        const tpl = renderTemplate('sos.alert', {
          tripDescription: `${trip.route?.name ?? 'route'} on ${trip.vehicle?.registration ?? 'vehicle'}`,
          reportedBy: getContext()?.userId ?? 'system',
          location: `${input.location.lat.toFixed(5)},${input.location.lng.toFixed(5)}`,
        });
        return this.comms.sendUrgentSmsToEmergencyContacts(tenantId, tpl.body);
      }),
    ]);

    return {
      incident: legStatus(persistRes),
      broadcast: legStatus(broadcastRes),
      notifications: legStatus(notifyRes),
    };
  }
}

function legStatus<T>(r: PromiseSettledResult<T>) {
  return r.status === 'fulfilled'
    ? { ok: true, value: r.value }
    : { ok: false, error: r.reason instanceof Error ? r.reason.message : String(r.reason) };
}
