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
  updateCardDetails: (number: string, expiry: string, cvc: string) => void;
  eligibility: ReturnType<typeof evaluateEligibility>;
  beginExpressPayment: (method: Exclude<PaymentMethodId, 'credit_card'>) => Promise<void>;
  confirmExpressSheet: () => Promise<void>;
  cancelExpressSheet: () => Promise<void>;
  processCardPayment: () => Promise<void>;
  lastResponse: PaymentResponse | null;
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
      await clearSession();
      return;
    }
    if (response.status === 'cancelled') {
      setStatus('cancelled');
      setStatusMessage(response.errorMessage || 'Payment cancelled.');
      await clearSession();
      return;
    }
    if (response.status === 'processing') {
      setStatus('reconciling');
      setStatusMessage("We don't know yet — checking with the payment API.");
      return;
    }
    setStatus(response.status === 'declined' ? 'declined' : 'failed');
    setStatusMessage(response.errorMessage || 'Payment failed.');
    await clearSession();
  }, []);

  const charge = useCallback(
    async (attempt: PersistentPaymentState) => {
      inFlightRef.current = true;
      setStatus('processing');
      setStatusMessage('Authorizing payment…');
      await persistSession({ ...attempt, status: 'processing' });

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
        await persistLedger();
        // Network drop after the API accepted the request: stay reconciling
        // and keep the same idempotency key so a retry is a GET, not a new POST.
        setStatus('reconciling');
        setStatusMessage(
          err instanceof Error
            ? `${err.message} Checking whether the charge already landed…`
            : "We don't know yet — checking with the payment API."
        );
        inFlightRef.current = false;
        const recovered = await mockPaymentApi.queryPaymentStatus(attempt.idempotencyKey);
        if (recovered && recovered.status !== 'processing') {
          await applyTerminal(recovered);
        }
      }
    },
    [applyTerminal, override.forceFailureMode, override.simulateSlowNetwork]
  );

  const reconcile = useCallback(async () => {
    if (inFlightRef.current) {
      return;
    }
    const stored = attemptRef.current || (await loadSession());
    if (!stored) return;

    setIsRecoveringFromInterruption(true);
    setActiveIdempotencyKey(stored.idempotencyKey);
    setStatus('reconciling');
    setStatusMessage("We don't know yet — checking with the payment API.");

    try {
      await hydrateLedger();
      const result = await mockPaymentApi.queryPaymentStatus(stored.idempotencyKey);
      if (result && result.status !== 'processing') {
        await applyTerminal(result);
      } else if (result?.status === 'processing') {
        setStatus('reconciling');
        setStatusMessage('Payment is still in flight. Waiting for a terminal result…');
      } else {
        // API never saw the key. Safe to let the fan start a *new* attempt.
        setStatus('idle');
        setStatusMessage(
          'The last attempt never reached the payment API. You can try again — this will not double-charge.'
        );
        await clearSession();
        attemptRef.current = null;
        setActiveIdempotencyKey(null);
      }
    } finally {
      setIsRecoveringFromInterruption(false);
    }
  }, [applyTerminal]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      await hydrateLedger();
      if (!mounted) return;
      const stored = await loadSession();
      if (stored) {
        attemptRef.current = stored;
        await reconcile();
      }
    })();

    const onChange = (next: AppStateStatus) => {
      if (next === 'active') {
        void reconcile();
      }
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, [reconcile]);

  const beginExpressPayment = async (
    method: Exclude<PaymentMethodId, 'credit_card'>
  ) => {
    if (status !== 'idle' && status !== 'cancelled' && status !== 'declined' && status !== 'failed') {
      return;
    }
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
    await persistSession(attempt);

    if (override.forceFailureMode === 'cancelled_sheet') {
      await cancelExpressSheet();
    }
  };

  const confirmExpressSheet = async () => {
    const attempt = attemptRef.current;
    setExpressSheet(null);
    if (!attempt) return;
    await charge(attempt);
  };

  const cancelExpressSheet = async () => {
    setExpressSheet(null);
    setStatus('cancelled');
    setStatusMessage('Wallet / Affirm cancelled. Nothing was charged.');
    await clearSession();
    attemptRef.current = null;
    setActiveIdempotencyKey(null);
  };

  const processCardPayment = async () => {
    if (!cardData.isComplete) return;
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
    await persistSession(attempt);
    await charge(attempt);
  };

  const resetCheckout = async () => {
    inFlightRef.current = false;
    attemptRef.current = null;
    setStatus('idle');
    setStatusMessage(null);
    setActiveIdempotencyKey(null);
    setLastResponse(null);
    setExpressSheet(null);
    setCardInputs({ number: '', expiry: '', cvc: '' });
    await clearSession();
  };

  const simulateKillRelaunch = async () => {
    inFlightRef.current = false;
    setExpressSheet(null);
    await persistLedger();
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
        updateCardDetails,
        eligibility,
        beginExpressPayment,
        confirmExpressSheet,
        cancelExpressSheet,
        processCardPayment,
        lastResponse,
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
