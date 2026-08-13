import AsyncStorage from '@react-native-async-storage/async-storage';
import { PersistentPaymentState } from '../types/checkout';
import { mockPaymentApi } from './mockPaymentApi';

const SESSION_KEY = 'gt.checkout.session.v2';
const LEDGER_KEY = 'gt.checkout.ledger.v2';

export async function persistSession(state: PersistentPaymentState): Promise<void> {
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(state));
}

export async function loadSession(): Promise<PersistentPaymentState | null> {
  const raw = await AsyncStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PersistentPaymentState;
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  await AsyncStorage.removeItem(SESSION_KEY);
}

export async function persistLedger(): Promise<void> {
  await AsyncStorage.setItem(LEDGER_KEY, JSON.stringify(mockPaymentApi.exportLedger()));
}

export async function hydrateLedger(): Promise<void> {
  const raw = await AsyncStorage.getItem(LEDGER_KEY);
  if (!raw) return;
  try {
    const records = JSON.parse(raw) as ReturnType<typeof mockPaymentApi.exportLedger>;
    mockPaymentApi.hydrate(records);
  } catch {
    // Corrupt cache: start clean rather than guess a payment state.
  }
}

export async function clearPersistedLedger(): Promise<void> {
  mockPaymentApi.clearLedger();
  await AsyncStorage.removeItem(LEDGER_KEY);
}

export function newIdempotencyKey(prefix: string): string {
  const rand =
    typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}_${rand}`;
}
