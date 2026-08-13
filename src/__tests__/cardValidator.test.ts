import { describe, it, expect } from '@jest/globals';
import {
  validateLuhn,
  detectCardBrand,
  validateExpiry,
  validateCvc,
  parseAndValidateCard,
} from '../services/cardValidator';

describe('Card Validator Service', () => {
  describe('validateLuhn', () => {
    it('validates a correct test Visa card (4242 4242 4242 4242)', () => {
      expect(validateLuhn('4242424242424242')).toBe(true);
    });

    it('rejects an invalid card number that fails Luhn check', () => {
      expect(validateLuhn('4242424242424243')).toBe(false);
    });

    it('rejects card numbers with invalid length', () => {
      expect(validateLuhn('123')).toBe(false);
    });
  });

  describe('detectCardBrand', () => {
    it('detects Visa starting with 4', () => {
      expect(detectCardBrand('4000123456789010')).toBe('visa');
    });

    it('detects Mastercard starting with 51-55', () => {
      expect(detectCardBrand('5105123456789010')).toBe('mastercard');
    });

    it('detects Amex starting with 37', () => {
      expect(detectCardBrand('378282246831005')).toBe('amex');
    });

    it('detects Discover starting with 6011', () => {
      expect(detectCardBrand('6011000000000000')).toBe('discover');
    });
  });

  describe('validateExpiry', () => {
    it('validates future expiry date (e.g. 12/28)', () => {
      expect(validateExpiry('12/28')).toBe(true);
    });

    it('rejects expired date (e.g. 01/20)', () => {
      expect(validateExpiry('01/20')).toBe(false);
    });

    it('rejects invalid month (e.g. 14/28)', () => {
      expect(validateExpiry('14/28')).toBe(false);
    });
  });

  describe('validateCvc', () => {
    it('requires 3 digits for Visa', () => {
      expect(validateCvc('123', 'visa')).toBe(true);
      expect(validateCvc('12', 'visa')).toBe(false);
    });

    it('requires 4 digits for Amex', () => {
      expect(validateCvc('1234', 'amex')).toBe(true);
      expect(validateCvc('123', 'amex')).toBe(false);
    });
  });

  describe('parseAndValidateCard', () => {
    it('returns complete true for a fully valid Visa card', () => {
      const card = parseAndValidateCard('4242 4242 4242 4242', '12/28', '123');
      expect(card.isValidCardNumber).toBe(true);
      expect(card.isValidExpiry).toBe(true);
      expect(card.isValidCvc).toBe(true);
      expect(card.isComplete).toBe(true);
    });
  });
});
