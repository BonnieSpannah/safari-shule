import type { SmsProvider } from '../tokens';

export class MockSmsProvider implements SmsProvider {
  async send({ to, body }: { to: string; body: string }) {
    console.log(`[MockSmsProvider] -> ${to}: ${body}`);
    return { providerMessageId: `mock-${Date.now()}`, costCents: 80 };
  }
}
