import AsyncStorage from '@react-native-async-storage/async-storage';
import { PersistentPaymentState } from '../types/checkout';
import { mockPaymentApi } from './mockPaymentApi';

const SESSION_KEY = 'gt.checkout.session.v2';
const LEDGER_KEY = 'gt.checkout.ledger.v2';

async function storageGet(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    // Expo Go / missing native module: keep checkout in memory.
    return null;
  }
}

async function storageSet(key: string, value: string): Promise<void> {
  try {
    await AsyncStorage.setItem(key, value);
  } catch {
    // Persist is best-effort. Charge path must still run.
  }
}

async function storageRemove(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export async function persistSession(state: PersistentPaymentState): Promise<void> {
  await storageSet(SESSION_KEY, JSON.stringify(state));
}

export async function loadSession(): Promise<PersistentPaymentState | null> {
  const raw = await storageGet(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PersistentPaymentState;
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  await storageRemove(SESSION_KEY);
}

export async function persistLedger(): Promise<void> {
  await storageSet(LEDGER_KEY, JSON.stringify(mockPaymentApi.exportLedger()));
}

export async function hydrateLedger(): Promise<void> {
  const raw = await storageGet(LEDGER_KEY);
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
  await storageRemove(LEDGER_KEY);
}

export function newIdempotencyKey(prefix: string): string {
  const rand =
    typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}_${rand}`;
}
