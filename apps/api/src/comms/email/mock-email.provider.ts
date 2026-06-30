import type { EmailProvider } from '../tokens';

export class MockEmailProvider implements EmailProvider {
  async send({ to, subject }: { to: string; subject: string; html: string }) {
    console.log(`[MockEmailProvider] -> ${to}: ${subject}`);
    return { providerMessageId: `mock-${Date.now()}` };
  }
}
