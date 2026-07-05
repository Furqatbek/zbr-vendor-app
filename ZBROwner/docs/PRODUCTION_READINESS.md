# Production Readiness Audit — ZBROwner

**Verdict: NOT ready for production launch.**

A five-dimension audit (config/deploy, security, resilience, testing, feature-correctness)
of the ZBROwner vendor app. The architecture is sound — the order pipeline works
end-to-end, auth is well-built, real-time is properly wired — but the app **cannot
connect to a backend from a device and does not build in its current state.**

Every load-bearing finding below was verified by hand against the repo.

| Dimension | Score /10 | One-line |
|-----------|-----------|----------|
| Config & deployment | 2 | Hardcoded `localhost`; two deps uninstalled; no `eas.json` |
| Security | 3 | Plaintext tokens, cleartext traffic, PII in logs |
| Resilience | 4 | No error boundary; one bad record blanks the order board |
| Testing & quality | 3 | Zero tests, no CI, blind-cast API boundary |
| Feature correctness | 5 | Core flows real; several features fake success |

**Rough timeline:** ~1 week to *installable & functional on a device*; **3–4 weeks**
to *let real restaurants run a dinner rush on it.*

---

## TIER 0 — Ship-blockers (must fix before ANY build ships)

- [ ] **Backend URL hardcoded to localhost, no env mechanism**
  `constants/api.ts:5,7` — `API_BASE_URL='http://localhost:8080'`,
  `WS_BASE_URL='ws://localhost:8080'`. On a real device `localhost` is the phone
  itself, so login and every request/WebSocket fail instantly. No `app.config`,
  no `expo-constants` `extra`, no `__DEV__` switch. **Move to an env/build-profile
  mechanism and point at a real host.**

- [ ] **`expo-location` imported but not an installed dependency**
  `app/settings/location.tsx:7` imports it and `app.json` lists it as a plugin,
  but it's absent from `package.json`. `expo prebuild`/EAS fails to resolve the
  plugin; Metro fails to resolve the import. **Run `npx expo install expo-location`
  and commit.**

- [ ] **`react-native-webview` require()'d but not installed**
  `components/MapPicker.tsx:159` — native map picker require()s it; absent from
  `package.json`. Bundle fails / crashes when a vendor opens Settings → Location.
  **Run `npx expo install react-native-webview` and commit.**

- [ ] **No `eas.json`, no EAS project config in `app.json`**
  No build profiles (development/preview/production), no `projectId`, no
  `runtimeVersion`, no updates block. Deployment via EAS is not set up. **Create
  `eas.json` and run `eas init`.**

- [ ] **Cleartext HTTP/WS will be blocked in release even after the host is fixed**
  `constants/api.ts:5,7` use `http://`/`ws://`. iOS ATS and Android cleartext
  policy block non-TLS in release builds; no exception config exists. **Backend
  must be `https://` and `wss://`.**

- [ ] **Auth tokens in AsyncStorage plaintext**
  `store/authStore.ts` persists access + long-lived refresh tokens unencrypted.
  A rooted/stolen/`adb backup`'d device leaks a refresh token that mints access
  tokens indefinitely (rotation only on use). **Migrate token storage to
  `expo-secure-store`.**

- [ ] **PII console-logged to production**
  `store/index.ts:148` — `console.log('[store.declineOrder] API success:',
  JSON.stringify(result))` dumps the full order (customer name, phone, address)
  to device logs on every decline. Also `services/api.ts:189` logs cancel URL +
  body. No `__DEV__` guard, no `babel-plugin-transform-remove-console`. **Strip
  all console.* from release (add the babel plugin) and remove the PII dumps now.**

- [ ] **No global React error boundary**
  `app/_layout.tsx` — no `componentDidCatch`/`ErrorBoundary` anywhere. Any thrown
  render white-screens the entire app with no recovery; vendor must force-quit.
  **Add a root error boundary with a reload affordance.**

---

## TIER 1 — Soft-launch bar (fix before real vendors rely on it)

### Crashes & data integrity
- [ ] **Reports crashes on partial/null financial data** — `app/(tabs)/reports.tsx`
  calls `.toFixed(2)` directly on ~12 backend fields (`totalRevenue`, `netPayout`,
  …). Any null/missing field throws during render → white-screen (no boundary).
  Default/guard every numeric field.
- [ ] **One malformed order poisons the whole list** — `services/api.ts:253`
  `res.data.content.map(mapApiOrder)`; `mapApiOrder` does `raw.items.map` and
  `raw.status.toUpperCase()`. A single null `items`/`status` rejects the whole
  `.map`; `loadOrders` swallows it (empty catch, `store/index.ts:91`) → order
  board silently stops updating. Map defensively per-record; skip bad records.

### Error visibility
- [ ] **No error/retry UI on any data screen** — orders, reviews, reports, more,
  notifications all render a friendly empty-state on fetch failure, identical to
  genuinely-empty data, with no retry. Add error state + retry.
- [ ] **`toggleRestaurantOpen` failures are fully silent** — `app/(tabs)/index.tsx:47`,
  `app/(tabs)/more.tsx:57`. The open/closed switch just doesn't move; a vendor who
  thinks they went "Open" may be receiving nothing. Surface the failure.
- [ ] **Orders screen has no loading indicator** — `store.ordersLoading` is set but
  never consumed by `app/(tabs)/index.tsx`; first load flashes "No new orders"
  before data arrives.

### Features that fake success (persist nothing)
- [ ] **Review replies are local-only** — `store/index.ts:236` `replyToReview` flips
  in-memory state; no reply endpoint exists; `loadReviews` always maps
  `replied:false`, so the reply vanishes on refresh. The customer never sees it.
- [ ] **Courier ratings discarded** — `store/index.ts:310` `submitCourierRating`
  appends to an array that is never POSTed or read.
- [ ] **Notification preference toggles are cosmetic** — `store/index.ts:337` flips an
  in-memory map that's never sent to the backend or consulted before showing
  notifications.
- [ ] **Reports "Refunds / Cancellations" permanently show 0** — `reports.tsx:329,334`
  read `revenueData.refunds/cancellations`, never populated by
  `loadFinancialReport`. Misleading on a money screen.
- [ ] **Sold Items always empty** — `settings/sold-items.tsx` reads
  `revenueData.soldItems` (never populated); its pull-to-refresh is a no-op
  (`useRefresh()` with no callback).
- [ ] **Staff screen is an inert stub** — `settings/staff.tsx`: `staffMembers` never
  loaded, no staff API, "Invite" button has no `onPress`, route unreachable from UI.
  **Decide: finish it or delete it (and its `_layout.tsx` registration).**

**For each fake feature: either wire it to a real endpoint or remove the UI so it
doesn't present a capability that doesn't exist.**

### Race conditions
- [ ] **Optimistic status updates clobbered by WS `loadOrders`** — every WS event
  (`order_update`/`kitchen_ticket`/`new_order`/`connected`) calls `loadOrders`,
  replacing the whole array with server state. If an event lands mid-PATCH, the
  optimistic status reverts ("Ready" → "Preparing") until the next event. Add
  request sequencing or reconcile in-flight mutations.
- [ ] **WS `new_order` re-triggers the alarm without the push path's dedupe guard** —
  `hooks/useNotifications.ts`: push handler guards on `!store.showOrderAlert`; the
  WS handler calls `triggerOrderAlert` unconditionally. Duplicate deliveries /
  reconnects churn the modal.

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
