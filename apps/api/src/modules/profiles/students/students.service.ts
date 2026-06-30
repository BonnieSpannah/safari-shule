import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { requireTenantId } from '../../../common/context/request-context';
import { DynamicValidationService } from '../../attributes/dynamic-validation.service';
import { paginated, buildPagination } from '../../../common/pagination/pagination';
import {
  studentInput,
  type StudentInput,
  paginationQuery,
  type PaginationQuery,
} from '@safari-shule/shared-types';

@Injectable()
export class StudentsService {
  constructor(private readonly prisma: PrismaService, private readonly validator: DynamicValidationService) {}

  async list(q: PaginationQuery) {
    const tenantId = requireTenantId();
    const where: any = { tenantId };
    if (q.q) where.OR = [
      { legalName: { contains: q.q, mode: 'insensitive' } },
      { admissionNumber: { contains: q.q, mode: 'insensitive' } },
    ];
    const [total, data] = await Promise.all([
      this.prisma.student.count({ where }),
      this.prisma.student.findMany({ where, ...buildPagination(q) }),
    ]);
    return paginated(data, total, q);
  }

  async byId(id: string) {
    const row = await this.prisma.student.findFirst({
      where: { id },
      include: { parents: { include: { parent: true } }, caretakers: { include: { caretaker: true } } },
    });
    if (!row) throw new NotFoundException();
    return row;
  }

  async create(input: StudentInput) {
    const tenantId = requireTenantId();
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

  async update(id: string, patch: Partial<StudentInput>) {
    const tenantId = requireTenantId();
    const existing = await this.prisma.student.findFirst({ where: { id } });
    if (!existing) throw new NotFoundException();
    const flex = patch.flexibleAttributes
      ? await this.validator.validateAndNormalize(tenantId, 'student', patch.flexibleAttributes)
      : undefined;
    return this.prisma.student.update({
      where: { id },
      data: {
        ...(patch.admissionNumber ? { admissionNumber: patch.admissionNumber } : {}),
        ...(patch.legalName ? { legalName: patch.legalName } : {}),
        ...(patch.birthCertificateNumber !== undefined ? { birthCertificateNumber: patch.birthCertificateNumber } : {}),
        ...(patch.classroom !== undefined ? { classroom: patch.classroom } : {}),
        ...(patch.dateOfBirth ? { dateOfBirth: new Date(patch.dateOfBirth) } : {}),
        ...(patch.gender ? { gender: patch.gender as any } : {}),
        ...(flex ? { flexibleAttributes: flex as any } : {}),
      },
    });
  }

  async remove(id: string) {
    await this.prisma.student.delete({ where: { id } });
    return { id };
  }
}
