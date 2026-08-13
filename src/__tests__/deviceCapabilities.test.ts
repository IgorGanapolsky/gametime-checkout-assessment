import { detectDeviceCapabilities } from '../services/deviceCapabilities';

jest.mock('react-native', () => ({
  Platform: { OS: 'android' },
}));

jest.mock('expo-device', () => ({
  isDevice: true,
}));

describe('detectDeviceCapabilities', () => {
  it('fails closed when the real wallet readiness adapter is still stubbed', () => {
    expect(detectDeviceCapabilities()).toEqual({
      platform: 'android',
      hasApplePayCardProvisioned: false,
      hasGooglePaySetup: false,
    });
  });
});
