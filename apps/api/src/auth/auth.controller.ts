import { Body, Controller, HttpCode, Post, UnauthorizedException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { ERROR_CODES } from '@safari-shule/shared-types';
import { Public } from '../rbac/permission.decorators';
import { ZodBody } from '../common/validation/zod-pipe';
import { AuthService } from './auth.service';
import { getContext } from '../common/context/request-context';
import { CommunicationsService } from '../comms/communications.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { runWithBypass } from '../common/context/request-context';

const loginSchema = z.object({
  email: z.string().email().transform((s) => s.toLowerCase()),
  password: z.string().min(6).max(200),
});

const refreshSchema = z.object({ refreshToken: z.string().min(20) });

const otpRequestSchema = z.object({
  phone: z.string().regex(/^\+254[17]\d{8}$/),
});

const otpVerifySchema = z.object({
  phone: z.string().regex(/^\+254[17]\d{8}$/),
  code: z.string().regex(/^\d{6}$/),
});

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly comms: CommunicationsService,
    private readonly prisma: PrismaService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(@ZodBody(loginSchema) body: z.infer<typeof loginSchema>) {
    const tenantId = getContext()?.tenantId;
    if (!tenantId) {
      throw new UnauthorizedException({ code: ERROR_CODES.TENANT_NOT_RESOLVED, message: 'Tenant required.' });
    }
    return this.auth.login(tenantId, body.email, body.password);
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  async refresh(@ZodBody(refreshSchema) body: z.infer<typeof refreshSchema>) {
    return this.auth.refresh(body.refreshToken);
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(@ZodBody(refreshSchema) body: z.infer<typeof refreshSchema>) {
    await this.auth.logout(body.refreshToken);
  }

  @Public()
  @Post('parent/otp/request')
  @HttpCode(202)
  async otpRequest(@ZodBody(otpRequestSchema) body: z.infer<typeof otpRequestSchema>) {
    const tenantId = getContext()?.tenantId;
    if (!tenantId) {
      throw new UnauthorizedException({ code: ERROR_CODES.TENANT_NOT_RESOLVED, message: 'Tenant required.' });
    }
    const code = await this.auth.issueOtp(tenantId, body.phone, 'parent_login');
    await this.comms.sendSms({
      tenantId,
      to: body.phone,
      templateId: 'parent.otp',
      body: `Your Safari Shule verification code is ${code}. Expires in 5 minutes.`,
      priority: 'high',
    });
    return { delivered: true };
  }

  @Public()
  @Post('parent/otp/verify')
  @HttpCode(200)
  async otpVerify(@ZodBody(otpVerifySchema) body: z.infer<typeof otpVerifySchema>) {
    const tenantId = getContext()?.tenantId;
    if (!tenantId) {
      throw new UnauthorizedException({ code: ERROR_CODES.TENANT_NOT_RESOLVED, message: 'Tenant required.' });
    }
    const ok = await this.auth.consumeOtp(tenantId, body.phone, 'parent_login', body.code);
    if (!ok) {
      throw new UnauthorizedException({ code: ERROR_CODES.INVALID_CREDENTIALS, message: 'Invalid or expired OTP.' });
    }
    const parent = await runWithBypass(() =>
      this.prisma.parent.findUnique({ where: { tenantId_phoneE164: { tenantId, phoneE164: body.phone } }, include: { tenant: false } } as any),
    );
    if (!parent?.userId) {
      throw new UnauthorizedException({ code: ERROR_CODES.INVALID_CREDENTIALS, message: 'No active parent account for that number.' });
    }
    const user = await runWithBypass(() => this.prisma.user.findUniqueOrThrow({ where: { id: parent.userId! } }));
    return this.auth.issueTokenPair(user);
  }
}
