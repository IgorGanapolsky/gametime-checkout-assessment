import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useCheckout } from '../context/CheckoutContext';
import { dollarsFromCents } from '../types/checkout';
import { TEST_IDS } from '../testing/testIds';

export const ExpressCheckout: React.FC = () => {
  const { cart, eligibility, beginExpressPayment, status } = useCheckout();
  const busy = status !== 'idle' && status !== 'cancelled' && status !== 'declined' && status !== 'failed';

  const hasAnyExpress =
    eligibility.applePayAvailable ||
    eligibility.googlePayAvailable ||
    eligibility.affirmAvailable;

  if (!hasAnyExpress) {
    return (
      <View style={styles.emptyContainer} testID={TEST_IDS.expressEmpty}>
        <Text style={styles.emptyTitle}>No express methods for this fan</Text>
        <Text style={styles.emptySub}>
          Apple Pay / Google Pay stay hidden unless the platform and wallet
          capability both pass. Affirm stays hidden at or under $100. Card is
          always available below.
        </Text>
      </View>
    );
  }

  const affirmMonthly = dollarsFromCents(Math.round(cart.totalCents / 4));

  return (
    <View style={styles.container}>
      <Text style={styles.sectionHeader}>EXPRESS CHECKOUT</Text>

      {eligibility.applePayAvailable && (
        <TouchableOpacity
          testID={TEST_IDS.expressApple}
          style={[styles.expressBtn, styles.applePayBtn, busy && styles.btnDisabled]}
          onPress={() => beginExpressPayment('apple_pay')}
          disabled={busy}
          activeOpacity={0.8}
        >
          <Text style={styles.applePayText}> Pay</Text>
        </TouchableOpacity>
      )}

      {eligibility.googlePayAvailable && (
        <TouchableOpacity
          testID={TEST_IDS.expressGoogle}
          style={[styles.expressBtn, styles.googlePayBtn, busy && styles.btnDisabled]}
          onPress={() => beginExpressPayment('google_pay')}
          disabled={busy}
          activeOpacity={0.8}
        >
          <Text style={styles.googlePayText}>G Pay</Text>
        </TouchableOpacity>
      )}

      {eligibility.affirmAvailable && (
        <TouchableOpacity
          testID={TEST_IDS.expressAffirm}
          style={[styles.expressBtn, styles.affirmBtn, busy && styles.btnDisabled]}
          onPress={() => beginExpressPayment('affirm')}
          disabled={busy}
          activeOpacity={0.8}
        >
          <View style={styles.affirmRow}>
            <Text style={styles.affirmLogo}>affirm</Text>
            <Text style={styles.affirmDetail}>4 payments of ${affirmMonthly}</Text>
          </View>
        </TouchableOpacity>
      )}

      <View style={styles.orDividerContainer}>
        <View style={styles.dividerLine} />
        <Text style={styles.orText}>OR PAY WITH CARD</Text>
        <View style={styles.dividerLine} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  sectionHeader: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  expressBtn: {
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  applePayBtn: {
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: '#334155',
  },
  applePayText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  googlePayBtn: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#475569',
  },
  googlePayText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  affirmBtn: {
    backgroundColor: '#4F46E5',
  },
  affirmRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  affirmLogo: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    marginRight: 10,
    fontStyle: 'italic',
  },
  affirmDetail: {
    color: '#E0E7FF',
    fontSize: 13,
    fontWeight: '600',
  },
  emptyContainer: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 14,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  emptyTitle: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  emptySub: {
    color: '#64748B',
    fontSize: 11,
    lineHeight: 16,
  },
  orDividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 14,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#334155',
  },
  orText: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '800',
    marginHorizontal: 12,
    letterSpacing: 1,
  },
});
