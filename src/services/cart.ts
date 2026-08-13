import { CartSummary } from '../types/checkout';

export const UNIT_PRICE_CENTS = 7900;
export const FACILITY_FEE_CENTS = 400;
export const ORDER_ID = 'ord_sf_la_lower_114';

export function cartFromQuantity(quantity: number): CartSummary {
  const qty = Math.max(1, Math.min(6, quantity));
  const subtotalCents = UNIT_PRICE_CENTS * qty;
  const serviceFeeCents = Math.round(subtotalCents * 0.1);
  return {
    items: [
      {
        id: 'item_sf_la',
        name: 'SF Giants vs LA Dodgers',
        section: 'Lower Box 114',
        row: '12',
        seats: Array.from({ length: qty }, (_, i) => String(14 + i)),
        unitPriceCents: UNIT_PRICE_CENTS,
        quantity: qty,
      },
    ],
    subtotalCents,
    serviceFeeCents,
    facilityFeeCents: FACILITY_FEE_CENTS,
    totalCents: subtotalCents + serviceFeeCents + FACILITY_FEE_CENTS,
  };
}
