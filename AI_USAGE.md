# AI usage (required by Gametime)

Date: 2026-08-13 (Thursday, America/New_York)

I used Grok (xAI) as a pair-programmer inside an existing Expo 57 scaffold. I did **not** paste the assignment into a model and ship the first draft.

## Where

| Area | Used AI for | Challenged / validated by |
|---|---|---|
| Domain types + eligibility | First-pass rules table | Spec re-read: Affirm is **over** $100, not `>=`; Apple Pay is not “iOS ⇒ show”. Locked with Jest. |
| Card helpers | Luhn + brand formatting | Compared against known test PANs (`4242…`, Amex 15). Rejected an earlier expiry formatter that produced `MM/`. |
| Mock API | Idempotency sketch | Rejected `Date.now()` keys and “clear pending in `finally` then recover on every `AppState` active” — that combination double-charges. Replaced with persist-before-POST, processing row, GET on relaunch. |
| UI scaffold | Layout / Review Lab | Kept eligibility/lifecycle logic out of presentational components. |
| README | Structure | Rewrote from the spec’s submission bullets, not from the Expo starter README. |

## What I threw away

- Showing Apple Pay solely because `Platform.OS === 'ios'`.
- Sending the raw PAN to the mock API.
- Generating a new idempotency key on every tap / every resume.
- Treating “ledger miss after kill” as success.
- A `$165 × 2` cart that could never drop under the Affirm threshold, so the qty question was untestable.

## What I did not use AI for

- Inventing that a real Wallet was provisioned on the simulator.
- Real Apple Pay / Google Pay / Affirm sandbox credentials (forbidden by the brief).
- Claiming the app was tested on hardware it was not.
