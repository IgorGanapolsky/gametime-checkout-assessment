import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { useCheckout } from '../context/CheckoutContext';
import { TEST_IDS } from '../testing/testIds';

export const PaymentStatusModal: React.FC = () => {
  const {
    status,
    statusMessage,
    activeIdempotencyKey,
    lastResponse,
    resetCheckout,
    isRecoveringFromInterruption,
    expressSheet,
  } = useCheckout();

  const hidden =
    status === 'idle' ||
    status === 'awaiting_wallet' ||
    status === 'awaiting_redirect' ||
    Boolean(expressSheet);

  if (hidden) {
    return null;
  }

  const isProcessing =
    status === 'processing' ||
    status === 'reconciling' ||
    isRecoveringFromInterruption;
  const isSuccess = status === 'succeeded';
  const isCancelled = status === 'cancelled';
  const isDeclined = status === 'declined' || status === 'failed';

  return (
    <Modal visible transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          {isProcessing && (
            <>
              <ActivityIndicator size="large" color="#38BDF8" style={styles.spinner} />
              <Text style={styles.title}>
                {status === 'reconciling' ? "We're checking" : 'Processing'}
              </Text>
              <Text style={styles.message}>
                {statusMessage || 'Talking to the payment API…'}
              </Text>
              {activeIdempotencyKey ? (
                <Text style={styles.idempotencyTag}>
                  idempotency {activeIdempotencyKey}
                </Text>
              ) : null}
            </>
          )}

          {isSuccess && (
            <>
              <View style={styles.iconCircleSuccess}>
                <Text style={styles.iconText}>✓</Text>
              </View>
              <Text style={styles.titleSuccess} testID={TEST_IDS.statusTitle}>
                Order confirmed
              </Text>
              <Text style={styles.message}>
                {statusMessage || 'Tickets issued.'}
              </Text>
              {lastResponse ? (
                <View style={styles.receiptBox}>
                  <Text style={styles.receiptTitle}>API RECEIPT</Text>
                  <Text style={styles.receiptRow}>id {lastResponse.transactionId}</Text>
                  <Text style={styles.receiptRow}>
                    replay {lastResponse.wasIdempotentReplay ? 'yes' : 'no'}
                  </Text>
                </View>
              ) : null}
              <TouchableOpacity
                testID={TEST_IDS.statusDone}
                style={styles.doneBtn}
                onPress={resetCheckout}
              >
                <Text style={styles.doneBtnText}>Done</Text>
              </TouchableOpacity>
            </>
          )}

          {isCancelled && (
            <>
              <Text style={styles.title}>Cancelled</Text>
              <Text style={styles.message}>
                {statusMessage || 'Nothing was charged.'}
              </Text>
              <TouchableOpacity style={styles.retryBtn} onPress={resetCheckout}>
                <Text style={styles.retryBtnText}>Back to checkout</Text>
              </TouchableOpacity>
            </>
          )}

          {isDeclined && (
            <>
              <View style={styles.iconCircleError}>
                <Text style={styles.iconText}>✕</Text>
              </View>
              <Text style={styles.titleError}>Payment failed</Text>
              <Text style={styles.message}>
                {statusMessage || 'The charge did not go through.'}
              </Text>
              <TouchableOpacity style={styles.retryBtn} onPress={resetCheckout}>
                <Text style={styles.retryBtnText}>Try a different method</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  spinner: {
    marginBottom: 16,
  },
  title: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  titleSuccess: {
    color: '#34D399',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  titleError: {
    color: '#F87171',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    color: '#94A3B8',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  idempotencyTag: {
    color: '#64748B',
    fontSize: 10,
    fontFamily: 'monospace',
  },
  iconCircleSuccess: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#065F46',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  iconCircleError: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#991B1B',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  iconText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
  },
  receiptBox: {
    backgroundColor: '#0F172A',
    borderRadius: 10,
    padding: 12,
    width: '100%',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  receiptTitle: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 6,
  },
  receiptRow: {
    color: '#CBD5E1',
    fontSize: 11,
    fontFamily: 'monospace',
    marginBottom: 2,
  },
  doneBtn: {
    backgroundColor: '#10B981',
    width: '100%',
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  retryBtn: {
    backgroundColor: '#334155',
    width: '100%',
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
