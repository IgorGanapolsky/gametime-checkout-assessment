import { evaluateEligibility } from '../services/eligibilityEngine';

const iosWallet = {
  platform: 'ios' as const,
  hasApplePayCardProvisioned: true,
  hasGooglePaySetup: false,
};

const iosNoWallet = {
  platform: 'ios' as const,
  hasApplePayCardProvisioned: false,
  hasGooglePaySetup: false,
};

const androidReady = {
  platform: 'android' as const,
  hasApplePayCardProvisioned: false,
  hasGooglePaySetup: true,
};

describe('evaluateEligibility', () => {
  it('shows Apple Pay only on iOS with a provisioned wallet card', () => {
    const rules = evaluateEligibility(iosWallet, 15_000);
    expect(rules.applePayAvailable).toBe(true);
    expect(rules.googlePayAvailable).toBe(false);
    expect(rules.creditCardAvailable).toBe(true);
  });

  it('hides Apple Pay on iOS when Wallet has no card', () => {
    expect(evaluateEligibility(iosNoWallet, 15_000).applePayAvailable).toBe(false);
  });

  it('never shows Apple Pay on Android even if a wallet flag is true', () => {
    const rules = evaluateEligibility(
      { platform: 'android', hasApplePayCardProvisioned: true, hasGooglePaySetup: true },
      15_000
    );
    expect(rules.applePayAvailable).toBe(false);
    expect(rules.googlePayAvailable).toBe(true);
  });

  it('shows Affirm only when total is strictly over $100.00', () => {
    expect(evaluateEligibility(iosWallet, 10_000).affirmAvailable).toBe(false);
    expect(evaluateEligibility(iosWallet, 10_001).affirmAvailable).toBe(true);
    expect(evaluateEligibility(iosWallet, 9_090).affirmAvailable).toBe(false);
  });

  it('lets Review Lab force Android + GPay and a sub-$100 total', () => {
    const rules = evaluateEligibility(iosWallet, 20_000, {
      forcePlatform: 'android',
      forceApplePayProvisioned: false,
      forceGooglePaySetup: true,
      forceFailureMode: 'none',
      simulateSlowNetwork: false,
    });
    expect(rules.applePayAvailable).toBe(false);
    expect(rules.googlePayAvailable).toBe(true);
    expect(rules.affirmAvailable).toBe(true);
  });

  it('keeps device wallet flags when override is "device"', () => {
    const rules = evaluateEligibility(androidReady, 5_000, {
      forcePlatform: 'auto',
      forceApplePayProvisioned: 'device',
      forceGooglePaySetup: 'device',
      forceFailureMode: 'none',
      simulateSlowNetwork: false,
    });
    expect(rules.googlePayAvailable).toBe(true);
    expect(rules.applePayAvailable).toBe(false);
    expect(rules.affirmAvailable).toBe(false);
  });
});
