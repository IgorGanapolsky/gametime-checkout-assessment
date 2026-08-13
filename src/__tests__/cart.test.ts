import { AFFIRM_THRESHOLD_CENTS } from '../types/checkout';
import { cartFromQuantity, UNIT_PRICE_CENTS, FACILITY_FEE_CENTS } from '../services/cart';
import { evaluateEligibility } from '../services/eligibilityEngine';

const ios = {
  platform: 'ios' as const,
  hasApplePayCardProvisioned: true,
  hasGooglePaySetup: false,
};

describe('cartFromQuantity (TDD)', () => {
  it('qty 1 stays at or under the Affirm threshold', () => {
    const cart = cartFromQuantity(1);
    expect(cart.items[0].unitPriceCents).toBe(UNIT_PRICE_CENTS);
    expect(cart.facilityFeeCents).toBe(FACILITY_FEE_CENTS);
    expect(cart.totalCents).toBe(
      UNIT_PRICE_CENTS + Math.round(UNIT_PRICE_CENTS * 0.1) + FACILITY_FEE_CENTS
    );
    expect(cart.totalCents).toBeLessThanOrEqual(AFFIRM_THRESHOLD_CENTS);
    expect(evaluateEligibility(ios, cart.totalCents).affirmAvailable).toBe(false);
  });

  it('qty 2 crosses Affirm and recomputes fees in integer cents', () => {
    const cart = cartFromQuantity(2);
    expect(cart.subtotalCents).toBe(UNIT_PRICE_CENTS * 2);
    expect(cart.serviceFeeCents).toBe(Math.round(cart.subtotalCents * 0.1));
    expect(cart.totalCents).toBeGreaterThan(AFFIRM_THRESHOLD_CENTS);
    expect(evaluateEligibility(ios, cart.totalCents).affirmAvailable).toBe(true);
  });

  it('clamps quantity to 1..6', () => {
    expect(cartFromQuantity(0).items[0].quantity).toBe(1);
    expect(cartFromQuantity(99).items[0].quantity).toBe(6);
  });
});
