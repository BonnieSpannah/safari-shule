import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CommunicationsService } from '../../comms/communications.service';
import { AuthService } from '../../auth/auth.service';
import { renderTemplate } from '../../comms/templates/registry';
import { runWithBypass, getContext, requireTenantId } from '../../common/context/request-context';
import type { RoleKey } from '@safari-shule/shared-types';

const INVITATION_TTL_DAYS = 7;

@Injectable()
export class OnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly comms: CommunicationsService,
    private readonly config: ConfigService,
    private readonly auth: AuthService,
  ) {}

  async invite(input: { email: string; fullName: string; phone?: string; roleKeys: RoleKey[]; targetTenantId?: string }) {
    const tenantId = input.targetTenantId ?? requireTenantId();
    const inviterId = getContext()?.userId;
    if (!inviterId) throw new BadRequestException('Authenticated user required to send invitations.');

    const roleRows = await runWithBypass(() =>
      this.prisma.role.findMany({ where: { tenantId, key: { in: input.roleKeys } } }),
    );
    if (roleRows.length !== input.roleKeys.length) {
      throw new BadRequestException('One or more role keys are invalid for this tenant.');
    }

    const existing = await runWithBypass(() =>
      this.prisma.user.findFirst({ where: { tenantId, email: input.email.toLowerCase() } }),
    );
    if (existing) throw new BadRequestException('A user with this email already exists in this tenant.');

    // Remove orphaned invitations (old code created invitations without a user record)
    await runWithBypass(() =>
      this.prisma.invitation.deleteMany({
        where: { tenantId, email: input.email.toLowerCase(), acceptedAt: null },
      }),
    );

    const tenant = await runWithBypass(() => this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } }));
    const ttlMs = INVITATION_TTL_DAYS * 86400 * 1000;
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');

    await runWithBypass(async () => {
      // Pre-create the user as pending so activation reuses the existing /activate/:token flow
      const user = await this.prisma.user.create({
        data: {
          tenantId,
          email: input.email.toLowerCase(),
          phoneE164: input.phone ?? null,
          fullName: input.fullName,
          passwordHash: '',   // empty until activation
          status: 'pending',
        },
      });

      if (roleRows.length) {
        await this.prisma.userRole.createMany({
          data: roleRows.map((r) => ({ tenantId, userId: user.id, roleId: r.id })),
        });
      }

      // Link matching unlinked staff record immediately
      await this.prisma.staff.updateMany({
        where: { tenantId, email: input.email.toLowerCase(), userId: null },
        data: { userId: user.id },
      });

      // Store activation token in passwordResetToken (purpose='activation') — same as manual user creation
      await this.prisma.passwordResetToken.create({
        data: { tenantId, userId: user.id, tokenHash, purpose: 'activation', expiresAt: new Date(Date.now() + ttlMs) },
      });

      // Record invitation for audit trail
      await this.prisma.invitation.create({
        data: {
          tenantId, inviterId,
          email: input.email.toLowerCase(),
          phoneE164: input.phone ?? null,
          fullName: input.fullName,
          roleKeys: input.roleKeys,
          tokenHash,
          expiresAt: new Date(Date.now() + ttlMs),
        },
      });
    });

    const activateUrl = `${this.config.get<string>('app.webPublicUrl')}/activate/${rawToken}?tenant=${tenant.slug}`;

    const emailTpl = renderTemplate('invitation', {
      fullName: input.fullName,
      tenantName: tenant.name,
      acceptUrl: activateUrl,
    });
    await this.comms.sendEmail({
      tenantId,
      to: input.email,
      templateId: 'invitation',
      subject: emailTpl.subject ?? `You've been invited to ${tenant.name} on Safari Shule`,
      html: emailTpl.html ?? `<p>${emailTpl.body}</p>`,
      text: emailTpl.body,
    });
    if (input.phone) {
      await this.comms.sendSms({
        tenantId,
        to: input.phone,
        templateId: 'invitation',
        body: `${tenant.name} invited you to Safari Shule. Activate your account: ${activateUrl}`,
      });
    }

    return { expiresAt: new Date(Date.now() + ttlMs) };
  }

  // Fallback: direct token acceptance (used if someone calls the API endpoint directly)
  async accept(rawToken: string, password: string) {
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const invitation = await runWithBypass(() =>
      this.prisma.invitation.findUnique({ where: { tokenHash } }),
    );
    if (!invitation || invitation.acceptedAt || invitation.expiresAt < new Date()) {
      throw new NotFoundException('Invitation invalid, expired or already used.');
    }

    // Delegate to activateAccount which handles the passwordResetToken correctly
    const result = await this.auth.activateAccount(rawToken, password);
    await runWithBypass(() =>
      this.prisma.invitation.update({ where: { id: invitation.id }, data: { acceptedAt: new Date() } }),
    );
    return result;
  }
}
