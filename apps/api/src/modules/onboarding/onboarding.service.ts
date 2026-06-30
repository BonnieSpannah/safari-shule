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

  async invite(input: { email: string; fullName: string; phone?: string; roleKeys: RoleKey[] }) {
    const tenantId = requireTenantId();
    const inviterId = getContext()?.userId;
    if (!inviterId) throw new BadRequestException('Authenticated user required to send invitations.');

    const roleRows = await this.prisma.role.findMany({
      where: { key: { in: input.roleKeys } },
    });
    if (roleRows.length !== input.roleKeys.length) {
      throw new BadRequestException('One or more role keys are invalid for this tenant.');
    }

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');

    const invitation = await this.prisma.invitation.create({
      data: {
        tenantId,
        inviterId,
        email: input.email.toLowerCase(),
        phoneE164: input.phone ?? null,
        fullName: input.fullName,
        roleKeys: input.roleKeys,
        tokenHash,
        expiresAt: new Date(Date.now() + INVITATION_TTL_DAYS * 86400 * 1000),
      },
    });

    const tenant = await runWithBypass(() => this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } }));
    const acceptUrl = `${this.config.get<string>('app.webPublicUrl')}/onboarding/accept?token=${rawToken}&tenant=${tenant.slug}`;

    const emailTpl = renderTemplate('invitation', {
      fullName: input.fullName,
      tenantName: tenant.name,
      acceptUrl,
    });
    await this.comms.sendEmail({
      tenantId,
      to: input.email,
      templateId: 'invitation',
      subject: emailTpl.subject ?? 'You have been invited to Safari Shule',
      html: emailTpl.html ?? `<p>${emailTpl.body}</p>`,
      text: emailTpl.body,
    });
    if (input.phone) {
      await this.comms.sendSms({
        tenantId,
        to: input.phone,
        templateId: 'invitation',
        body: `${tenant.name} invited you to Safari Shule. Set your password: ${acceptUrl}`,
      });
    }

    return { invitationId: invitation.id, expiresAt: invitation.expiresAt };
  }

  async accept(rawToken: string, password: string) {
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const invitation = await runWithBypass(() =>
      this.prisma.invitation.findUnique({ where: { tokenHash } }),
    );
    if (!invitation || invitation.acceptedAt || invitation.expiresAt < new Date()) {
      throw new NotFoundException('Invitation invalid, expired or already used.');
    }

    return runWithBypass(async () => {
      const passwordHash = await this.auth.hashPassword(password);
      const user = await this.prisma.user.create({
        data: {
          tenantId: invitation.tenantId,
          email: invitation.email,
          phoneE164: invitation.phoneE164,
          fullName: invitation.fullName,
          passwordHash,
          status: 'active',
        },
      });
      const roles = await this.prisma.role.findMany({
        where: { tenantId: invitation.tenantId, key: { in: invitation.roleKeys } },
      });
      if (roles.length) {
        await this.prisma.userRole.createMany({
          data: roles.map((r) => ({ tenantId: invitation.tenantId, userId: user.id, roleId: r.id })),
        });
      }
      await this.prisma.invitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date() },
      });
      return this.auth.issueTokenPair(user);
    });
  }
}
