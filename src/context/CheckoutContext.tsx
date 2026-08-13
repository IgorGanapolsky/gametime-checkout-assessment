import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  CartSummary,
  CheckoutStatus,
  CreditCardData,
  PaymentMethodId,
  PaymentResponse,
  PersistentPaymentState,
} from '../types/checkout';
import { parseAndValidateCard } from '../services/cardValidator';
import { evaluateEligibility } from '../services/eligibilityEngine';
import { mockPaymentApi } from '../services/mockPaymentApi';
import { useEnvironment } from './EnvironmentContext';

const PERSISTENCE_KEY = '@gt_checkout_pending_state_v1';

const initialCart: CartSummary = {
  items: [
    {
      id: 'item_sf_la',
      name: 'SF Giants vs LA Dodgers',
      section: 'Lower Box 114',
      row: '12',
      seats: ['14', '15'],
      unitPrice: 165.0,
      quantity: 2,
    },
  ],
  subtotal: 330.0,
  serviceFee: 32.5,
  facilityFee: 8.0,
  total: 370.5,
};

interface CheckoutContextType {
  cart: CartSummary;
  setQuantity: (quantity: number) => void;
  status: CheckoutStatus;
  statusMessage: string | null;
  activeIdempotencyKey: string | null;
  cardData: CreditCardData;
  updateCardDetails: (number: string, expiry: string, cvc: string) => void;
  eligibility: ReturnType<typeof evaluateEligibility>;
  processExpressPayment: (method: PaymentMethodId) => Promise<void>;
  processCardPayment: () => Promise<void>;
  lastResponse: PaymentResponse | null;
  isRecoveringFromInterruption: boolean;
  resetCheckout: () => void;
  simulateInterruption: () => void;
}

const CheckoutContext = createContext<CheckoutContextType | undefined>(
  undefined
);

