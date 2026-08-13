export type PlatformType = 'ios' | 'android' | 'web' | 'other';

export type PaymentMethodId = 'apple_pay' | 'google_pay' | 'affirm' | 'credit_card';

export type CardBrand = 'visa' | 'mastercard' | 'amex' | 'discover' | 'unknown';

export type FailureMode = 'none' | 'declined' | 'network_error' | 'cancelled_sheet';

export type WalletOverride = 'device' | true | false;

export interface DeviceCapabilities {
  platform: PlatformType;
  /** Real capability check result (stubbed; default false on simulators). */
  hasApplePayCardProvisioned: boolean;
  hasGooglePaySetup: boolean;
}

export interface CartItem {
  id: string;
  name: string;
  section: string;
  row: string;
  seats: string[];
  unitPriceCents: number;
  quantity: number;
}

export interface CartSummary {
  items: CartItem[];
  subtotalCents: number;
  serviceFeeCents: number;
  facilityFeeCents: number;
  totalCents: number;
}

export interface PaymentEligibilityRules {
  applePayAvailable: boolean;
  googlePayAvailable: boolean;
  affirmAvailable: boolean;
  creditCardAvailable: boolean;
}

export interface CreditCardData {
  cardNumber: string;
  formattedCardNumber: string;
  expiryMonth: string;
  expiryYear: string;
  cvc: string;
  cardBrand: CardBrand;
  isValidCardNumber: boolean;
  isValidExpiry: boolean;
  isValidCvc: boolean;
  isComplete: boolean;
}

/**
 * Checkout state machine. `reconciling` is the honest "we don't know yet"
 * state after background/kill — never treat absence of a local result as success
 * or as a safe new charge.
 */
export type CheckoutStatus =
  | 'idle'
  | 'awaiting_wallet'
  | 'awaiting_redirect'
  | 'processing'
  | 'reconciling'
  | 'succeeded'
  | 'declined'
  | 'cancelled'
  | 'failed';

export interface PaymentRequest {
  idempotencyKey: string;
  orderId: string;
  paymentMethod: PaymentMethodId;
  amountCents: number;
  currency: 'usd';
  /** Tokenized instrument — never a PAN. */
  paymentMethodToken: string;
  simulateFailureMode?: FailureMode;
  simulateSlowNetwork?: boolean;
}

export type PaymentApiStatus = 'processing' | 'captured' | 'declined' | 'cancelled' | 'conflict';

export interface PaymentResponse {
  success: boolean;
  transactionId?: string;
  status: PaymentApiStatus;
  errorMessage?: string;
  declineCode?: string;
  idempotencyKey: string;
  processedAt: string;
  wasIdempotentReplay?: boolean;
}

export interface PersistentPaymentState {
  idempotencyKey: string;
  orderId: string;
  status: CheckoutStatus;
  paymentMethod: PaymentMethodId;
  amountCents: number;
  paymentMethodToken?: string;
  startedAt: string;
  lastKnownResult?: PaymentResponse;
}

export interface EnvironmentOverride {
  forcePlatform: 'auto' | 'ios' | 'android';
  forceApplePayProvisioned: WalletOverride;
  forceGooglePaySetup: WalletOverride;
  forceFailureMode: FailureMode;
  simulateSlowNetwork: boolean;
}

export const AFFIRM_THRESHOLD_CENTS = 10_000; // strictly over $100.00

export function dollarsFromCents(cents: number): string {
  return (cents / 100).toFixed(2);
}
