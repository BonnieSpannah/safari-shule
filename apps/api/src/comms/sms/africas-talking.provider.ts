import AfricasTalking from 'africastalking';
import type { SmsProvider } from '../tokens';

export class AfricasTalkingSmsProvider implements SmsProvider {
  private readonly client: any;
  private readonly senderId: string;

  constructor(cfg: { username: string; apiKey: string; senderId: string }) {
    this.client = AfricasTalking({ username: cfg.username, apiKey: cfg.apiKey });
    this.senderId = cfg.senderId;
  }

  async send({ to, body, senderId }: { to: string; body: string; senderId?: string }) {
    const res = await this.client.SMS.send({
      to: [to],
      message: body,
      from: senderId ?? this.senderId,
    });
    const recipient = res?.SMSMessageData?.Recipients?.[0];
    return {
      providerMessageId: recipient?.messageId ?? null,
      costCents: recipient?.cost ? parseCost(recipient.cost) : null,
    };
  }
}

function parseCost(raw: string): number | null {
  const m = /KES\s*([\d.]+)/i.exec(raw);
  return m ? Math.round(parseFloat(m[1]!) * 100) : null;
}
