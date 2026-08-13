import React from 'react';
import { StyleSheet, ScrollView, View, Text, SafeAreaView } from 'react-native';
import { OrderSummary } from '../components/OrderSummary';
import { ExpressCheckout } from '../components/ExpressCheckout';
import { CreditCardForm } from '../components/CreditCardForm';
import { DevSimulatorDrawer } from '../components/DevSimulatorDrawer';
import { PaymentStatusModal } from '../components/PaymentStatusModal';
import { ExpressSheet } from '../components/ExpressSheet';
import { TEST_IDS } from '../testing/testIds';

export default function CheckoutScreen() {
  return (
    <SafeAreaView style={styles.safeArea} testID={TEST_IDS.screen}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.banner}>
          <Text style={styles.bannerIcon}>●</Text>
          <View style={styles.bannerTextCol}>
            <Text style={styles.bannerTitle}>Outside the venue · patchy signal</Text>
            <Text style={styles.bannerSubtitle}>
              Express methods complete in one interaction. Card will not submit until it is valid.
            </Text>
          </View>
        </View>

        <OrderSummary />
        <ExpressCheckout />
        <CreditCardForm />
        <View style={{ height: 88 }} />
      </ScrollView>

      <DevSimulatorDrawer />
      <ExpressSheet />
      <PaymentStatusModal />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#090D16',
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  contentContainer: {
    paddingTop: 12,
    paddingBottom: 24,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  bannerIcon: {
    color: '#38BDF8',
    fontSize: 18,
    marginRight: 10,
  },
  bannerTextCol: {
    flex: 1,
  },
  bannerTitle: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  bannerSubtitle: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
  },
});
