# Production Readiness Audit — ZBROwner

**Original verdict: NOT ready for production launch.**
**Status: Tier-0, Tier-1 and (bar cert pinning) Tier-2 all resolved.
The remaining blockers are external, not client code:**
1. **A TLS backend host + its hostnames** — inlined into the bundle at build
   time, so no shippable APK exists until these are known.
2. **Backend sending FCM/APNs pushes** — see `docs/PUSH_SETUP.md`.
3. **An APNs key** (iOS only; Android push is fully configured).

**Build/release model: local Gradle builds → Google Play. No EAS.** See
`docs/LOCAL_BUILD.md`.

A five-dimension audit (config/deploy, security, resilience, testing, feature-correctness)
of the ZBROwner vendor app. The architecture is sound — the order pipeline works
end-to-end, auth is well-built, real-time is properly wired. As originally filed the
app **could not connect to a backend from a device and did not build.** Both are
fixed, and the soft-launch hardening is done; see the progress log.

| Dimension | Score /10 → now | One-line |
|-----------|-----------|----------|
| Config & deployment | 2 → 7 | Env-based hosts + preflight checks, local Gradle build documented; needs real TLS host |
| Push notifications | 1 → 6 | Real FCM/APNs tokens, Firebase wired, channels/sound configured; needs backend senders + APNs key |
| Security | 3 → 6 | Tokens in keystore, logs stripped; SSRF/deep-link hardening pending |
| Resilience | 4 → 7 | Error boundary, error/retry UI, crash guards, race fix all in |
| Testing & quality | 3 → 8 | CI runs lint+typecheck+37 tests; strict flags on; zod at money/orders boundary |
| Feature correctness | 5 → 7 | Fake-success features gated off; core flows solid |

### Progress log
- **Tier 0 — all items resolved** (`89bb82b`, `b97e32e`, `417fbec`, `73f17b2`,
  `44e7e2f`). #5 (TLS) is client-ready; the remaining piece is the backend
  serving `https`/`wss`.
- **Tier 1 — all items resolved** (`85275a0`, `e8d87f6`, `d13baee`, `2dc4e3b`,
  `e158dc5`): crash guards, error/retry UI, silent-failure fixes, fake-feature
  gating, optimistic-race fix, WS alarm dedupe.
- **Tier 2 — essentially done:** jest harness + **37 passing tests** (API mapping,
  order state machine incl. the race guard, reviews + financial-report store
  logic, URL-safety, zod schemas) (`c5f90c2`, `f0a8f0d`, `2bab325`, `f78be08`);
  **CI** running lint→typecheck→test on every PR + **ESLint** (`c5f90c2`,
  `fb9f92c`); **security hardening** — notification-nav validation, Restos SSRF
  guard, Restos key to keystore (`2bab325`, `13438fc`);
  `noUncheckedIndexedAccess` on with its real bugs fixed (`e613924`); i18n `t()`
  casts removed (`1b7eadd`); **zod runtime validation** at the money/orders
  boundary (`f78be08`). **The only remaining Tier-2 item is cert pinning, which
  needs the real TLS host.**
- **Push notifications — new workstream** (`a139652`, `ac07611`, `e3cf2a9`,
  `0415a6d`): screen-off delivery needs remote push; the WebSocket + local
  notifications could never wake a sleeping device. Fixed four real defects
  found along the way — push registration threw in any real build (no EAS
  `projectId`), the wrong token type was being sent (Expo token to an FCM/APNs
  backend), token rotation was unhandled (silent push death), and the alarm
  sound's filename would have broken the Android build. Firebase project
  `push-notifications-for-zbr` wired and verified. See `docs/PUSH_SETUP.md`.
- **Build model** (`9e043bf`): local Gradle builds, no EAS. Added
  `check:release` / `check:push` preflights so a build can't ship pointing at a
  placeholder host or with a mismatched Firebase config.
- **Bonus:** fixed 4 pre-existing TypeScript compile errors (`479244d`) — the
  project now type-checks clean, including a real runtime bug in the menu
  remove-image button.

**Rough remaining timeline:** client work is essentially done. What's left is
external: the TLS hostnames, the backend's FCM/APNs senders, and an APNs key for
iOS. Android could be in an internal Play test within a day of the TLS host
existing.

---

## TIER 0 — Ship-blockers — ✅ ALL RESOLVED

- [x] **Backend URL hardcoded to localhost** → `constants/api.ts` now reads
  `EXPO_PUBLIC_API_BASE_URL` / `EXPO_PUBLIC_WS_BASE_URL` (Expo inlines these at
  build time), with a localhost dev fallback + `__DEV__` warning. Release hosts
  come from `.env.production`; `.env.example` documents which env file loads
  when. (`b97e32e`, `9e043bf`)

- [x] **`expo-location` not installed** → installed via `expo install`
  (`expo-location@~55.1.11`, SDK-matched). (`89bb82b`)

- [x] **`react-native-webview` not installed** → installed
  (`react-native-webview@13.16.0`). Native map picker resolves. (`89bb82b`)

