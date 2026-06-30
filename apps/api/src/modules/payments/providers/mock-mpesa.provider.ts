import { randomUUID } from 'node:crypto';
import type { MpesaProvider, StkPushInput, StkPushResult } from '../tokens';

export class MockMpesaProvider implements MpesaProvider {
  async stkPush(_input: StkPushInput): Promise<StkPushResult> {
    return {
      merchantRequestId: `MOCK-MR-${randomUUID()}`,
      checkoutRequestId: `MOCK-CR-${randomUUID()}`,
    };
  }
}
