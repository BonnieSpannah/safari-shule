import { Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { RequirePermission } from '../../rbac/permission.decorators';
import { Audited } from '../../audit/audit.decorators';
import { ZodBody } from '../../common/validation/zod-pipe';
import { PaymentsService } from './payments.service';

const fuelInitiate = z.object({
  fuelLogId: z.string().uuid(),
  amountKes: z.number().int().positive(),
  phoneE164: z.string().regex(/^\+254[17]\d{8}$/),
  description: z.string().max(120).default('Fuel payment'),
});

const repairInitiate = z.object({
  repairLogId: z.string().uuid(),
  amountKes: z.number().int().positive(),
  phoneE164: z.string().regex(/^\+254[17]\d{8}$/),
  description: z.string().max(120).default('Repair payment'),
});

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly svc: PaymentsService) {}

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
