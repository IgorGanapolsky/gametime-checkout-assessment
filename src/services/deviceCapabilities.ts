import { Platform } from 'react-native';
import * as Device from 'expo-device';
import { DeviceCapabilities, PlatformType } from '../types/checkout';

function platformFromOs(): PlatformType {
  if (Platform.OS === 'ios') return 'ios';
  if (Platform.OS === 'android') return 'android';
  if (Platform.OS === 'web') return 'web';
  return 'other';
}

/**
 * Real detection lives here and is the default.
 *
 * Apple Pay / Google Pay native SDKs are stubbed per the brief. A production
 * build would call:
 *   - iOS: PKPaymentAuthorizationController.canMakePaymentsUsingNetworks
 *   - Android: PaymentsClient.isReadyToPay
 *
 * Until those native adapters are implemented, the honest production
 * capability is false even on a physical phone. The Review Lab can force a
 * capability for deterministic reviewer flows without claiming a wallet is
 * actually provisioned.
 */
export function detectDeviceCapabilities(): DeviceCapabilities {
  const platform = platformFromOs();
  void Device.isDevice;

  return {
    platform,
    hasApplePayCardProvisioned: false,
    hasGooglePaySetup: false,
  };
}
