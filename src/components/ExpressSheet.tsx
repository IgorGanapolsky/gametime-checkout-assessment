import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useCheckout } from '../context/CheckoutContext';
import { dollarsFromCents } from '../types/checkout';
import { TEST_IDS } from '../testing/testIds';

export function ExpressSheet() {
  const { expressSheet, cart, confirmExpressSheet, cancelExpressSheet } =
    useCheckout();

  if (!expressSheet) return null;

  const isAffirm = expressSheet === 'affirm';
  const title = isAffirm
    ? 'Affirm'
    : expressSheet === 'apple_pay'
      ? 'Apple Pay'
      : 'Google Pay';

  return (
    <Modal visible transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.kicker}>
            {isAffirm ? 'REDIRECT STUB' : 'WALLET SHEET STUB'}
          </Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body}>
            {isAffirm
              ? 'This stands in for an Affirm webview. The OS may background the app. Confirming completes the purchase in this flow — there is no second Submit tap.'
              : 'This stands in for the native wallet sheet + biometric prompt. Backgrounding here is expected. Pay completes the charge immediately.'}
          </Text>
          <Text style={styles.amount}>${dollarsFromCents(cart.totalCents)}</Text>
          <TouchableOpacity
            testID={TEST_IDS.sheetPay}
            style={styles.pay}
            onPress={confirmExpressSheet}
          >
            <Text style={styles.payText}>
              {isAffirm ? 'Continue with Affirm' : `Pay with ${title}`}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID={TEST_IDS.sheetCancel}
            style={styles.cancel}
            onPress={cancelExpressSheet}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(2,6,23,0.72)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: '#334155',
  },
  kicker: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  title: {
    color: '#F8FAFC',
    fontSize: 22,
    fontWeight: '800',
    marginTop: 6,
  },
  body: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 10,
  },
  amount: {
    color: '#F8FAFC',
    fontSize: 28,
    fontWeight: '800',
    marginVertical: 16,
  },
  pay: {
    backgroundColor: '#10B981',
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 16,
  },
  cancel: {
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    color: '#94A3B8',
    fontWeight: '700',
  },
});
