/**
 * Full e2e instrumentation of the checkout controller.
 * These tests are the product spec: they failed first (TDD), then the
 * controller was written to satisfy them. They do not render React Native.
 */
import { MemoryKv } from '../services/memoryKv';
import { MockPaymentBackend } from '../services/mockPaymentApi';
import {
  CheckoutController,
  LEDGER_KEY,
  SESSION_KEY,
} from '../services/checkoutController';
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

  it('reset restores the one-ticket cart and hides Affirm again', async () => {
    const { controller } = makeController({ platform: 'android' });
    controller.setQuantity(2);
    expect(controller.snapshot().eligibility.affirmAvailable).toBe(true);

    await controller.reset();

    expect(controller.snapshot().cart.items[0].quantity).toBe(1);
    expect(controller.snapshot().eligibility.affirmAvailable).toBe(false);
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

  it('coalesces concurrent card taps into one idempotency key and one API row', async () => {
    const api = new MockPaymentBackend({ latencyMs: 30 });
    const kv = new MemoryKv();
    const nextIdempotencyKey = jest
      .fn<string, []>()
      .mockReturnValueOnce('idem_single')
      .mockReturnValue('idem_duplicate');
    const controller = new CheckoutController({
      api,
      kv,
      now: () => '2026-08-13T20:10:00.000Z',
      nextIdempotencyKey,
      device: {
        platform: 'android',
        hasApplePayCardProvisioned: false,
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
    await Promise.all([controller.payCard(), controller.payCard()]);

    expect(nextIdempotencyKey).toHaveBeenCalledTimes(1);
    expect(api.exportLedger()).toHaveLength(1);
    expect(controller.snapshot().activeIdempotencyKey).toBe('idem_single');
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

  it('cold process restart settles a durable processing row without the old backend', async () => {
    const firstApi = new MockPaymentBackend({ latencyMs: 45 });
    const firstKv = new MemoryKv();
    const first = new CheckoutController({
      api: firstApi,
      kv: firstKv,
      now: () => '2026-08-13T20:10:00.000Z',
      nextIdempotencyKey: () => 'idem_cold_restart',
      device: {
        platform: 'android',
        hasApplePayCardProvisioned: false,
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

    first.updateCard('4242424242424242', '12/28', '123');
    const abandonedProcess = first.payCard();
    let persistedLedger = await firstKv.get(LEDGER_KEY);
    for (let i = 0; i < 20 && !persistedLedger; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 2));
      persistedLedger = await firstKv.get(LEDGER_KEY);
    }
    expect(persistedLedger).toContain('processing');

    // Copy only durable storage into a new process. The original backend and
    // controller are deliberately not shared with the relaunched instance.
    const relaunchedKv = new MemoryKv();
    await relaunchedKv.set(SESSION_KEY, (await firstKv.get(SESSION_KEY))!);
    await relaunchedKv.set(LEDGER_KEY, persistedLedger!);
    const relaunchedApi = new MockPaymentBackend();
    const relaunched = CheckoutController.rehydrate({
      api: relaunchedApi,
      kv: relaunchedKv,
      now: () => '2026-08-13T20:11:00.000Z',
      nextIdempotencyKey: () => 'idem_must_not_be_used',
      device: {
        platform: 'android',
        hasApplePayCardProvisioned: false,
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

    await new Promise((resolve) => setTimeout(resolve, 50));
    await relaunched.recover();

    expect(relaunched.snapshot().status).toBe('succeeded');
    expect(relaunched.snapshot().activeIdempotencyKey).toBe('idem_cold_restart');
    expect(relaunched.snapshot().lastResponse?.idempotencyKey).toBe(
      'idem_cold_restart'
    );
    expect(relaunchedApi.exportLedger()).toHaveLength(1);
    await abandonedProcess;
  });

  it('504 lost response reconciles the accepted charge without minting a new key', async () => {
    const { controller, api } = makeController({
      failure: 'network_error',
      keys: ['idem_504'],
    });
    controller.updateCard('4242424242424242', '12/28', '123');
    await controller.payCard();
    expect(controller.snapshot().status).toBe('succeeded');
    expect(controller.snapshot().activeIdempotencyKey).toBe('idem_504');
    expect((await api.queryPaymentStatus('idem_504'))?.status).toBe('captured');
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
