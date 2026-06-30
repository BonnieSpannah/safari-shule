import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { MpesaCallbackController } from './mpesa.callback.controller';
import { MPESA_PROVIDER } from './tokens';
import { LiveMpesaProvider } from './providers/live-mpesa.provider';
import { MockMpesaProvider } from './providers/mock-mpesa.provider';
import { RedisService } from '../../common/redis/redis.service';

@Module({
  providers: [
    PaymentsService,
    {
      provide: MPESA_PROVIDER,
      inject: [ConfigService, RedisService],
      useFactory: (config: ConfigService, redis: RedisService) => {
        const mode = config.get<string>('app.integrationsMode');
        const mpesa = config.get<{
          consumerKey: string;
          consumerSecret: string;
          shortCode: string;
          passkey: string;
          environment: string;
        }>('app.mpesa');
        if (mode === 'live' && mpesa?.consumerKey) return new LiveMpesaProvider(mpesa, redis);
        return new MockMpesaProvider();
      },
    },
  ],
  controllers: [PaymentsController, MpesaCallbackController],
})
export class PaymentsModule {}
