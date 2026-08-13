import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { AppState, AppStateStatus } from 'react-native';
import {
  CartSummary,
  CheckoutStatus,
  CreditCardData,
  PaymentMethodId,
  PaymentResponse,
  PersistentPaymentState,
} from '../types/checkout';
import { parseAndValidateCard, tokenizeCard } from '../services/cardValidator';
import { evaluateEligibility } from '../services/eligibilityEngine';
import { mockPaymentApi } from '../services/mockPaymentApi';
import {
  clearPersistedLedger,
  clearSession,
  hydrateLedger,
  loadSession,
  newIdempotencyKey,
  persistLedger,
  persistSession,
} from '../services/paymentSession';
import { cartFromQuantity, ORDER_ID } from '../services/cart';
import { useEnvironment } from './EnvironmentContext';

export type ExpressSheet = 'apple_pay' | 'google_pay' | 'affirm' | null;

interface CheckoutContextType {
  cart: CartSummary;
  setQuantity: (quantity: number) => void;
  status: CheckoutStatus;
  statusMessage: string | null;
  activeIdempotencyKey: string | null;
  cardData: CreditCardData;
  cardInputs: { number: string; expiry: string; cvc: string };
  updateCardDetails: (number: string, expiry: string, cvc: string) => void;
  eligibility: ReturnType<typeof evaluateEligibility>;
  beginExpressPayment: (method: Exclude<PaymentMethodId, 'credit_card'>) => Promise<void>;
  confirmExpressSheet: () => Promise<void>;
  cancelExpressSheet: () => Promise<void>;
  processCardPayment: () => Promise<void>;
  lastResponse: PaymentResponse | null;
  ledgerCount: number;
  expressSheet: ExpressSheet;
  isRecoveringFromInterruption: boolean;
  resetCheckout: () => Promise<void>;
  simulateKillRelaunch: () => Promise<void>;
}

const CheckoutContext = createContext<CheckoutContextType | undefined>(undefined);

