import React, { createContext, useContext, useState } from 'react';
import { Platform } from 'react-native';
import { DeviceCapabilities, EnvironmentOverride } from '../types/checkout';

interface EnvironmentContextType {
  device: DeviceCapabilities;
  override: EnvironmentOverride;
  isDevDrawerOpen: boolean;
  setDevDrawerOpen: (open: boolean) => void;
  updateOverride: (partial: Partial<EnvironmentOverride>) => void;
  resetOverride: () => void;
}

const defaultDevice: DeviceCapabilities = {
  platform: Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web',
  hasApplePayCardProvisioned: Platform.OS === 'ios',
  hasGooglePaySetup: Platform.OS === 'android',
};

const defaultOverride: EnvironmentOverride = {
  forcePlatform: 'auto',
  forceApplePayProvisioned: true,
  forceGooglePaySetup: true,
  forceCartTotal: null,
  forceFailureMode: 'none',
  simulateSlowNetwork: false,
};

const EnvironmentContext = createContext<EnvironmentContextType | undefined>(undefined);

export const EnvironmentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [device] = useState<DeviceCapabilities>(defaultDevice);
  const [override, setOverride] = useState<EnvironmentOverride>(defaultOverride);
  const [isDevDrawerOpen, setDevDrawerOpen] = useState<boolean>(false);

  const updateOverride = (partial: Partial<EnvironmentOverride>) => {
    setOverride((prev) => ({ ...prev, ...partial }));
  };

  const resetOverride = () => {
    setOverride(defaultOverride);
  };

  return (
    <EnvironmentContext.Provider
      value={{
        device,
        override,
        isDevDrawerOpen,
        setDevDrawerOpen,
        updateOverride,
        resetOverride,
      }}
    >
      {children}
    </EnvironmentContext.Provider>
  );
};

export function useEnvironment() {
  const context = useContext(EnvironmentContext);
  if (!context) {
    throw new Error('useEnvironment must be used within an EnvironmentProvider');
  }
  return context;
}
