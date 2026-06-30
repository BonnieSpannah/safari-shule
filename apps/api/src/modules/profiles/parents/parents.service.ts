import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { requireTenantId } from '../../../common/context/request-context';
import { DynamicValidationService } from '../../attributes/dynamic-validation.service';
import { paginated, buildPagination } from '../../../common/pagination/pagination';
import { parentInput, type ParentInput, type PaginationQuery } from '@safari-shule/shared-types';

@Injectable()
export class ParentsService {
  constructor(private readonly prisma: PrismaService, private readonly validator: DynamicValidationService) {}

  async list(q: PaginationQuery) {
    const where: any = {};
    if (q.q) where.OR = [
      { legalName: { contains: q.q, mode: 'insensitive' } },
      { phoneE164: { contains: q.q } },
    ];
    const [total, data] = await Promise.all([
      this.prisma.parent.count({ where }),
      this.prisma.parent.findMany({ where, ...buildPagination(q), include: { students: { include: { student: true } } } }),
    ]);
    return paginated(data, total, q);
  }

  async byId(id: string) {
    const row = await this.prisma.parent.findFirst({
      where: { id },
      include: { students: { include: { student: true } } },
    });
    if (!row) throw new NotFoundException();
    return row;
  }

  async create(input: ParentInput) {
    const tenantId = requireTenantId();
    const parsed = parentInput.parse(input);
    const flex = await this.validator.validateAndNormalize(tenantId, 'parent', parsed.flexibleAttributes);
    return this.prisma.parent.create({
      data: {
        tenantId,
        legalName: parsed.legalName,
        phoneE164: parsed.phone,
        email: parsed.email ?? null,
        nationalId: parsed.nationalId ?? null,
        occupation: parsed.occupation ?? null,
        dateOfBirth: new Date(parsed.dateOfBirth),
        gender: parsed.gender as any,
        flexibleAttributes: flex as any,
      },
    });
  }

  async update(id: string, patch: Partial<ParentInput>) {
    const tenantId = requireTenantId();
    const existing = await this.prisma.parent.findFirst({ where: { id } });
    if (!existing) throw new NotFoundException();
    const flex = patch.flexibleAttributes
      ? await this.validator.validateAndNormalize(tenantId, 'parent', patch.flexibleAttributes)
      : undefined;
    return this.prisma.parent.update({
      where: { id },
      data: {
        ...(patch.legalName ? { legalName: patch.legalName } : {}),
        ...(patch.phone ? { phoneE164: patch.phone } : {}),
        ...(patch.email !== undefined ? { email: patch.email } : {}),
        ...(patch.nationalId !== undefined ? { nationalId: patch.nationalId } : {}),
        ...(patch.occupation !== undefined ? { occupation: patch.occupation } : {}),
        ...(patch.dateOfBirth ? { dateOfBirth: new Date(patch.dateOfBirth) } : {}),
        ...(patch.gender ? { gender: patch.gender as any } : {}),
        ...(flex ? { flexibleAttributes: flex as any } : {}),
      },
    });
  }

  async remove(id: string) {
    await this.prisma.parent.delete({ where: { id } });
    return { id };
  }

  async linkStudent(parentId: string, studentId: string, relation: 'mother' | 'father' | 'guardian' | 'other', isPrimary: boolean) {
    const tenantId = requireTenantId();
    return this.prisma.parentStudent.create({
      data: { tenantId, parentId, studentId, relation: relation as any, isPrimary },
    });
  }
}
