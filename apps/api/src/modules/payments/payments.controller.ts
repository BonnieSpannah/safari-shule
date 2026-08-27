import { Controller, Get, Param, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import type { Request } from 'express';
import { paginationQuery } from '@safari-shule/shared-types';
import { RequirePermission } from '../../rbac/permission.decorators';
import { Audited } from '../../audit/audit.decorators';
import { ZodBody, ZodQuery } from '../../common/validation/zod-pipe';
import { PaymentsService } from './payments.service';
import { RbacService } from '../../rbac/rbac.service';
import { resolveTenantScope } from '../../common/tenant/tenant-scope';
import { runWithBypass } from '../../common/context/request-context';

const fuelInitiate = z.object({
  fuelLogId: z.string().uuid(),
  amountKes: z.number().int().positive(),
  phoneE164: z.string().trim().regex(/^\+254[17]\d{8}$/, 'Must be a valid Kenyan mobile number, e.g. +254712345678'),
  description: z.string().max(120).default('Fuel payment'),
});

const repairInitiate = z.object({
  repairLogId: z.string().uuid(),
  amountKes: z.number().int().positive(),
  phoneE164: z.string().trim().regex(/^\+254[17]\d{8}$/, 'Must be a valid Kenyan mobile number, e.g. +254712345678'),
  description: z.string().max(120).default('Repair payment'),
});

const paymentsListQuery = paginationQuery.extend({
  status: z.enum(['initiated', 'succeeded', 'failed', 'cancelled']).optional(),
  purpose: z.enum(['fuel', 'repair']).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  tenantId: z.string().uuid().optional(),
});

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly svc: PaymentsService,
    private readonly rbac: RbacService,
  ) {}

  @Get()
  @RequirePermission('payments.view')
  async list(
    @Req() req: Request,
    @ZodQuery(paymentsListQuery) q: z.infer<typeof paymentsListQuery>,
  ) {
    const scope = await resolveTenantScope(this.rbac, req, q.tenantId);
    const run = () => this.svc.list({ ...q, scopeTenantId: scope.tenantId });
    return scope.isSuperAdmin ? runWithBypass(run) : run();
  }

  @Get(':id')
  @RequirePermission('payments.view')
  async one(
    @Req() req: Request,
    @Param('id') id: string,
    @ZodQuery(z.object({ tenantId: z.string().uuid().optional() })) q: { tenantId?: string },
  ) {
    const scope = await resolveTenantScope(this.rbac, req, q.tenantId);
    const run = () => this.svc.byId(id, scope.tenantId);
    return scope.isSuperAdmin ? runWithBypass(run) : run();
  }

  @Post('fuel/initiate')
  @RequirePermission('payments.initiate')
  @Audited({ action: 'mpesa.fuel.initiate', entityType: 'mpesa_transaction' })
  fuel(@ZodBody(fuelInitiate) body: z.infer<typeof fuelInitiate>) {
    return this.svc.initiate({ purpose: 'fuel', ...body });
  }

  @Post('repair/initiate')
  @RequirePermission('payments.initiate')
  @Audited({ action: 'mpesa.repair.initiate', entityType: 'mpesa_transaction' })
  repair(@ZodBody(repairInitiate) body: z.infer<typeof repairInitiate>) {
    return this.svc.initiate({ purpose: 'repair', ...body });
  }
}
