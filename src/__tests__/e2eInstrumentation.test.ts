import { evaluateEligibility } from '../services/eligibilityEngine';
import { parseAndValidateCard, tokenizeCard } from '../services/cardValidator';
import { MockPaymentBackend } from '../services/mockPaymentApi';

describe('instrumented checkout paths', () => {
  let api: MockPaymentBackend;

  beforeEach(() => {
    api = new MockPaymentBackend();
  });

  it('Apple Pay eligibility + single express charge', async () => {
    const rules = evaluateEligibility(
      { platform: 'ios', hasApplePayCardProvisioned: true, hasGooglePaySetup: false },
      17_780
    );
    expect(rules.applePayAvailable).toBe(true);

    const res = await api.processPayment({
      idempotencyKey: 'e2e_apple',
      orderId: 'ord_1',
      paymentMethod: 'apple_pay',
      amountCents: 17780,
      currency: 'usd',
      paymentMethodToken: 'tok_express_apple_pay',
    });
    expect(res.success).toBe(true);
    expect(res.transactionId).toBe('pay_e2e_appl_17780');
  });

  it('Affirm only when total is over $100, then charges', async () => {
    const hidden = evaluateEligibility(
      { platform: 'android', hasApplePayCardProvisioned: false, hasGooglePaySetup: true },
      9090
    );
    const shown = evaluateEligibility(
      { platform: 'android', hasApplePayCardProvisioned: false, hasGooglePaySetup: true },
      17780
    );
    expect(hidden.affirmAvailable).toBe(false);
    expect(shown.affirmAvailable).toBe(true);

    const res = await api.processPayment({
      idempotencyKey: 'e2e_affirm',
      orderId: 'ord_1',
      paymentMethod: 'affirm',
      amountCents: 17780,
      currency: 'usd',
      paymentMethodToken: 'tok_express_affirm',
    });
    expect(res.status).toBe('captured');
  });

  it('valid card tokenizes and charges without sending a PAN', async () => {
    const card = parseAndValidateCard('4242424242424242', '12/28', '123', new Date('2026-08-13'));
    expect(card.isComplete).toBe(true);
    const token = tokenizeCard(card.cardNumber, card.cardBrand);
    expect(token).toBe('tok_visa_4242');

    const res = await api.processPayment({
      idempotencyKey: 'e2e_card',
      orderId: 'ord_1',
      paymentMethod: 'credit_card',
      amountCents: 9090,
      currency: 'usd',
      paymentMethodToken: token,
    });
    expect(res.success).toBe(true);
  });

  it('kill/relaunch replays the same idempotency key', async () => {
    const req = {
      idempotencyKey: 'e2e_interrupt',
      orderId: 'ord_1',
      paymentMethod: 'apple_pay' as const,
      amountCents: 17780,
      currency: 'usd' as const,
      paymentMethodToken: 'tok_express_apple_pay',
    };
    const first = await api.processPayment(req);
    const recovered = await api.queryPaymentStatus('e2e_interrupt');
    const retry = await api.processPayment(req);
    expect(recovered?.transactionId).toEqual(first.transactionId);
    expect(retry.transactionId).toEqual(first.transactionId);
    expect(retry.wasIdempotentReplay).toBe(true);
  });

  it('declined card stays declined on GET', async () => {
    const res = await api.processPayment({
      idempotencyKey: 'e2e_decline',
      orderId: 'ord_1',
      paymentMethod: 'credit_card',
      amountCents: 9090,
      currency: 'usd',
      paymentMethodToken: 'tok_visa_declined',
    });
    expect(res.status).toBe('declined');
    const again = await api.queryPaymentStatus('e2e_decline');
    expect(again?.status).toBe('declined');
  });
});
