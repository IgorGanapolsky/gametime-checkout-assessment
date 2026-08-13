import React, { useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import TestRenderer, { act } from 'react-test-renderer';
import { CheckoutProvider, useCheckout } from '../context/CheckoutContext';
import { EnvironmentProvider } from '../context/EnvironmentContext';
import { mockPaymentApi } from '../services/mockPaymentApi';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

jest.mock('react-native', () => ({
  AppState: {
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  },
  Platform: { OS: 'android' },
}));

jest.mock('expo-device', () => ({ isDevice: true }));

const storage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

let checkout: ReturnType<typeof useCheckout>;
let renderer: TestRenderer.ReactTestRenderer | undefined;

function Probe() {
  const value = useCheckout();
  useEffect(() => {
    checkout = value;
  }, [value]);
  return null;
}

async function mountCheckout() {
  await act(async () => {
    renderer = TestRenderer.create(
      <EnvironmentProvider>
        <CheckoutProvider>
          <Probe />
        </CheckoutProvider>
      </EnvironmentProvider>
    );
    await Promise.resolve();
  });
}

describe('CheckoutProvider durable-boundary behavior', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const originalConsoleError = console.error;
    jest.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      if (
        args[0] ===
        'react-test-renderer is deprecated. See https://react.dev/warnings/react-test-renderer'
      ) {
        return;
      }
      originalConsoleError(...args);
    });
    mockPaymentApi.clearLedger();
    mockPaymentApi.onLedgerChange = undefined;
    storage.getItem.mockResolvedValue(null);
    storage.setItem.mockResolvedValue(undefined);
    storage.removeItem.mockResolvedValue(undefined);
  });

  afterEach(async () => {
    if (renderer) {
      await act(async () => renderer?.unmount());
      renderer = undefined;
    }
    jest.restoreAllMocks();
  });

  it('fails closed before POST when the attempt cannot be persisted, then allows retry', async () => {
    const processPayment = jest
      .spyOn(mockPaymentApi, 'processPayment')
      .mockResolvedValue({
        success: true,
        status: 'captured',
        transactionId: 'pay_provider_retry',
        idempotencyKey: 'card_provider_retry',
        processedAt: '2026-08-13T21:00:00.000Z',
      });
    await mountCheckout();

    await act(async () => {
      checkout.updateCardDetails('4242424242424242', '1228', '123');
    });
    storage.setItem.mockRejectedValueOnce(new Error('disk unavailable'));

    await act(async () => {
      await expect(checkout.processCardPayment()).resolves.toBeUndefined();
    });

    expect(processPayment).not.toHaveBeenCalled();
    expect(checkout.status).toBe('failed');
    expect(checkout.statusMessage).toBe(
      'Secure checkout storage is unavailable. Payment was not attempted.'
    );
    expect(checkout.activeIdempotencyKey).toBeNull();

    await act(async () => {
      await checkout.processCardPayment();
    });

    expect(processPayment).toHaveBeenCalledTimes(1);
    expect(checkout.status).toBe('succeeded');
  });

  it('atomically consumes an express attempt when cancel wins the race', async () => {
    const processPayment = jest.spyOn(mockPaymentApi, 'processPayment');
    await mountCheckout();

    await act(async () => {
      await checkout.beginExpressPayment('google_pay');
    });

    let releaseRemove!: () => void;
    storage.removeItem.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          releaseRemove = resolve;
        })
    );

    let cancellation!: Promise<void>;
    await act(async () => {
      cancellation = checkout.cancelExpressSheet();
      await Promise.resolve();
    });
    await act(async () => {
      await checkout.confirmExpressSheet();
    });

    expect(processPayment).not.toHaveBeenCalled();
    expect(checkout.status).toBe('cancelled');

    releaseRemove();
    await act(async () => cancellation);
  });

  it('fails closed when an express attempt cannot be persisted', async () => {
    const processPayment = jest.spyOn(mockPaymentApi, 'processPayment');
    await mountCheckout();
    storage.setItem.mockRejectedValueOnce(new Error('disk unavailable'));

    await act(async () => {
      await expect(
        checkout.beginExpressPayment('google_pay')
      ).resolves.toBeUndefined();
    });

    expect(processPayment).not.toHaveBeenCalled();
    expect(checkout.status).toBe('failed');
    expect(checkout.expressSheet).toBeNull();
    expect(checkout.activeIdempotencyKey).toBeNull();
  });

  it('does not reject or charge when storage deletion fails after cancellation', async () => {
    const processPayment = jest.spyOn(mockPaymentApi, 'processPayment');
    await mountCheckout();
    await act(async () => {
      await checkout.beginExpressPayment('google_pay');
    });
    storage.removeItem.mockRejectedValueOnce(new Error('disk unavailable'));

    await act(async () => {
      await expect(checkout.cancelExpressSheet()).resolves.toBeUndefined();
      await checkout.confirmExpressSheet();
    });

    expect(processPayment).not.toHaveBeenCalled();
    expect(checkout.status).toBe('cancelled');
  });
});
