import React from 'react';
import { StyleSheet, ScrollView, View, Text, SafeAreaView } from 'react-native';
import { OrderSummary } from '../components/OrderSummary';
import { ExpressCheckout } from '../components/ExpressCheckout';
import { CreditCardForm } from '../components/CreditCardForm';
import { DevSimulatorDrawer } from '../components/DevSimulatorDrawer';
import { PaymentStatusModal } from '../components/PaymentStatusModal';

export default function CheckoutScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.banner}>
          <Text style={styles.bannerIcon}>🔒</Text>
          <View style={styles.bannerTextCol}>
            <Text style={styles.bannerTitle}>100% Buyer Guarantee</Text>
            <Text style={styles.bannerSubtitle}>
              Authentic tickets delivered right on time for your game.
            </Text>
          </View>
        </View>

        {/* Order Breakdown */}
        <OrderSummary />

        {/* Express Checkout Options (Apple Pay, Google Pay, Affirm) */}
        <ExpressCheckout />

        {/* Universal Credit Card Form */}
        <CreditCardForm />

        {/* Space at bottom for FAB */}
        <View style={{ height: 80 }} />
      </ScrollView>

      {/* Floating Dev Environment Simulator Drawer */}
      <DevSimulatorDrawer />

      {/* Status & App Interruption Recovery Overlay */}
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
    fontSize: 22,
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
