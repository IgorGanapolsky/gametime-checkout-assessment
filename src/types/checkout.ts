export type PlatformType = 'ios' | 'android' | 'web' | 'other';

export type PaymentMethodId = 'apple_pay' | 'google_pay' | 'affirm' | 'credit_card';

export interface DeviceCapabilities {
  platform: PlatformType;
  hasApplePayCardProvisioned: boolean;
  hasGooglePaySetup: boolean;
}

export interface CartItem {
  id: string;
  name: string;
  section: string;
  row: string;
  seats: string[];
  unitPrice: number;
  quantity: number;
}

export interface CartSummary {
  items: CartItem[];
  subtotal: number;
  serviceFee: number;
  facilityFee: number;
  total: number;
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
  cardBrand: 'visa' | 'mastercard' | 'amex' | 'discover' | 'unknown';
  isValidCardNumber: boolean;
  isValidExpiry: boolean;
  isValidCvc: boolean;
  isComplete: boolean;
}

export type CheckoutStatus =
  | 'idle'
  | 'validating'
  | 'processing'
  | 'awaiting_interruption_resolution'
  | 'succeeded'
  | 'declined'
  | 'failed';

export interface PaymentRequest {
  idempotencyKey: string;
  paymentMethod: PaymentMethodId;
  amount: number;
  currency: string;
  cardDetails?: {
    lastFour: string;
    brand: string;
    expMonth: string;
    expYear: string;
  };
  expressToken?: string;
  simulateFailureMode?: 'none' | 'declined' | 'network_error' | 'cancelled_sheet';
}

export interface PaymentResponse {
  success: boolean;
  transactionId?: string;
  status: 'captured' | 'declined' | 'error' | 'cancelled';
  errorMessage?: string;
  idempotencyKey: string;
  processedAt: string;
  wasIdempotentReplay?: boolean;
}

export interface PersistentPaymentState {
  idempotencyKey: string;
  status: CheckoutStatus;
  paymentMethod: PaymentMethodId;
  amount: number;
  startedAt: string;
  lastKnownResult?: PaymentResponse;
}

export interface EnvironmentOverride {
  forcePlatform: 'auto' | 'ios' | 'android';
  forceApplePayProvisioned: boolean;
  forceGooglePaySetup: boolean;
  forceCartTotal: number | null;
  forceFailureMode: 'none' | 'declined' | 'network_error' | 'cancelled_sheet';
  simulateSlowNetwork: boolean;
}
