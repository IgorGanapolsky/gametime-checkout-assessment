import { PaymentRequest, PaymentResponse } from '../types/checkout';

/**
 * In-memory server ledger to maintain idempotency records across app re-runs.
 * In a real production architecture, this is backed by Redis or PostgreSQL with unique constraints on idempotency_key.
 */
class MockPaymentBackend {
  private ledger = new Map<string, PaymentResponse>();

  /**
   * Processes a payment request with strict idempotency guarantees.
   */
  public async processPayment(
    request: PaymentRequest
  ): Promise<PaymentResponse> {
    const { idempotencyKey, simulateFailureMode, simulateSlowNetwork } = request as any;

    // Simulate real network delay
    const delay = simulateSlowNetwork ? 2500 : 800;
    await new Promise((resolve) => setTimeout(resolve, delay));

    // Idempotency Check: If key was previously processed, return exact cached response
    if (this.ledger.has(idempotencyKey)) {
      const cached = this.ledger.get(idempotencyKey)!;
      return {
        ...cached,
        wasIdempotentReplay: true,
      };
    }

    // Handle forced/simulated failure paths
    if (simulateFailureMode === 'declined') {
      const response: PaymentResponse = {
        success: false,
        status: 'declined',
        errorMessage: 'Card declined: Insufficient funds or bank security block.',
        idempotencyKey,
        processedAt: new Date().toISOString(),
      };
      this.ledger.set(idempotencyKey, response);
      return response;
    }

    if (simulateFailureMode === 'cancelled_sheet') {
      const response: PaymentResponse = {
        success: false,
        status: 'cancelled',
        errorMessage: 'Payment cancelled by user.',
        idempotencyKey,
        processedAt: new Date().toISOString(),
      };
      // Do not store cancelled sheets as permanent failure in ledger so user can re-try with new key
      return response;
    }

    if (simulateFailureMode === 'network_error') {
      throw new Error('Network Connection Error: Server unreachable (HTTP 504 Gateway Timeout).');
    }

    // Default Success Path
    const response: PaymentResponse = {
      success: true,
      status: 'captured',
      transactionId: `txn_gt_${Math.random().toString(36).substring(2, 10)}_${Date.now()}`,
      idempotencyKey,
      processedAt: new Date().toISOString(),
    };

    this.ledger.set(idempotencyKey, response);
    return response;
  }

  /**
   * Queries existing payment status by idempotency key (used during app lifecycle recovery).
   */
  public async queryPaymentStatus(
    idempotencyKey: string
  ): Promise<PaymentResponse | null> {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return this.ledger.get(idempotencyKey) || null;
  }

  /**
   * Resets backend ledger (used by dev simulator).
   */
  public clearLedger(): void {
    this.ledger.clear();
  }
}

export const mockPaymentApi = new MockPaymentBackend();
