import { MockPaymentBackend } from '../services/mockPaymentApi';
import { PaymentRequest } from '../types/checkout';

function base(overrides: Partial<PaymentRequest> = {}): PaymentRequest {
  return {
    idempotencyKey: 'idem_test_1',
    orderId: 'ord_1',
    paymentMethod: 'credit_card',
    amountCents: 9090,
    currency: 'usd',
    paymentMethodToken: 'tok_visa_4242',
    ...overrides,
  };
}

describe('mock payment API contract', () => {
  let api: MockPaymentBackend;

  beforeEach(() => {
    api = new MockPaymentBackend();
  });

  it('captures a fresh charge and returns a stable transaction id', async () => {
    const res = await api.processPayment(base({ paymentMethod: 'apple_pay', paymentMethodToken: 'tok_express_apple_pay' }));
    expect(res.success).toBe(true);
    expect(res.status).toBe('captured');
    expect(res.transactionId).toBe('pay_idem_tes_9090');
  });

  it('replays the same capture for a duplicate idempotency key (no double charge)', async () => {
    const first = await api.processPayment(base());
    const second = await api.processPayment(base());
    expect(second.transactionId).toEqual(first.transactionId);
    expect(second.wasIdempotentReplay).toBe(true);
  });

  it('conflicts when the same key is reused with a different amount', async () => {
    await api.processPayment(base());
    const conflict = await api.processPayment(base({ amountCents: 17780 }));
    expect(conflict.status).toBe('conflict');
    expect(conflict.success).toBe(false);
  });

  it('declines the documented 0002 test token', async () => {
    const res = await api.processPayment(
      base({ idempotencyKey: 'idem_decline', paymentMethodToken: 'tok_visa_declined' })
    );
    expect(res.success).toBe(false);
    expect(res.status).toBe('declined');
    expect(res.declineCode).toBe('card_declined');
  });

  it('writes a processing row before a network timeout so recovery can poll', async () => {
    await expect(
      api.processPayment(
        base({
          idempotencyKey: 'idem_timeout',
          simulateFailureMode: 'network_error',
        })
      )
    ).rejects.toThrow(/NETWORK_TIMEOUT/);

    const mid = await api.queryPaymentStatus('idem_timeout');
    expect(mid?.status).toBe('processing');
  });

  it('lets recovery query a captured payment by idempotency key', async () => {
    await api.processPayment(base({ idempotencyKey: 'idem_query', paymentMethod: 'google_pay', paymentMethodToken: 'tok_express_google_pay' }));
    const queried = await api.queryPaymentStatus('idem_query');
    expect(queried?.success).toBe(true);
    expect(queried?.status).toBe('captured');
  });
});