export const CheckoutProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { device, override } = useEnvironment();
  const [cart, setCart] = useState<CartSummary>(() => cartFromQuantity(1));
  const [status, setStatus] = useState<CheckoutStatus>('idle');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [activeIdempotencyKey, setActiveIdempotencyKey] = useState<string | null>(null);
  const [lastResponse, setLastResponse] = useState<PaymentResponse | null>(null);
  const [ledgerCount, setLedgerCount] = useState(0);
  const [expressSheet, setExpressSheet] = useState<ExpressSheet>(null);
  const [isRecoveringFromInterruption, setIsRecoveringFromInterruption] =
    useState(false);
  const [cardInputs, setCardInputs] = useState({
    number: '',
    expiry: '',
    cvc: '',
  });

  const inFlightRef = useRef(false);
  const attemptRef = useRef<PersistentPaymentState | null>(null);

  const failClosedBeforePost = useCallback(() => {
    inFlightRef.current = false;
    attemptRef.current = null;
    setExpressSheet(null);
    setActiveIdempotencyKey(null);
    setStatus('failed');
    setStatusMessage(
      'Secure checkout storage is unavailable. Payment was not attempted.'
    );
  }, []);

  const clearSessionWithoutThrow = useCallback(async () => {
    try {
      await clearSession();
    } catch {
      // A stale recovery key is safer than surfacing an unhandled promise or
      // allowing a new key to charge. Relaunch will reconcile the same key.
    }
  }, []);

  const cardData = parseAndValidateCard(
    cardInputs.number,
    cardInputs.expiry,
    cardInputs.cvc
  );
  const eligibility = evaluateEligibility(device, cart.totalCents, override);

  const setQuantity = (qty: number) => {
    if (status !== 'idle') return;
    setCart(cartFromQuantity(qty));
  };

  const updateCardDetails = (number: string, expiry: string, cvc: string) => {
    setCardInputs({ number, expiry, cvc });
  };

  const applyTerminal = useCallback(async (response: PaymentResponse) => {
    setLastResponse(response);
    inFlightRef.current = false;
    if (response.success) {
      setStatus('succeeded');
      setStatusMessage('Payment confirmed. Tickets are ready.');
      await clearSessionWithoutThrow();
      return;
    }
    if (response.status === 'cancelled') {
      setStatus('cancelled');
      setStatusMessage(response.errorMessage || 'Payment cancelled.');
      await clearSessionWithoutThrow();
      return;
    }
    if (response.status === 'processing') {
      setStatus('reconciling');
      setStatusMessage("We don't know yet — checking with the payment API.");
      return;
    }
    setStatus(response.status === 'declined' ? 'declined' : 'failed');
    setStatusMessage(response.errorMessage || 'Payment failed.');
    await clearSessionWithoutThrow();
  }, [clearSessionWithoutThrow]);

  const charge = useCallback(
    async (attempt: PersistentPaymentState) => {
      inFlightRef.current = true;
      setStatus('processing');
      setStatusMessage('Authorizing payment…');

      try {
        await persistSession({ ...attempt, status: 'processing' });
      } catch {
        failClosedBeforePost();
        return;
      }

      try {
        const response = await mockPaymentApi.processPayment({
          idempotencyKey: attempt.idempotencyKey,
          orderId: attempt.orderId,
          paymentMethod: attempt.paymentMethod,
          amountCents: attempt.amountCents,
          currency: 'usd',
          paymentMethodToken: attempt.paymentMethodToken || 'tok_missing',
          simulateFailureMode: override.forceFailureMode,
          simulateSlowNetwork: override.simulateSlowNetwork,
        });
        await persistLedger();
        await applyTerminal(response);
      } catch (err) {
        let ledgerStorageUnavailable = false;
        try {
          await persistLedger();
        } catch {
          ledgerStorageUnavailable = true;
        }
        // Network drop after the API accepted the request: stay reconciling
        // and keep the same idempotency key so a retry is a GET, not a new POST.
        setStatus('reconciling');
        setStatusMessage(
          err instanceof Error
            ? `${err.message} Checking whether the charge already landed…`
            : "We don't know yet — checking with the payment API."
        );
        inFlightRef.current = false;
        try {
          const recovered = await mockPaymentApi.queryPaymentStatus(
            attempt.idempotencyKey
          );
          if (recovered && recovered.status !== 'processing') {
            await applyTerminal(recovered);
          }
        } catch {
          setStatus('reconciling');
          setStatusMessage(
            ledgerStorageUnavailable
              ? 'Payment state storage is unavailable. No new charge will be attempted; keep this app open while we retain the same idempotency key.'
              : 'Unable to reconcile safely. No new charge will be attempted with a different key.'
          );
        }
      }
    },
    [
      applyTerminal,
      failClosedBeforePost,
      override.forceFailureMode,
      override.simulateSlowNetwork,
    ]
  );

  const reconcile = useCallback(async () => {
    if (inFlightRef.current) {
      return;
    }
    try {
      const stored = attemptRef.current || (await loadSession());
      if (!stored) return;

      setIsRecoveringFromInterruption(true);
      setActiveIdempotencyKey(stored.idempotencyKey);
      setStatus('reconciling');
      setStatusMessage("We don't know yet — checking with the payment API.");

      for (let poll = 0; poll < 8; poll += 1) {
        await hydrateLedger();
        setLedgerCount(mockPaymentApi.exportLedger().length);
        const result = await mockPaymentApi.queryPaymentStatus(
          stored.idempotencyKey
        );
        if (result && result.status !== 'processing') {
          await applyTerminal(result);
          return;
        }
        if (!result) {
          // API never saw the key. Safe to let the fan start a *new* attempt.
          setStatus('idle');
          setStatusMessage(
            'The last attempt never reached the payment API. You can try again — this will not double-charge.'
          );
          attemptRef.current = null;
          setActiveIdempotencyKey(null);
          await clearSessionWithoutThrow();
          return;
        }

        setStatus('reconciling');
        setStatusMessage('Payment is still in flight. Waiting for a terminal result…');
        if (poll < 7) {
          await new Promise((resolve) => setTimeout(resolve, 400));
        }
      }
    } catch {
      inFlightRef.current = false;
      setStatus('failed');
      setStatusMessage(
        'Unable to read durable payment state. No new charge was attempted.'
      );
    } finally {
      setIsRecoveringFromInterruption(false);
    }
  }, [applyTerminal, clearSessionWithoutThrow]);

  useEffect(() => {
    let mounted = true;
    const onLedgerChange = async () => {
      await persistLedger();
      if (mounted) {
        setLedgerCount(mockPaymentApi.exportLedger().length);
      }
    };
    mockPaymentApi.onLedgerChange = onLedgerChange;
    void (async () => {
      await hydrateLedger();
      setLedgerCount(mockPaymentApi.exportLedger().length);
      if (!mounted) return;
      const stored = await loadSession();
      if (stored) {
        attemptRef.current = stored;
        await reconcile();
      }
    })().catch(() => {
      if (!mounted) return;
      setStatus('failed');
      setStatusMessage(
        'Secure checkout storage is unavailable. Payment was not attempted.'
      );
    });

    const onChange = (next: AppStateStatus) => {
      if (next === 'active') {
        void reconcile();
      }
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => {
      mounted = false;
      if (mockPaymentApi.onLedgerChange === onLedgerChange) {
        mockPaymentApi.onLedgerChange = undefined;
      }
      sub.remove();
    };
  }, [reconcile]);

  const beginExpressPayment = async (
    method: Exclude<PaymentMethodId, 'credit_card'>
  ) => {
    if (
      inFlightRef.current ||
      (status !== 'idle' &&
        status !== 'cancelled' &&
        status !== 'declined' &&
        status !== 'failed')
    ) {
      return;
    }
    inFlightRef.current = true;
    const key = newIdempotencyKey(`exp_${method}`);
    const attempt: PersistentPaymentState = {
      idempotencyKey: key,
      orderId: ORDER_ID,
      status: method === 'affirm' ? 'awaiting_redirect' : 'awaiting_wallet',
      paymentMethod: method,
      amountCents: cart.totalCents,
      paymentMethodToken: `tok_express_${method}`,
      startedAt: new Date().toISOString(),
    };
    attemptRef.current = attempt;
    setActiveIdempotencyKey(key);
    setExpressSheet(method);
    setStatus(attempt.status);
    setStatusMessage(
      method === 'affirm'
        ? 'Opening Affirm… if the app backgrounds, we will resume this attempt.'
        : 'Opening wallet sheet… biometrics may background the app.'
    );
    try {
      await persistSession(attempt);
    } catch {
      failClosedBeforePost();
      return;
    }

    if (override.forceFailureMode === 'cancelled_sheet') {
      await cancelExpressSheet();
    }
  };

  const confirmExpressSheet = async () => {
    const attempt = attemptRef.current;
    attemptRef.current = null;
    setExpressSheet(null);
    if (!attempt) return;
    await charge(attempt);
  };

  const cancelExpressSheet = async () => {
    inFlightRef.current = false;
    attemptRef.current = null;
    setExpressSheet(null);
    setStatus('cancelled');
    setStatusMessage('Wallet / Affirm cancelled. Nothing was charged.');
    setActiveIdempotencyKey(null);
    await clearSessionWithoutThrow();
  };

  const processCardPayment = async () => {
    if (
      inFlightRef.current ||
      (status !== 'idle' &&
        status !== 'cancelled' &&
        status !== 'declined' &&
        status !== 'failed') ||
      !cardData.isComplete
    ) {
      return;
    }
    inFlightRef.current = true;
    const token = tokenizeCard(cardData.cardNumber, cardData.cardBrand);
    const key = newIdempotencyKey('card');
    const attempt: PersistentPaymentState = {
      idempotencyKey: key,
      orderId: ORDER_ID,
      status: 'processing',
      paymentMethod: 'credit_card',
      amountCents: cart.totalCents,
      paymentMethodToken: token,
      startedAt: new Date().toISOString(),
    };
    attemptRef.current = attempt;
    setActiveIdempotencyKey(key);
    await charge(attempt);
  };

  const resetCheckout = async () => {
    inFlightRef.current = false;
    attemptRef.current = null;
    setCart(cartFromQuantity(1));
    setStatus('idle');
    setStatusMessage(null);
    setActiveIdempotencyKey(null);
    setLastResponse(null);
    setLedgerCount(0);
    setExpressSheet(null);
    setCardInputs({ number: '', expiry: '', cvc: '' });
    await clearSessionWithoutThrow();
  };

  const simulateKillRelaunch = async () => {
    inFlightRef.current = false;
    setExpressSheet(null);
    try {
      await persistLedger();
    } catch {
      setStatus('failed');
      setStatusMessage(
        'Unable to persist the mock payment ledger. Relaunch was not simulated.'
      );
      return;
    }
    await reconcile();
  };

  return (
    <CheckoutContext.Provider
      value={{
        cart,
        setQuantity,
        status,
        statusMessage,
        activeIdempotencyKey,
        cardData,
        cardInputs,
        updateCardDetails,
        eligibility,
        beginExpressPayment,
        confirmExpressSheet,
        cancelExpressSheet,
        processCardPayment,
        lastResponse,
        ledgerCount,
        expressSheet,
        isRecoveringFromInterruption,
        resetCheckout,
        simulateKillRelaunch,
      }}
    >
      {children}
    </CheckoutContext.Provider>
  );
};

export function useCheckout() {
  const context = useContext(CheckoutContext);
  if (!context) {
    throw new Error('useCheckout must be used within a CheckoutProvider');
  }
  return context;
}

export async function resetAllPaymentState(): Promise<void> {
  await clearSession();
  await clearPersistedLedger();
}
