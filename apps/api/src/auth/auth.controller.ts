import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import type { Request } from 'express';
import {
  ERROR_CODES,
  changePasswordSchema,
  forgotPasswordSchema,
  passwordSchema,
  preferencesSchema,
  updateProfileSchema,
} from '@safari-shule/shared-types';
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

const revokeAllSessionsSchema = z.object({
  keepCurrent: z.boolean().default(true),
  currentRefreshToken: z.string().min(20).optional(),
});

const preferencesPatchSchema = preferencesSchema.deepPartial();

function requireUserId(req: Request): string {
  const claim = (req as unknown as { user?: { sub?: string; userId?: string } }).user;
  const id = claim?.sub ?? claim?.userId;
  if (!id) {
    throw new UnauthorizedException({
      code: ERROR_CODES.INVALID_CREDENTIALS,
      message: 'No session.',
    });
  }
  return id;
}

function extractMeta(req: Request): { ipAddress: string | null; userAgent: string | null } {
  const forwarded = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim();
  const ip = forwarded || req.ip || (req.socket?.remoteAddress ?? null);
  const ua = (req.headers['user-agent'] as string | undefined) ?? null;
  return { ipAddress: ip ?? null, userAgent: ua };
}

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
  async login(@ZodBody(loginSchema) body: z.infer<typeof loginSchema>, @Req() req: Request) {
    const tenantId = getContext()?.tenantId;
    if (!tenantId) {
      throw new UnauthorizedException({ code: ERROR_CODES.TENANT_NOT_RESOLVED, message: 'Tenant required.' });
    }
    return this.auth.login(tenantId, body.email, body.password, extractMeta(req));
  }

  /**
   * Return the caller's identity + roles + permissions + preferences.
   * Requires a valid JWT (no @Public). Used by the web to build
   * permission-aware navigation, profile screens, and preference wiring.
   */
  @Get('me')
  @HttpCode(200)
  async me(@Req() req: Request) {
    return this.auth.getMe(requireUserId(req));
  }

  /** Update mutable profile fields (fullName, phoneE164). Email is locked. */
  @Patch('me')
  @HttpCode(200)
  async updateMe(
    @Req() req: Request,
    @ZodBody(updateProfileSchema) body: z.infer<typeof updateProfileSchema>,
  ) {
    return this.auth.updateProfile(requireUserId(req), body);
  }

  /** Change own password (requires current password + history check). */
  @Post('me/password')
  @HttpCode(200)
  async changePassword(
    @Req() req: Request,
    @ZodBody(changePasswordSchema) body: z.infer<typeof changePasswordSchema>,
  ) {
    return this.auth.changePassword(
      requireUserId(req),
      body.currentPassword,
      body.newPassword,
      { reason: 'self', revokeOtherSessions: false },
    );
  }

  /** List the caller's active refresh tokens (sessions). */
  @Get('me/sessions')
  @HttpCode(200)
  async listSessions(@Req() req: Request) {
    const currentHashHeader = req.header('x-refresh-token-hash') ?? null;
    return { sessions: await this.auth.listSessions(requireUserId(req), currentHashHeader) };
  }

  @Delete('me/sessions/:id')
  @HttpCode(200)
  async revokeSession(@Req() req: Request, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.auth.revokeSession(requireUserId(req), id);
  }

  @Post('me/sessions/revoke-all')
  @HttpCode(200)
  async revokeAllSessions(
    @Req() req: Request,
    @ZodBody(revokeAllSessionsSchema) body: z.infer<typeof revokeAllSessionsSchema>,
  ) {
    const exceptHash =
      body.keepCurrent && body.currentRefreshToken
        ? this.auth.hashToken(body.currentRefreshToken)
        : null;
    return this.auth.revokeAllSessions(requireUserId(req), exceptHash);
  }

  @Get('me/preferences')
  @HttpCode(200)
  async getPreferences(@Req() req: Request) {
    return this.auth.getPreferences(requireUserId(req));
  }

  @Patch('me/preferences')
  @HttpCode(200)
  async updatePreferences(
    @Req() req: Request,
    @ZodBody(preferencesPatchSchema) body: z.infer<typeof preferencesPatchSchema>,
  ) {
    return this.auth.updatePreferences(requireUserId(req), body);
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  async refresh(@ZodBody(refreshSchema) body: z.infer<typeof refreshSchema>, @Req() req: Request) {
    return this.auth.refresh(body.refreshToken, extractMeta(req));
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(@ZodBody(refreshSchema) body: z.infer<typeof refreshSchema>) {
    await this.auth.logout(body.refreshToken);
  }

  // -------------------------------------------------------------------------
  //  Forgot / reset / activate — public, token-based
  // -------------------------------------------------------------------------

  @Public()
  @Post('forgot-password')
  @HttpCode(202)
  async forgotPassword(
    @ZodBody(forgotPasswordSchema) body: z.infer<typeof forgotPasswordSchema>,
    @Req() req: Request,
  ) {
    const webUrl = req.headers.origin as string | undefined;
    return this.auth.forgotPassword(body.tenantSlug, body.email, { webUrl });
  }

  @Public()
  @Post('reset-password')
  @HttpCode(200)
  async resetPassword(
    @ZodBody(
      z.object({
        token: z.string().min(20),
        newPassword: passwordSchema,
        confirmPassword: z.string(),
      }).refine((v) => v.newPassword === v.confirmPassword, {
        path: ['confirmPassword'],
        message: 'Passwords do not match.',
      }),
    )
    body: { token: string; newPassword: string; confirmPassword: string },
  ) {
    return this.auth.resetPassword(body.token, body.newPassword);
  }

  @Public()
  @Post('activate')
  @HttpCode(200)
  async activate(
    @ZodBody(
      z.object({
        token: z.string().min(20),
        newPassword: passwordSchema,
        confirmPassword: z.string(),
      }).refine((v) => v.newPassword === v.confirmPassword, {
        path: ['confirmPassword'],
        message: 'Passwords do not match.',
      }),
    )
    body: { token: string; newPassword: string; confirmPassword: string },
  ) {
    return this.auth.activateAccount(body.token, body.newPassword);
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
