export const COMMS_QUEUE = 'comms';
export const SMS_PROVIDER = Symbol('SMS_PROVIDER');
export const EMAIL_PROVIDER = Symbol('EMAIL_PROVIDER');

export interface SmsProvider {
  send(input: { to: string; body: string; senderId?: string }): Promise<{ providerMessageId: string | null; costCents: number | null }>;
}

export interface EmailProvider {
  send(input: {
    to: string;
    subject: string;
    html: string;
    text?: string;
    attachments?: { filename: string; content: Buffer | string }[];
  }): Promise<{ providerMessageId: string | null }>;
}
