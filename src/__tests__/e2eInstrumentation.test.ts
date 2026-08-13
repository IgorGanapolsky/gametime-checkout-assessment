import { describe, it, expect, beforeEach } from '@jest/globals';
import { evaluateEligibility } from '../services/eligibilityEngine';
import { parseAndValidateCard } from '../services/cardValidator';
import { mockPaymentApi } from '../services/mockPaymentApi';

describe('Gametime Checkout Full E2E Flow Instrumentation', () => {
  beforeEach(() => {
    mockPaymentApi.clearLedger();
  });

  it('E2E Flow 1: Express Apple Pay Single-Tap Checkout on iOS', async () => {
    const device = {
      platform: 'ios' as const,
      hasApplePayCardProvisioned: true,
      hasGooglePaySetup: false,
    };
    const rules = evaluateEligibility(device, 370.5);
    expect(rules.applePayAvailable).toBe(true);

    const idempotencyKey = `e2e_apple_pay_${Date.now()}`;
    const response = await mockPaymentApi.processPayment({
      idempotencyKey,
      paymentMethod: 'apple_pay',
      amount: 370.5,
      currency: 'USD',
    });

    expect(response.success).toBe(true);
    expect(response.status).toBe('captured');
    expect(response.transactionId).toMatch(/^txn_gt_/);
  });

  it('E2E Flow 2: Express Affirm BNPL Checkout when total > $100', async () => {
    const device = {
      platform: 'android' as const,
      hasApplePayCardProvisioned: false,
      hasGooglePaySetup: true,
    };
    const rules = evaluateEligibility(device, 150.0);
    expect(rules.affirmAvailable).toBe(true);

    const idempotencyKey = `e2e_affirm_${Date.now()}`;
    const response = await mockPaymentApi.processPayment({
      idempotencyKey,
      paymentMethod: 'affirm',
      amount: 150.0,
      currency: 'USD',
    });

    expect(response.success).toBe(true);
    expect(response.status).toBe('captured');
  });

  it('E2E Flow 3: Credit Card Checkout with Luhn, Expiry, and CVC Validation', async () => {
    const validCard = parseAndValidateCard('4242424242424242', '12/28', '123');
    expect(validCard.isComplete).toBe(true);

    const idempotencyKey = `e2e_card_${Date.now()}`;
    const response = await mockPaymentApi.processPayment({
      idempotencyKey,
      paymentMethod: 'credit_card',
      amount: 85.0,
      currency: 'USD',
      cardDetails: {
        lastFour: validCard.cardNumber.slice(-4),
        brand: validCard.cardBrand,
        expMonth: validCard.expiryMonth,
        expYear: validCard.expiryYear,
      },
    });

    expect(response.success).toBe(true);
    expect(response.status).toBe('captured');
  });

  it('E2E Flow 4: App Lifecycle Interruption & Idempotency Recovery (No Double Charging)', async () => {
    const idempotencyKey = `e2e_interrupted_key_777`;

    // 1. Initial attempt before backgrounding
    const firstCall = await mockPaymentApi.processPayment({
      idempotencyKey,
      paymentMethod: 'apple_pay',
      amount: 200.0,
      currency: 'USD',
    });
    expect(firstCall.success).toBe(true);

    // 2. App was backgrounded mid-flow or force-quit and relaunched.
    // Querying existing status with idempotency key:
    const recoveredStatus = await mockPaymentApi.queryPaymentStatus(idempotencyKey);
    expect(recoveredStatus).not.toBeNull();
    expect(recoveredStatus?.success).toBe(true);

    // 3. Retry dispatch with same idempotency key returns exact same transaction ID and marks replay
    const retryCall = await mockPaymentApi.processPayment({
      idempotencyKey,
      paymentMethod: 'apple_pay',
      amount: 200.0,
      currency: 'USD',
    });
    expect(retryCall.transactionId).toEqual(firstCall.transactionId);
    expect(retryCall.wasIdempotentReplay).toBe(true);
  });

  it('E2E Flow 5: Handling Declined Card Error Recovery', async () => {
    const idempotencyKey = `e2e_decline_key_888`;
    const response = await mockPaymentApi.processPayment({
      idempotencyKey,
      paymentMethod: 'credit_card',
      amount: 100.0,
      currency: 'USD',
      simulateFailureMode: 'declined',
    } as any);

    expect(response.success).toBe(false);
    expect(response.status).toBe('declined');
    expect(response.errorMessage).toContain('Card declined');
  });
});
