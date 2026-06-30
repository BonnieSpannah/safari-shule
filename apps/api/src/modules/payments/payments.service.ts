import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import { getContext, requireTenantId, runWithBypass } from '../../common/context/request-context';
import { MPESA_PROVIDER, type MpesaProvider } from './tokens';

interface InitiateInput {
  purpose: 'fuel' | 'repair';
  fuelLogId?: string;
  repairLogId?: string;
  amountKes: number;
  phoneE164: string;
  description: string;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(MPESA_PROVIDER) private readonly mpesa: MpesaProvider,
  ) {}

  async initiate(input: InitiateInput) {
    const tenantId = requireTenantId();
    const callbackUrl = `${this.config.get<string>('app.publicBaseUrl')}/v1/integrations/mpesa/callback`;
    const accountReference = input.fuelLogId ?? input.repairLogId ?? 'safari-shule';

    const stk = await this.mpesa.stkPush({
      amountKes: input.amountKes,
      msisdn: toMpesaMsisdn(input.phoneE164),
      accountReference,
      description: input.description,
      callbackUrl,
    });

    const txn = await this.prisma.mpesaTransaction.create({
      data: {
        tenantId,
        purpose: input.purpose as any,
        amountKes: input.amountKes,
        phoneE164: input.phoneE164,
        accountReference,
        checkoutRequestId: stk.checkoutRequestId,
        merchantRequestId: stk.merchantRequestId,
        status: 'initiated' as any,
      },
    });

    if (input.fuelLogId) {
      await this.prisma.fuelLog.update({
        where: { id: input.fuelLogId },
        data: { mpesaTransactionId: txn.id },
      });
    } else if (input.repairLogId) {
      await this.prisma.repairLog.update({
        where: { id: input.repairLogId },
        data: { mpesaTransactionId: txn.id },
      });
    }

    return { transactionId: txn.id, checkoutRequestId: stk.checkoutRequestId };
  }

  async handleCallback(payload: any) {
    const body = payload?.Body?.stkCallback;
    if (!body) throw new BadRequestException('Invalid M-Pesa callback');
    const checkoutRequestId = body.CheckoutRequestID as string;
    const resultCode = Number(body.ResultCode);
    const resultDesc = body.ResultDesc as string;
    const metadata = body.CallbackMetadata?.Item ?? [];
    const receiptNumber = findMeta(metadata, 'MpesaReceiptNumber');
    const transactionDate = findMeta(metadata, 'TransactionDate');

    return runWithBypass(async () => {
      const txn = await this.prisma.mpesaTransaction.findUnique({ where: { checkoutRequestId } });
      if (!txn) {
        this.logger.warn(`Callback for unknown CheckoutRequestID ${checkoutRequestId}`);
        return { acknowledged: false as const };
      }
      if (txn.status !== 'initiated') {
        return { acknowledged: true as const, duplicate: true as const };
      }
      await this.prisma.mpesaTransaction.update({
        where: { id: txn.id },
        data: {
          status: resultCode === 0 ? ('succeeded' as any) : ('failed' as any),
          resultCode,
          resultDescription: resultDesc,
          mpesaReceiptNumber: receiptNumber ? String(receiptNumber) : null,
          callbackPayload: payload,
          completedAt: transactionDate ? mpesaDateToDate(String(transactionDate)) : new Date(),
        },
      });
      if (resultCode === 0) {
        const fuel = await this.prisma.fuelLog.findFirst({ where: { mpesaTransactionId: txn.id } });
        if (fuel) {
          await this.prisma.fuelLog.update({
            where: { id: fuel.id },
            data: { paymentStatus: 'paid' as any },
          });
        }
        const repair = await this.prisma.repairLog.findFirst({ where: { mpesaTransactionId: txn.id } });
        if (repair) {
          await this.prisma.repairLog.update({
            where: { id: repair.id },
            data: { status: 'paid' as any },
          });
        }
      }
      return { acknowledged: true as const };
    });
  }
}

function findMeta(items: any[], name: string) {
  return items.find((i) => i.Name === name)?.Value;
}

function toMpesaMsisdn(e164: string): string {
  if (e164.startsWith('+')) return e164.slice(1);
  return e164;
}

function mpesaDateToDate(raw: string): Date {
  const y = raw.slice(0, 4);
  const mo = raw.slice(4, 6);
  const d = raw.slice(6, 8);
  const h = raw.slice(8, 10);
  const mi = raw.slice(10, 12);
  const s = raw.slice(12, 14);
  return new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}Z`);
}