export const CheckoutProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { device, override } = useEnvironment();
  const [cart, setCart] = useState<CartSummary>(initialCart);
  const [status, setStatus] = useState<CheckoutStatus>('idle');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [activeIdempotencyKey, setActiveIdempotencyKey] = useState<
    string | null
  >(null);
  const [lastResponse, setLastResponse] = useState<PaymentResponse | null>(
    null
  );
  const [isRecoveringFromInterruption, setIsRecoveringFromInterruption] =
    useState<boolean>(false);

  const [cardInputs, setCardInputs] = useState({
    number: '',
    expiry: '',
    cvc: '',
  });

  const cardData = parseAndValidateCard(
    cardInputs.number,
    cardInputs.expiry,
    cardInputs.cvc
  );

  const eligibility = evaluateEligibility(device, cart.total, override);

  const setQuantity = (qty: number) => {
    const newQty = Math.max(1, qty);
    const subtotal = initialCart.items[0].unitPrice * newQty;
    const serviceFee = Math.round(subtotal * 0.1 * 100) / 100;
    const facilityFee = 8.0;
    const total = subtotal + serviceFee + facilityFee;

    setCart({
      items: [
        {
          ...initialCart.items[0],
          quantity: newQty,
        },
      ],
      subtotal,
      serviceFee,
      facilityFee,
      total,
    });
  };

  const updateCardDetails = (number: string, expiry: string, cvc: string) => {
    setCardInputs({ number, expiry, cvc });
  };

  /**
   * Helper to persist pending payment state to disk before network dispatch.
   */
  const savePendingState = async (
    key: string,
    method: PaymentMethodId
  ): Promise<void> => {
    const pendingState: PersistentPaymentState = {
      idempotencyKey: key,
      status: 'processing',
      paymentMethod: method,
      amount: cart.total,
      startedAt: new Date().toISOString(),
    };
    await AsyncStorage.setItem(PERSISTENCE_KEY, JSON.stringify(pendingState));
  };

  const clearPendingState = async (): Promise<void> => {
    await AsyncStorage.removeItem(PERSISTENCE_KEY);
  };

  /**
   * Recovers state if app was interrupted (backgrounded or killed mid-flight).
   */
  const recoverPendingPayment = useCallback(async () => {
    try {
      const storedJson = await AsyncStorage.getItem(PERSISTENCE_KEY);
      if (!storedJson) return;

      const storedState: PersistentPaymentState = JSON.parse(storedJson);
      setIsRecoveringFromInterruption(true);
      setStatus('awaiting_interruption_resolution');
      setStatusMessage(
        'Resuming checkout... Checking transaction status with backend.'
      );

      // Query mock payment backend with saved idempotency key
      const result = await mockPaymentApi.queryPaymentStatus(
        storedState.idempotencyKey
      );

      if (result) {
        setLastResponse(result);
        if (result.success) {
          setStatus('succeeded');
          setStatusMessage('Payment confirmed! Your tickets are ready.');
        } else {
          setStatus('declined');
          setStatusMessage(result.errorMessage || 'Payment was declined.');
        }
      } else {
        // Backend didn't receive it before kill; safely restore idle state without double charging
        setStatus('idle');
        setStatusMessage(
          'Transaction was interrupted before completion. You can safely try again.'
        );
      }
      await clearPendingState();
    } catch (err) {
      console.warn('Failed to recover pending payment state:', err);
    } finally {
      setIsRecoveringFromInterruption(false);
    }
  }, []);

  // Listen for AppState changes (e.g. background -> active)
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        recoverPendingPayment();
      }
    };

    const subscription = AppState.addEventListener(
      'change',
      handleAppStateChange
    );

    // Initial cold-start recovery check
    recoverPendingPayment();

    return () => {
      subscription.remove();
    };
  }, [recoverPendingPayment]);

  /**
   * Executes Express payment (Apple Pay, Google Pay, Affirm) in one tap.
   */
  const processExpressPayment = async (method: PaymentMethodId) => {
    const key = `idempotency_gt_exp_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 6)}`;
    setActiveIdempotencyKey(key);
    setStatus('processing');
    setStatusMessage(
      `Authorizing ${
        method === 'apple_pay'
          ? 'Apple Pay'
          : method === 'google_pay'
          ? 'Google Pay'
          : 'Affirm'
      }...`
    );

    try {
      await savePendingState(key, method);

      const response = await mockPaymentApi.processPayment({
        idempotencyKey: key,
        paymentMethod: method,
        amount: cart.total,
        currency: 'USD',
        expressToken: `tok_express_${method}_${Date.now()}`,
        simulateFailureMode: override.forceFailureMode as any,
        simulateSlowNetwork: override.simulateSlowNetwork as any,
      } as any);

      setLastResponse(response);
      if (response.success) {
        setStatus('succeeded');
        setStatusMessage('Transaction approved! Order confirmed.');
      } else {
        setStatus('declined');
        setStatusMessage(response.errorMessage || 'Express payment failed.');
      }
    } catch (err: any) {
      setStatus('failed');
      setStatusMessage(
        err?.message || 'Network error encountered during payment.'
      );
    } finally {
      await clearPendingState();
    }
  };

  /**
   * Executes standard Credit Card payment.
   */
  const processCardPayment = async () => {
    if (!cardData.isComplete) return;

    const key = `idempotency_gt_cc_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 6)}`;
    setActiveIdempotencyKey(key);
    setStatus('processing');
    setStatusMessage('Processing card payment with payment gateway...');

    try {
      await savePendingState(key, 'credit_card');

      const response = await mockPaymentApi.processPayment({
        idempotencyKey: key,
        paymentMethod: 'credit_card',
        amount: cart.total,
        currency: 'USD',
        cardDetails: {
          lastFour: cardData.cardNumber.slice(-4),
          brand: cardData.cardBrand,
          expMonth: cardData.expiryMonth,
          expYear: cardData.expiryYear,
        },
        simulateFailureMode: override.forceFailureMode as any,
        simulateSlowNetwork: override.simulateSlowNetwork as any,
      } as any);

      setLastResponse(response);
      if (response.success) {
        setStatus('succeeded');
        setStatusMessage('Payment processed successfully!');
      } else {
        setStatus('declined');
        setStatusMessage(response.errorMessage || 'Card payment declined.');
      }
    } catch (err: any) {
      setStatus('failed');
      setStatusMessage(
        err?.message || 'Connection failure while contacting payment gateway.'
      );
    } finally {
      await clearPendingState();
    }
  };

  const resetCheckout = () => {
    setStatus('idle');
    setStatusMessage(null);
    setActiveIdempotencyKey(null);
    setLastResponse(null);
    setCardInputs({ number: '', expiry: '', cvc: '' });
  };

  const simulateInterruption = async () => {
    if (status === 'processing' && activeIdempotencyKey) {
      setStatus('awaiting_interruption_resolution');
      setStatusMessage('Simulating background app interruption...');
      await recoverPendingPayment();
    }
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
        processExpressPayment,
        processCardPayment,
        lastResponse,
        isRecoveringFromInterruption,
        resetCheckout,
        simulateInterruption,
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
