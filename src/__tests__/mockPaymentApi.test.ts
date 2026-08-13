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

  afterEach(() => {
    jest.useRealTimers();
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

  it('settles an accepted charge before simulating a lost 504 response', async () => {
    await expect(
      api.processPayment(
        base({
          idempotencyKey: 'idem_timeout',
          simulateFailureMode: 'network_error',
        })
      )
    ).rejects.toThrow(/NETWORK_TIMEOUT/);

    const recovered = await api.queryPaymentStatus('idem_timeout');
    expect(recovered?.status).toBe('captured');
    expect(recovered?.idempotencyKey).toBe('idem_timeout');
    expect(api.exportLedger()).toHaveLength(1);
  });

  it('lets recovery query a captured payment by idempotency key', async () => {
    await api.processPayment(base({ idempotencyKey: 'idem_query', paymentMethod: 'google_pay', paymentMethodToken: 'tok_express_google_pay' }));
    const queried = await api.queryPaymentStatus('idem_query');
    expect(queried?.success).toBe(true);
    expect(queried?.status).toBe('captured');
  });

  it('keeps the explicit slow-network request processing long enough for a device kill', async () => {
    jest.useFakeTimers();
    const startedAt = Date.now();
    const pending = api.processPayment(
      base({ idempotencyKey: 'idem_device_kill', simulateSlowNetwork: true })
    );
    const durableRow = api.exportLedger()[0].record;

    expect(durableRow.response.status).toBe('processing');
    expect(durableRow.settleAtMs).toBeGreaterThanOrEqual(startedAt + 6000);

    await jest.advanceTimersByTimeAsync(8000);
    await expect(pending).resolves.toMatchObject({
      status: 'captured',
      idempotencyKey: 'idem_device_kill',
    });
  });
});
