import {
  CheckoutStatus,
  CreditCardData,
  DeviceCapabilities,
  EnvironmentOverride,
  PaymentMethodId,
  PaymentResponse,
  PersistentPaymentState,
} from '../types/checkout';
import { cartFromQuantity, ORDER_ID } from './cart';
import { parseAndValidateCard, tokenizeCard } from './cardValidator';
import { evaluateEligibility } from './eligibilityEngine';
import { MockPaymentBackend } from './mockPaymentApi';
import { KvStore } from './memoryKv';

export const SESSION_KEY = 'gt.checkout.session.v2';
export const LEDGER_KEY = 'gt.checkout.ledger.v2';

export type ExpressSheet = 'apple_pay' | 'google_pay' | 'affirm' | null;

export interface ControllerDeps {
  api: MockPaymentBackend;
  kv: KvStore;
  now: () => string;
  nextIdempotencyKey: () => string;
  device: DeviceCapabilities;
  override: EnvironmentOverride;
}

const RESETTABLE: CheckoutStatus[] = ['idle', 'cancelled', 'declined', 'failed'];

export class CheckoutController {
  readonly device: DeviceCapabilities;
  readonly override: EnvironmentOverride;
  private readonly api: MockPaymentBackend;
  private readonly kv: KvStore;
  private readonly now: () => string;
  private readonly nextIdempotencyKey: () => string;

  private cart = cartFromQuantity(1);
  private status: CheckoutStatus = 'idle';
  private statusMessage: string | null = null;
  private activeIdempotencyKey: string | null = null;
  private lastResponse: PaymentResponse | null = null;
  private expressSheet: ExpressSheet = null;
  private recovering = false;
  private inFlight = false;
  private attempt: PersistentPaymentState | null = null;
  private cardInputs = { number: '', expiry: '', cvc: '' };

  constructor(deps: ControllerDeps) {
    this.api = deps.api;
    this.kv = deps.kv;
    this.now = deps.now;
    this.nextIdempotencyKey = deps.nextIdempotencyKey;
    this.device = deps.device;
    this.override = deps.override;
    this.api.onLedgerChange = () => this.persistLedger();
  }

  static rehydrate(deps: ControllerDeps): CheckoutController {
    return new CheckoutController(deps);
  }

  snapshot() {
    const cardData = parseAndValidateCard(
      this.cardInputs.number,
      this.cardInputs.expiry,
      this.cardInputs.cvc
    );
    return {
      device: this.device,
      cart: this.cart,
      status: this.status,
      statusMessage: this.statusMessage,
      activeIdempotencyKey: this.activeIdempotencyKey,
      lastResponse: this.lastResponse,
      expressSheet: this.expressSheet,
      isRecoveringFromInterruption: this.recovering,
      cardData,
      eligibility: evaluateEligibility(this.device, this.cart.totalCents, this.override),
    };
  }

  setQuantity(qty: number): void {
    if (!RESETTABLE.includes(this.status)) return;
    this.cart = cartFromQuantity(qty);
  }

  updateCard(number: string, expiry: string, cvc: string): void {
    this.cardInputs = { number, expiry, cvc };
  }

  async beginExpress(method: Exclude<PaymentMethodId, 'credit_card'>): Promise<void> {
    if (!RESETTABLE.includes(this.status)) return;
    const eligibility = evaluateEligibility(this.device, this.cart.totalCents, this.override);
    const allowed =
      (method === 'apple_pay' && eligibility.applePayAvailable) ||
      (method === 'google_pay' && eligibility.googlePayAvailable) ||
      (method === 'affirm' && eligibility.affirmAvailable);
    if (!allowed) return;

    const key = this.nextIdempotencyKey();
    const attempt: PersistentPaymentState = {
      idempotencyKey: key,
      orderId: ORDER_ID,
      status: method === 'affirm' ? 'awaiting_redirect' : 'awaiting_wallet',
      paymentMethod: method,
      amountCents: this.cart.totalCents,
      paymentMethodToken: `tok_express_${method}`,
      startedAt: this.now(),
    };
    this.attempt = attempt;
    this.activeIdempotencyKey = key;
    this.expressSheet = method;
    this.status = attempt.status;
    this.statusMessage =
      method === 'affirm' ? 'Opening Affirm…' : 'Opening wallet sheet…';
    await this.persistSession(attempt);

    if (this.override.forceFailureMode === 'cancelled_sheet') {
      await this.cancelSheet();
    }
  }

  async confirmSheet(): Promise<void> {
    const attempt = this.attempt;
    this.expressSheet = null;
    if (!attempt) return;
    await this.charge(attempt);
  }

  async cancelSheet(): Promise<void> {
    this.expressSheet = null;
    this.status = 'cancelled';
    this.statusMessage = 'Wallet / Affirm cancelled. Nothing was charged.';
    this.attempt = null;
    this.activeIdempotencyKey = null;
    await this.kv.del(SESSION_KEY);
  }

