import {
  AFFIRM_THRESHOLD_CENTS,
  DeviceCapabilities,
  EnvironmentOverride,
  PaymentEligibilityRules,
  PlatformType,
} from '../types/checkout';

function resolvePlatform(
  device: DeviceCapabilities,
  override?: EnvironmentOverride
): PlatformType {
  if (override && override.forcePlatform !== 'auto') {
    return override.forcePlatform;
  }
  return device.platform;
}

function resolveFlag(
  deviceValue: boolean,
  overrideValue: EnvironmentOverride['forceApplePayProvisioned'] | undefined
): boolean {
  if (overrideValue === undefined || overrideValue === 'device') {
    return deviceValue;
  }
  return overrideValue;
}

/**
 * Pure eligibility function. Showing a method that cannot complete is worse
 * than hiding it — the rules below are the product spec, not heuristics.
 *
 * Affirm is available only when the purchase total is *over* $100
 * (`totalCents > 10000`). Quantity and fee changes must re-run this.
 */
export function evaluateEligibility(
  device: DeviceCapabilities,
  totalCents: number,
  override?: EnvironmentOverride
): PaymentEligibilityRules {
  const platform = resolvePlatform(device, override);
  const appleProvisioned = resolveFlag(
    device.hasApplePayCardProvisioned,
    override?.forceApplePayProvisioned
  );
  const googleReady = resolveFlag(
    device.hasGooglePaySetup,
    override?.forceGooglePaySetup
  );

  return {
    applePayAvailable: platform === 'ios' && appleProvisioned,
    googlePayAvailable: platform === 'android' && googleReady,
    affirmAvailable: totalCents > AFFIRM_THRESHOLD_CENTS,
    creditCardAvailable: true,
  };
}
