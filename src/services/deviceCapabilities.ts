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
 * Simulators and Expo Go almost never have a provisioned wallet, so the
 * honest default is false unless we are on a real device. The Review Lab
 * can force either state without four phones.
 */
export function detectDeviceCapabilities(): DeviceCapabilities {
  const platform = platformFromOs();
  const onRealDevice = Device.isDevice === true;

  return {
    platform,
    hasApplePayCardProvisioned: platform === 'ios' && onRealDevice,
    hasGooglePaySetup: platform === 'android' && onRealDevice,
  };
}
