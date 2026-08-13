import React, { createContext, useContext, useMemo, useState } from 'react';
import { DeviceCapabilities, EnvironmentOverride } from '../types/checkout';
import { detectDeviceCapabilities } from '../services/deviceCapabilities';

interface EnvironmentContextType {
  device: DeviceCapabilities;
  override: EnvironmentOverride;
  isDevDrawerOpen: boolean;
  setDevDrawerOpen: (open: boolean) => void;
  updateOverride: (partial: Partial<EnvironmentOverride>) => void;
  resetOverride: () => void;
}

const defaultOverride: EnvironmentOverride = {
  forcePlatform: 'auto',
  forceApplePayProvisioned: 'device',
  forceGooglePaySetup: 'device',
  forceFailureMode: 'none',
  simulateSlowNetwork: false,
};

const EnvironmentContext = createContext<EnvironmentContextType | undefined>(
  undefined
);

export const EnvironmentProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const device = useMemo(() => detectDeviceCapabilities(), []);
  const [override, setOverride] = useState<EnvironmentOverride>(defaultOverride);
  const [isDevDrawerOpen, setDevDrawerOpen] = useState(false);

  const updateOverride = (partial: Partial<EnvironmentOverride>) => {
    setOverride((prev) => ({ ...prev, ...partial }));
  };

  const resetOverride = () => setOverride(defaultOverride);

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
    throw new Error('useEnvironment must be used within a EnvironmentProvider');
  }
  return context;
}
