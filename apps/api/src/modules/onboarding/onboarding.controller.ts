import { Controller, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { Public } from '../../auth/public.decorator';
import { RequirePermission } from '../../rbac/permission.decorators';
import { Audited } from '../../audit/audit.decorators';
import { ZodBody } from '../../common/validation/zod-pipe';
import { OnboardingService } from './onboarding.service';
import { ROLE_KEYS } from '@safari-shule/shared-types';

const inviteSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(2),
  phone: z.string().trim().regex(/^\+254[17]\d{8}$/, 'Must be a valid Kenyan mobile number, e.g. +254712345678').optional(),
  roleKeys: z.array(z.enum(ROLE_KEYS as unknown as [string, ...string[]])).min(1),
});

const acceptSchema = z.object({
  password: z.string().min(10).max(72),
});

@ApiTags('onboarding')
@Controller()
export class OnboardingController {
  constructor(private readonly svc: OnboardingService) {}

  @Post('invitations')
  @RequirePermission('invitations.send')
  @Audited({ action: 'invitation.create', entityType: 'invitation' })
  invite(@ZodBody(inviteSchema) body: z.infer<typeof inviteSchema>) {
    return this.svc.invite(body as any);
  }

  @Public()
  @Post('invitations/:token/accept')
  accept(@Param('token') token: string, @ZodBody(acceptSchema) body: z.infer<typeof acceptSchema>) {
    return this.svc.accept(token, body.password);
  }
}
