import { Module, Global, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { CommunicationsService } from './communications.service';
import { CommsProcessor } from './comms.processor';
import { COMMS_QUEUE, SMS_PROVIDER, EMAIL_PROVIDER } from './tokens';
import { AfricasTalkingSmsProvider } from './sms/africas-talking.provider';
import { TwilioSmsProvider } from './sms/twilio.provider';
import { InfobipSmsProvider } from './sms/infobip.provider';
import { MockSmsProvider } from './sms/mock-sms.provider';
import { SmtpEmailProvider } from './email/smtp.provider';
import { MockEmailProvider } from './email/mock-email.provider';
import { renderTemplate } from './templates/registry';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module';

const bootLog = new Logger('CommsModule');

@Global()
@Module({
  imports: [BullModule.registerQueue({ name: COMMS_QUEUE }), FeatureFlagsModule],
  providers: [
    CommunicationsService,
    CommsProcessor,
    {
      provide: SMS_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const mode = config.get<string>('app.integrationsMode');
        const selected = config.get<string>('app.smsProvider') ?? 'auto';
        const at = config.get<{ username: string; apiKey: string; senderId: string }>('app.at');
        const twilio = config.get<{ accountSid: string; authToken: string; fromNumber: string }>('app.twilio');
        const infobip = config.get<{ baseUrl: string; apiKey: string; senderId: string }>('app.infobip');

        if (mode !== 'live' || selected === 'mock') {
          bootLog.log(`SMS provider = MOCK (integrations=${mode}, selected=${selected})`);
          return new MockSmsProvider();
        }

        const pick = selected === 'auto' ? (at?.apiKey ? 'africas_talking' : 'mock') : selected;

        switch (pick) {
          case 'africas_talking':
            if (!at?.apiKey) throw new Error('SMS provider=africas_talking but AT_API_KEY is empty');
            bootLog.log(`SMS provider = Africa's Talking (sender=${at.senderId})`);
            return new AfricasTalkingSmsProvider(at);
          case 'twilio':
            if (!twilio?.accountSid) throw new Error('SMS provider=twilio but TWILIO_ACCOUNT_SID is empty');
            bootLog.log(`SMS provider = Twilio (from=${twilio.fromNumber})`);
            return new TwilioSmsProvider(twilio);
          case 'infobip':
            if (!infobip?.apiKey) throw new Error('SMS provider=infobip but INFOBIP_API_KEY is empty');
            bootLog.log(`SMS provider = Infobip (sender=${infobip.senderId})`);
            return new InfobipSmsProvider(infobip);
          default:
            bootLog.warn(`SMS provider selection '${pick}' unknown — falling back to MOCK`);
            return new MockSmsProvider();
        }
      },
    },
    {
      provide: EMAIL_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const mode = config.get<string>('app.integrationsMode');
        const selected = config.get<string>('app.mailProvider') ?? 'auto';
        const smtp = config.get<{ host: string; port: number; user: string; password: string; from: string }>(
          'app.smtp',
        );

        const forceReal =
          selected === 'mailhog' || selected === 'mailtrap' || selected === 'smtp';

        if (!forceReal && (mode !== 'live' || selected === 'mock')) {
          bootLog.log(`Email provider = MOCK (integrations=${mode}, selected=${selected})`);
          return new MockEmailProvider();
        }

        const pick = selected === 'auto' ? (smtp?.host ? 'smtp' : 'mock') : selected;

        if ((pick === 'mailhog' || pick === 'mailtrap' || pick === 'smtp') && smtp?.host) {
          bootLog.log(`Email provider = ${pick.toUpperCase()} (${smtp.host}:${smtp.port})`);
          return new SmtpEmailProvider(smtp);
        }

        bootLog.log('Email provider = MOCK (no SMTP configured)');
        return new MockEmailProvider();
      },
    },
    { provide: 'TEMPLATE_RENDERER', useValue: renderTemplate },
  ],
  exports: [CommunicationsService],
})
export class CommsModule {}
