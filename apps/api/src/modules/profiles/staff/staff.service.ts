import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { requireTenantId } from '../../../common/context/request-context';
import { DynamicValidationService } from '../../attributes/dynamic-validation.service';
import { paginated, buildPagination } from '../../../common/pagination/pagination';
import { staffInput, type StaffInput, type PaginationQuery } from '@safari-shule/shared-types';

@Injectable()
export class StaffService {
  constructor(private readonly prisma: PrismaService, private readonly validator: DynamicValidationService) {}

  async list(q: PaginationQuery) {
    const where: any = {};
    if (q.q) where.OR = [
      { legalName: { contains: q.q, mode: 'insensitive' } },
      { employeeNumber: { contains: q.q, mode: 'insensitive' } },
    ];
    const [total, data] = await Promise.all([
      this.prisma.staff.count({ where }),
      this.prisma.staff.findMany({ where, ...buildPagination(q) }),
    ]);
    return paginated(data, total, q);
  }

  async byId(id: string) {
    const row = await this.prisma.staff.findFirst({ where: { id } });
    if (!row) throw new NotFoundException();
    return row;
  }

  async create(input: StaffInput) {
    const tenantId = requireTenantId();
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

  async update(id: string, patch: Partial<StaffInput>) {
    const tenantId = requireTenantId();
    const existing = await this.prisma.staff.findFirst({ where: { id } });
    if (!existing) throw new NotFoundException();
    const flex = patch.flexibleAttributes
      ? await this.validator.validateAndNormalize(tenantId, 'staff', patch.flexibleAttributes)
      : undefined;
    return this.prisma.staff.update({
      where: { id },
      data: {
        ...(patch.employeeNumber ? { employeeNumber: patch.employeeNumber } : {}),
        ...(patch.legalName ? { legalName: patch.legalName } : {}),
        ...(patch.nationalId ? { nationalId: patch.nationalId } : {}),
        ...(patch.phone ? { phoneE164: patch.phone } : {}),
        ...(patch.email !== undefined ? { email: patch.email } : {}),
        ...(patch.position ? { position: patch.position } : {}),
        ...(patch.dateOfBirth ? { dateOfBirth: new Date(patch.dateOfBirth) } : {}),
        ...(patch.gender ? { gender: patch.gender as any } : {}),
        ...(flex ? { flexibleAttributes: flex as any } : {}),
      },
    });
  }

  async remove(id: string) {
    await this.prisma.staff.delete({ where: { id } });
    return { id };
  }
}
