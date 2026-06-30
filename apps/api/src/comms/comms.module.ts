import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { CommunicationsService } from './communications.service';
import { CommsProcessor } from './comms.processor';
import { SMS_PROVIDER, EMAIL_PROVIDER } from './tokens';
import { AfricasTalkingSmsProvider } from './sms/africas-talking.provider';
import { MockSmsProvider } from './sms/mock-sms.provider';
import { SmtpEmailProvider } from './email/smtp.provider';
import { MockEmailProvider } from './email/mock-email.provider';
import { renderTemplate } from './templates/registry';

export const COMMS_QUEUE = 'comms';

@Global()
@Module({
  imports: [BullModule.registerQueue({ name: COMMS_QUEUE })],
  providers: [
    CommunicationsService,
    CommsProcessor,
    {
      provide: SMS_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const mode = config.get<string>('app.integrationsMode');
        const at = config.get<{ username: string; apiKey: string; senderId: string }>('app.at');
        if (mode === 'live' && at?.apiKey) {
          return new AfricasTalkingSmsProvider(at);
        }
        return new MockSmsProvider();
      },
    },
    {
      provide: EMAIL_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const mode = config.get<string>('app.integrationsMode');
        const smtp = config.get<{ host: string; port: number; user: string; password: string; from: string }>(
          'app.smtp',
        );
        if (mode === 'live' && smtp?.host) return new SmtpEmailProvider(smtp);
        return new MockEmailProvider();
      },
    },
    { provide: 'TEMPLATE_RENDERER', useValue: renderTemplate },
  ],
  exports: [CommunicationsService],
})
export class CommsModule {}
