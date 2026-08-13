import {
  DeviceCapabilities,
  EnvironmentOverride,
  PaymentEligibilityRules,
} from '../types/checkout';

/**
 * Pure evaluation function for payment method eligibility.
 * Evaluates platform capabilities, provisioned cards, and cart purchase threshold.
 */
export function evaluateEligibility(
  device: DeviceCapabilities,
  cartTotal: number,
  override?: EnvironmentOverride
): PaymentEligibilityRules {
  // Apply platform overrides if active
  const effectivePlatform =
    override && override.forcePlatform !== 'auto'
      ? override.forcePlatform
      : device.platform;

  const effectiveApplePayCard =
    override && override.forcePlatform !== 'auto'
      ? override.forceApplePayProvisioned
      : device.hasApplePayCardProvisioned;

  const effectiveGooglePaySetup =
    override && override.forcePlatform !== 'auto'
      ? override.forceGooglePaySetup
      : device.hasGooglePaySetup;

  const effectiveTotal =
    override && override.forceCartTotal !== null
      ? override.forceCartTotal
      : cartTotal;

  const applePayAvailable =
    effectivePlatform === 'ios' && effectiveApplePayCard;

  const googlePayAvailable =
    effectivePlatform === 'android' && effectiveGooglePaySetup;

  const affirmAvailable = effectiveTotal > 100;

  return {
    applePayAvailable,
    googlePayAvailable,
    affirmAvailable,
    creditCardAvailable: true, // Universal fallback
  };
}
