import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { requireTenantId, runWithBypass } from '../../common/context/request-context';
import {
  attributeDefinitionInput,
  type AttributeDefinitionInput,
  type ProfileEntityKind,
  paginationQuery,
  type PaginationQuery,
} from '@safari-shule/shared-types';

const CACHE_TTL = 300;

@Injectable()
export class AttributeDefinitionsService {
  constructor(private readonly prisma: PrismaService, private readonly redis: RedisService) {}

  async list(params: PaginationQuery & { targetEntity?: ProfileEntityKind }) {
    const tenantId = requireTenantId();
    const q = paginationQuery.parse(params);
    const where: any = { tenantId, archivedAt: null };
    if (params.targetEntity) where.targetEntity = params.targetEntity;
    if (q.q) where.label = { contains: q.q, mode: 'insensitive' };

    const [total, data] = await Promise.all([
      this.prisma.attributeDefinition.count({ where }),
      this.prisma.attributeDefinition.findMany({
        where,
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        orderBy: [{ targetEntity: 'asc' }, { sortOrder: 'asc' }, { slug: 'asc' }],
      }),
    ]);

    return {
      data,
      meta: { page: q.page, pageSize: q.pageSize, total, pageCount: Math.ceil(total / q.pageSize) },
    };
  }

  async listActiveFor(tenantId: string, targetEntity: ProfileEntityKind) {
    const cacheKey = `attrs:${tenantId}:${targetEntity}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);
    const rows = await runWithBypass(() =>
      this.prisma.attributeDefinition.findMany({
        where: { tenantId, targetEntity, archivedAt: null },
        orderBy: [{ sortOrder: 'asc' }, { slug: 'asc' }],
      }),
    );
    await this.redis.set(cacheKey, JSON.stringify(rows), 'EX', CACHE_TTL);
    return rows;
  }

  async create(input: AttributeDefinitionInput) {
    const tenantId = requireTenantId();
    const parsed = attributeDefinitionInput.parse(input);
    const created = await this.prisma.attributeDefinition.create({
      data: { ...parsed, tenantId, options: parsed.options as any },
    });
    await this.invalidate(tenantId, parsed.targetEntity);
    return created;
  }

  async update(id: string, patch: Partial<AttributeDefinitionInput>) {
    const tenantId = requireTenantId();
    const existing = await this.prisma.attributeDefinition.findFirst({ where: { id } });
    if (!existing) throw new NotFoundException();
    const updated = await this.prisma.attributeDefinition.update({
      where: { id },
      data: { ...patch, options: (patch.options ?? existing.options) as any },
    });
    await this.invalidate(tenantId, updated.targetEntity);
    return updated;
  }

  async archive(id: string) {
    const tenantId = requireTenantId();
    const row = await this.prisma.attributeDefinition.update({
      where: { id },
      data: { archivedAt: new Date() },
    });
    await this.invalidate(tenantId, row.targetEntity);
    return row;
  }

  private async invalidate(tenantId: string, target: ProfileEntityKind): Promise<void> {
    await this.redis.del(`attrs:${tenantId}:${target}`);
  }
}
