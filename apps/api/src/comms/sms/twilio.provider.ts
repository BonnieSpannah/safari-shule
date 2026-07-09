import type { SmsProvider } from '../tokens';

export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  fromNumber: string;
}

export class TwilioSmsProvider implements SmsProvider {
  constructor(private readonly config: TwilioConfig) {}

  async send({ to, body }: { to: string; body: string }) {
    if (!this.config.accountSid || !this.config.authToken) {
      throw new Error(
        'TwilioSmsProvider is not fully configured. Set TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + TWILIO_FROM_NUMBER.',
      );
    }

    const url = `https://api.twilio.com/2010-04-01/Accounts/${this.config.accountSid}/Messages.json`;
    const auth = Buffer.from(`${this.config.accountSid}:${this.config.authToken}`).toString('base64');
    const params = new URLSearchParams({ To: to, From: this.config.fromNumber, Body: body });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Twilio SMS failed: ${response.status} ${text}`);
    }

    const data = (await response.json()) as { sid: string; price?: string | null };
    const costCents = data.price ? Math.round(Number(data.price) * 100) : null;
    return { providerMessageId: data.sid, costCents };
  }
}
