import { CardBrand, CreditCardData } from '../types/checkout';

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

export function detectCardBrand(cardNumber: string): CardBrand {
  const clean = cardNumber.replace(/\D/g, '');
  if (/^4/.test(clean)) return 'visa';
  if (/^(5[1-5]|2[2-7])/.test(clean)) return 'mastercard';
  if (/^3[47]/.test(clean)) return 'amex';
  if (/^(6011|65|64[4-9]|622)/.test(clean)) return 'discover';
  return 'unknown';
}

export function expectedPanLength(brand: CardBrand): number {
  if (brand === 'amex') return 15;
  if (brand === 'discover') return 16;
  return 16;
}

export function formatCardNumber(rawInput: string, brand: CardBrand): string {
  const max = expectedPanLength(brand);
  const digits = rawInput.replace(/\D/g, '').slice(0, max);
  if (brand === 'amex') {
    const part1 = digits.slice(0, 4);
    const part2 = digits.slice(4, 10);
    const part3 = digits.slice(10, 15);
    return [part1, part2, part3].filter(Boolean).join(' ');
  }
  const parts = digits.match(/.{1,4}/g);
  return parts ? parts.join(' ') : '';
}

export function formatExpiry(rawInput: string): string {
  const digits = rawInput.replace(/\D/g, '').slice(0, 4);
  if (digits.length >= 3) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }
  return digits;
}

export function validateExpiry(expiry: string, now: Date = new Date()): boolean {
  const clean = expiry.replace(/\D/g, '');
  if (clean.length !== 4) return false;

  const month = parseInt(clean.slice(0, 2), 10);
  const year = parseInt(`20${clean.slice(2, 4)}`, 10);

  if (month < 1 || month > 12) return false;

  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  if (year < currentYear) return false;
  if (year === currentYear && month < currentMonth) return false;
  if (year > currentYear + 20) return false;

  return true;
}

export function validateCvc(cvc: string, brand: CardBrand): boolean {
  const clean = cvc.replace(/\D/g, '');
  if (brand === 'amex') {
    return clean.length === 4;
  }
  return clean.length === 3;
}

/**
 * Tokenize locally. The mock API never sees a PAN — same contract shape as
 * a real PSP token (pm_ / tok_). Decline test cards map to known tokens.
 */
export function tokenizeCard(pan: string, brand: CardBrand): string {
  const digits = pan.replace(/\D/g, '');
  const last4 = digits.slice(-4);
  if (last4 === '0002') return 'tok_visa_declined';
  if (last4 === '9995') return 'tok_visa_insufficient';
  if (last4 === '0069') return 'tok_visa_expired';
  return `tok_${brand}_${last4}`;
}

export function parseAndValidateCard(
  rawCardNumber: string,
  rawExpiry: string,
  rawCvc: string,
  now: Date = new Date()
): CreditCardData {
  const cleanCardNumber = rawCardNumber.replace(/\D/g, '');
  const brand = detectCardBrand(cleanCardNumber);
  const formattedCardNumber = formatCardNumber(cleanCardNumber, brand);
  const expected = expectedPanLength(brand);
  const isValidCardNumber =
    cleanCardNumber.length === expected && validateLuhn(cleanCardNumber);

  const formattedExpiry = formatExpiry(rawExpiry);
  const isValidExpiryDate = validateExpiry(formattedExpiry, now);

  const cleanCvc = rawCvc.replace(/\D/g, '');
  const isValidCvcCode = validateCvc(cleanCvc, brand);

  return {
    cardNumber: cleanCardNumber,
    formattedCardNumber,
    expiryMonth: formattedExpiry.slice(0, 2),
    expiryYear: formattedExpiry.length === 5 ? formattedExpiry.slice(3, 5) : '',
    cvc: cleanCvc,
    cardBrand: brand,
    isValidCardNumber,
    isValidExpiry: isValidExpiryDate,
    isValidCvc: isValidCvcCode,
    isComplete: isValidCardNumber && isValidExpiryDate && isValidCvcCode,
  };
}
