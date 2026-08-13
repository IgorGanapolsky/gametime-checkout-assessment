import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useCheckout } from '../context/CheckoutContext';
import { formatCardNumber } from '../services/cardValidator';
import { dollarsFromCents } from '../types/checkout';
import { TEST_IDS } from '../testing/testIds';

export const CreditCardForm: React.FC = () => {
  const { cart, cardData, updateCardDetails, processCardPayment, status } =
    useCheckout();

  const [touched, setTouched] = useState({
    number: false,
    expiry: false,
    cvc: false,
  });

  const [rawNumber, setRawNumber] = useState('');
  const [rawExpiry, setRawExpiry] = useState('');
  const [rawCvc, setRawCvc] = useState('');

  const busy = status !== 'idle' && status !== 'cancelled' && status !== 'declined' && status !== 'failed';

  const handleNumberChange = (text: string) => {
    const digits = text.replace(/\D/g, '');
    setRawNumber(digits);
    updateCardDetails(digits, rawExpiry, rawCvc);
  };

  const handleExpiryChange = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, 4);
    const formatted =
      digits.length >= 3 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
    setRawExpiry(formatted);
    updateCardDetails(rawNumber, formatted, rawCvc);
  };

  const handleCvcChange = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, 4);
    setRawCvc(digits);
    updateCardDetails(rawNumber, rawExpiry, digits);
  };

  const brandLabel = cardData.cardBrand === 'unknown' ? 'CARD' : cardData.cardBrand.toUpperCase();

  return (
    <View style={styles.container}>
      <Text style={styles.sectionHeader}>CREDIT OR DEBIT CARD</Text>
      <Text style={styles.hint}>
        Test cards: 4242 4242 4242 4242 succeeds. 4000 0000 0000 0002 declines.
        Never use a real PAN.
      </Text>

      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Card Number</Text>
        <View
          style={[
            styles.inputWrapper,
            touched.number && !cardData.isValidCardNumber && rawNumber.length > 0
              ? styles.inputError
              : cardData.isValidCardNumber
                ? styles.inputSuccess
                : null,
          ]}
        >
          <TextInput
            testID={TEST_IDS.cardNumber}
            style={styles.textInput}
            value={formatCardNumber(rawNumber, cardData.cardBrand)}
            onChangeText={handleNumberChange}
            onBlur={() => setTouched((p) => ({ ...p, number: true }))}
            placeholder="4242 4242 4242 4242"
            placeholderTextColor="#64748B"
            keyboardType="number-pad"
            textContentType="creditCardNumber"
            autoComplete="cc-number"
            maxLength={cardData.cardBrand === 'amex' ? 17 : 19}
            editable={!busy}
          />
          <Text
            style={[
              styles.brandBadge,
              cardData.cardBrand !== 'unknown' && styles.brandKnown,
            ]}
          >
            {brandLabel}
          </Text>
        </View>
        {touched.number && !cardData.isValidCardNumber && rawNumber.length > 12 && (
          <Text style={styles.errorHint}>Fails Luhn or length for this brand</Text>
        )}
      </View>

      <View style={styles.row}>
        <View style={[styles.fieldGroup, { flex: 1, marginRight: 8 }]}>
          <Text style={styles.fieldLabel}>Expires</Text>
          <View
            style={[
              styles.inputWrapper,
              touched.expiry && !cardData.isValidExpiry && rawExpiry.length > 0
                ? styles.inputError
                : cardData.isValidExpiry
                  ? styles.inputSuccess
                  : null,
            ]}
          >
            <TextInput
              testID={TEST_IDS.cardExpiry}
              style={styles.textInput}
              value={rawExpiry}
              onChangeText={handleExpiryChange}
              onBlur={() => setTouched((p) => ({ ...p, expiry: true }))}
              placeholder="12/28"
              placeholderTextColor="#64748B"
              keyboardType="number-pad"
              textContentType="creditCardExpiration"
              autoComplete="cc-exp"
              maxLength={5}
              editable={!busy}
            />
          </View>
          {touched.expiry && !cardData.isValidExpiry && rawExpiry.length >= 5 && (
            <Text style={styles.errorHint}>Must be a future month</Text>
          )}
        </View>

        <View style={[styles.fieldGroup, { flex: 1, marginLeft: 8 }]}>
          <Text style={styles.fieldLabel}>
            CVC {cardData.cardBrand === 'amex' ? '(4)' : '(3)'}
          </Text>
          <View
            style={[
              styles.inputWrapper,
              touched.cvc && !cardData.isValidCvc && rawCvc.length > 0
                ? styles.inputError
                : cardData.isValidCvc
                  ? styles.inputSuccess
                  : null,
            ]}
          >
            <TextInput
              testID={TEST_IDS.cardCvc}
              accessibilityLabel="CVC input"
              style={styles.textInput}
              value={rawCvc}
              onChangeText={handleCvcChange}
              onBlur={() => setTouched((p) => ({ ...p, cvc: true }))}
              placeholder={cardData.cardBrand === 'amex' ? '1234' : '123'}
              placeholderTextColor="#64748B"
              keyboardType="number-pad"
              textContentType="creditCardSecurityCode"
              autoComplete="cc-csc"
              secureTextEntry
              maxLength={cardData.cardBrand === 'amex' ? 4 : 3}
              editable={!busy}
            />
          </View>
        </View>
      </View>

      <TouchableOpacity
        testID={TEST_IDS.cardSubmit}
        style={[
          styles.submitBtn,
          (!cardData.isComplete || busy) && styles.submitBtnDisabled,
        ]}
        onPress={processCardPayment}
        disabled={!cardData.isComplete || busy}
        activeOpacity={0.8}
      >
        <Text style={styles.submitBtnText}>
          {busy ? 'Authorizing…' : `Pay $${dollarsFromCents(cart.totalCents)}`}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#334155',
  },
  sectionHeader: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  hint: {
    color: '#64748B',
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 14,
  },
  fieldGroup: {
    marginBottom: 14,
  },
  fieldLabel: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  row: {
    flexDirection: 'row',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#334155',
    paddingHorizontal: 12,
    height: 48,
  },
  inputError: {
    borderColor: '#EF4444',
  },
  inputSuccess: {
    borderColor: '#10B981',
  },
  textInput: {
    flex: 1,
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '600',
  },
  brandBadge: {
    backgroundColor: '#334155',
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  brandKnown: {
    backgroundColor: '#1E40AF',
    color: '#FFFFFF',
  },
  errorHint: {
    color: '#F87171',
    fontSize: 11,
    marginTop: 4,
  },
  submitBtn: {
    backgroundColor: '#10B981',
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  submitBtnDisabled: {
    backgroundColor: '#334155',
    opacity: 0.6,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
});
