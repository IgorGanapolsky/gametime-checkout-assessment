# Gametime Mobile Checkout — Staff Mobile Engineer Take-Home

A production-grade, highly resilient React Native (Expo) checkout application built for **Gametime**'s mobile app. Tailored for high-friction, last-minute ticket purchases outside venues on patchy cell coverage.

---

## 🚀 Quick Start & How to Run

### Prerequisites
- **Node.js**: `v18+` or `v20+`
- **npm** or **yarn**
- **Expo Go app** (iOS / Android) or iOS Simulator / Android Emulator

### Installation & Run Commands
```bash
# 1. Navigate to the repository
cd gametime-mobile-checkout

# 2. Install dependencies
npm install

# 3. Run Jest Unit & E2E Instrumentation Tests
npm test

# 4. Start Expo Development Server
npm start
```

- **iOS Simulator**: Press `i` in the terminal or run `npm run ios`.
- **Android Emulator**: Press `a` in the terminal or run `npm run android`.
- **Web Browser Preview**: Press `w` in the terminal or run `npm run web`.
- **Tested Environments**: Tested on iOS Simulator (iPhone 16 Pro, iOS 18.0), Android Emulator (Pixel 8, API 34), and Web.

---

## 🎯 Architecture & Core Solutions

### 1. Payment Eligibility Detection Engine (`src/services/eligibilityEngine.ts`)
Express payment options appear dynamically based on real-time device capabilities and cart parameters:
- **Apple Pay**: Appears ONLY when `platform === 'ios'` AND device has a provisioned card in Apple Wallet (`PKPaymentAuthorizationViewController.canMakePayments()`).
- **Google Pay**: Appears ONLY when `platform === 'android'` AND Google Pay API is initialized/available.
- **Affirm (BNPL)**: Appears ONLY when purchase total > `$100.00` (re-evaluated dynamically as ticket quantity or fees change).
- **Credit Card**: Universal fallback, always available.

### 2. Form UX & Native Keyboard Optimization (`src/components/CreditCardForm.tsx`)
- Real-time **Luhn Algorithm (Mod 10)** validation (`validateLuhn`).
- Automatic **Card Brand Detection** (Visa, Mastercard, American Express, Discover) with dynamic brand badges.
- Native keyboard props: `keyboardType="numeric"`, `textContentType="creditCardNumber"`, `autoComplete="cc-number"`.
- Real-time 4-4-4-4 / 4-6-5 digit grouping and `MM/YY` expiration formatting.
- Strict submit enforcement: The **"Pay $[Amount]"** button remains disabled until card number, future expiration date, and CVC length (3 digits for Visa/MC/Disc, 4 digits for Amex) are valid.

### 3. Single-Tap Express Checkout Execution (`src/components/ExpressCheckout.tsx`)
- Tapping Apple Pay, Google Pay, or Affirm completes the purchase in **one interaction**. No secondary "Submit Order" button required.
- Triggers payment authorization immediately upon sheet/biometric confirmation.

### 4. Idempotent Payment API Contract (`src/services/mockPaymentApi.ts`)
```typescript
interface PaymentRequest {
  idempotencyKey: string; // Client-generated UUID (e.g. idempotency_gt_exp_...)
  paymentMethod: 'apple_pay' | 'google_pay' | 'affirm' | 'credit_card';
  amount: number;
  currency: string;
  cardDetails?: { lastFour: string; brand: string; expMonth: string; expYear: string };
  expressToken?: string;
  simulateFailureMode?: 'none' | 'declined' | 'network_error' | 'cancelled_sheet';
}

interface PaymentResponse {
  success: boolean;
  status: 'captured' | 'declined' | 'error' | 'cancelled';
  transactionId?: string;
  errorMessage?: string;
  idempotencyKey: string;
  processedAt: string;
  wasIdempotentReplay?: boolean; // Indicates cached server replay
}
```
**Why this contract?** In live event ticketing, fans tap buy on unstable cell towers outside stadiums. Attaching a client-side `idempotencyKey` before dispatch guarantees that server retries return the original transaction result without double-charging the fan.

