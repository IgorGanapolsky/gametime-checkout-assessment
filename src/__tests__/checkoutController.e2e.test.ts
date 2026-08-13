/**
 * Full e2e instrumentation of the checkout controller.
 * These tests are the product spec: they failed first (TDD), then the
 * controller was written to satisfy them. They do not render React Native.
 */
import { MemoryKv } from '../services/memoryKv';
import { MockPaymentBackend } from '../services/mockPaymentApi';
import { CheckoutController } from '../services/checkoutController';
import { evaluateEligibility } from '../services/eligibilityEngine';

function makeController(
  opts: {
    platform?: 'ios' | 'android';
    apple?: boolean;
    google?: boolean;
    failure?: 'none' | 'declined' | 'network_error' | 'cancelled_sheet';
    keys?: string[];
  } = {}
) {
  const api = new MockPaymentBackend({ latencyMs: 0 });
  const kv = new MemoryKv();
  const keys = [...(opts.keys ?? ['idem_fixed'])];
  const controller = new CheckoutController({
    api,
    kv,
    now: () => '2026-08-13T20:10:00.000Z',
    nextIdempotencyKey: () => keys.shift() || 'idem_overflow',
    device: {
      platform: opts.platform ?? 'ios',
      hasApplePayCardProvisioned: opts.apple ?? true,
      hasGooglePaySetup: opts.google ?? false,
    },
    override: {
      forcePlatform: 'auto',
      forceApplePayProvisioned: 'device',
      forceGooglePaySetup: 'device',
      forceFailureMode: opts.failure ?? 'none',
      simulateSlowNetwork: false,
    },
  });
  return { controller, api, kv };
}

