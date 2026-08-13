import { CreditCardData } from '../types/checkout';

/**
 * Validates a card number using the Luhn Algorithm (Mod 10 check).
 */
export function validateLuhn(cardNumber: string): boolean {
  const digits = cardNumber.replace(/\D/g, '');
  if (!digits || digits.length < 13 || digits.length > 19) {
    return false;
  }

  let sum = 0;
  let shouldDouble = false;

  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = parseInt(digits.charAt(i), 10);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }

  return sum % 10 === 0;
}

/**
 * Detects credit card brand based on BIN pattern.
 */
export function detectCardBrand(
  cardNumber: string
): CreditCardData['cardBrand'] {
  const clean = cardNumber.replace(/\D/g, '');
  if (/^4/.test(clean)) return 'visa';
  if (/^(5[1-5]|2[2-7])/.test(clean)) return 'mastercard';
  if (/^3[47]/.test(clean)) return 'amex';
  if (/^(6011|65|64[4-9]|622)/.test(clean)) return 'discover';
  return 'unknown';
}

/**
 * Formats a raw card number string into grouped digits based on brand.
 */
export function formatCardNumber(
  rawInput: string,
  brand: CreditCardData['cardBrand']
): string {
  const digits = rawInput.replace(/\D/g, '');
  if (brand === 'amex') {
    // Amex: 4 - 6 - 5 digits (e.g. 3782 822468 31005)
    const part1 = digits.slice(0, 4);
    const part2 = digits.slice(4, 10);
    const part3 = digits.slice(10, 15);
    return [part1, part2, part3].filter(Boolean).join(' ');
  }
  // Standard: 4-4-4-4
  const parts = digits.match(/.{1,4}/g);
  return parts ? parts.join(' ').slice(0, 19) : '';
}

/**
 * Formats expiration input to MM/YY.
 */
export function formatExpiry(rawInput: string): string {
  const digits = rawInput.replace(/\D/g, '').slice(0, 4);
  if (digits.length >= 3) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }
  return digits;
}

/**
 * Validates expiration date (MM/YY format, must be current month/year or in the future).
 */
export function validateExpiry(expiry: string): boolean {
  const clean = expiry.replace(/\D/g, '');
  if (clean.length !== 4) return false;

  const month = parseInt(clean.slice(0, 2), 10);
  const year = parseInt(`20${clean.slice(2, 4)}`, 10);

  if (month < 1 || month > 12) return false;

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-indexed

  if (year < currentYear) return false;
  if (year === currentYear && month < currentMonth) return false;

  // Reasonable upper ceiling (e.g., 20 years from now)
  if (year > currentYear + 20) return false;

  return true;
}

/**
 * Validates CVC code length according to card brand.
 */
export function validateCvc(
  cvc: string,
  brand: CreditCardData['cardBrand']
): boolean {
  const clean = cvc.replace(/\D/g, '');
  if (brand === 'amex') {
    return clean.length === 4;
  }
  return clean.length === 3;
}

/**
 * Compiles comprehensive credit card validation state.
 */
export function parseAndValidateCard(
  rawCardNumber: string,
  rawExpiry: string,
  rawCvc: string
): CreditCardData {
  const cleanCardNumber = rawCardNumber.replace(/\D/g, '');
  const brand = detectCardBrand(cleanCardNumber);
  const formattedCardNumber = formatCardNumber(cleanCardNumber, brand);
  const isValidCardNumber = validateLuhn(cleanCardNumber);

  const formattedExpiry = formatExpiry(rawExpiry);
  const isValidExpiryDate = validateExpiry(formattedExpiry);

  const cleanCvc = rawCvc.replace(/\D/g, '');
  const isValidCvcCode = validateCvc(cleanCvc, brand);

  const isComplete = isValidCardNumber && isValidExpiryDate && isValidCvcCode;

  const expiryMonth = formattedExpiry.slice(0, 2);
  const expiryYear = formattedExpiry.length === 5 ? formattedExpiry.slice(3, 5) : '';

  return {
    cardNumber: cleanCardNumber,
    formattedCardNumber,
    expiryMonth,
    expiryYear,
    cvc: cleanCvc,
    cardBrand: brand,
    isValidCardNumber,
    isValidExpiry: isValidExpiryDate,
    isValidCvc: isValidCvcCode,
    isComplete,
  };
}
