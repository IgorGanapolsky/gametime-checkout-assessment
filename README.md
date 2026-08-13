# Gametime Staff Mobile — Checkout & Payments

React Native (Expo) checkout for the Staff Mobile Engineer take-home.

A fan has already picked seats. This screen decides **which payment methods they are allowed to see**, makes **express pay actually express**, keeps **card entry honest**, and talks to a **mock payment API** whose contract is designed so a kill/relaunch cannot double-charge.

Deadline context: assignment email received **2026-08-12 (Wednesday)**; submit by **2026-08-17**.

## What I built

- Checkout screen: order summary, quantity (fees recompute), eligibility-gated express methods, card form, Review Lab.
- Pure eligibility engine (`src/services/eligibilityEngine.ts`).
- Card validation: formatting, brand, Luhn, future expiry, CVC length (`src/services/cardValidator.ts`).
- Wallet / Affirm **stubs** that mimic a native sheet and a redirect — tap completes in that flow. No second Submit.
- In-process mock API with a JSON request/response boundary, idempotency, processing-before-wait, and GET-by-key reconciliation (`src/services/mockPaymentApi.ts`).
- AppState + persisted session + persisted ledger so background and kill/relaunch resume the **same** attempt.

Visual polish was deliberately second to eligibility, lifecycle, and form UX.

## How to run

Requires Node 20+.

```bash
npm install
npm test
npx expo start
```

Then:

- iOS Simulator: `i`
- Android emulator: `a`
- Expo Go on a device: scan the QR (same LAN)

**Tested:** `npm test` on Node 22 (macOS). App starts with Expo SDK 57. Simulator/emulator is enough — no paid Apple Developer account, no real Apple Pay / Google Pay / Affirm credentials.

On first launch in the iOS Simulator you should **not** see Apple Pay. That is the honest default: simulators do not have a provisioned Wallet card. Open **REVIEW LAB** (bottom right) → platform `iOS` → cycle **Apple Pay provisioned** to `true`.

## Eligibility

| Method | Shown when |
|---|---|
| Apple Pay | Effective platform is iOS **and** a card is provisioned in Wallet |
| Google Pay | Effective platform is Android **and** Google Pay is set up |
| Affirm | Cart total is **strictly over $100.00** (`totalCents > 10000`) |
| Card | Always |

Detection default (`src/services/deviceCapabilities.ts`):

- Platform from `Platform.OS`.
- Wallet capability is **false on simulators / Expo Go** and true only on a real device of that OS. A production build would swap the stub for `PKPaymentAuthorizationController.canMakePaymentsUsingNetworks` / `PaymentsClient.isReadyToPay`. The stub has the same shape: capability check → (sheet \| redirect) → authorization token.

Review Lab can force platform and wallet independently so one device can exercise every branch.

Affirm reacts to quantity: default qty 1 is about **$90.90** (hidden); qty 2 is about **$177.80** (shown). Fees are integer cents.

## Mock API contract

`POST /v1/payments` shape (in-process, JSON cloned both ways):

```json
{
  "idempotencyKey": "card_<uuid>",
  "orderId": "ord_sf_la_lower_114",
  "paymentMethod": "credit_card",
  "amountCents": 9090,
  "currency": "usd",
  "paymentMethodToken": "tok_visa_4242"
}
```

Responses: `processing` | `captured` | `declined` | `cancelled` | `conflict`.

`GET /v1/payments/by-idempotency/:key` is `queryPaymentStatus`.

Why this shape:

- **Integer cents** — ticket + fee math never uses floats.
- **Token, never PAN** — `tokenizeCard` maps `4242…4242` → `tok_visa_4242` and `4000…0002` → `tok_visa_declined`.
- **Idempotency is the anti-double-charge primitive.** Same key + same fingerprint replays the original row. Same key + different amount/method/token is HTTP 409.
- **`processing` is written before the simulated network wait.** If the app is killed mid-request, relaunch finds a row instead of inventing a new key.
- In-process transport is enough to defend the contract. Swapping `MockPaymentBackend` for `fetch` is a one-file change; the checkout already treats the boundary as JSON.

Failure paths the UI handles:

- Issuer decline (`4000 0000 0000 0002` or Review Lab → Issuer decline)
- Wallet / Affirm cancel (sheet Cancel — **no charge**)
- 504 mid-request (Review Lab → 504; UI goes to **we're checking**, then GET)

## State flow

```
idle
  ├─ express tap → awaiting_wallet | awaiting_redirect  (sheet/redirect stub)
  │                   ├─ Pay/Continue → processing → captured | declined
  │                   └─ Cancel → cancelled (no API charge)
  └─ valid card Pay → processing → captured | declined
                         └─ 504 → reconciling → GET same key
```

Background (`AppState` → inactive/background) does **not** reset. The attempt (idempotency key, amount, method, token) is already on disk.

Kill + relaunch: hydrate the ledger, load the session, GET the key.

- captured → success (do not charge again)
- declined → show decline, new attempt needs a **new** key
- processing → stay on “we don’t know yet”
- missing → the POST never landed; a new attempt is safe

A local in-flight request is not overwritten by AppState recovery (that race is how you double-charge).

## Card UX

- Format and brand on keystroke.
- Luhn / expiry / CVC errors on blur once the field is long enough — so iOS/Google autofill can land a full PAN before we shout.
- `keyboardType="number-pad"`, `textContentType` / `autoComplete` for number, expiry, CVC.
- Pay stays disabled until the card is complete.

## Tradeoffs

- In-process API instead of a separate Express process so Expo Go on a phone does not need `localhost` routing.
- Wallet / Affirm are stubs with the real interaction shape, not sandbox SDKs (per the brief).
- Context + hooks instead of XState — the state machine is small enough to read in one file.
- Ledger persistence is AsyncStorage, not SQLite. Fine for one in-flight checkout.

## What I would do with more time

- Hosted mock (`msw` or a tiny Fastify) plus a recorded OpenAPI file.
- Detox: background during sheet, kill during `processing`, assert a single `transactionId`.
- 3-D Secure / step-up as a second redirect state.
- SecureStore for the session, and a server-side unique constraint demo.
- Accessibility pass (Dynamic Type, VoiceOver on the wallet buttons).

## AI usage

See [AI_USAGE.md](./AI_USAGE.md). Gametime asked for where/why AI was used and how outputs were challenged.

## Tests (TDD + e2e instrumentation)

```bash
npm test          # Jest: domain + CheckoutController e2e + testID contract
npm run test:e2e  # controller + instrumentation only
```

TDD: `cart.test.ts` and `checkoutController.e2e.test.ts` were written first (they failed on missing modules), then `CheckoutController` / `cart` / `MemoryKv` were implemented until green.

The controller suite is the fail-closed **full e2e of payment state** (no RN renderer):

- hide Apple Pay without Wallet; card still charges
- express is one interaction (sheet confirm charges; cancel writes no ledger row)
- Affirm appears only after qty crosses $100
- qty locked in flight
- decline token then new key succeeds
- kill mid-`processing` + rehydrate GET-replays one ledger row
- 504 stays on the same idempotency key
- incomplete card never hits the API

Device instrumentation: `maestro/` (testIDs from `src/testing/testIds.ts`). See `maestro/README.md`. Maestro on a booted sim is complementary; Jest controller e2e is the gate.
