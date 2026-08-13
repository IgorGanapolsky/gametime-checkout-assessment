import { describe, it, expect } from '@jest/globals';
import { evaluateEligibility } from '../services/eligibilityEngine';

describe('Payment Eligibility Engine', () => {
  it('enables Apple Pay only on iOS when card is provisioned', () => {
    const iosDevice = {
      platform: 'ios' as const,
      hasApplePayCardProvisioned: true,
      hasGooglePaySetup: false,
    };
    const rules = evaluateEligibility(iosDevice, 150);

    expect(rules.applePayAvailable).toBe(true);
    expect(rules.googlePayAvailable).toBe(false);
    expect(rules.creditCardAvailable).toBe(true);
  });

  it('disables Apple Pay on iOS when no card is provisioned in Wallet', () => {
    const iosDevice = {
      platform: 'ios' as const,
      hasApplePayCardProvisioned: false,
      hasGooglePaySetup: false,
    };
    const rules = evaluateEligibility(iosDevice, 150);

    expect(rules.applePayAvailable).toBe(false);
  });

  it('enables Google Pay only on Android when Google Pay is set up', () => {
    const androidDevice = {
      platform: 'android' as const,
      hasApplePayCardProvisioned: false,
      hasGooglePaySetup: true,
    };
    const rules = evaluateEligibility(androidDevice, 150);

    expect(rules.applePayAvailable).toBe(false);
    expect(rules.googlePayAvailable).toBe(true);
  });

  it('enables Affirm only when cart total > $100', () => {
    const device = {
      platform: 'ios' as const,
      hasApplePayCardProvisioned: true,
      hasGooglePaySetup: false,
    };

    const rulesUnder100 = evaluateEligibility(device, 45);
    expect(rulesUnder100.affirmAvailable).toBe(false);

    const rulesOver100 = evaluateEligibility(device, 105);
    expect(rulesOver100.affirmAvailable).toBe(true);
  });

  it('respects environment overrides when active', () => {
    const device = {
      platform: 'ios' as const,
      hasApplePayCardProvisioned: true,
      hasGooglePaySetup: false,
    };

    const override = {
      forcePlatform: 'android' as const,
      forceApplePayProvisioned: false,
      forceGooglePaySetup: true,
      forceCartTotal: 50,
      forceFailureMode: 'none' as const,
      simulateSlowNetwork: false,
    };

    const rules = evaluateEligibility(device, 200, override);
    expect(rules.applePayAvailable).toBe(false);
    expect(rules.googlePayAvailable).toBe(true);
    expect(rules.affirmAvailable).toBe(false); // $50 total < $100 threshold
  });
});
