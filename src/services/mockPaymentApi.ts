import {
  PaymentApiStatus,
  PaymentRequest,
  PaymentResponse,
} from '../types/checkout';

interface LedgerRecord {
  fingerprint: string;
  response: PaymentResponse;
}

function requestFingerprint(request: PaymentRequest): string {
  return [
    request.orderId,
    request.paymentMethod,
    String(request.amountCents),
    request.paymentMethodToken,
  ].join('|');
}

function cloneResponse(record: LedgerRecord, replay: boolean): PaymentResponse {
  return {
    ...record.response,
    wasIdempotentReplay: replay,
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Mock payment API with a real request/response boundary.
 *
 * The public methods JSON-serialize both ways so the checkout cannot sneak
 * extra in-memory fields across the contract. The ledger is the source of
 * truth for idempotency: same key + same fingerprint replays; same key +
 * different fingerprint is a conflict (409).
 *
 * A `processing` row is written *before* the simulated network wait so a
 * kill/relaunch can reconcile instead of starting a second charge.
 */
export class MockPaymentBackend {
  private ledger = new Map<string, LedgerRecord>();
  private readonly latencyMs: number;
  private readonly queryLatencyMs: number;
  onLedgerChange?: () => void | Promise<void>;

  constructor(opts: { latencyMs?: number; queryLatencyMs?: number } = {}) {
    this.latencyMs = opts.latencyMs ?? 0;
    this.queryLatencyMs = opts.queryLatencyMs ?? 0;
  }

  hydrate(records: Array<{ key: string; record: LedgerRecord }>): void {
    this.ledger.clear();
    for (const { key, record } of records) {
      this.ledger.set(key, record);
    }
  }

  exportLedger(): Array<{ key: string; record: LedgerRecord }> {
    return Array.from(this.ledger.entries()).map(([key, record]) => ({
      key,
      record,
    }));
  }

  async processPayment(raw: PaymentRequest): Promise<PaymentResponse> {
    const request = JSON.parse(JSON.stringify(raw)) as PaymentRequest;
    this.assertRequest(request);

    const existing = this.ledger.get(request.idempotencyKey);
    if (existing) {
      if (existing.fingerprint !== requestFingerprint(request)) {
        const conflict: PaymentResponse = {
          success: false,
          status: 'conflict',
          errorMessage:
            'Idempotency-Key reused with a different payment payload (HTTP 409).',
          idempotencyKey: request.idempotencyKey,
          processedAt: new Date().toISOString(),
        };
        return JSON.parse(JSON.stringify(conflict)) as PaymentResponse;
      }
      if (existing.response.status !== 'processing') {
        return JSON.parse(JSON.stringify(cloneResponse(existing, true))) as PaymentResponse;
      }
    }

    const processing: PaymentResponse = {
      success: false,
      status: 'processing',
      idempotencyKey: request.idempotencyKey,
      processedAt: new Date().toISOString(),
    };
    this.ledger.set(request.idempotencyKey, {
      fingerprint: requestFingerprint(request),
      response: processing,
    });
    if (this.onLedgerChange) {
      await this.onLedgerChange();
    }

    const waitMs = request.simulateSlowNetwork ? 2500 : this.latencyMs;
    await delay(waitMs);

    if (request.simulateFailureMode === 'network_error') {
      // Leave the processing row. Recovery must poll, not invent a new key.
      throw new Error('NETWORK_TIMEOUT: payment API unreachable (HTTP 504).');
    }

    const terminal = this.decide(request);
    this.ledger.set(request.idempotencyKey, {
      fingerprint: requestFingerprint(request),
      response: terminal,
    });
    if (this.onLedgerChange) {
      await this.onLedgerChange();
    }
    return JSON.parse(JSON.stringify(terminal)) as PaymentResponse;
  }

  async queryPaymentStatus(idempotencyKey: string): Promise<PaymentResponse | null> {
    await delay(this.queryLatencyMs);
    const record = this.ledger.get(idempotencyKey);
    return record
      ? (JSON.parse(JSON.stringify(record.response)) as PaymentResponse)
      : null;
  }

  clearLedger(): void {
    this.ledger.clear();
  }

  private assertRequest(request: PaymentRequest): void {
    if (!request.idempotencyKey) {
      throw new Error('idempotencyKey is required');
    }
    if (!request.orderId) {
      throw new Error('orderId is required');
    }
    if (!Number.isInteger(request.amountCents) || request.amountCents <= 0) {
      throw new Error('amountCents must be a positive integer');
    }
    if (request.currency !== 'usd') {
      throw new Error('only usd is supported');
    }
    if (!request.paymentMethodToken) {
      throw new Error('paymentMethodToken is required (never send a PAN)');
    }
  }

  private decide(request: PaymentRequest): PaymentResponse {
    const now = new Date().toISOString();
    const base = {
      idempotencyKey: request.idempotencyKey,
      processedAt: now,
    };

    if (request.simulateFailureMode === 'declined') {
      return {
        ...base,
        success: false,
        status: 'declined' as PaymentApiStatus,
        declineCode: 'generic_decline',
        errorMessage: 'Card declined by the issuing bank.',
      };
    }

    if (request.simulateFailureMode === 'cancelled_sheet') {
      return {
        ...base,
        success: false,
        status: 'cancelled' as PaymentApiStatus,
        errorMessage: 'Wallet sheet cancelled by the fan.',
      };
    }

    if (request.paymentMethodToken === 'tok_visa_declined') {
      return {
        ...base,
        success: false,
        status: 'declined',
        declineCode: 'card_declined',
        errorMessage: 'Card declined (test token tok_visa_declined / 4000 0000 0000 0002).',
      };
    }

    if (request.paymentMethodToken === 'tok_visa_insufficient') {
      return {
        ...base,
        success: false,
        status: 'declined',
        declineCode: 'insufficient_funds',
        errorMessage: 'Insufficient funds (test token tok_visa_insufficient).',
      };
    }

    return {
      ...base,
      success: true,
      status: 'captured',
      transactionId: `pay_${request.idempotencyKey.slice(0, 8)}_${request.amountCents}`,
    };
  }
}

export const mockPaymentApi = new MockPaymentBackend();