- [x] **No reproducible build config** → **decided: build locally with Gradle, no
  EAS.** `eas.json` remains in the repo but is **unused** (kept only as an escape
  hatch if cloud builds are ever wanted); its placeholder hosts affect nothing,
  and no Expo `projectId` is needed. Release config now lives in
  `.env.production` + `app.json` (`android.versionCode`, `ios.buildNumber`),
  with `npm run check:release` blocking a build on placeholder/localhost/
  cleartext hosts or a missing versionCode. See `docs/LOCAL_BUILD.md`.
  (`b97e32e`, `9e043bf`)

- [x] **Cleartext HTTP/WS** → **client-ready.** `check:release` hard-fails any
  release build whose hosts aren't `https://` / `wss://`. (`b97e32e`, `9e043bf`)
  **⚠️ Remaining (backend):** the staging/prod backend must actually serve TLS,
  **and the hostnames must be known** — they're inlined into the bundle at build
  time, so no shippable APK can be produced until they exist. No client code
  change left.

- [x] **Auth tokens in AsyncStorage plaintext** → migrated to `expo-secure-store`
  (iOS Keychain / Android Keystore) via `utils/secureStorage.ts`, with web
  fallback and a one-time migration from the legacy plaintext slot. (`44e7e2f`)

- [x] **PII console-logged to production** → removed the debug logs (including the
  full-order `JSON.stringify` dump) across store/api/order-detail/orders-tab/
  SlideToAction, and added `babel-plugin-transform-remove-console` to strip
  `console.*` (except `error`) from release builds. (`417fbec`)

- [x] **No global React error boundary** → added `components/ErrorBoundary.tsx`
  wrapping the root tree with a "Something went wrong / Reload" fallback.
  (`73f17b2`)

---

## TIER 1 — Soft-launch bar — ✅ ALL RESOLVED

### Crashes & data integrity
- [x] **Reports crashes on partial/null financial data** → `fmt()` coerces
  null/undefined to 0 before `.toFixed`. (`85275a0`)
- [x] **One malformed order poisons the whole list** → `normalizeStatus`/`mapApiOrder`
  tolerate null fields and a new `safeMapOrders` drops bad records per-item instead
  of rejecting the page; `totalElements`/`last` guarded too. (`85275a0`)

### Error visibility
- [x] **No error/retry UI on any data screen** → added `components/ErrorState.tsx` +
  `ordersError`/`reviewsError`/`financialReportError` store flags; Orders, Reviews,
  and Reports show a retryable error state when a load fails with no cached data.
  (`e158dc5`)
- [x] **`toggleRestaurantOpen` failures are fully silent** → both tabs now Alert the
  vendor on failure (`orders.toggleOpenFailed`, all locales). (`e8d87f6`)
- [x] **Orders screen has no loading indicator** → first-load spinner wired to
  `ordersLoading`. (`e8d87f6`)

### Features that fake success (persist nothing)
Resolved by **hiding behind feature flags** (`constants/features.ts`) so they stop
presenting capabilities that silently fail; flip each flag to `true` when the
backend endpoint lands. (`d13baee`)
- [x] **Review replies** → reply button + `unresponded` filter gated on
  `FEATURES.reviewReplies`.
- [x] **Courier ratings** → rating sheet gated on `FEATURES.courierRatings`.
- [x] **Notification preference toggles** → switches disabled and show the truthful
  "all delivered" state, gated on `FEATURES.notificationPrefs`.
- [x] **Reports "Refunds / Cancellations"** → cards gated on `FEATURES.reportsRefunds`
  (were hardcoded 0 on a money screen).
- [x] **Sold Items always empty** → already self-hidden (preview gated on
  `soldItems.length > 0`, which is never populated). No change needed.
- [x] **Staff screen** → already unreachable (removed from the More menu earlier).
  Left registered but not linked; delete in a later cleanup if desired.

### Race conditions
- [x] **Optimistic status updates clobbered by WS `loadOrders`** → a module-level
  `pendingOrderIds` set is populated during each in-flight mutation; `loadOrders`
  merges server data but preserves the local copy for pending ids, so a refresh
  mid-PATCH no longer reverts the card. (`2dc4e3b`)
- [x] **WS `new_order` re-triggers the alarm** → now skips `triggerOrderAlert` when
  it's already showing for that same order. (`2dc4e3b`)

---

## TIER 2 — Real confidence (before scaling up)

- [~] **Automated tests** — harness established (`jest-expo`) with the first two
  suites: `__tests__/api.mapping.test.ts` (status normalization incl.
  COURIER_ASSIGNED, ETA math, safe order mapping) and
  `__tests__/store.orders.test.ts` (optimistic accept/decline/status + rollback,
  the pending-merge race guard, error flag). 20 tests passing. (`c5f90c2`)
  **Still to cover:** financial-report math, reviews mapping, auth refresh flow,
  component render smoke tests.
- [x] **API boundary runtime validation** — added zod schemas
  (`services/schemas.ts`) for the money/orders-critical payloads:
  `financialReportSchema` defaults every numeric field to 0 / trend arrays to []
  (applied in `fetchFinancialReport`), and `isStructurallyValidOrder` drops
  records missing id/status or with a non-array items in `safeMapOrders`
  (getter-throw-safe). 6 tests. (`f78be08`) *(Remaining payloads still use the
  `as T` cast; the highest-risk money/orders paths are now validated.)*
