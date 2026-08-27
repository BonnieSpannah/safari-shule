import { api } from './client';

export interface PaymentTransaction {
  id: string;
  tenantId: string;
  purpose: 'fuel' | 'repair';
  amountKes: number;
  phoneE164: string;
  accountReference: string;
  checkoutRequestId: string;
  merchantRequestId: string | null;
  mpesaReceiptNumber: string | null;
  status: 'initiated' | 'succeeded' | 'failed' | 'cancelled';
  resultCode: number | null;
  resultDescription: string | null;
  initiatedAt: string;
  completedAt: string | null;
  tenant?: { id: string; name: string; slug: string } | null;
}

export interface ListPaymentsResponse {
  data: PaymentTransaction[];
  meta: { page: number; pageSize: number; total: number; pageCount: number };
}

export async function listPayments(params?: {
  q?: string;
  status?: string;
  purpose?: string;
  from?: string;
  to?: string;
  tenantId?: string;
  page?: number;
  pageSize?: number;
}): Promise<ListPaymentsResponse> {
  const { data } = await api.get<ListPaymentsResponse>('/v1/payments', { params });
  return data;
}

export async function getPayment(id: string, tenantId?: string): Promise<PaymentTransaction> {
  const { data } = await api.get<PaymentTransaction>(`/v1/payments/${id}`, {
    params: tenantId ? { tenantId } : undefined,
  });
  return data;
}

export async function initiateFuelPayment(input: {
  fuelLogId: string;
  amountKes: number;
  phoneE164: string;
  description: string;
}): Promise<{ transactionId: string; checkoutRequestId: string }> {
  const { data } = await api.post<{ transactionId: string; checkoutRequestId: string }>(
    '/v1/payments/fuel/initiate',
    input,
  );
  return data;
}

export async function initiateRepairPayment(input: {
  repairLogId: string;
  amountKes: number;
  phoneE164: string;
  description: string;
}): Promise<{ transactionId: string; checkoutRequestId: string }> {
  const { data } = await api.post<{ transactionId: string; checkoutRequestId: string }>(
    '/v1/payments/repair/initiate',
    input,
  );
  return data;
}
