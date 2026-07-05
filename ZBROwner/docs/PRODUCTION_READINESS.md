# Production Readiness Audit — ZBROwner

**Original verdict: NOT ready for production launch.**
**Status: Tier-0 (ship-blockers) and Tier-1 (soft-launch bar) both resolved.
Remaining before a confident launch: a TLS backend host + Tier-2 (tests/CI/runtime
validation).**

A five-dimension audit (config/deploy, security, resilience, testing, feature-correctness)
of the ZBROwner vendor app. The architecture is sound — the order pipeline works
end-to-end, auth is well-built, real-time is properly wired. As originally filed the
app **could not connect to a backend from a device and did not build.** Both are
fixed, and the soft-launch hardening is done; see the progress log.

| Dimension | Score /10 → now | One-line |
|-----------|-----------|----------|
| Config & deployment | 2 → 7 | Env-based hosts, deps installed, `eas.json` added; needs real TLS host |
| Security | 3 → 6 | Tokens in keystore, logs stripped; SSRF/deep-link hardening pending |
| Resilience | 4 → 7 | Error boundary, error/retry UI, crash guards, race fix all in |
| Testing & quality | 3 → 7 | CI runs lint+typecheck+31 tests; runtime validation + noUncheckedIndexedAccess pending |
| Feature correctness | 5 → 7 | Fake-success features gated off; core flows solid |

### Progress log
- **Tier 0 — all items resolved** (`89bb82b`, `b97e32e`, `417fbec`, `73f17b2`,
  `44e7e2f`). #5 (TLS) is client-ready; the remaining piece is the backend
  serving `https`/`wss`.
- **Tier 1 — all items resolved** (`85275a0`, `e8d87f6`, `d13baee`, `2dc4e3b`,
  `e158dc5`): crash guards, error/retry UI, silent-failure fixes, fake-feature
  gating, optimistic-race fix, WS alarm dedupe.
- **Tier 2 — largely done:** jest harness + **31 passing tests** (API mapping,
  order state machine incl. the race guard, reviews + financial-report store
  logic, URL-safety) (`c5f90c2`, `f0a8f0d`, `2bab325`); **CI** running
  lint→typecheck→test on every PR + **ESLint** (`c5f90c2`, `fb9f92c`); **security
  hardening** — notification-nav validation, Restos SSRF guard, Restos key to
  keystore (`2bab325`, `13438fc`). Remaining: runtime schema validation at the
  API boundary, `noUncheckedIndexedAccess` (+ the `menu.tsx` partial-types it
  surfaces), the `t('key' as any)` casts, and cert pinning (with the TLS host).
- **Bonus:** fixed 4 pre-existing TypeScript compile errors (`479244d`) — the
  project now type-checks clean, including a real runtime bug in the menu
  remove-image button.

**Rough remaining timeline:** a few days to close out the remaining Tier-2
items — plus the external TLS backend host, which gates a real launch.

---

## TIER 0 — Ship-blockers — ✅ ALL RESOLVED

- [x] **Backend URL hardcoded to localhost** → `constants/api.ts` now reads
  `EXPO_PUBLIC_API_BASE_URL` / `EXPO_PUBLIC_WS_BASE_URL` (Expo inlines these at
  build time), with a localhost dev fallback + `__DEV__` warning. Hosts are set
  per environment in `eas.json`. `.env.example` documents local usage. (`b97e32e`)

- [x] **`expo-location` not installed** → installed via `expo install`
  (`expo-location@~55.1.11`, SDK-matched). (`89bb82b`)

- [x] **`react-native-webview` not installed** → installed
  (`react-native-webview@13.16.0`). Native map picker resolves. (`89bb82b`)

- [x] **No `eas.json`** → added with development / preview / production build
  profiles, each injecting the API/WS hosts; `appVersionSource: remote` +
  `production.autoIncrement` handles versionCode/buildNumber. (`b97e32e`)
  **⚠️ Action for team:** replace the `*.zbr.example.com` placeholder hosts with
  real staging/prod URLs, and run `eas init` to attach a `projectId`.

- [x] **Cleartext HTTP/WS** → **client-ready.** Env mechanism + `eas.json`
  preview/production profiles use `https://` / `wss://`. (`b97e32e`)
  **⚠️ Remaining (backend):** the staging/prod backend must actually serve TLS.
  No client code change left.

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
- [ ] **API boundary blind-cast** — `services/api.ts:114` `return data as T`; enum
  fields cast unchecked (`orderType`, `paymentStatus`, `status`). A renamed field or
  null-where-number crashes deep in render. Add runtime validation (zod/io-ts) at
  the boundary. *(The order-mapping layer is now null-tolerant + unit-tested,
  which de-risks the most common path; full schema validation still pending.)*
- [x] **Quality gate (CI + lint)** — `.github/workflows/ci.yml` runs `npm ci` →
  lint → typecheck → test on every PR. Added ESLint (flat config extending
  `eslint-config-expo`); lint is error-clean (50 non-blocking warnings remain as
  follow-ups). `tsc --noEmit` clean. (`c5f90c2`, `fb9f92c`)
- [ ] **`noUncheckedIndexedAccess` off** — deferred. Enabling it surfaces ~23
  errors: ~12 in test files (trivial), and ~11 real ones in `menu.tsx` variant/
  option editing that indicate genuine partial-type assignments worth fixing
  carefully (not a rush job). The highest-risk index access (status/label maps,
  order arrays) is now runtime-null-tolerant and unit-tested. Enable + fix as a
  focused follow-up.
- [ ] **83 `t('key' as any)` casts** defeat i18n key-checking — a future key rename
  ships broken UI silently (renders the raw key path). Drop the `as any`.
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

- `app.json` has no `android.versionCode` / `ios.buildNumber` (needed for store updates).
- `expo-image-picker` used but not registered as a plugin in `app.json` — no
  `NSPhotoLibraryUsageDescription`; will bite on App Store review / camera use.
- `expo-av` (order alarm) is deprecated in favor of `expo-audio`/`expo-video`.
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
