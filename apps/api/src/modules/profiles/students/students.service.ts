import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { requireTenantId } from '../../../common/context/request-context';
import { DynamicValidationService } from '../../attributes/dynamic-validation.service';
import { paginated, buildPagination } from '../../../common/pagination/pagination';
import {
  studentInput,
  type StudentInput,
  type PaginationQuery,
} from '@safari-shule/shared-types';

@Injectable()
export class StudentsService {
  constructor(private readonly prisma: PrismaService, private readonly validator: DynamicValidationService) {}

  async list(q: PaginationQuery & { gender?: string; classroom?: string; scopeTenantId?: string | null }) {
    const tenantId = q.scopeTenantId !== undefined ? q.scopeTenantId : requireTenantId();
    const where: any = tenantId ? { tenantId } : {};
    if (q.q) where.OR = [
      { legalName: { contains: q.q, mode: 'insensitive' } },
      { admissionNumber: { contains: q.q, mode: 'insensitive' } },
    ];
    if (q.gender) where.gender = q.gender;
    if (q.classroom) where.classroom = { contains: q.classroom, mode: 'insensitive' };
    const [total, data] = await Promise.all([
      this.prisma.student.count({ where }),
      this.prisma.student.findMany({ where, ...buildPagination(q), include: { tenant: { select: { id: true, name: true, slug: true } } } }),
    ]);
    return paginated(data, total, q);
  }

  async byId(id: string, sourceTenantId?: string) {
    const tenantId = sourceTenantId ?? requireTenantId();
    const row = await this.prisma.student.findFirst({
      where: { id, tenantId },
      include: { parents: { include: { parent: true } }, caretakers: { include: { caretaker: true } } },
    });
    if (!row) throw new NotFoundException();
    return row;
  }

  async create(input: StudentInput & { targetTenantId?: string }) {
    const tenantId = input.targetTenantId ?? requireTenantId();
    const parsed = studentInput.parse(input);
    const flex = await this.validator.validateAndNormalize(tenantId, 'student', parsed.flexibleAttributes);
    return this.prisma.student.create({
      data: {
        tenantId,
        admissionNumber: parsed.admissionNumber,
        legalName: parsed.legalName,
        birthCertificateNumber: parsed.birthCertificateNumber ?? null,
        classroom: parsed.classroom ?? null,
        dateOfBirth: new Date(parsed.dateOfBirth),
        gender: parsed.gender as any,
        flexibleAttributes: flex as any,
      },
    });
  }

  async update(id: string, patch: Partial<StudentInput> & { targetTenantId?: string; sourceTenantId?: string }) {
    // sourceTenantId = current tenant for lookup; targetTenantId = new tenant (may differ for reassignment)
    const lookupTenantId = patch.sourceTenantId ?? requireTenantId();
    const { targetTenantId, sourceTenantId: _s, ...fields } = patch;
    const existing = await this.prisma.student.findFirst({ where: { id, tenantId: lookupTenantId } });
    if (!existing) throw new NotFoundException();
    const activeTenantId = targetTenantId ?? lookupTenantId;
    const flex = fields.flexibleAttributes
      ? await this.validator.validateAndNormalize(activeTenantId, 'student', fields.flexibleAttributes)
      : undefined;
    return this.prisma.student.update({
      where: { id },
      data: {
        ...(targetTenantId && targetTenantId !== existing.tenantId ? { tenantId: targetTenantId } : {}),
        ...(fields.admissionNumber ? { admissionNumber: fields.admissionNumber } : {}),
        ...(fields.legalName ? { legalName: fields.legalName } : {}),
        ...(fields.birthCertificateNumber !== undefined ? { birthCertificateNumber: fields.birthCertificateNumber } : {}),
        ...(fields.classroom !== undefined ? { classroom: fields.classroom } : {}),
        ...(fields.dateOfBirth ? { dateOfBirth: new Date(fields.dateOfBirth) } : {}),
        ...(fields.gender ? { gender: fields.gender as any } : {}),
        ...(flex ? { flexibleAttributes: flex as any } : {}),
      },
    });
  }

  async remove(id: string) {
    await this.prisma.student.delete({ where: { id } });
    return { id };
  }
}
