import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import {
  DEFAULT_PREFERENCES,
  ERROR_CODES,
  preferencesSchema,
  type UpdateProfileInput,
  type UserPreferences,
  type UserSession,
} from '@safari-shule/shared-types';
import { PrismaService } from '../common/prisma/prisma.service';
import { runWithBypass, getContext } from '../common/context/request-context';
import { CommunicationsService } from '../comms/communications.service';
import type { JwtAccessClaims, JwtRefreshClaims } from './auth.types';

const ACCESS_TTL_SECONDS = (ttl: string): number => parseTtl(ttl);
const REFRESH_TTL_SECONDS = (ttl: string): number => parseTtl(ttl);

function parseTtl(ttl: string): number {
  const m = /^(\d+)([smhd])$/.exec(ttl);
  if (!m) return Number(ttl);
  const n = Number(m[1]);
  switch (m[2]) {
    case 's': return n;
    case 'm': return n * 60;
    case 'h': return n * 3600;
    case 'd': return n * 86400;
    default: return n;
  }
}

/** Optional per-request metadata captured when issuing a refresh token. */
export interface SessionMeta {
  ipAddress?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly comms: CommunicationsService,
  ) {}

  async hashPassword(plain: string): Promise<string> {
    return argon2.hash(plain, { type: argon2.argon2id, memoryCost: 2 ** 16, timeCost: 3, parallelism: 1 });
  }

  async verifyPassword(hash: string, plain: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plain);
    } catch {
      return false;
    }
  }

  async login(tenantId: string, email: string, password: string, meta: SessionMeta = {}) {
    const tenant = await runWithBypass(() =>
      this.prisma.tenant.findUnique({ where: { id: tenantId } }),
    );
    if (!tenant) {
      throw new UnauthorizedException({
        code: ERROR_CODES.TENANT_NOT_RESOLVED,
        message: 'Tenant not found.',
      });
    }
    this.assertTenantLoginAllowed(tenant.status);

    const user = await runWithBypass(() =>
      this.prisma.user.findUnique({
        where: { tenantId_email: { tenantId, email: email.toLowerCase() } },
      }),
    );
    if (!user) {
      throw new UnauthorizedException({
        code: ERROR_CODES.INVALID_CREDENTIALS,
        message: 'Invalid credentials.',
      });
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException({
        code: ERROR_CODES.ACCOUNT_LOCKED,
        message: `Account temporarily locked until ${user.lockedUntil.toISOString()}.`,
      });
    }

    const ok = await this.verifyPassword(user.passwordHash, password);
    if (!ok) {
      await this.recordFailedLogin(user.id, user.failedLoginCount);
      throw new UnauthorizedException({
        code: ERROR_CODES.INVALID_CREDENTIALS,
        message: 'Invalid credentials.',
      });
    }

    // Password matched — now enforce status. We only leak per-status detail
    // AFTER the password check has passed, so we don't reveal account
    // existence to unauthenticated attackers.
    this.assertUserLoginAllowed(user.status);

    const maxAgeDays = this.config.get<number>('app.security.passwordMaxAgeDays') ?? 90;
    const ageMs = Date.now() - user.passwordUpdatedAt.getTime();
    const expiredByAge = ageMs > maxAgeDays * 86400 * 1000;
    if (expiredByAge && !user.mustChangePassword) {
      await runWithBypass(() =>
        this.prisma.user.update({
          where: { id: user.id },
          data: {
            mustChangePassword: true,
            status: user.status === 'active' ? 'expired' : user.status,
          },
        }),
      );
      throw new UnauthorizedException({
        code: ERROR_CODES.PASSWORD_EXPIRED,
        message: 'Password has expired. Reset it to continue.',
      });
    }

    await runWithBypass(() =>
      this.prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date(), failedLoginCount: 0, lockedUntil: null },
      }),
    );
    return this.issueTokenPair(user, meta);
  }

  private assertTenantLoginAllowed(status: string): void {
    switch (status) {
      case 'active':
        return;
      case 'pending':
        throw new UnauthorizedException({
          code: ERROR_CODES.TENANT_INACTIVE,
          message: 'This school is still pending activation. Contact support.',
        });
      case 'suspended':
        throw new UnauthorizedException({
          code: ERROR_CODES.TENANT_SUSPENDED,
          message: 'This school is currently suspended. Contact support.',
        });
      case 'deactivated':
        throw new UnauthorizedException({
          code: ERROR_CODES.TENANT_DEACTIVATED,
          message: 'This school has been deactivated. Contact support.',
        });
      case 'cancelled':
        throw new UnauthorizedException({
          code: ERROR_CODES.TENANT_CANCELLED,
          message: 'This school has been cancelled. Contact support.',
        });
      case 'deleted':
        throw new UnauthorizedException({
          code: ERROR_CODES.TENANT_DELETED,
          message: 'This school no longer exists.',
        });
      default:
        throw new UnauthorizedException({
          code: ERROR_CODES.TENANT_INACTIVE,
          message: 'This school is not available for sign-in right now.',
        });
    }
  }

  private assertUserLoginAllowed(status: string): void {
    switch (status) {
      case 'active':
        return;
      case 'pending':
        throw new UnauthorizedException({
          code: ERROR_CODES.USER_PENDING_ACTIVATION,
          message: 'Your account is pending activation. Check your email for the activation link.',
        });
      case 'inactive':
        throw new UnauthorizedException({
          code: ERROR_CODES.USER_INACTIVE,
          message: 'Your account is inactive. Contact your school administrator.',
        });
      case 'suspended':
        throw new UnauthorizedException({
          code: ERROR_CODES.USER_SUSPENDED,
          message: 'Your account has been suspended. Contact your school administrator.',
        });
      case 'deactivated':
        throw new UnauthorizedException({
          code: ERROR_CODES.USER_DEACTIVATED,
          message: 'Your account has been deactivated. Contact your school administrator.',
        });
      case 'blocked':
        throw new UnauthorizedException({
          code: ERROR_CODES.USER_BLOCKED,
          message: 'Your account has been blocked due to security concerns. Contact your school administrator.',
        });
      case 'expired':
        throw new UnauthorizedException({
          code: ERROR_CODES.PASSWORD_EXPIRED,
          message: 'Your password has expired. Reset it to continue.',
        });
      case 'deleted':
        throw new UnauthorizedException({
          code: ERROR_CODES.USER_DELETED,
          message: 'Your account no longer exists.',
        });
      default:
        throw new UnauthorizedException({
          code: ERROR_CODES.USER_INACTIVE,
          message: 'Your account is not available for sign-in right now.',
        });
    }
  }

  private async recordFailedLogin(userId: string, currentCount: number): Promise<void> {
    const threshold = this.config.get<number>('app.security.failedLoginLockThreshold') ?? 8;
    const lockMinutes = this.config.get<number>('app.security.failedLoginLockMinutes') ?? 30;
    const next = currentCount + 1;
    const lock = next >= threshold ? new Date(Date.now() + lockMinutes * 60 * 1000) : null;
    await runWithBypass(() =>
      this.prisma.user.update({
        where: { id: userId },
        data: { failedLoginCount: next, lockedUntil: lock },
      }),
    );
  }

  async refresh(refreshToken: string, meta: SessionMeta = {}) {
    let claims: JwtRefreshClaims;
    try {
      claims = await this.jwt.verifyAsync<JwtRefreshClaims>(refreshToken, {
        secret: this.config.get<string>('app.jwt.refreshSecret'),
      });
    } catch {
      throw new UnauthorizedException({ code: ERROR_CODES.TOKEN_EXPIRED, message: 'Refresh token invalid or expired.' });
    }

    const tokenHash = this.hashToken(refreshToken);
    const stored = await runWithBypass(() =>
      this.prisma.refreshToken.findUnique({ where: { tokenHash } }),
    );
    if (!stored || stored.userId !== claims.sub || stored.tenantId !== claims.tid) {
      // Reuse detection: revoke every token for this user.
      await runWithBypass(() =>
        this.prisma.refreshToken.updateMany({
          where: { userId: claims.sub, tenantId: claims.tid, revokedAt: null },
          data: { revokedAt: new Date() },
        }),
      );
      throw new UnauthorizedException({ code: ERROR_CODES.TOKEN_REUSED, message: 'Refresh token reuse detected; all sessions revoked.' });
    }
    if (stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException({ code: ERROR_CODES.TOKEN_EXPIRED, message: 'Refresh token expired.' });
    }

    await runWithBypass(() =>
      this.prisma.refreshToken.update({
        where: { id: stored.id },
        data: { revokedAt: new Date(), lastUsedAt: new Date() },
      }),
    );

    const user = await runWithBypass(() =>
      this.prisma.user.findUniqueOrThrow({ where: { id: claims.sub } }),
    );

    // Re-check tenant + user status on each refresh so we can freeze
    // compromised or suspended accounts immediately, without waiting for
    // the access-token TTL to elapse.
    const tenant = await runWithBypass(() =>
      this.prisma.tenant.findUniqueOrThrow({ where: { id: user.tenantId } }),
    );
    this.assertTenantLoginAllowed(tenant.status);
    this.assertUserLoginAllowed(user.status);

    return this.issueTokenPair(user, meta);
  }

  async logout(refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);
    await runWithBypass(() =>
      this.prisma.refreshToken.updateMany({
        where: { tokenHash, revokedAt: null },
        data: { revokedAt: new Date(), lastUsedAt: new Date() },
      }),
    );
  }

  /**
   * Return the caller's identity + roles + permissions. Powers the web's
   * permission-aware navigation, role badges, and profile screens.
   */
  async getMe(userId: string) {
    const user = await runWithBypass(() =>
      this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        include: {
          userRoles: {
            include: {
              role: {
                include: {
                  rolePermissions: { include: { permission: true } },
                },
              },
            },
          },
        },
      }),
    );

    const roles = user.userRoles.map((ur) => ur.role.key);
    const permissions = Array.from(
      new Set(
        user.userRoles.flatMap((ur) =>
          ur.role.rolePermissions.map((rp) => rp.permission.key),
        ),
      ),
    ).sort();

    const maxAgeDays = this.config.get<number>('app.security.passwordMaxAgeDays') ?? 90;
    const passwordExpiresAt = new Date(
      user.passwordUpdatedAt.getTime() + maxAgeDays * 86400 * 1000,
    );
    const passwordExpiresInDays = Math.max(
      0,
      Math.ceil((passwordExpiresAt.getTime() - Date.now()) / (86400 * 1000)),
    );

    return {
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      fullName: user.fullName,
      phoneE164: user.phoneE164,
      status: user.status,
      mustChangePassword: user.mustChangePassword,
      passwordUpdatedAt: user.passwordUpdatedAt.toISOString(),
      passwordExpiresAt: passwordExpiresAt.toISOString(),
      passwordExpiresInDays,
      activatedAt: user.activatedAt?.toISOString() ?? null,
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      roles,
      permissions,
      preferences: this.mergePreferences(user.preferences),
    };
  }

  // -------------------------------------------------------------------------
  //  Profile — PATCH /v1/auth/me
  // -------------------------------------------------------------------------

  async updateProfile(userId: string, input: UpdateProfileInput) {
    const updated = await runWithBypass(() =>
      this.prisma.user.update({
        where: { id: userId },
        data: {
          fullName: input.fullName,
          phoneE164: input.phoneE164 ?? null,
        },
      }),
    );
    return {
      id: updated.id,
      fullName: updated.fullName,
      phoneE164: updated.phoneE164,
    };
  }

  // -------------------------------------------------------------------------
  //  Password — self-service change
  // -------------------------------------------------------------------------

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    opts: { reason?: string; revokeOtherSessions?: boolean; currentTokenHash?: string } = {},
  ) {
    const user = await runWithBypass(() =>
      this.prisma.user.findUniqueOrThrow({ where: { id: userId } }),
    );

    const ok = await this.verifyPassword(user.passwordHash, currentPassword);
    if (!ok) {
      throw new UnauthorizedException({
        code: ERROR_CODES.INVALID_CREDENTIALS,
        message: 'Current password is incorrect.',
      });
    }

    if (currentPassword === newPassword) {
      throw new BadRequestException({
        code: ERROR_CODES.PASSWORD_SAME_AS_CURRENT,
        message: 'New password must differ from your current password.',
      });
    }

    const historyCount = this.config.get<number>('app.security.passwordHistoryCount') ?? 5;
    const history = await runWithBypass(() =>
      this.prisma.passwordHistory.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: historyCount,
      }),
    );
    for (const row of history) {
      if (await this.verifyPassword(row.passwordHash, newPassword)) {
        throw new BadRequestException({
          code: ERROR_CODES.PASSWORD_HISTORY_REUSE,
          message: `Password matches one of your last ${historyCount} passwords. Choose a different one.`,
        });
      }
    }

    const newHash = await this.hashPassword(newPassword);
    const now = new Date();

    await runWithBypass(async () => {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          passwordHash: newHash,
          passwordUpdatedAt: now,
          mustChangePassword: false,
          status: user.status === 'expired' ? 'active' : user.status,
          failedLoginCount: 0,
          lockedUntil: null,
        },
      });
      await this.prisma.passwordHistory.create({
        data: {
          tenantId: user.tenantId,
          userId,
          passwordHash: newHash,
          changedByUserId: userId,
          reason: opts.reason ?? 'self',
        },
      });
      // Trim history to twice the retention window (kept for forensics).
      const retained = historyCount * 2;
      const stale = await this.prisma.passwordHistory.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: retained,
        select: { id: true },
      });
      if (stale.length) {
        await this.prisma.passwordHistory.deleteMany({
          where: { id: { in: stale.map((r) => r.id) } },
        });
      }
    });

    if (opts.revokeOtherSessions) {
      await runWithBypass(() =>
        this.prisma.refreshToken.updateMany({
          where: {
            userId,
            revokedAt: null,
            ...(opts.currentTokenHash ? { tokenHash: { not: opts.currentTokenHash } } : {}),
          },
          data: { revokedAt: new Date() },
        }),
      );
    }

    return { changedAt: now.toISOString() };
  }

  // -------------------------------------------------------------------------
  //  Sessions
  // -------------------------------------------------------------------------

  async listSessions(userId: string, currentTokenHash: string | null = null): Promise<UserSession[]> {
    const rows = await runWithBypass(() =>
      this.prisma.refreshToken.findMany({
        where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: 'desc' },
      }),
    );
    return rows.map((r) => ({
      id: r.id,
      createdAt: r.createdAt.toISOString(),
      expiresAt: r.expiresAt.toISOString(),
      lastUsedAt: r.lastUsedAt?.toISOString() ?? null,
      ipAddress: r.ipAddress,
      userAgent: r.userAgent,
      isCurrent: currentTokenHash !== null && r.tokenHash === currentTokenHash,
    }));
  }

  async revokeSession(userId: string, sessionId: string) {
    const row = await runWithBypass(() =>
      this.prisma.refreshToken.findUnique({ where: { id: sessionId } }),
    );
    if (!row || row.userId !== userId) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Session not found.' });
    }
    if (row.revokedAt) return { revokedAt: row.revokedAt.toISOString() };
    const now = new Date();
    await runWithBypass(() =>
      this.prisma.refreshToken.update({
        where: { id: sessionId },
        data: { revokedAt: now },
      }),
    );
    return { revokedAt: now.toISOString() };
  }

  async revokeAllSessions(userId: string, exceptTokenHash: string | null = null) {
    const now = new Date();
    const res = await runWithBypass(() =>
      this.prisma.refreshToken.updateMany({
        where: {
          userId,
          revokedAt: null,
          ...(exceptTokenHash ? { tokenHash: { not: exceptTokenHash } } : {}),
        },
        data: { revokedAt: now },
      }),
    );
    return { revoked: res.count, revokedAt: now.toISOString() };
  }

  // -------------------------------------------------------------------------
  //  Preferences
  // -------------------------------------------------------------------------

  private mergePreferences(raw: unknown): UserPreferences {
    if (!raw || typeof raw !== 'object') return DEFAULT_PREFERENCES;
    const parsed = preferencesSchema.safeParse({
      ...DEFAULT_PREFERENCES,
      ...(raw as Record<string, unknown>),
    });
    return parsed.success ? parsed.data : DEFAULT_PREFERENCES;
  }

  async getPreferences(userId: string): Promise<UserPreferences> {
    const user = await runWithBypass(() =>
      this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { preferences: true },
      }),
    );
    return this.mergePreferences(user.preferences);
  }

  async updatePreferences(userId: string, patch: Partial<UserPreferences>): Promise<UserPreferences> {
    const current = await this.getPreferences(userId);
    const next = preferencesSchema.parse({
      ...current,
      ...patch,
      notifications: {
        ...current.notifications,
        ...(patch.notifications ?? {}),
      },
    });
    await runWithBypass(() =>
      this.prisma.user.update({
        where: { id: userId },
        data: { preferences: next as unknown as any },
      }),
    );
    return next;
  }

  async issueOtp(tenantId: string, phoneE164: string, purpose: string): Promise<string> {
    const code = (Math.floor(100000 + Math.random() * 900000)).toString();
    const codeHash = await argon2.hash(code, { type: argon2.argon2id });
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    await runWithBypass(() =>
      this.prisma.otpCode.create({
        data: { tenantId, phoneE164, codeHash, purpose, expiresAt },
      }),
    );
    return code;
  }

  async consumeOtp(tenantId: string, phoneE164: string, purpose: string, code: string) {
    const rows = await runWithBypass(() =>
      this.prisma.otpCode.findMany({
        where: { tenantId, phoneE164, purpose, consumedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    );
    for (const row of rows) {
      if (await argon2.verify(row.codeHash, code).catch(() => false)) {
        await runWithBypass(() =>
          this.prisma.otpCode.update({ where: { id: row.id }, data: { consumedAt: new Date(), attempts: row.attempts + 1 } }),
        );
        return true;
      }
    }
    if (rows.length) {
      await runWithBypass(() =>
        this.prisma.otpCode.updateMany({
          where: { id: { in: rows.map((r) => r.id) } },
          data: { attempts: { increment: 1 } },
        }),
      );
    }
    return false;
  }

  async issueTokenPair(
    user: { id: string; tenantId: string; email: string; fullName: string },
    meta: SessionMeta = {},
  ) {
    const accessClaims: JwtAccessClaims = {
      sub: user.id,
      tid: user.tenantId,
      email: user.email,
      name: user.fullName,
    };
    const accessToken = await this.jwt.signAsync(accessClaims, {
      expiresIn: this.config.get<string>('app.jwt.accessTtl'),
    });

    const refreshJti = randomUUID();
    const refreshClaims: JwtRefreshClaims = { sub: user.id, tid: user.tenantId, jti: refreshJti };
    const refreshToken = await this.jwt.signAsync(refreshClaims, {
      secret: this.config.get<string>('app.jwt.refreshSecret'),
      expiresIn: this.config.get<string>('app.jwt.refreshTtl'),
    });

    const refreshTtl = REFRESH_TTL_SECONDS(this.config.get<string>('app.jwt.refreshTtl')!);
    await runWithBypass(() =>
      this.prisma.refreshToken.create({
        data: {
          tenantId: user.tenantId,
          userId: user.id,
          tokenHash: this.hashToken(refreshToken),
          expiresAt: new Date(Date.now() + refreshTtl * 1000),
          ipAddress: meta.ipAddress ?? null,
          userAgent: meta.userAgent ?? null,
          lastUsedAt: new Date(),
        },
      }),
    );

    return {
      accessToken,
      refreshToken,
      accessTtlSeconds: ACCESS_TTL_SECONDS(this.config.get<string>('app.jwt.accessTtl')!),
      refreshTtlSeconds: refreshTtl,
      user: { id: user.id, email: user.email, fullName: user.fullName, tenantId: user.tenantId },
    };
  }

  // -------------------------------------------------------------------------
  //  Forgot password — issues a reset token + emails the user
  // -------------------------------------------------------------------------

  /**
   * Always resolves with `{ delivered: true }` — never reveals whether the
   * email/tenant combination exists, to prevent user enumeration.
   */
  async forgotPassword(
    tenantSlug: string,
    email: string,
    meta: { webUrl?: string } = {},
  ): Promise<{ delivered: boolean }> {
    const tenant = await runWithBypass(() =>
      this.prisma.tenant.findUnique({ where: { slug: tenantSlug } }),
    );
    if (!tenant || tenant.status !== 'active') return { delivered: true };

    const user = await runWithBypass(() =>
      this.prisma.user.findUnique({
        where: { tenantId_email: { tenantId: tenant.id, email: email.toLowerCase() } },
      }),
    );
    if (!user || user.status === 'deleted') return { delivered: true };

    // Invalidate any previous unused reset tokens for this user.
    await runWithBypass(() =>
      this.prisma.passwordResetToken.updateMany({
        where: { userId: user.id, purpose: 'reset', usedAt: null },
        data: { usedAt: new Date() },
      }),
    );

    const ttlMinutes = this.config.get<number>('app.security.resetTokenTtlMinutes') ?? 30;
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);

    await runWithBypass(() =>
      this.prisma.passwordResetToken.create({
        data: {
          tenantId: tenant.id,
          userId: user.id,
          tokenHash,
          purpose: 'reset',
          expiresAt: new Date(Date.now() + ttlMinutes * 60 * 1000),
        },
      }),
    );

    const baseUrl = meta.webUrl ?? this.config.get<string>('app.webPublicUrl') ?? 'http://localhost:5173';
    const resetUrl = `${baseUrl}/reset-password/${rawToken}?tenant=${tenantSlug}`;

    await this.comms.sendEmail({
      tenantId: tenant.id,
      to: user.email,
      templateId: 'auth.reset-password',
      subject: 'Reset your Safari Shule password',
      html: this.renderAuthEmail('auth.reset-password', {
        fullName: user.fullName,
        resetUrl,
        ttlMinutes: String(ttlMinutes),
      }),
    });

    return { delivered: true };
  }

  // -------------------------------------------------------------------------
  //  Reset password — consumes token, validates history, rotates password
  // -------------------------------------------------------------------------

  async resetPassword(rawToken: string, newPassword: string): Promise<{ resetAt: string }> {
    const tokenHash = this.hashToken(rawToken);
    const record = await runWithBypass(() =>
      this.prisma.passwordResetToken.findUnique({ where: { tokenHash } }),
    );

    if (!record || record.purpose !== 'reset' || record.usedAt || record.expiresAt < new Date()) {
      throw new UnauthorizedException({
        code: ERROR_CODES.TOKEN_INVALID,
        message: 'This password reset link is invalid or has expired.',
      });
    }

    const user = await runWithBypass(() =>
      this.prisma.user.findUniqueOrThrow({ where: { id: record.userId } }),
    );

    const historyCount = this.config.get<number>('app.security.passwordHistoryCount') ?? 5;
    const history = await runWithBypass(() =>
      this.prisma.passwordHistory.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: historyCount,
      }),
    );
    for (const row of history) {
      if (await this.verifyPassword(row.passwordHash, newPassword)) {
        throw new BadRequestException({
          code: ERROR_CODES.PASSWORD_HISTORY_REUSE,
          message: `Password matches one of your last ${historyCount} passwords. Choose a different one.`,
        });
      }
    }

    const newHash = await this.hashPassword(newPassword);
    const now = new Date();

    await runWithBypass(async () => {
      await this.prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: now },
      });
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash: newHash,
          passwordUpdatedAt: now,
          mustChangePassword: false,
          status: user.status === 'expired' ? 'active' : user.status,
          failedLoginCount: 0,
          lockedUntil: null,
        },
      });
      await this.prisma.passwordHistory.create({
        data: {
          tenantId: user.tenantId,
          userId: user.id,
          passwordHash: newHash,
          reason: 'reset',
        },
      });
      // Revoke all sessions — password changed via reset = all devices out.
      await this.prisma.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: now },
      });
    });

    return { resetAt: now.toISOString() };
  }

  // -------------------------------------------------------------------------
  //  Activation — first-login link; sets password, activates account
  // -------------------------------------------------------------------------

  async activateAccount(rawToken: string, newPassword: string): Promise<{ activatedAt: string }> {
    const tokenHash = this.hashToken(rawToken);
    const record = await runWithBypass(() =>
      this.prisma.passwordResetToken.findUnique({ where: { tokenHash } }),
    );

    if (
      !record ||
      record.purpose !== 'activation' ||
      record.usedAt ||
      record.expiresAt < new Date()
    ) {
      throw new UnauthorizedException({
        code: ERROR_CODES.TOKEN_INVALID,
        message: 'This activation link is invalid or has expired.',
      });
    }

    const newHash = await this.hashPassword(newPassword);
    const now = new Date();

    await runWithBypass(async () => {
      await this.prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: now },
      });
      await this.prisma.user.update({
        where: { id: record.userId },
        data: {
          passwordHash: newHash,
          passwordUpdatedAt: now,
          mustChangePassword: false,
          status: 'active',
          activatedAt: now,
          failedLoginCount: 0,
          lockedUntil: null,
        },
      });
      await this.prisma.passwordHistory.create({
        data: {
          tenantId: record.tenantId,
          userId: record.userId,
          passwordHash: newHash,
          reason: 'initial',
        },
      });
    });

    return { activatedAt: now.toISOString() };
  }

  // -------------------------------------------------------------------------
  //  Helper used by TenantAdminService when provisioning new users
  // -------------------------------------------------------------------------

  async issueActivationToken(
    tenantId: string,
    userId: string,
    email: string,
    fullName: string,
    tenantName: string,
    tenantSlug: string,
  ): Promise<void> {
    const ttlHours = this.config.get<number>('app.security.activationTokenTtlHours') ?? 48;
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);

    await runWithBypass(() =>
      this.prisma.passwordResetToken.create({
        data: {
          tenantId,
          userId,
          tokenHash,
          purpose: 'activation',
          expiresAt: new Date(Date.now() + ttlHours * 3600 * 1000),
        },
      }),
    );

    const baseUrl = this.config.get<string>('app.webPublicUrl') ?? 'http://localhost:5173';
    const activateUrl = `${baseUrl}/activate/${rawToken}?tenant=${tenantSlug}`;

    await this.comms.sendEmail({
      tenantId,
      to: email,
      templateId: 'auth.activation',
      subject: `Activate your Safari Shule account — ${tenantName}`,
      html: this.renderAuthEmail('auth.activation', {
        fullName,
        tenantName,
        activateUrl,
        ttlHours: String(ttlHours),
      }),
    });
  }

  private renderAuthEmail(
    templateId: 'auth.activation' | 'auth.reset-password',
    params: Record<string, string>,
  ): string {
    if (templateId === 'auth.activation') {
      const { fullName, tenantName, activateUrl, ttlHours } = params;
      return `<!DOCTYPE html><html><body style="font-family:sans-serif;color:#18181b;max-width:560px;margin:40px auto;padding:0 16px">
<h2 style="color:#10b981">Welcome to Safari Shule</h2>
<p>Hello <strong>${fullName}</strong>,</p>
<p>Your account for <strong>${tenantName}</strong> has been created. Click the button below to activate it and set your password.</p>
<p style="margin:28px 0"><a href="${activateUrl}" style="background:#10b981;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">Activate account</a></p>
<p style="font-size:13px;color:#71717a">This link expires in <strong>${ttlHours} hours</strong>. If you did not expect this email, you can safely ignore it.</p>
<p style="font-size:13px;color:#71717a">Or copy: <a href="${activateUrl}">${activateUrl}</a></p>
</body></html>`;
    }
    const { fullName, resetUrl, ttlMinutes } = params;
    return `<!DOCTYPE html><html><body style="font-family:sans-serif;color:#18181b;max-width:560px;margin:40px auto;padding:0 16px">
<h2 style="color:#10b981">Password reset</h2>
<p>Hello <strong>${fullName}</strong>,</p>
<p>We received a request to reset your Safari Shule password. Click the button below to set a new one.</p>
<p style="margin:28px 0"><a href="${resetUrl}" style="background:#10b981;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">Reset password</a></p>
<p style="font-size:13px;color:#71717a">This link expires in <strong>${ttlMinutes} minutes</strong>. If you didn't request this, you can safely ignore it.</p>
<p style="font-size:13px;color:#71717a">Or copy: <a href="${resetUrl}">${resetUrl}</a></p>
</body></html>`;
  }

  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
