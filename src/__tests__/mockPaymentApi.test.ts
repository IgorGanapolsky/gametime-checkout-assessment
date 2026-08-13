import { describe, it, expect, beforeEach } from '@jest/globals';
import { mockPaymentApi } from '../services/mockPaymentApi';

describe('Mock Payment API Service', () => {
  beforeEach(() => {
    mockPaymentApi.clearLedger();
  });

  it('processes fresh payment successfully and returns transaction ID', async () => {
    const key = `test_key_${Date.now()}`;
    const res = await mockPaymentApi.processPayment({
      idempotencyKey: key,
      paymentMethod: 'apple_pay',
      amount: 150,
      currency: 'USD',
    });

    expect(res.success).toBe(true);
    expect(res.status).toBe('captured');
    expect(res.transactionId).toBeDefined();
    expect(res.wasIdempotentReplay).toBeUndefined();
  });

  it('guarantees idempotency on duplicate requests with same key (prevents double charging)', async () => {
    const key = `idempotency_duplicate_test_123`;
    const firstRes = await mockPaymentApi.processPayment({
      idempotencyKey: key,
      paymentMethod: 'credit_card',
      amount: 250,
      currency: 'USD',
    });

    // Replay request with exact same idempotency key
    const secondRes = await mockPaymentApi.processPayment({
      idempotencyKey: key,
      paymentMethod: 'credit_card',
      amount: 250,
      currency: 'USD',
    });

    expect(secondRes.success).toBe(true);
    expect(secondRes.transactionId).toEqual(firstRes.transactionId);
    expect(secondRes.wasIdempotentReplay).toBe(true);
  });

  it('handles simulated card decline', async () => {
    const key = `test_decline_key`;
    const res = await mockPaymentApi.processPayment({
      idempotencyKey: key,
      paymentMethod: 'credit_card',
      amount: 100,
      currency: 'USD',
      simulateFailureMode: 'declined',
    } as any);

    expect(res.success).toBe(false);
    expect(res.status).toBe('declined');
    expect(res.errorMessage).toContain('Card declined');
  });

  it('allows querying payment status by idempotency key during recovery', async () => {
    const key = `test_query_key_999`;
    await mockPaymentApi.processPayment({
      idempotencyKey: key,
      paymentMethod: 'google_pay',
      amount: 120,
      currency: 'USD',
    });

    const queried = await mockPaymentApi.queryPaymentStatus(key);
    expect(queried).not.toBeNull();
    expect(queried?.success).toBe(true);
  });
});
