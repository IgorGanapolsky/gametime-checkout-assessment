import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useCheckout } from '../context/CheckoutContext';
import { dollarsFromCents } from '../types/checkout';
import { TEST_IDS } from '../testing/testIds';

export const OrderSummary: React.FC = () => {
  const { cart, setQuantity, status, eligibility } = useCheckout();
  const item = cart.items[0];
  const isLocked = status !== 'idle' && status !== 'cancelled' && status !== 'declined' && status !== 'failed';

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.badge}>GAMETIME LIVE</Text>
        <Text style={styles.eventTime}>Today • 7:05 PM</Text>
      </View>

      <Text style={styles.eventTitle}>{item.name}</Text>
      <Text style={styles.seatDetails}>
        {item.section} • Row {item.row} • Seats {item.seats.join(', ')}
      </Text>

      <View style={styles.qtyRow}>
        <Text style={styles.qtyLabel}>Tickets ({item.quantity})</Text>
        <View style={styles.qtyControls}>
          <TouchableOpacity
            testID={TEST_IDS.qtyDec}
            style={[styles.qtyBtn, (item.quantity <= 1 || isLocked) && styles.disabledBtn]}
            onPress={() => setQuantity(item.quantity - 1)}
            disabled={item.quantity <= 1 || isLocked}
          >
            <Text style={styles.qtyBtnText}>-</Text>
          </TouchableOpacity>
          <Text style={styles.qtyCount} testID={TEST_IDS.qtyValue}>
            {item.quantity}
          </Text>
          <TouchableOpacity
            testID={TEST_IDS.qtyInc}
            style={[styles.qtyBtn, isLocked && styles.disabledBtn]}
            onPress={() => setQuantity(item.quantity + 1)}
            disabled={isLocked}
          >
            <Text style={styles.qtyBtnText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.affirmHint} testID={TEST_IDS.affirmHint}>
        Affirm {eligibility.affirmAvailable ? 'is' : 'is not'} available
        {' '}(shown only when total is over $100). Qty 1 stays under; qty 2 crosses.
      </Text>

      <View style={styles.divider} />

      <View style={styles.priceRow}>
        <Text style={styles.priceLabel}>
          Subtotal (${dollarsFromCents(item.unitPriceCents)} ea)
        </Text>
        <Text style={styles.priceValue}>${dollarsFromCents(cart.subtotalCents)}</Text>
      </View>

      <View style={styles.priceRow}>
        <Text style={styles.priceLabel}>Service Fee</Text>
        <Text style={styles.priceValue}>${dollarsFromCents(cart.serviceFeeCents)}</Text>
      </View>

      <View style={styles.priceRow}>
        <Text style={styles.priceLabel}>Facility Fee</Text>
        <Text style={styles.priceValue}>${dollarsFromCents(cart.facilityFeeCents)}</Text>
      </View>

      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total Due</Text>
        <Text style={styles.totalValue} testID={TEST_IDS.orderTotal}>
          ${dollarsFromCents(cart.totalCents)}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  badge: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  eventTime: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '500',
  },
  eventTitle: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  seatDetails: {
    color: '#CBD5E1',
    fontSize: 14,
    marginBottom: 16,
  },
  qtyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  qtyLabel: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '600',
  },
  qtyControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  qtyBtn: {
    backgroundColor: '#334155',
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledBtn: {
    opacity: 0.4,
  },
  qtyBtnText: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '700',
  },
  qtyCount: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
    marginHorizontal: 14,
  },
  affirmHint: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 10,
    lineHeight: 16,
  },
  divider: {
    height: 1,
    backgroundColor: '#334155',
    marginVertical: 14,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  priceLabel: {
    color: '#94A3B8',
    fontSize: 13,
  },
  priceValue: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '600',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  totalLabel: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
  },
  totalValue: {
    color: '#38BDF8',
    fontSize: 22,
    fontWeight: '800',
  },
});
