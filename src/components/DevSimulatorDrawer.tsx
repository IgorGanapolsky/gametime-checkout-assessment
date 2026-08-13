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
import { useCheckout } from '../context/CheckoutContext';
import { mockPaymentApi } from '../services/mockPaymentApi';

export const DevSimulatorDrawer: React.FC = () => {
  const {
    override,
    updateOverride,
    resetOverride,
    isDevDrawerOpen,
    setDevDrawerOpen,
  } = useEnvironment();

  const {
    cart,
    setQuantity,
    resetCheckout,
    simulateInterruption,
    status,
  } = useCheckout();

  return (
    <>
      {/* Floating Trigger FAB */}
      <TouchableOpacity
        style={styles.fabTrigger}
        onPress={() => setDevDrawerOpen(true)}
        activeOpacity={0.8}
      >
        <Text style={styles.fabText}>🛠 DEV SIMULATOR</Text>
      </TouchableOpacity>

      {/* Dev Simulator Modal */}
      <Modal
        visible={isDevDrawerOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setDevDrawerOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.drawerContainer}>
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Environment & API Simulator</Text>
              <TouchableOpacity onPress={() => setDevDrawerOpen(false)}>
                <Text style={styles.closeText}>✕ Close</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.content}>
              <Text style={styles.sectionTitle}>1. TARGET PLATFORM OVERRIDE</Text>
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

              <Text style={styles.sectionTitle}>2. DEVICE CARD PROVISIONING</Text>
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Apple Pay Card Provisioned (iOS)</Text>
                <Switch
                  value={override.forceApplePayProvisioned}
                  onValueChange={(val) =>
                    updateOverride({ forceApplePayProvisioned: val })
                  }
                />
              </View>
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Google Pay Set Up (Android)</Text>
                <Switch
                  value={override.forceGooglePaySetup}
                  onValueChange={(val) =>
                    updateOverride({ forceGooglePaySetup: val })
                  }
                />
              </View>

              <Text style={styles.sectionTitle}>3. CART TOTAL (AFFIRM THRESHOLD &gt;$100)</Text>
              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[
                    styles.toggleBtn,
                    cart.total > 100 && styles.toggleBtnActive,
                  ]}
                  onPress={() => setQuantity(2)}
                >
                  <Text
                    style={[
                      styles.toggleBtnText,
                      cart.total > 100 && styles.toggleBtnTextActive,
                    ]}
                  >
                    &gt; $100 ($370.50)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.toggleBtn,
                    cart.total <= 100 && styles.toggleBtnActive,
                  ]}
                  onPress={() => setQuantity(0)}
                >
                  <Text
                    style={[
                      styles.toggleBtnText,
                      cart.total <= 100 && styles.toggleBtnTextActive,
                    ]}
                  >
                    &lt; $100 ($45.00)
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.sectionTitle}>4. BACKEND FAILURE SCENARIOS</Text>
              {(
                [
                  { id: 'none', label: 'Normal Success (200 OK)' },
                  { id: 'declined', label: 'Card Declined' },
                  { id: 'cancelled_sheet', label: 'Apple Pay Sheet Cancelled' },
                  { id: 'network_error', label: '504 Network Timeout' },
                ] as const
              ).map((mode) => (
                <TouchableOpacity
                  key={mode.id}
                  style={[
                    styles.failModeBtn,
                    override.forceFailureMode === mode.id &&
                      styles.failModeBtnActive,
                  ]}
                  onPress={() => updateOverride({ forceFailureMode: mode.id })}
                >
                  <Text
                    style={[
                      styles.failModeText,
                      override.forceFailureMode === mode.id &&
                        styles.failModeTextActive,
                    ]}
                  >
                    • {mode.label}
                  </Text>
                </TouchableOpacity>
              ))}

              <Text style={styles.sectionTitle}>5. NETWORK & INTERRUPTION TESTS</Text>
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Simulate Slow Network (2.5s Delay)</Text>
                <Switch
                  value={override.simulateSlowNetwork}
                  onValueChange={(val) =>
                    updateOverride({ simulateSlowNetwork: val })
                  }
                />
              </View>

              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => {
                  simulateInterruption();
                  setDevDrawerOpen(false);
                }}
              >
                <Text style={styles.actionBtnText}>⚡ Simulate App Interruption / Relaunch</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: '#334155' }]}
                onPress={() => {
                  resetCheckout();
                  resetOverride();
                  mockPaymentApi.clearLedger();
                }}
              >
                <Text style={styles.actionBtnText}>🔄 Reset All State & Backend Ledger</Text>
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
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
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
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
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
    color: '#94A3B8',
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
    paddingVertical: 6,
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
