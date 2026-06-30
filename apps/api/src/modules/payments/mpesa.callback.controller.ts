import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../auth/public.decorator';
import { PaymentsService } from './payments.service';

@ApiTags('integrations')
@Controller('integrations/mpesa')
export class MpesaCallbackController {
  constructor(private readonly svc: PaymentsService) {}

  @Public()
  @Throttle({ default: { limit: 300, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('callback')
  async callback(@Body() body: any) {
    await this.svc.handleCallback(body);
    return { ResultCode: 0, ResultDesc: 'Accepted' };
  }
}