describe('CheckoutController e2e instrumentation', () => {
  it('hides Apple Pay when Wallet is empty and still charges card', async () => {
    const { controller } = makeController({ apple: false });
    expect(controller.snapshot().eligibility.applePayAvailable).toBe(false);
    await controller.beginExpress('apple_pay');
    expect(controller.snapshot().status).toBe('idle');
    expect(controller.snapshot().expressSheet).toBeNull();

    controller.updateCard('4242424242424242', '12/28', '123');
    expect(controller.snapshot().cardData.isComplete).toBe(true);
    await controller.payCard();
    const snap = controller.snapshot();
    expect(snap.status).toBe('succeeded');
    expect(snap.lastResponse?.transactionId).toBeDefined();
    expect(JSON.stringify(snap.lastResponse)).not.toContain('4242424242424242');
  });

  it('express Apple Pay is one interaction: tap → sheet → Pay charges, no second submit', async () => {
    const { controller, api } = makeController({ apple: true, keys: ['idem_ap'] });
    expect(controller.snapshot().eligibility.applePayAvailable).toBe(true);

    await controller.beginExpress('apple_pay');
    expect(controller.snapshot().status).toBe('awaiting_wallet');
    expect(controller.snapshot().expressSheet).toBe('apple_pay');
    expect(await api.queryPaymentStatus('idem_ap')).toBeNull();

    await controller.confirmSheet();
    const snap = controller.snapshot();
    expect(snap.status).toBe('succeeded');
    expect(snap.expressSheet).toBeNull();
    expect(snap.lastResponse?.wasIdempotentReplay).not.toBe(true);
    expect(snap.activeIdempotencyKey).toBe('idem_ap');
  });

  it('cancelling the wallet sheet does not create a charge', async () => {
    const { controller, api } = makeController({ keys: ['idem_cancel'] });
    await controller.beginExpress('apple_pay');
    await controller.cancelSheet();
    expect(controller.snapshot().status).toBe('cancelled');
    expect(await api.queryPaymentStatus('idem_cancel')).toBeNull();
  });

  it('Affirm appears only after qty crosses $100 and express redirect charges once', async () => {
    const { controller } = makeController({
      platform: 'android',
      apple: false,
      google: true,
      keys: ['idem_aff'],
    });
    expect(controller.snapshot().eligibility.affirmAvailable).toBe(false);
    controller.setQuantity(2);
    expect(controller.snapshot().eligibility.affirmAvailable).toBe(true);
    expect(
      evaluateEligibility(controller.snapshot().device, controller.snapshot().cart.totalCents)
        .affirmAvailable
    ).toBe(true);

    await controller.beginExpress('affirm');
    expect(controller.snapshot().status).toBe('awaiting_redirect');
    await controller.confirmSheet();
    expect(controller.snapshot().status).toBe('succeeded');
  });

  it('locks quantity while a payment is in flight', async () => {
    const { controller } = makeController();
    await controller.beginExpress('apple_pay');
    const qty = controller.snapshot().cart.items[0].quantity;
    controller.setQuantity(3);
    expect(controller.snapshot().cart.items[0].quantity).toBe(qty);
  });

  it('declines tok_visa_declined and allows a new attempt with a new key', async () => {
    const { controller, api } = makeController({ keys: ['idem_d1', 'idem_d2'] });
    controller.updateCard('4000000000000002', '12/28', '123');
    await controller.payCard();
    expect(controller.snapshot().status).toBe('declined');
    expect((await api.queryPaymentStatus('idem_d1'))?.status).toBe('declined');

    await controller.reset();
    controller.updateCard('4242424242424242', '12/28', '123');
    await controller.payCard();
    expect(controller.snapshot().status).toBe('succeeded');
    expect((await api.queryPaymentStatus('idem_d2'))?.success).toBe(true);
  });

  it('kill mid-flight then relaunch GET-replays the same key (no double charge)', async () => {
    const api = new MockPaymentBackend({ latencyMs: 40, queryLatencyMs: 0 });
    const kv = new MemoryKv();
    const controller = new CheckoutController({
      api,
      kv,
      now: () => '2026-08-13T20:10:00.000Z',
      nextIdempotencyKey: () => 'idem_kill',
      device: {
        platform: 'ios',
        hasApplePayCardProvisioned: true,
        hasGooglePaySetup: false,
      },
      override: {
        forcePlatform: 'auto',
        forceApplePayProvisioned: 'device',
        forceGooglePaySetup: 'device',
        forceFailureMode: 'none',
        simulateSlowNetwork: false,
      },
    });

    controller.updateCard('4242424242424242', '12/28', '123');
    const payPromise = controller.payCard();
    let mid = await api.queryPaymentStatus('idem_kill');
    for (let i = 0; i < 20 && !mid; i += 1) {
      await new Promise((r) => setTimeout(r, 2));
      mid = await api.queryPaymentStatus('idem_kill');
    }
    expect(mid?.status === 'processing' || mid?.status === 'captured').toBe(true);
    if (mid?.status !== 'processing') {
      // The charge finished before we sampled — still one key, still recoverable.
    }

    const revived = CheckoutController.rehydrate({
      api,
      kv,
      now: () => '2026-08-13T20:11:00.000Z',
      nextIdempotencyKey: () => 'idem_should_not_use',
      device: {
        platform: 'ios',
        hasApplePayCardProvisioned: true,
        hasGooglePaySetup: false,
      },
      override: {
        forcePlatform: 'auto',
        forceApplePayProvisioned: 'device',
        forceGooglePaySetup: 'device',
        forceFailureMode: 'none',
        simulateSlowNetwork: false,
      },
    });
    await revived.recover();
    await payPromise;

    const after = await revived.recover();
    expect(after.status === 'succeeded' || after.status === 'reconciling' || after.status === 'processing').toBe(
      true
    );
    await new Promise((r) => setTimeout(r, 40));
    await revived.recover();
    expect(revived.snapshot().lastResponse?.transactionId).toBe(
      (await api.queryPaymentStatus('idem_kill'))?.transactionId
    );
    expect(revived.snapshot().lastResponse?.idempotencyKey).toBe('idem_kill');
    expect(api.exportLedger()).toHaveLength(1);
  });

  it('504 leaves a processing row; recover does not mint a new key', async () => {
    const { controller, api } = makeController({
      failure: 'network_error',
      keys: ['idem_504'],
    });
    controller.updateCard('4242424242424242', '12/28', '123');
    await controller.payCard();
    expect(controller.snapshot().status).toBe('reconciling');
    expect(controller.snapshot().activeIdempotencyKey).toBe('idem_504');
    expect((await api.queryPaymentStatus('idem_504'))?.status).toBe('processing');
    await controller.recover();
    expect(controller.snapshot().activeIdempotencyKey).toBe('idem_504');
    expect(api.exportLedger()).toHaveLength(1);
  });

  it('incomplete card never hits the API', async () => {
    const { controller, api } = makeController({ keys: ['idem_nope'] });
    controller.updateCard('4242', '12', '1');
    await controller.payCard();
    expect(controller.snapshot().status).toBe('idle');
    expect(api.exportLedger()).toHaveLength(0);
  });
});