- [x] **Quality gate (CI + lint)** — `.github/workflows/ci.yml` runs `npm ci` →
  lint → typecheck → test on every PR. Added ESLint (flat config extending
  `eslint-config-expo`); lint is error-clean (50 non-blocking warnings remain as
  follow-ups). `tsc --noEmit` clean. (`c5f90c2`, `fb9f92c`)
- [x] **`noUncheckedIndexedAccess`** — enabled in `tsconfig`. Fixed the real bugs
  it surfaced: `menu.tsx` variant/option editing spread a possibly-undefined
  element into an object missing required fields (now reads-then-guards), and
  `reviews.tsx` wrote to `dist[-1]` (NaN) for a 0-rating. tsc clean with the flag
  on. (`e613924`)
- [x] **`t('key' as any)` casts** — removed all ~64 literal-key casts and typed the
  dynamic-key lookups (`Record<_, TranslationKey>`), so a future key rename now
  fails the build instead of silently rendering the raw key path. (`1b7eadd`)
- [ ] **No cert/public-key pinning** — land with the TLS fix (needs the real host).
- [x] **SSRF vector** — `settings/integration.tsx` now validates the user-entered
  `baseUrl` client-side via `utils/urlSafety` (http(s) only; rejects localhost/
  127.*/169.254.*/10/192.168/172.16-31/*.local/*.internal) before the backend
  fetches it. Authoritative allowlist still belongs server-side. (`2bab325`)
- [x] **Untrusted notification payload drives navigation** — `orderId` is now
  validated as a numeric string before being routed to `/order/${id}`. (`2bab325`)
- [x] **Restos API key in AsyncStorage plaintext** — moved to `expo-secure-store`;
  the config blob no longer holds the credential. (`13438fc`)

---

## Minor / polish

- ~~`app.json` has no `android.versionCode` / `ios.buildNumber`~~ → **added**
  (`versionCode: 1`, `buildNumber: "1"`). Now that EAS isn't auto-incrementing
  them, `versionCode` **must be bumped manually before every Play upload** —
  Play rejects a duplicate. (`9e043bf`)
- `expo-image-picker` used but not registered as a plugin in `app.json` — no
  `NSPhotoLibraryUsageDescription`; will bite on App Store review / camera use.
- ~~`expo-av` (order alarm) is deprecated in favor of `expo-audio`/`expo-video`.~~
  **Done** — expo-av was removed. It no longer compiles against this SDK: its
  `EXAV.h` imports `ExpoModulesCore/EXEventEmitter.h`, which is gone, so an iOS
  archive fails with "could not build Objective-C module 'EXAV'".
- Dead/unreachable UI shipped in bundle: `settings/payments.tsx` (fully built,
  menu entry commented out), `settings/staff.tsx`, `settings/sold-items.tsx`.
- Dead buttons (no `onPress`): Reports "Export PDF", order-detail chat bubble,
  "Platform support" card.
- `Review.orderItems` always `[]`; `platform` hardcoded `'ZBR'`.
- "Mark ready" from the dashboard jumps `accepted → ready`, skipping `preparing`,
  so `prepStartedAt` is never set and the countdown never shows.
- `clearSession()` fires `AsyncStorage.multiRemove` without awaiting — a crash
  mid-remove could leave a stale token file after logout.
- Root `/zbr-vendor-app/.gitignore` is malformed (literal `\n` escapes); harmless
  because `ZBROwner/.gitignore` is correct.
- 3 `as unknown as typeof en` casts (`i18n/index.ts:20-22`) disable locale
  type-checking against the `en` shape — i18n is complete today only by discipline.

---

## What's genuinely solid (not padding)

- **Order lifecycle is real end-to-end** — accept/decline/every status transition
  does optimistic-update + real endpoint + rollback-on-failure + user-facing error.
  No fake success in the order pipeline itself.
- **Auth is well-engineered** — single-flight token refresh with dedupe, awaited
  rotated-token persistence, clean session-expiry → logout, device-token
  register/unregister. No dev bypass, no seeded creds.
- **Real-time is correct** — STOMP subscriptions, token re-read on every reconnect,
  `connected` event re-syncs orders to close gaps missed while disconnected.
- **Menu management is complete** — category/item CRUD, stock toggle, multipart
  image upload/delete (web + native), variants/options — all real endpoints.
- **Notifications inbox is fully functional** — paginated fetch, mark-read,
  mark-all-read, unread-count, all real API with optimistic UI.
- **i18n is genuinely complete** — all four locales (en/ru/uz-Latn/uz-Cyrl) share
  the same sections and key sets; no missing keys in practice.
- **No secrets committed** — no `.env`, no keys, no signing material; `.gitignore`
  correctly excludes native signing artifacts.

---

*Generated from a five-agent parallel audit. Findings with file:line were verified
against the repository. Check items off as they're addressed; keep this doc as the
launch checklist.*
