import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { COMMS_QUEUE } from './tokens';
import { FeatureFlagService } from '../feature-flags/feature-flag.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { runWithBypass, getContext } from '../common/context/request-context';
import { MetricsService } from '../common/metrics/metrics.service';

export interface SendSmsInput {
  tenantId: string;
  to: string;
  templateId: string;
  body: string;
  priority?: 'normal' | 'high';
}

export interface SendEmailInput {
  tenantId: string;
  to: string;
  templateId: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: { filename: string; content: Buffer | string }[];
}

@Injectable()
export class CommunicationsService {
  private readonly logger = new Logger(CommunicationsService.name);

  constructor(
    @InjectQueue(COMMS_QUEUE) private readonly queue: Queue,
    private readonly flags: FeatureFlagService,
    private readonly prisma: PrismaService,
    private readonly metrics: MetricsService,
  ) {}

  async sendSms(input: SendSmsInput): Promise<{ id: string }> {
    const suppressed = await this.isDncSuppressed(input.tenantId, 'sms', input.to);
    if (suppressed) {
      const suppressedMsg = await runWithBypass(() =>
        this.prisma.outboundMessage.create({
          data: {
            tenantId: input.tenantId,
            channel: 'sms' as any,
            to: input.to,
            templateId: input.templateId,
            body: input.body,
            status: 'failed' as any,
            error: 'Suppressed by do-not-contact policy.',
            requestId: getContext()?.requestId ?? null,
          },
        }),
      );
      this.metrics.recordOutboundMessage('sms', 'suppressed');
      return { id: suppressedMsg.id };
    }

    const msg = await runWithBypass(() =>
      this.prisma.outboundMessage.create({
        data: {
          tenantId: input.tenantId,
          channel: 'sms' as any,
          to: input.to,
          templateId: input.templateId,
          body: input.body,
          requestId: getContext()?.requestId ?? null,
        },
      }),
    );
    this.metrics.recordOutboundMessage('sms', 'queued');
    await this.queue.add(
      'sms',
      { messageId: msg.id },
      {
        attempts: 5,
        backoff: { type: 'exponential', delay: 5_000 },
        removeOnComplete: 1000,
        removeOnFail: 5000,
        priority: input.priority === 'high' ? 1 : 5,
      },
    );
    return { id: msg.id };
  }

  async sendBulkSms(inputs: SendSmsInput[]): Promise<string[]> {
    const ids: string[] = [];
    for (const i of inputs) {
      const { id } = await this.sendSms(i);
      ids.push(id);
    }
    return ids;
  }

  async sendUrgentSmsToEmergencyContacts(tenantId: string, body: string): Promise<string[]> {
    const contacts = await runWithBypass(() =>
      this.prisma.incidentEmergencyContact.findMany({
        where: { tenantId, isActive: true },
        orderBy: { priority: 'asc' },
      }),
    );
    if (contacts.length === 0) return [];
    return this.sendBulkSms(
      contacts.map((c) => ({
        tenantId,
        to: c.phoneE164,
        templateId: 'sos.alert',
        body,
        priority: 'high' as const,
      })),
    );
  }

  async sendEmail(input: SendEmailInput): Promise<{ id: string }> {
    const suppressed = await this.isDncSuppressed(input.tenantId, 'email', input.to);
    if (suppressed) {
      const suppressedMsg = await runWithBypass(() =>
        this.prisma.outboundMessage.create({
          data: {
            tenantId: input.tenantId,
            channel: 'email' as any,
            to: input.to,
            templateId: input.templateId,
            body: input.html,
            status: 'failed' as any,
            error: 'Suppressed by do-not-contact policy.',
            requestId: getContext()?.requestId ?? null,
          },
        }),
      );
      this.metrics.recordOutboundMessage('email', 'suppressed');
      return { id: suppressedMsg.id };
    }

    const msg = await runWithBypass(() =>
      this.prisma.outboundMessage.create({
        data: {
          tenantId: input.tenantId,
          channel: 'email' as any,
          to: input.to,
          templateId: input.templateId,
          body: input.html,
          requestId: getContext()?.requestId ?? null,
        },
      }),
    );
    this.metrics.recordOutboundMessage('email', 'queued');
    await this.queue.add(
      'email',
      {
        messageId: msg.id,
        subject: input.subject,
        text: input.text,
        attachments: input.attachments,
      },
      { attempts: 5, backoff: { type: 'exponential', delay: 10_000 } },
    );
    return { id: msg.id };
  }

  async checkSmsQuota(tenantId: string): Promise<boolean> {
    const quota = await this.flags.getLimit(tenantId, 'sms_broadcast', 'monthly_sms_quota');
    if (quota === null) return true;
    const start = new Date();
    start.setUTCDate(1);
    start.setUTCHours(0, 0, 0, 0);
    const used = await runWithBypass(() =>
      this.prisma.outboundMessage.count({
        where: {
          tenantId,
          channel: 'sms' as any,
          status: { in: ['sent', 'delivered', 'queued'] as any },
          createdAt: { gte: start },
        },
      }),
    );
    return used < quota;
  }

  private async isDncSuppressed(tenantId: string, channel: 'sms' | 'email', destination: string): Promise<boolean> {
    const now = new Date();
    const policy = await runWithBypass(() =>
      this.prisma.doNotContact.findFirst({
        where: {
          tenantId,
          destination,
          AND: [
            { OR: [{ channel: channel as any }, { channel: 'all' as any }] },
            { effectiveFrom: { lte: now } },
            { OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }] },
          ],
        },
      }),
    );
    return !!policy;
  }
}
