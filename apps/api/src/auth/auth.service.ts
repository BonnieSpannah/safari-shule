import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { ERROR_CODES } from '@safari-shule/shared-types';
import { PrismaService } from '../common/prisma/prisma.service';
import { runWithBypass, getContext } from '../common/context/request-context';
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

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
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

  async login(tenantId: string, email: string, password: string) {
    const user = await runWithBypass(() =>
      this.prisma.user.findUnique({ where: { tenantId_email: { tenantId, email: email.toLowerCase() } } }),
    );
    if (!user || user.status !== 'active') {
      throw new UnauthorizedException({ code: ERROR_CODES.INVALID_CREDENTIALS, message: 'Invalid credentials.' });
    }
    const ok = await this.verifyPassword(user.passwordHash, password);
    if (!ok) {
      throw new UnauthorizedException({ code: ERROR_CODES.INVALID_CREDENTIALS, message: 'Invalid credentials.' });
    }
    await runWithBypass(() =>
      this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }),
    );
    return this.issueTokenPair(user);
  }

  async refresh(refreshToken: string) {
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
      this.prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } }),
    );

    const user = await runWithBypass(() =>
      this.prisma.user.findUniqueOrThrow({ where: { id: claims.sub } }),
    );
    return this.issueTokenPair(user);
  }

  async logout(refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);
    await runWithBypass(() =>
      this.prisma.refreshToken.updateMany({
        where: { tokenHash, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    );
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

  async issueTokenPair(user: { id: string; tenantId: string; email: string; fullName: string }) {
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

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
