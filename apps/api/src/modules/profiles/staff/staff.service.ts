import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { requireTenantId } from '../../../common/context/request-context';
import { DynamicValidationService } from '../../attributes/dynamic-validation.service';
import { paginated, buildPagination } from '../../../common/pagination/pagination';
import { staffInput, type StaffInput, type PaginationQuery } from '@safari-shule/shared-types';

@Injectable()
export class StaffService {
  constructor(private readonly prisma: PrismaService, private readonly validator: DynamicValidationService) {}

  async list(q: PaginationQuery & { scopeTenantId?: string | null }) {
    const tenantId = q.scopeTenantId !== undefined ? q.scopeTenantId : requireTenantId();
    const where: any = tenantId ? { tenantId } : {};
    if (q.q) where.OR = [
      { legalName: { contains: q.q, mode: 'insensitive' } },
      { employeeNumber: { contains: q.q, mode: 'insensitive' } },
    ];
    const [total, data] = await Promise.all([
      this.prisma.staff.count({ where }),
      this.prisma.staff.findMany({ where, ...buildPagination(q), include: { tenant: { select: { id: true, name: true, slug: true } }, user: { select: { id: true, email: true } } } }),
    ]);
    return paginated(data, total, q);
  }

  async byId(id: string) {
    const row = await this.prisma.staff.findFirst({ where: { id, tenantId: requireTenantId() } });
    if (!row) throw new NotFoundException();
    return row;
  }

  async create(input: StaffInput & { targetTenantId?: string }) {
    const tenantId = input.targetTenantId ?? requireTenantId();
    const parsed = staffInput.parse(input);
    const flex = await this.validator.validateAndNormalize(tenantId, 'staff', parsed.flexibleAttributes);
    return this.prisma.staff.create({
      data: {
        tenantId,
        employeeNumber: parsed.employeeNumber,
        legalName: parsed.legalName,
        nationalId: parsed.nationalId,
        phoneE164: parsed.phone,
        email: parsed.email ?? null,
        position: parsed.position,
        dateOfBirth: new Date(parsed.dateOfBirth),
        gender: parsed.gender as any,
        flexibleAttributes: flex as any,
      },
    });
  }

  async update(id: string, patch: Partial<StaffInput> & { targetTenantId?: string; sourceTenantId?: string }) {
    const lookupTenantId = patch.sourceTenantId ?? requireTenantId();
    const { targetTenantId, sourceTenantId: _s, ...fields } = patch;
    const existing = await this.prisma.staff.findFirst({ where: { id, tenantId: lookupTenantId } });
    if (!existing) throw new NotFoundException();
    const flex = fields.flexibleAttributes
      ? await this.validator.validateAndNormalize(lookupTenantId, 'staff', fields.flexibleAttributes)
      : undefined;
    return this.prisma.staff.update({
      where: { id },
      data: {
        ...(targetTenantId && targetTenantId !== existing.tenantId ? { tenantId: targetTenantId } : {}),
        ...(fields.employeeNumber ? { employeeNumber: fields.employeeNumber } : {}),
        ...(fields.legalName ? { legalName: fields.legalName } : {}),
        ...(fields.nationalId ? { nationalId: fields.nationalId } : {}),
        ...(fields.phone ? { phoneE164: fields.phone } : {}),
        ...(fields.email !== undefined ? { email: fields.email } : {}),
        ...(fields.position ? { position: fields.position } : {}),
        ...(fields.dateOfBirth ? { dateOfBirth: new Date(fields.dateOfBirth) } : {}),
        ...(fields.gender ? { gender: fields.gender as any } : {}),
        ...(flex ? { flexibleAttributes: flex as any } : {}),
      },
    });
  }

  async remove(id: string) {
    await this.prisma.staff.delete({ where: { id } });
    return { id };
  }
}
