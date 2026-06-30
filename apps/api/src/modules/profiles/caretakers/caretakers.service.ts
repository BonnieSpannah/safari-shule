import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { requireTenantId } from '../../../common/context/request-context';
import { DynamicValidationService } from '../../attributes/dynamic-validation.service';
import { paginated, buildPagination } from '../../../common/pagination/pagination';
import { caretakerInput, type CaretakerInput, type PaginationQuery } from '@safari-shule/shared-types';

@Injectable()
export class CaretakersService {
  constructor(private readonly prisma: PrismaService, private readonly validator: DynamicValidationService) {}

  async list(q: PaginationQuery) {
    const where: any = {};
    if (q.q) where.legalName = { contains: q.q, mode: 'insensitive' };
    const [total, data] = await Promise.all([
      this.prisma.caretaker.count({ where }),
      this.prisma.caretaker.findMany({ where, ...buildPagination(q) }),
    ]);
    return paginated(data, total, q);
  }

  async byId(id: string) {
    const row = await this.prisma.caretaker.findFirst({ where: { id } });
    if (!row) throw new NotFoundException();
    return row;
  }

  async create(input: CaretakerInput) {
    const tenantId = requireTenantId();
    const parsed = caretakerInput.parse(input);
    const flex = await this.validator.validateAndNormalize(tenantId, 'caretaker', parsed.flexibleAttributes);
    return this.prisma.caretaker.create({
      data: {
        tenantId,
        legalName: parsed.legalName,
        phoneE164: parsed.phone,
        relationship: parsed.relationship,
        nationalId: parsed.nationalId ?? null,
        dateOfBirth: new Date(parsed.dateOfBirth),
        gender: parsed.gender as any,
        flexibleAttributes: flex as any,
      },
    });
  }

  async update(id: string, patch: Partial<CaretakerInput>) {
    const tenantId = requireTenantId();
    const existing = await this.prisma.caretaker.findFirst({ where: { id } });
    if (!existing) throw new NotFoundException();
    const flex = patch.flexibleAttributes
      ? await this.validator.validateAndNormalize(tenantId, 'caretaker', patch.flexibleAttributes)
      : undefined;
    return this.prisma.caretaker.update({
      where: { id },
      data: {
        ...(patch.legalName ? { legalName: patch.legalName } : {}),
        ...(patch.phone ? { phoneE164: patch.phone } : {}),
        ...(patch.relationship ? { relationship: patch.relationship } : {}),
        ...(patch.nationalId !== undefined ? { nationalId: patch.nationalId } : {}),
        ...(patch.dateOfBirth ? { dateOfBirth: new Date(patch.dateOfBirth) } : {}),
        ...(patch.gender ? { gender: patch.gender as any } : {}),
        ...(flex ? { flexibleAttributes: flex as any } : {}),
      },
    });
  }

  async remove(id: string) {
    await this.prisma.caretaker.delete({ where: { id } });
    return { id };
  }
}
