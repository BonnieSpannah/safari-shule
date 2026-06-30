import axios from 'axios';
import { Logger } from '@nestjs/common';
import { RedisService } from '../../../common/redis/redis.service';
import type { MpesaProvider, StkPushInput, StkPushResult } from '../tokens';

const TOKEN_CACHE_KEY = 'mpesa:access_token';

export class LiveMpesaProvider implements MpesaProvider {
  private readonly logger = new Logger(LiveMpesaProvider.name);
  private readonly baseUrl: string;

  constructor(
    private readonly cfg: {
      consumerKey: string;
      consumerSecret: string;
      shortCode: string;
      passkey: string;
      environment: string;
    },
    private readonly redis: RedisService,
  ) {
    this.baseUrl =
      this.cfg.environment === 'production'
        ? 'https://api.safaricom.co.ke'
        : 'https://sandbox.safaricom.co.ke';
  }

  private async getAccessToken(): Promise<string> {
    const cached = await this.redis.client.get(TOKEN_CACHE_KEY);
    if (cached) return cached;
    const auth = Buffer.from(`${this.cfg.consumerKey}:${this.cfg.consumerSecret}`).toString('base64');
    const res = await axios.get(`${this.baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
      headers: { Authorization: `Basic ${auth}` },
      timeout: 10_000,
    });
    const token = res.data?.access_token as string;
    const expiresIn = Number(res.data?.expires_in ?? 3500);
    await this.redis.client.setex(TOKEN_CACHE_KEY, Math.max(30, expiresIn - 60), token);
    return token;
  }

  async stkPush(input: StkPushInput): Promise<StkPushResult> {
    const token = await this.getAccessToken();
    const timestamp = formatTimestamp(new Date());
    const password = Buffer.from(`${this.cfg.shortCode}${this.cfg.passkey}${timestamp}`).toString('base64');

    const res = await axios.post(
      `${this.baseUrl}/mpesa/stkpush/v1/processrequest`,
      {
        BusinessShortCode: this.cfg.shortCode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: input.amountKes,
        PartyA: input.msisdn,
        PartyB: this.cfg.shortCode,
        PhoneNumber: input.msisdn,
        CallBackURL: input.callbackUrl,
        AccountReference: input.accountReference,
        TransactionDesc: input.description,
      },
      { headers: { Authorization: `Bearer ${token}` }, timeout: 15_000 },
    );

    return {
      merchantRequestId: res.data?.MerchantRequestID,
      checkoutRequestId: res.data?.CheckoutRequestID,
    };
  }
}

function formatTimestamp(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return (
    d.getFullYear().toString() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds())
  );
}
