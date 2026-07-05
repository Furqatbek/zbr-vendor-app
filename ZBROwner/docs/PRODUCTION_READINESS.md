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
| Testing & quality | 3 → 4 | `tsc` now clean; still zero tests, no CI |
| Feature correctness | 5 → 7 | Fake-success features gated off; core flows solid |

### Progress log
- **Tier 0 — all items resolved** (`89bb82b`, `b97e32e`, `417fbec`, `73f17b2`,
  `44e7e2f`). #5 (TLS) is client-ready; the remaining piece is the backend
  serving `https`/`wss`.
- **Tier 1 — all items resolved** (`85275a0`, `e8d87f6`, `d13baee`, `2dc4e3b`,
  `e158dc5`): crash guards, error/retry UI, silent-failure fixes, fake-feature
  gating, optimistic-race fix, WS alarm dedupe.
- **Bonus:** fixed 4 pre-existing TypeScript compile errors (`479244d`) — the
  project now type-checks clean (`npx tsc --noEmit` passes), including a real
  runtime bug in the menu remove-image button.

**Rough remaining timeline:** Tier 2 (~2–3 weeks) for real confidence (tests, CI,
runtime validation, security hardening).

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

- [ ] **Zero automated tests** — no runner, no `test` script, no `__tests__`. An app
  that mutates orders and computes payouts has no regression net. Start with the
  order state machine (`store` accept/decline/status) and the `api.ts` mapping layer.
- [ ] **API boundary blind-cast** — `services/api.ts:114` `return data as T`; enum
  fields cast unchecked (`orderType`, `paymentStatus`, `status`). A renamed field or
  null-where-number crashes deep in render. Add runtime validation (zod/io-ts) at
  the boundary.
- [ ] **No quality gates** — no ESLint/Prettier config, no `.github/workflows`. Nothing
  runs `tsc --noEmit`/lint/test on PRs. (`more.tsx:48` even has an
  `eslint-disable` for an ESLint that isn't installed.) Add CI.
  *(Update: `npx tsc --noEmit` now passes clean as of `479244d`, so a typecheck
  gate can be wired immediately.)*
- [ ] **`noUncheckedIndexedAccess` off** — `tsconfig.json`; record lookups
  (`STATUS_LABEL_KEYS[order.status]`, `ROLE_COLORS[role]`) resolve to `undefined`
  with no compile warning, and the mapping layer explicitly passes unknown statuses
  through. Turn it on.
- [ ] **83 `t('key' as any)` casts** defeat i18n key-checking — a future key rename
  ships broken UI silently (renders the raw key path). Drop the `as any`.
- [ ] **No cert/public-key pinning** — land with the TLS fix.
- [ ] **SSRF vector** — `settings/integration.tsx` forwards a raw user-entered
  `baseUrl` to the backend to fetch server-side with no scheme/host allowlist.
  Allowlist client-side + validate server-side.
- [ ] **Untrusted notification payload drives navigation** —
  `hooks/useNotifications.ts:96` `router.push('/order/${data.orderId}')` with no
  validation of `orderId`. Validate before interpolating into a route.
- [ ] **Restos API key in AsyncStorage plaintext** — `settings/integration.tsx`
  `persistConfig`. Move to SecureStore with the token fix.

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
