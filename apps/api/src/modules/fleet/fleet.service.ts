import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { paginated, buildPagination } from '../../common/pagination/pagination';
import { requireTenantId } from '../../common/context/request-context';
import type {
  VehicleInput,
  FuelLogInput,
  RepairLogInput,
  InsuranceRecordInput,
  PaginationQuery,
} from '@safari-shule/shared-types';

@Injectable()
export class FleetService {
  constructor(private readonly prisma: PrismaService) {}

  async listVehicles(q: PaginationQuery) {
    const where: any = {};
    if (q.q)
      where.OR = [
        { registration: { contains: q.q, mode: 'insensitive' } },
        { make: { contains: q.q, mode: 'insensitive' } },
        { model: { contains: q.q, mode: 'insensitive' } },
      ];
    const [total, data] = await Promise.all([
      this.prisma.vehicle.count({ where }),
      this.prisma.vehicle.findMany({ where, ...buildPagination(q) }),
    ]);
    return paginated(data, total, q);
  }

  async vehicle(id: string) {
    const row = await this.prisma.vehicle.findFirst({ where: { id } });
    if (!row) throw new NotFoundException();
    return row;
  }

  createVehicle(input: VehicleInput) {
    const tenantId = requireTenantId();
    return this.prisma.vehicle.create({
      data: {
        tenantId,
        registration: input.registration,
        make: input.make,
        model: input.model,
        year: input.year,
        capacity: input.capacity,
        ownership: input.ownership as any,
        status: input.status as any,
        assignedDriverId: input.assignedDriverId ?? null,
        assignedAssistantId: input.assignedAssistantId ?? null,
        odometerKm: input.odometerKm,
      },
    });
  }

  updateVehicle(id: string, patch: Partial<VehicleInput>) {
    return this.prisma.vehicle.update({
      where: { id },
      data: {
        ...(patch.registration ? { registration: patch.registration } : {}),
        ...(patch.make ? { make: patch.make } : {}),
        ...(patch.model ? { model: patch.model } : {}),
        ...(patch.year !== undefined ? { year: patch.year } : {}),
        ...(patch.capacity !== undefined ? { capacity: patch.capacity } : {}),
        ...(patch.ownership ? { ownership: patch.ownership as any } : {}),
        ...(patch.status ? { status: patch.status as any } : {}),
        ...(patch.assignedDriverId !== undefined ? { assignedDriverId: patch.assignedDriverId } : {}),
        ...(patch.assignedAssistantId !== undefined ? { assignedAssistantId: patch.assignedAssistantId } : {}),
        ...(patch.odometerKm !== undefined ? { odometerKm: patch.odometerKm } : {}),
      },
    });
  }

  async deleteVehicle(id: string) {
    await this.prisma.vehicle.delete({ where: { id } });
    return { id };
  }

  listFuel(vehicleId: string) {
    return this.prisma.fuelLog.findMany({
      where: { vehicleId },
      orderBy: { occurredAt: 'desc' },
      take: 200,
    });
  }

  addFuel(input: FuelLogInput) {
    const tenantId = requireTenantId();
    return this.prisma.fuelLog.create({
      data: {
        tenantId,
        vehicleId: input.vehicleId,
        driverUserId: input.driverUserId,
        liters: input.liters as any,
        costKes: input.costKes,
        station: input.station,
        odometerKm: input.odometerKm,
        occurredAt: new Date(input.occurredAt),
      },
    });
  }

  listRepairs(vehicleId: string) {
    return this.prisma.repairLog.findMany({
      where: { vehicleId },
      orderBy: { occurredOn: 'desc' },
      take: 200,
    });
  }

  addRepair(input: RepairLogInput) {
    const tenantId = requireTenantId();
    return this.prisma.repairLog.create({
      data: {
        tenantId,
        vehicleId: input.vehicleId,
        reportedByUserId: input.reportedByUserId,
        description: input.description,
        vendor: input.vendor,
        costKes: input.costKes,
        occurredOn: new Date(input.occurredOn),
      },
    });
  }

  approveRepair(id: string, approvalUserId: string) {
    return this.prisma.repairLog.update({
      where: { id },
      data: { status: 'approved' as any, approvalUserId },
    });
  }

  listInsurance(vehicleId: string) {
    return this.prisma.insuranceRecord.findMany({
      where: { vehicleId },
      orderBy: { expiresOn: 'desc' },
    });
  }

  addInsurance(input: InsuranceRecordInput) {
    const tenantId = requireTenantId();
    return this.prisma.insuranceRecord.create({
      data: {
        tenantId,
        vehicleId: input.vehicleId,
        provider: input.provider,
        policyNumber: input.policyNumber,
        premiumKes: input.premiumKes,
        startsOn: new Date(input.startsOn),
        expiresOn: new Date(input.expiresOn),
        documentUrl: input.documentUrl ?? null,
      },
    });
  }

  async ledger(vehicleId: string) {
    const [vehicle, fuel, repairs] = await Promise.all([
      this.prisma.vehicle.findUnique({ where: { id: vehicleId } }),
      this.prisma.fuelLog.findMany({ where: { vehicleId }, orderBy: { occurredAt: 'desc' } }),
      this.prisma.repairLog.findMany({ where: { vehicleId }, orderBy: { occurredOn: 'desc' } }),
    ]);
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    const entries = [
      ...fuel.map((f) => ({
        type: 'fuel' as const,
        id: f.id,
        date: f.occurredAt,
        amountKes: f.costKes,
        description: `Fuel: ${f.liters.toString()}L at ${f.station}`,
        paymentStatus: f.paymentStatus,
      })),
      ...repairs.map((r) => ({
        type: 'repair' as const,
        id: r.id,
        date: r.occurredOn,
        amountKes: r.costKes,
        description: `Repair: ${r.description}`,
        paymentStatus: r.status,
      })),
    ].sort((a, b) => b.date.getTime() - a.date.getTime());
    const totalKes = entries.reduce((sum, e) => sum + e.amountKes, 0);
    return { vehicle, entries, totalKes };
  }
}
