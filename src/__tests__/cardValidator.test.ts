import {
  detectCardBrand,
  parseAndValidateCard,
  tokenizeCard,
  validateCvc,
  validateExpiry,
  validateLuhn,
} from '../services/cardValidator';

describe('cardValidator', () => {
  it('accepts the documented Visa test PAN and rejects a Luhn miss', () => {
    expect(validateLuhn('4242424242424242')).toBe(true);
    expect(validateLuhn('4242424242424243')).toBe(false);
    expect(validateLuhn('123')).toBe(false);
  });

  it('detects brands from BIN', () => {
    expect(detectCardBrand('4000123456789010')).toBe('visa');
    expect(detectCardBrand('5105123456789010')).toBe('mastercard');
    expect(detectCardBrand('378282246831005')).toBe('amex');
    expect(detectCardBrand('6011000000000000')).toBe('discover');
  });

  it('requires a future expiry relative to a fixed now', () => {
    const now = new Date('2026-08-13T12:00:00Z');
    expect(validateExpiry('12/28', now)).toBe(true);
    expect(validateExpiry('01/20', now)).toBe(false);
    expect(validateExpiry('08/26', now)).toBe(true);
    expect(validateExpiry('07/26', now)).toBe(false);
    expect(validateExpiry('14/28', now)).toBe(false);
  });

  it('uses 4-digit CVC for Amex and 3 for others', () => {
    expect(validateCvc('123', 'visa')).toBe(true);
    expect(validateCvc('12', 'visa')).toBe(false);
    expect(validateCvc('1234', 'amex')).toBe(true);
    expect(validateCvc('123', 'amex')).toBe(false);
  });

  it('is complete only when number, expiry, and CVC are all valid', () => {
    const card = parseAndValidateCard(
      '4242 4242 4242 4242',
      '12/28',
      '123',
      new Date('2026-08-13T12:00:00Z')
    );
    expect(card.isComplete).toBe(true);
    expect(card.cardBrand).toBe('visa');
  });

  it('tokenizes decline test cards without exposing the PAN', () => {
    expect(tokenizeCard('4000000000000002', 'visa')).toBe('tok_visa_declined');
    expect(tokenizeCard('4242424242424242', 'visa')).toBe('tok_visa_4242');
  });
});
