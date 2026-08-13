# Maestro e2e (device instrumentation)

Requires Maestro 2.7+ (this Mac: `~/.maestro/bin/maestro`).

Codex AGENT-379 recorded:

- `JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home`
- iPhone 17 Pro UDID `28AD6591-DE90-4BF2-9D1A-30D691132EEB`
- Android `R3CY90QPM7E`

```bash
npm test                          # controller + unit (TDD)
npx expo start --ios              # or --android
maestro test maestro/checkout-affirm-eligibility.yaml
maestro test maestro/checkout-card-success.yaml
```

Flows tap `testID`s from `src/testing/testIds.ts`. They are not a substitute for the Jest controller suite, which is the fail-closed e2e of payment state.