  async payCard(): Promise<void> {
    const card: CreditCardData = parseAndValidateCard(
      this.cardInputs.number,
      this.cardInputs.expiry,
      this.cardInputs.cvc
    );
    if (!card.isComplete) return;
    const key = this.nextIdempotencyKey();
    const attempt: PersistentPaymentState = {
      idempotencyKey: key,
      orderId: ORDER_ID,
      status: 'processing',
      paymentMethod: 'credit_card',
      amountCents: this.cart.totalCents,
      paymentMethodToken: tokenizeCard(card.cardNumber, card.cardBrand),
      startedAt: this.now(),
    };
    this.attempt = attempt;
    this.activeIdempotencyKey = key;
    await this.persistSession(attempt);
    await this.charge(attempt);
  }

  async reset(): Promise<void> {
    this.inFlight = false;
    this.attempt = null;
    this.status = 'idle';
    this.statusMessage = null;
    this.activeIdempotencyKey = null;
    this.lastResponse = null;
    this.expressSheet = null;
    this.cardInputs = { number: '', expiry: '', cvc: '' };
    await this.kv.del(SESSION_KEY);
  }

  async recover(): Promise<{ status: CheckoutStatus }> {
    if (this.inFlight) {
      return { status: this.status };
    }
    const stored = this.attempt || (await this.loadSession());
    if (!stored) {
      return { status: this.status };
    }
    this.recovering = true;
    this.attempt = stored;
    this.activeIdempotencyKey = stored.idempotencyKey;
    this.status = 'reconciling';
    this.statusMessage = "We don't know yet — checking with the payment API.";
    try {
      await this.hydrateLedger();
      const result = await this.api.queryPaymentStatus(stored.idempotencyKey);
      if (result && result.status !== 'processing') {
        await this.applyTerminal(result);
      } else if (result?.status === 'processing') {
        this.status = 'reconciling';
      } else {
        this.status = 'idle';
        this.statusMessage =
          'The last attempt never reached the payment API. You can try again — this will not double-charge.';
        this.attempt = null;
        this.activeIdempotencyKey = null;
        await this.kv.del(SESSION_KEY);
      }
    } finally {
      this.recovering = false;
    }
    return { status: this.status };
  }

  private async charge(attempt: PersistentPaymentState): Promise<void> {
    this.inFlight = true;
    this.status = 'processing';
    this.statusMessage = 'Authorizing payment…';
    await this.persistSession({ ...attempt, status: 'processing' });
    try {
      const response = await this.api.processPayment({
        idempotencyKey: attempt.idempotencyKey,
        orderId: attempt.orderId,
        paymentMethod: attempt.paymentMethod,
        amountCents: attempt.amountCents,
        currency: 'usd',
        paymentMethodToken: attempt.paymentMethodToken || 'tok_missing',
        simulateFailureMode: this.override.forceFailureMode,
        simulateSlowNetwork: this.override.simulateSlowNetwork,
      });
      await this.applyTerminal(response);
    } catch {
      this.inFlight = false;
      this.status = 'reconciling';
      this.statusMessage = "We don't know yet — checking with the payment API.";
      const recovered = await this.api.queryPaymentStatus(attempt.idempotencyKey);
      if (recovered && recovered.status !== 'processing') {
        await this.applyTerminal(recovered);
      }
    }
  }

  private async applyTerminal(response: PaymentResponse): Promise<void> {
    this.lastResponse = response;
    this.inFlight = false;
    if (response.success) {
      this.status = 'succeeded';
      this.statusMessage = 'Payment confirmed. Tickets are ready.';
      await this.kv.del(SESSION_KEY);
      return;
    }
    if (response.status === 'cancelled') {
      this.status = 'cancelled';
      await this.kv.del(SESSION_KEY);
      return;
    }
    if (response.status === 'processing') {
      this.status = 'reconciling';
      return;
    }
    this.status = response.status === 'declined' ? 'declined' : 'failed';
    this.statusMessage = response.errorMessage || 'Payment failed.';
    await this.kv.del(SESSION_KEY);
  }

  private async persistSession(state: PersistentPaymentState): Promise<void> {
    await this.kv.set(SESSION_KEY, JSON.stringify(state));
  }

  private async loadSession(): Promise<PersistentPaymentState | null> {
    const raw = await this.kv.get(SESSION_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as PersistentPaymentState;
    } catch {
      return null;
    }
  }

  private async persistLedger(): Promise<void> {
    await this.kv.set(LEDGER_KEY, JSON.stringify(this.api.exportLedger()));
  }

  private async hydrateLedger(): Promise<void> {
    const raw = await this.kv.get(LEDGER_KEY);
    if (!raw) return;
    try {
      this.api.hydrate(JSON.parse(raw));
    } catch {
      /* corrupt cache */
    }
  }
}
