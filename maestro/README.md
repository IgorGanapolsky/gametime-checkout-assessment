# Maestro e2e (device instrumentation)

Requires Maestro 2.7+ (this Mac: `~/.maestro/bin/maestro`).

Codex AGENT-379 recorded:

- `JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home`
- iPhone 17 Pro UDID `28AD6591-DE90-4BF2-9D1A-30D691132EEB`
- Android `R3CY90QPM7E`

The physical Android lane uses Expo Go intentionally. Keep the tracked native
package id out of this suite: every flow opens `exp://127.0.0.1:8082`, and ADB
reverse makes that localhost URL deterministic over USB.

```bash
export ANDROID_HOME=/Users/igorganapolsky/Library/Android/sdk
export JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home
export PATH="$JAVA_HOME/bin:$PATH"

npm run test:acceptance
npx expo start --port 8082 --localhost --clear
adb -s R3CY90QPM7E reverse tcp:8082 tcp:8082
npm run test:maestro
```

Flows tap `testID`s from `src/testing/testIds.ts`. The real force-stop flow
waits for the durable processing row, copies its idempotency key, stops Expo Go,
reopens the project, and asserts the same key plus ledger count `1`.

The Jest controller suite and Maestro device suite are complementary. Neither a
service-only test nor an app launch is reported as physical E2E proof.
