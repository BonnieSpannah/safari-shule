import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { requireTenantId } from '../../../common/context/request-context';
import { DynamicValidationService } from '../../attributes/dynamic-validation.service';
import { paginated, buildPagination } from '../../../common/pagination/pagination';
import { parentInput, type ParentInput, type PaginationQuery } from '@safari-shule/shared-types';

@Injectable()
export class ParentsService {
  constructor(private readonly prisma: PrismaService, private readonly validator: DynamicValidationService) {}

  async list(q: PaginationQuery & { scopeTenantId?: string | null }) {
    const tenantId = q.scopeTenantId !== undefined ? q.scopeTenantId : requireTenantId();
    const where: any = tenantId ? { tenantId } : {};
    if (q.q) where.OR = [
      { legalName: { contains: q.q, mode: 'insensitive' } },
      { phoneE164: { contains: q.q } },
    ];
    const [total, data] = await Promise.all([
      this.prisma.parent.count({ where }),
      this.prisma.parent.findMany({ where, ...buildPagination(q), include: { tenant: { select: { id: true, name: true, slug: true } }, students: { include: { student: true } } } }),
    ]);
    return paginated(data, total, q);
  }

  async byId(id: string, sourceTenantId?: string) {
    const tenantId = sourceTenantId ?? requireTenantId();
    const row = await this.prisma.parent.findFirst({
      where: { id, tenantId },
      include: { students: { include: { student: true } } },
    });
    if (!row) throw new NotFoundException();
    return row;
  }

  async create(input: ParentInput & { targetTenantId?: string }) {
    const tenantId = input.targetTenantId ?? requireTenantId();
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

  async update(id: string, patch: Partial<ParentInput> & { targetTenantId?: string; sourceTenantId?: string }) {
    const lookupTenantId = patch.sourceTenantId ?? patch.targetTenantId ?? requireTenantId();
    const { targetTenantId, sourceTenantId: _s, ...fields } = patch;
    const existing = await this.prisma.parent.findFirst({ where: { id, tenantId: lookupTenantId } });
    if (!existing) throw new NotFoundException();
    const flex = fields.flexibleAttributes
      ? await this.validator.validateAndNormalize(lookupTenantId, 'parent', fields.flexibleAttributes)
      : undefined;
    return this.prisma.parent.update({
      where: { id },
      data: {
        ...(targetTenantId && targetTenantId !== existing.tenantId ? { tenantId: targetTenantId } : {}),
        ...(fields.legalName ? { legalName: fields.legalName } : {}),
        ...(fields.phone ? { phoneE164: fields.phone } : {}),
        ...(fields.email !== undefined ? { email: fields.email } : {}),
        ...(fields.nationalId !== undefined ? { nationalId: fields.nationalId } : {}),
        ...(fields.occupation !== undefined ? { occupation: fields.occupation } : {}),
        ...(fields.dateOfBirth ? { dateOfBirth: new Date(fields.dateOfBirth) } : {}),
        ...(fields.gender ? { gender: fields.gender as any } : {}),
        ...(flex ? { flexibleAttributes: flex as any } : {}),
      },
    });
  }

  async remove(id: string) {
    await this.prisma.parent.delete({ where: { id } });
    return { id };
  }

  async linkStudent(parentId: string, studentId: string, relation: 'mother' | 'father' | 'guardian' | 'other', isPrimary: boolean, sourceTenantId?: string) {
    const tenantId = sourceTenantId ?? requireTenantId();
    return this.prisma.parentStudent.create({
      data: { tenantId, parentId, studentId, relation: relation as any, isPrimary },
    });
  }
}
