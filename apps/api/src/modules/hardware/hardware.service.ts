import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { runWithBypass } from '../../common/context/request-context';
import { CommunicationsService } from '../../comms/communications.service';
import { renderTemplate } from '../../comms/templates/registry';

export interface RfidScanInput {
  tenantId: string;
  deviceDbId: string;
  tagUid: string;
  scannedAt: Date;
  rawPayload: unknown;
}

@Injectable()
export class HardwareService {
  private readonly logger = new Logger(HardwareService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly comms: CommunicationsService,
  ) {}

  async ingestScan(input: RfidScanInput) {
    return runWithBypass(async () => {
      const tag = await this.prisma.rfidTag.findUnique({
        where: { tenantId_tagUid: { tenantId: input.tenantId, tagUid: input.tagUid } },
        include: { student: true },
      });
      if (!tag || tag.revokedAt) {
        await this.prisma.unknownTagScan.create({
          data: {
            tenantId: input.tenantId,
            deviceId: input.deviceDbId,
            tagUid: input.tagUid,
            scannedAt: input.scannedAt,
          },
        });
        throw new NotFoundException({ code: 'UNKNOWN_TAG', tagUid: input.tagUid });
      }
      const device = await this.prisma.rfidDevice.findUniqueOrThrow({ where: { id: input.deviceDbId } });
      if (!device.vehicleId) {
        throw new NotFoundException({ code: 'DEVICE_NOT_LINKED_TO_VEHICLE' });
      }
      const activeTrip = await this.prisma.trip.findFirst({
        where: { tenantId: input.tenantId, vehicleId: device.vehicleId, status: 'in_progress' },
        orderBy: { startedAt: 'desc' },
      });
      if (!activeTrip) {
        throw new NotFoundException({ code: 'NO_ACTIVE_TRIP_FOR_DEVICE' });
      }

      const lastEvent = await this.prisma.attendanceEvent.findFirst({
        where: { tripId: activeTrip.id, studentId: tag.studentId },
        orderBy: { scannedAt: 'desc' },
      });
      const direction: 'boarding' | 'alighting' =
        !lastEvent || lastEvent.direction === 'alighting' ? 'boarding' : 'alighting';

      const event = await this.prisma.attendanceEvent.create({
        data: {
          tenantId: input.tenantId,
          tripId: activeTrip.id,
          studentId: tag.studentId,
          tagId: tag.id,
          deviceId: input.deviceDbId,
          direction: direction as any,
          scannedAt: input.scannedAt,
          rawPayload: input.rawPayload as any,
        },
      });

      const vehicle = await this.prisma.vehicle.findUnique({ where: { id: activeTrip.vehicleId } });
      const tpl = renderTemplate(
        direction === 'boarding' ? 'student.boarded' : 'student.alighted',
        {
          studentName: tag.student.legalName,
          vehicleReg: vehicle?.registration ?? 'unknown',
          time: input.scannedAt.toISOString(),
          location: '',
        },
      );

      const links = await this.prisma.parentStudent.findMany({
        where: { studentId: tag.studentId },
        include: { parent: true },
      });
      let queued = 0;
      for (const link of links) {
        if (link.parent.phoneE164) {
          await this.comms.sendSms({
            tenantId: input.tenantId,
            to: link.parent.phoneE164,
            templateId: direction === 'boarding' ? 'student.boarded' : 'student.alighted',
            body: tpl.body,
          });
          queued += 1;
        }
      }

      return {
        eventId: event.id,
        direction,
        studentId: tag.studentId,
        tripId: activeTrip.id,
        notificationsQueued: queued,
      };
    });
  }

  async ingestGps(input: {
    tenantId: string;
    vehicleId: string;
    lat: number;
    lng: number;
    headingDeg: number | null;
    speedKph: number | null;
    recordedAt: Date;
  }) {
    return runWithBypass(async () => {
      const activeTrip = await this.prisma.trip.findFirst({
        where: { tenantId: input.tenantId, vehicleId: input.vehicleId, status: 'in_progress' },
        orderBy: { startedAt: 'desc' },
      });
      if (!activeTrip) return { stored: false, reason: 'NO_ACTIVE_TRIP' as const };
      await this.prisma.$executeRaw`
        INSERT INTO trip_location_snapshots
          (id, tenant_id, trip_id, speed_kph, heading_deg, recorded_at, location)
        VALUES (
          gen_random_uuid(),
          ${input.tenantId}::uuid,
          ${activeTrip.id}::uuid,
          ${input.speedKph ?? 0},
          ${input.headingDeg ?? 0},
          ${input.recordedAt},
          ST_SetSRID(ST_MakePoint(${input.lng}, ${input.lat}), 4326)::geography
        );
      `;
      return { stored: true as const, tripId: activeTrip.id };
    });
  }
}
