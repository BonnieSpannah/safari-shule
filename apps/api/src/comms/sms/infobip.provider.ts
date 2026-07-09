import type { SmsProvider } from '../tokens';

export interface InfobipConfig {
  baseUrl: string;
  apiKey: string;
  senderId: string;
}

export class InfobipSmsProvider implements SmsProvider {
  constructor(private readonly config: InfobipConfig) {}

  async send({ to, body }: { to: string; body: string; senderId?: string }) {
    if (!this.config.baseUrl || !this.config.apiKey) {
      throw new Error(
        'InfobipSmsProvider is not fully configured. Set INFOBIP_BASE_URL + INFOBIP_API_KEY + INFOBIP_SENDER_ID.',
      );
    }

    const response = await fetch(`${this.config.baseUrl.replace(/\/$/, '')}/sms/2/text/advanced`, {
      method: 'POST',
      headers: {
        Authorization: `App ${this.config.apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        messages: [
          {
            from: this.config.senderId,
            destinations: [{ to }],
            text: body,
          },
        ],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Infobip SMS failed: ${response.status} ${text}`);
    }

    const data = (await response.json()) as {
      messages: Array<{ messageId: string; status: { groupName: string } }>;
    };
    const first = data.messages[0];
    return { providerMessageId: first?.messageId ?? null, costCents: null };
  }
}
