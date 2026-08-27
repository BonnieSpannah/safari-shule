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

  async listVehicles(q: PaginationQuery & { status?: string; ownership?: string; scopeTenantId?: string | null }) {
    const tenantId = q.scopeTenantId !== undefined ? q.scopeTenantId : requireTenantId();
    const where: any = tenantId ? { tenantId } : {};
    if (q.q)
      where.OR = [
        { registration: { contains: q.q, mode: 'insensitive' } },
        { make: { contains: q.q, mode: 'insensitive' } },
        { model: { contains: q.q, mode: 'insensitive' } },
      ];
    if (q.status) where.status = q.status;
    if (q.ownership) where.ownership = q.ownership;
    const [total, data] = await Promise.all([
      this.prisma.vehicle.count({ where }),
      this.prisma.vehicle.findMany({ where, ...buildPagination(q), include: { tenant: { select: { id: true, name: true, slug: true } } } }),
    ]);
    return paginated(data, total, q);
  }

  async vehicle(id: string) {
    const row = await this.prisma.vehicle.findFirst({ where: { id, tenantId: requireTenantId() } });
    if (!row) throw new NotFoundException();
    return row;
  }

  createVehicle(input: VehicleInput & { targetTenantId?: string }) {
    const tenantId = input.targetTenantId ?? requireTenantId();
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

  updateVehicle(id: string, patch: Partial<VehicleInput> & { targetTenantId?: string }) {
    const { targetTenantId, ...fields } = patch;
    return this.prisma.vehicle.update({
      where: { id },
      data: {
        ...(targetTenantId ? { tenantId: targetTenantId } : {}),
        ...(fields.registration ? { registration: fields.registration } : {}),
        ...(fields.make ? { make: fields.make } : {}),
        ...(fields.model ? { model: fields.model } : {}),
        ...(fields.year !== undefined ? { year: fields.year } : {}),
        ...(fields.capacity !== undefined ? { capacity: fields.capacity } : {}),
        ...(fields.ownership ? { ownership: fields.ownership as any } : {}),
        ...(fields.status ? { status: fields.status as any } : {}),
        ...(fields.assignedDriverId !== undefined ? { assignedDriverId: fields.assignedDriverId } : {}),
        ...(fields.assignedAssistantId !== undefined ? { assignedAssistantId: fields.assignedAssistantId } : {}),
        ...(fields.odometerKm !== undefined ? { odometerKm: fields.odometerKm } : {}),
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
