import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useCheckout } from '../context/CheckoutContext';
import { formatExpiry, formatCardNumber } from '../services/cardValidator';

export const CreditCardForm: React.FC = () => {
  const {
    cart,
    cardData,
    updateCardDetails,
    processCardPayment,
    status,
  } = useCheckout();

  const [touched, setTouched] = useState({
    number: false,
    expiry: false,
    cvc: false,
  });

  const [rawNumber, setRawNumber] = useState('');
  const [rawExpiry, setRawExpiry] = useState('');
  const [rawCvc, setRawCvc] = useState('');

  const isProcessing = status === 'processing';

  const handleNumberChange = (text: string) => {
    const digits = text.replace(/\D/g, '');
    setRawNumber(digits);
    updateCardDetails(digits, rawExpiry, rawCvc);
  };

  const handleExpiryChange = (text: string) => {
    const formatted = formatExpiry(text);
    setRawExpiry(formatted);
    updateCardDetails(rawNumber, formatted, rawCvc);
  };

  const handleCvcChange = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, 4);
    setRawCvc(digits);
    updateCardDetails(rawNumber, rawExpiry, digits);
  };

  const getBrandBadge = () => {
    switch (cardData.cardBrand) {
      case 'visa':
        return <Text style={[styles.brandBadge, styles.visaBadge]}>VISA</Text>;
      case 'mastercard':
        return <Text style={[styles.brandBadge, styles.mcBadge]}>MC</Text>;
      case 'amex':
        return <Text style={[styles.brandBadge, styles.amexBadge]}>AMEX</Text>;
      case 'discover':
        return <Text style={[styles.brandBadge, styles.discBadge]}>DISC</Text>;
      default:
        return <Text style={styles.brandBadge}>CARD</Text>;
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionHeader}>CREDIT OR DEBIT CARD</Text>

      {/* Card Number Input */}
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
            style={styles.textInput}
            value={formatCardNumber(rawNumber, cardData.cardBrand)}
            onChangeText={handleNumberChange}
            onBlur={() => setTouched((p) => ({ ...p, number: true }))}
            placeholder="4242 4242 4242 4242"
            placeholderTextColor="#64748B"
            keyboardType="numeric"
            textContentType="creditCardNumber"
            autoComplete="cc-number"
            maxLength={19}
            editable={!isProcessing}
          />
          {getBrandBadge()}
        </View>
        {touched.number && !cardData.isValidCardNumber && rawNumber.length > 0 && (
          <Text style={styles.errorHint}>Invalid card number (Luhn check failed)</Text>
        )}
      </View>

      {/* Expiry and CVC Row */}
      <View style={styles.row}>
        {/* Expiry */}
        <View style={[styles.fieldGroup, { flex: 1, marginRight: 8 }]}>
          <Text style={styles.fieldLabel}>Expires (MM/YY)</Text>
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
              style={styles.textInput}
              value={rawExpiry}
              onChangeText={handleExpiryChange}
              onBlur={() => setTouched((p) => ({ ...p, expiry: true }))}
              placeholder="12/28"
              placeholderTextColor="#64748B"
              keyboardType="numeric"
              maxLength={5}
              editable={!isProcessing}
            />
          </View>
          {touched.expiry && !cardData.isValidExpiry && rawExpiry.length > 0 && (
            <Text style={styles.errorHint}>Invalid / expired date</Text>
          )}
        </View>

        {/* CVC */}
        <View style={[styles.fieldGroup, { flex: 1, marginLeft: 8 }]}>
          <Text style={styles.fieldLabel}>
            Security Code ({cardData.cardBrand === 'amex' ? '4 digits' : '3 digits'})
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
              style={styles.textInput}
              value={rawCvc}
              onChangeText={handleCvcChange}
              onBlur={() => setTouched((p) => ({ ...p, cvc: true }))}
              placeholder={cardData.cardBrand === 'amex' ? '1234' : '123'}
              placeholderTextColor="#64748B"
              keyboardType="numeric"
              secureTextEntry
              maxLength={cardData.cardBrand === 'amex' ? 4 : 3}
              editable={!isProcessing}
            />
          </View>
          {touched.cvc && !cardData.isValidCvc && rawCvc.length > 0 && (
            <Text style={styles.errorHint}>Invalid CVC length</Text>
          )}
        </View>
      </View>

      {/* Submit Button */}
      <TouchableOpacity
        style={[
          styles.submitBtn,
          (!cardData.isComplete || isProcessing) && styles.submitBtnDisabled,
        ]}
        onPress={processCardPayment}
        disabled={!cardData.isComplete || isProcessing}
        activeOpacity={0.8}
      >
        <Text style={styles.submitBtnText}>
          {isProcessing
            ? 'Authorizing Card...'
            : `Pay $${cart.total.toFixed(2)}`}
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
  visaBadge: {
    backgroundColor: '#1E40AF',
    color: '#FFFFFF',
  },
  mcBadge: {
    backgroundColor: '#C2410C',
    color: '#FFFFFF',
  },
  amexBadge: {
    backgroundColor: '#047857',
    color: '#FFFFFF',
  },
  discBadge: {
    backgroundColor: '#B45309',
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
