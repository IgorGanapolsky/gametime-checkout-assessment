import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  Switch,
} from 'react-native';
import { useEnvironment } from '../context/EnvironmentContext';
import { resetAllPaymentState, useCheckout } from '../context/CheckoutContext';
import { WalletOverride } from '../types/checkout';
import { TEST_IDS } from '../testing/testIds';

export const DevSimulatorDrawer: React.FC = () => {
  const {
    device,
    override,
    updateOverride,
    resetOverride,
    isDevDrawerOpen,
    setDevDrawerOpen,
  } = useEnvironment();

  const { setQuantity, resetCheckout, simulateKillRelaunch, cart } = useCheckout();

  const cycleWallet = (key: 'forceApplePayProvisioned' | 'forceGooglePaySetup') => {
    const order: WalletOverride[] = ['device', true, false];
    const current = override[key];
    const next = order[(order.indexOf(current) + 1) % order.length];
    updateOverride({ [key]: next });
  };

  return (
    <>
      <TouchableOpacity
        testID={TEST_IDS.reviewLabOpen}
        style={styles.fabTrigger}
        onPress={() => setDevDrawerOpen(true)}
        activeOpacity={0.8}
      >
        <Text style={styles.fabText}>REVIEW LAB</Text>
      </TouchableOpacity>

      <Modal
        visible={isDevDrawerOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setDevDrawerOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.drawerContainer}>
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Review Lab</Text>
              <TouchableOpacity onPress={() => setDevDrawerOpen(false)}>
                <Text style={styles.closeText}>Close</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.content}>
              <Text style={styles.meta}>
                Detected device: {device.platform}
                {device.hasApplePayCardProvisioned ? ' · wallet yes' : ' · wallet no'}
                {device.hasGooglePaySetup ? ' · GPay yes' : ' · GPay no'}
              </Text>
              <Text style={styles.meta}>
                Default detection is honest: simulators report no provisioned wallet.
              </Text>

              <Text style={styles.sectionTitle}>PLATFORM</Text>
              <View style={styles.buttonRow}>
                {(['auto', 'ios', 'android'] as const).map((plat) => (
                  <TouchableOpacity
                    key={plat}
                    style={[
                      styles.toggleBtn,
                      override.forcePlatform === plat && styles.toggleBtnActive,
                    ]}
                    onPress={() => updateOverride({ forcePlatform: plat })}
                  >
                    <Text
                      style={[
                        styles.toggleBtnText,
                        override.forcePlatform === plat && styles.toggleBtnTextActive,
                      ]}
                    >
                      {plat.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.sectionTitle}>WALLET CAPABILITY</Text>
              <TouchableOpacity
                style={styles.failModeBtn}
                onPress={() => cycleWallet('forceApplePayProvisioned')}
              >
                <Text style={styles.failModeText}>
                  Apple Pay provisioned: {String(override.forceApplePayProvisioned)}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.failModeBtn}
                onPress={() => cycleWallet('forceGooglePaySetup')}
              >
                <Text style={styles.failModeText}>
                  Google Pay set up: {String(override.forceGooglePaySetup)}
                </Text>
              </TouchableOpacity>

              <Text style={styles.sectionTitle}>CART / AFFIRM</Text>
              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[styles.toggleBtn, cart.items[0].quantity === 1 && styles.toggleBtnActive]}
                  onPress={() => setQuantity(1)}
                >
                  <Text style={styles.toggleBtnText}>Qty 1 (~$90)</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.toggleBtn, cart.items[0].quantity >= 2 && styles.toggleBtnActive]}
                  onPress={() => setQuantity(2)}
                >
                  <Text style={styles.toggleBtnText}>Qty 2 (~$178)</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.sectionTitle}>FAILURE PATHS</Text>
              {(
                [
                  { id: 'none', label: 'Happy path' },
                  { id: 'declined', label: 'Issuer decline' },
                  { id: 'cancelled_sheet', label: 'Cancel wallet sheet' },
                  { id: 'network_error', label: '504 mid-request' },
                ] as const
              ).map((mode) => (
                <TouchableOpacity
                  key={mode.id}
                  style={[
                    styles.failModeBtn,
                    override.forceFailureMode === mode.id && styles.failModeBtnActive,
                  ]}
                  onPress={() => updateOverride({ forceFailureMode: mode.id })}
                >
                  <Text
                    style={[
                      styles.failModeText,
                      override.forceFailureMode === mode.id && styles.failModeTextActive,
                    ]}
                  >
                    {mode.label}
                  </Text>
                </TouchableOpacity>
              ))}

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Slow network (2.5s)</Text>
                <Switch
                  value={override.simulateSlowNetwork}
                  onValueChange={(val) => updateOverride({ simulateSlowNetwork: val })}
                />
              </View>

              <TouchableOpacity
                style={styles.actionBtn}
                onPress={async () => {
                  setDevDrawerOpen(false);
                  await simulateKillRelaunch();
                }}
              >
                <Text style={styles.actionBtnText}>Simulate kill + relaunch</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: '#334155' }]}
                onPress={async () => {
                  await resetCheckout();
                  resetOverride();
                  await resetAllPaymentState();
                }}
              >
                <Text style={styles.actionBtnText}>Reset session + ledger</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  fabTrigger: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    backgroundColor: '#0284C7',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 30,
    zIndex: 99,
  },
  fabText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  drawerContainer: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    padding: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '800',
  },
  closeText: {
    color: '#38BDF8',
    fontSize: 14,
    fontWeight: '700',
  },
  content: {
    marginBottom: 10,
  },
  meta: {
    color: '#64748B',
    fontSize: 12,
    marginBottom: 6,
  },
  sectionTitle: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: 14,
    marginBottom: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  toggleBtn: {
    flex: 1,
    backgroundColor: '#1E293B',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  toggleBtnActive: {
    backgroundColor: '#0284C7',
    borderColor: '#38BDF8',
  },
  toggleBtnText: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '700',
  },
  toggleBtnTextActive: {
    color: '#FFFFFF',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  switchLabel: {
    color: '#CBD5E1',
    fontSize: 13,
  },
  failModeBtn: {
    backgroundColor: '#1E293B',
    padding: 10,
    borderRadius: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  failModeBtnActive: {
    backgroundColor: '#991B1B',
    borderColor: '#EF4444',
  },
  failModeText: {
    color: '#94A3B8',
    fontSize: 13,
  },
  failModeTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  actionBtn: {
    backgroundColor: '#4F46E5',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
