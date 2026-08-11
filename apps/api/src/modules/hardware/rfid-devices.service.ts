import { Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { paginated, buildPagination } from '../../common/pagination/pagination';
import { requireTenantId } from '../../common/context/request-context';
import { encryptSecret, sha256 } from '../../common/crypto/secret-encryption';
import type { PaginationQuery } from '@safari-shule/shared-types';

@Injectable()
export class RfidDevicesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(q: PaginationQuery & { status?: string; scopeTenantId?: string | null }) {
    const tenantId = q.scopeTenantId !== undefined ? q.scopeTenantId : requireTenantId();
    const where: any = tenantId ? { tenantId } : {};
    if (q.q) where.deviceId = { contains: q.q, mode: 'insensitive' };
    if (q.status) where.status = q.status;
    const [total, data] = await Promise.all([
      this.prisma.rfidDevice.count({ where }),
      this.prisma.rfidDevice.findMany({
        where,
        ...buildPagination(q),
        include: {
          vehicle: { select: { registration: true, make: true, model: true } },
          tenant: { select: { id: true, name: true, slug: true } },
        },
      }),
    ]);
    return paginated(data, total, q);
  }

  async register(input: { deviceId: string; vehicleId?: string | null }) {
    const tenantId = requireTenantId();
    const apiKey = randomBytes(24).toString('hex');
    const hmacSecret = randomBytes(32).toString('hex');

    const created = await this.prisma.rfidDevice.create({
      data: {
        tenantId,
        deviceId: input.deviceId,
        vehicleId: input.vehicleId ?? null,
        apiKeyHash: sha256(apiKey),
        hmacSecretEncrypted: encryptSecret(hmacSecret),
        status: 'active',
      },
    });

    // id is included so the AuditInterceptor can record the entity UUID.
    // Plain secrets are returned ONCE — caller must store them; never shown again.
    return { id: created.id, deviceId: input.deviceId, apiKey, hmacSecret };
  }

  async setStatus(id: string, status: 'active' | 'rotating' | 'disabled') {
    const tenantId = requireTenantId();
    return this.prisma.rfidDevice.update({
      where: { id, tenantId },
      data: { status },
    });
  }
}
