import * as nodemailer from 'nodemailer';
import type { EmailProvider } from '../tokens';

export class SmtpEmailProvider implements EmailProvider {
  private readonly transport: nodemailer.Transporter;
  private readonly from: string;

  constructor(cfg: { host: string; port: number; user: string; password: string; from: string }) {
    this.transport = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.port === 465,
      auth: cfg.user ? { user: cfg.user, pass: cfg.password } : undefined,
    });
    this.from = cfg.from;
  }

  async send({ to, subject, html, text, attachments }: { to: string; subject: string; html: string; text?: string; attachments?: any[] }) {
    const info = await this.transport.sendMail({
      from: this.from,
      to,
      subject,
      html,
      text,
      attachments,
    });
    return { providerMessageId: info.messageId ?? null };
  }
}
