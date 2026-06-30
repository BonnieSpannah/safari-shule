export const MPESA_PROVIDER = Symbol('MPESA_PROVIDER');

export interface StkPushInput {
  amountKes: number;
  msisdn: string;
  accountReference: string;
  description: string;
  callbackUrl: string;
}

export interface StkPushResult {
  merchantRequestId: string;
  checkoutRequestId: string;
}

export interface MpesaProvider {
  stkPush(input: StkPushInput): Promise<StkPushResult>;
}
