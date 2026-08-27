import { Injectable } from '@nestjs/common';
import { Counter, register } from 'prom-client';

type OutboundStatus = 'queued' | 'sent' | 'failed' | 'suppressed' | 'quota_exceeded';
type RfidResult = 'accepted' | 'unknown_tag' | 'no_active_trip' | 'failed';
type MpesaStatus = 'initiated' | 'succeeded' | 'failed' | 'cancelled';

@Injectable()
export class MetricsService {
  private readonly outboundMessagesCounter: Counter<'channel' | 'status'>;
  private readonly rfidScansCounter: Counter<'result'>;
  private readonly mpesaTransactionsCounter: Counter<'purpose' | 'status'>;

  constructor() {
    this.outboundMessagesCounter = this.getOrCreateCounter<'channel' | 'status'>(
      'safari_outbound_messages_total',
      'Total outbound messages by channel and status.',
      ['channel', 'status'],
    );

    this.rfidScansCounter = this.getOrCreateCounter<'result'>(
      'safari_rfid_scans_total',
      'Total RFID scans by ingestion result.',
      ['result'],
    );

    this.mpesaTransactionsCounter = this.getOrCreateCounter<'purpose' | 'status'>(
      'safari_mpesa_transactions_total',
      'Total M-Pesa transactions by purpose and status.',
      ['purpose', 'status'],
    );
  }

  recordOutboundMessage(channel: 'sms' | 'email' | 'push' | 'voice', status: OutboundStatus) {
    this.outboundMessagesCounter.inc({ channel, status });
  }

  recordRfidScan(result: RfidResult) {
    this.rfidScansCounter.inc({ result });
  }

  recordMpesaTransaction(purpose: 'fuel' | 'repair', status: MpesaStatus) {
    this.mpesaTransactionsCounter.inc({ purpose, status });
  }

  private getOrCreateCounter<TLabels extends string>(
    name: string,
    help: string,
    labelNames: TLabels[],
  ): Counter<TLabels> {
    const existing = register.getSingleMetric(name);
    if (existing) {
      return existing as Counter<TLabels>;
    }
    return new Counter<TLabels>({
      name,
      help,
      labelNames,
    });
  }
}