### 5. App Lifecycle Interruption & Recovery State Machine (`src/context/CheckoutContext.tsx`)
```
[idle] ──(Tap Payment)──> [savePendingState] ──> [processing] ──(OS Interrupt / AppState: background)
                                                        │
[succeeded] <──(Query Status by IdempotencyKey)─────────┴──(AppState: active / Cold Relaunch)
```
- **Interruption Resiliency**: When an OS biometric sheet, Affirm webview redirect, incoming phone call, or backgrounding event (`AppState` -> `background`) interrupts the flow, the pending `idempotencyKey` and payload are stored in `@react-native-async-storage/async-storage`.
- On cold launch or app foregrounding (`AppState` -> `active`), `recoverPendingPayment()` queries `mockPaymentApi.queryPaymentStatus(idempotencyKey)`.
- If the server captured the charge while backgrounded, the UI transitions directly to **"Order Confirmed"** with the receipt. If the request never reached the server, it resets cleanly to `idle` without double charging.

---

## 🛠 Interactive Dev Simulator Drawer

Includes a hidden QA / Environment Simulator Drawer (accessible via the floating **"🛠 DEV SIMULATOR"** FAB button):
1. **Target Platform Override**: Switch between `Auto`, `iOS`, and `Android`.
2. **Device Card Provisioning**: Toggle Apple Pay provisioned card or Google Pay set up.
3. **Cart Total Toggle**: Instantly switch between `$370.50` (> $100) and `$45.00` (< $100) to test Affirm visibility rules.
4. **Backend Failure Scenarios**: Force `Normal Success (200 OK)`, `Card Declined`, `Apple Pay Sheet Cancelled`, or `504 Gateway Timeout`.
5. **App Interruption Simulator**: Trigger backgrounding/relaunch simulation to verify idempotency state recovery.

---

## 🧪 Testing Suite (Jest & E2E Instrumentation)

Run unit and E2E instrumentation tests:
```bash
npm test
```

### Test Coverage Summary (27 / 27 Passed)
- `cardValidator.test.ts`: Luhn algorithm checks, BIN brand detection, future expiry validation, Amex vs Visa CVC rules.
- `eligibilityEngine.test.ts`: Apple Pay iOS rules, Google Pay Android rules, Affirm $100 threshold, environment overrides.
- `mockPaymentApi.test.ts`: Fresh payments, idempotency key replays (double-charge prevention), card declines, status queries.
- `e2eInstrumentation.test.ts`: Full end-to-end user journeys across Apple Pay, Affirm, Credit Card, app backgrounding recovery, and failure handling.

---

## ⚖️ Tradeoffs & Future Enhancements

### Tradeoffs Made
1. **In-Memory Ledger vs Persistent DB**: The mock payment API uses an in-memory `Map` for idempotency tracking rather than a real Redis/PostgreSQL store.
2. **Simplified Biometric Prompt**: Used React Native native modal overlays to simulate Apple/Google Pay sheets rather than requiring physical device credentials.

### What I'd Do Differently With More Time
1. **PassKit Native Bridge**: Implement direct Objective-C / Swift native module stubs (`PKPaymentAuthorizationViewControllerDelegate`) for deeper native sheet callbacks.
2. **3D Secure / OTP Flow**: Add a simulated 2FA challenge step for European/SCA credit card compliance.
3. **Offline Queueing**: Store pending ticket reservations in a local SQLite queue with automatic background sync when cell signal restores.

---

## 🤖 AI Usage Documentation

Per Gametime's assessment guidelines for AI-forward engineering:

- **Where AI was used**:
  - **Architecture & Boilerplate Generation**: Used AI to scaffold initial TypeScript domain types (`src/types/checkout.ts`), eligibility rules, and Jest unit test assertions.
  - **Luhn Algorithm Optimization**: Prompted AI for an edge-case-safe Luhn Mod-10 implementation.
  - **App Lifecycle State Machine Design**: Used AI to review edge cases for `AppState` transition handling with `AsyncStorage` persistence.
- **Why AI was used**: Accelerated setup of boilerplate structures and test data generation, freeing focus for state machine resiliency, idempotency boundaries, and form UX details.
- **How outputs were validated & challenged**:
  - **Challenged Card Formatting**: AI initially suggested a simple 4-4-4-4 regex for card numbers. I manually revised it to support 4-6-5 formatting for American Express cards (`formatCardNumber`).
  - **Challenged Idempotency Teardown**: AI suggested clearing the pending state key on app backgrounding. I corrected this logic so the key persists *through* backgrounding and is cleared only *after* server status verification, ensuring zero lost states on OS kill.
  - **Empirical Test Verification**: Executed 27 automated unit and E2E instrumentation tests (`npm test`) to empirically verify all logic without relying on unvalidated assumptions.
