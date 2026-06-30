import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../common/prisma/prisma.service';
import { runWithBypass } from '../common/context/request-context';
import { CommunicationsService } from './communications.service';
import { COMMS_QUEUE } from './comms.module';
import { SMS_PROVIDER, EMAIL_PROVIDER, type SmsProvider, type EmailProvider } from './tokens';

@Processor(COMMS_QUEUE, { concurrency: 8 })
export class CommsProcessor extends WorkerHost {
  private readonly logger = new Logger(CommsProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly comms: CommunicationsService,
    @Inject(SMS_PROVIDER) private readonly sms: SmsProvider,
    @Inject(EMAIL_PROVIDER) private readonly email: EmailProvider,
  ) {
    super();
  }

  async process(job: Job<{ messageId: string; subject?: string; text?: string; attachments?: any[] }>) {
    const { messageId } = job.data;
    const msg = await runWithBypass(() =>
      this.prisma.outboundMessage.findUnique({ where: { id: messageId } }),
    );
    if (!msg) {
      this.logger.warn(`OutboundMessage ${messageId} not found; dropping job`);
      return;
    }

    if (msg.channel === 'sms') {
      const allowed = await this.comms.checkSmsQuota(msg.tenantId);
      if (!allowed) {
        await runWithBypass(() =>
          this.prisma.outboundMessage.update({
            where: { id: msg.id },
            data: { status: 'quota_exceeded' as any, error: 'SMS quota exceeded for current month.' },
          }),
        );
        return;
      }
      try {
        const result = await this.sms.send({ to: msg.to, body: msg.body });
        await runWithBypass(() =>
          this.prisma.outboundMessage.update({
            where: { id: msg.id },
            data: {
              status: 'sent' as any,
              providerMessageId: result.providerMessageId,
              costCents: result.costCents,
              attempts: { increment: 1 },
            },
          }),
        );
      } catch (err) {
        await this.markFailed(msg.id, err);
        throw err;
      }
      return;
    }

    if (msg.channel === 'email') {
      try {
        const result = await this.email.send({
          to: msg.to,
          subject: job.data.subject ?? '(no subject)',
          html: msg.body,
          text: job.data.text,
          attachments: job.data.attachments,
        });
        await runWithBypass(() =>
          this.prisma.outboundMessage.update({
            where: { id: msg.id },
            data: {
              status: 'sent' as any,
              providerMessageId: result.providerMessageId,
              attempts: { increment: 1 },
            },
          }),
        );
      } catch (err) {
        await this.markFailed(msg.id, err);
        throw err;
      }
    }
  }

  private async markFailed(id: string, err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    await runWithBypass(() =>
      this.prisma.outboundMessage.update({
        where: { id },
        data: { status: 'failed' as any, error: message, attempts: { increment: 1 } },
      }),
    );
  }
}
