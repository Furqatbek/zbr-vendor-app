# ZBROwner (Vendor App) — Backend Handoff

Audience: the ZBR backend / platform team.
Purpose: everything the vendor mobile app now expects from the backend after the
hardening pass — endpoint contracts, the order/WebSocket model, what changed on
the client, what's blocked on you, and the endpoints the client is waiting for.

Companion doc: `docs/PRODUCTION_READINESS.md` (the client-side checklist).

---

## Update — backend responded (VENDOR_VERIFICATION_RESPONSE)

The backend team verified 36 points, confirmed 17, and shipped 6 fixes. Status of
the §0 asks and what the client adjusted in response:

**Resolved by backend:**
- ✅ **WS topic authorization** — restaurant topics now restricted to owners/admins;
  CONNECT rejects unauthenticated sockets (was a PII leak — any authed user could
  read `/topic/restaurants/{anyId}/orders`). (§0 #3)
- ✅ **`isCurrentlyOpen`** now `ACTIVE && isOpen==true`, never true when `isOpen`
  is false/null. (§0 #5)
- ✅ **Idempotency** — replaying a status update / cancelling an already-cancelled
  order returns 200 no-op. (§0 #7)
- ✅ **OrderDto timestamps** `pickedUpAt / inTransitAt / completedAt / cancelledAt`
  + `courierPhone` + `estimatedDeliveryTime` now included. (§0 #4)
- ✅ **Restos `overwriteExisting=false`** correctly skips existing products.

**Corrected the client (commit `f297549`) — the client had these wrong:**
- **Device-token endpoint** is `POST/DELETE /api/v1/device-tokens`, not
  `/notifications/device-token`. Fixed.
- **Active-orders** `GET /orders/restaurant/{id}/active` returns an **unpaged raw
  `OrderDto[]`** (no `content`/`totalElements`). Client now handles the array.
- **`/refresh` does NOT rotate** the refresh token — returns a new access token and
  the same/omitted refresh token, never revokes the old one. Client keeps the
  existing refresh token instead of expecting a rotated pair.
- **Financial report** — use owner-accessible `GET /restaurants/{id}/financial-report`
  (client already does). The payouts endpoint is admin-only (403 for owners) — the
  client's `fetchPayouts` is only reachable from the hidden payments screen, so no
  live impact, but don't wire it to an owner-facing screen.

**Still open:**
- 🔴 **TLS host** (§0 #1) — still the launch blocker.
- 🟠 **Restos `baseUrl` server-side allowlist** (§0 #2) — SSRF.
- 🟡 **Feature-flagged endpoints** (§7) — still unbuilt.

---

## 0. TL;DR — what we need from you

| # | Ask | Why | Blocking? | Status |
|---|-----|-----|-----------|--------|
| 1 | **Serve the API over `https://` and the WebSocket over `wss://`** on staging + prod | iOS ATS / Android cleartext block `http`/`ws` in release. Client is env-driven and TLS-ready. | **Yes — gates launch** | 🔴 Open |
| 2 | **Server-side allowlist on the Restos `baseUrl`** | Backend fetches it server-side → SSRF. | High | 🟠 Open |
| 3 | **JWT on STOMP `CONNECT`** + publish status changes to the restaurant topic | Real-time board + reconnect. | High | ✅ Done |
| 4 | **`courierPhone` + `estimatedDeliveryTime`** on every `OrderDto` (incl. WS) | Call-courier + ETA. | Medium | ✅ Done |
| 5 | Fix **`isOpen` vs `isCurrentlyOpen`** | Was true while `isOpen:false`. | Medium | ✅ Done |
| 6 | Build the **feature-flagged endpoints** (§7) | UIs hidden until each exists. | Low | 🟡 Open |
| 7 | **Idempotent** order mutations | Safe retries across deploys. | Medium | ✅ Done |

---

## 1. Transport & environment

- Base URLs are injected at build time via `EXPO_PUBLIC_API_BASE_URL` and
  `EXPO_PUBLIC_WS_BASE_URL` (see `eas.json` build profiles). The client no longer
  hardcodes `localhost`.
- **Release builds require TLS.** `http://`/`ws://` are fine for local dev only;
  a store/TestFlight build cannot talk to a cleartext host.
- All authenticated requests send `Authorization: Bearer <accessToken>`.
- `Content-Type: application/json` on all JSON requests; multipart on image
  uploads (field name **`file`**).
- Standard success envelope the client expects: `{ success: boolean, message?,
  data, timestamp? }`. On non-2xx the client reads `data.message` (or falls back
  to a status string) for the error shown to the user.

---

## 2. Auth

| Endpoint | Method | Body | Notes |
|----------|--------|------|-------|
| `/api/v1/auth/login` | POST | `{ emailOrPhone, password }` | Returns `data: { accessToken, refreshToken, userId, email, fullName, roles }` |
| `/api/v1/auth/refresh` | POST | `{ "refreshToken": "<REFRESH token>" }` | Returns a **new access token; refresh token is NOT rotated** (same value returned, old one never revoked). Client keeps its stored refresh token. |
| `/api/v1/auth/logout` | POST | `{ refreshToken }` | Best-effort; client also unregisters its device token |
| `/api/v1/auth/password-reset` | POST | `{ email }` | |
| `/api/v1/auth/password-reset/confirm` | POST | `{ token, newPassword }` | |

Client behavior you should know:
- **Single-flight refresh**: on `401/403` the client refreshes once and retries
  the original request. If the refresh fails, **or the retried request is still
  `401/403`**, the client treats the session as dead and logs out. Don't return
  `401` on a valid-but-newly-refreshed token.
- The refresh **token is rotated on use** and stored in the OS keystore
  (Keychain/Keystore), not plaintext. If you invalidate the old refresh token on
  rotation, that's fine — the client persists the new pair before continuing.
- Field name is exactly **`refreshToken`** and it must be the **refresh** token
  (a past cross-app bug sent the access token — the vendor app does not).

---

## 3. Restaurant

| Endpoint | Method | Notes |
|----------|--------|-------|
| `/api/v1/restaurants/my` | GET | Array of the owner's restaurants |
| `/api/v1/restaurants/{id}` | PUT | **Partial update** — client sends only changed fields. `@NotBlank` should apply only to `CreateRestaurantRequest` (POST), not this. |
| `/api/v1/restaurants/{id}/location?latitude=X&longitude=Y` | PATCH | Dedicated location update (query params) |
| `/api/v1/restaurants/{id}/toggle-open?isOpen=<bool>` | PATCH | Manual open/close |
| `/api/v1/restaurants/{id}/logo` | POST | multipart, field `file`; returns updated restaurant |
| `/api/v1/restaurants/{id}/cover-image` | POST | multipart, field `file` |

Fields the client reads from a restaurant object: `id, name, description, phone,
email, addressLine1, city, state, postalCode, country, fullAddress, latitude,
longitude, averageRating, totalRatings, isOpen, isCurrentlyOpen, logoUrl,
coverImageUrl, acceptsDelivery, acceptsTakeaway, acceptsDineIn, minimumOrder,
deliveryFee, deliveryRadiusKm, averagePrepTimeMinutes, opensAt, closesAt`.

Contract notes:
- **`logoUrl` / `coverImageUrl` are always present, `null` when unset** (thank
  you — the client renders a placeholder on `null`). Client type is
  `string | null`.
- **`averageRating` / `totalRatings`** are the source of truth for the Reviews
  header and the More-tab rating card (not derived from the reviews list).
- **`isOpen`** = the owner's manual switch; **`isCurrentlyOpen`** = computed
  (manual ∧ schedule). The client's open/close toggle mirrors `isOpen`. See §9.

---

## 4. Orders

### Endpoints
| Endpoint | Method | Body | Notes |
|----------|--------|------|-------|
| `/api/v1/orders/restaurant/{id}?page&size` | GET | | Paged order list (`data: { content[], totalElements, last }`) |
| `/api/v1/orders/restaurant/{id}/active` | GET | | Active orders — **unpaged raw `OrderDto[]` under `data`**; `page`/`size` ignored |
| `/api/v1/orders/{orderId}/status` | PATCH | `{ status: "ACCEPTED", estimatedPrepTimeMinutes? }` | Status is **UPPERCASE** |
| `/api/v1/orders/{orderId}/cancel` | POST | `{ reason, requestRefund }` | Used for decline + cancel |

### Order status model (client union)
`created · accepted · preparing · ready · picked_up · in_transit · delivered ·
completed · cancelled · refunded`

The client lowercases incoming statuses. It renders **any** status it receives
(unknown ones fall back to a neutral badge) — but for correct routing into the
board it needs the values above.

### Server-driven transitions (client honors these)
The app no longer assumes only user actions change state. It re-syncs on every WS
event and renders whatever arrives:
- **Unpaid → auto-cancel** (~30 min)
- **READY with no courier → timeout → cancel + auto-refund**
- **DELIVERED → auto-completes**
- **REFUNDED** is a real terminal status (counts under cancelled in stats; shows
  a terminal banner with `cancellationReason` on the detail screen)

### `COURIER_ASSIGNED`
A courier can accept before the kitchen finishes, so `COURIER_ASSIGNED` may arrive
while the order is still `ACCEPTED`/`PREPARING`. The client **maps it to a kitchen
state by timestamps** (`pickedUpAt` → picked_up, else `readyAt` → ready, else
`acceptedAt` → preparing, else accepted) so kitchen actions (Mark Ready) stay
available and the courier card still populates. Please keep sending the
`*At` timestamps so this mapping is correct.

### OrderDto fields the client consumes
`id, externalOrderNo, status, orderType, paymentStatus, items[], subtotal, tax,
deliveryFee, discount, tipAmount, total, customerName, customerPhone,
deliveryAddress, deliveryInstructions, courierId, courierName, courierPhone,
estimatedPrepTimeMinutes, estimatedDeliveryTime, createdAt, acceptedAt, readyAt,
pickedUpAt, inTransitAt, deliveredAt, completedAt, cancelledAt, cancellationReason`.

- **`courierPhone`** — gates the call-courier button (null until assigned).
- **`estimatedDeliveryTime`** (absolute ISO timestamp) — the client derives the
  courier ETA chip as minutes-from-now. Set it when the restaurant accepts with a
  prep time; leave null before that (chip stays hidden).
- Each `item`: `id, menuItemId, itemName, quantity, unitPrice, totalPrice,
  variantName?, variantPriceDelta?, modifiers?[{id,name,price}], modifiersTotal?,
  specialInstructions?`.

### Runtime validation (new — affects you)
The client now runs a **structural check** on each order record and **drops** any
record that is missing `id` or `status`, or whose `items` is not an array/null.
→ **Always send `id`, `status`, and `items` (array, may be empty).** A record
without these silently disappears from the vendor's board.

### Payment
MVP is **cash-only**; every order carries `paymentMethod: "CASH"`. The client
ignores `paymentMethod` and hides all card UI. No action needed; when card
payments land, tell us and we'll surface it.

---

## 5. WebSocket (STOMP)

- Native WS endpoint: `/ws` (SockJS `/ws-sockjs` exists but the client uses the
  native transport).
- **Auth:** JWT in the STOMP `CONNECT` header (`Authorization: Bearer <token>`).
  The client re-reads the token on **every** (re)connect, so a mid-session
  refresh won't strand the socket — but you must accept the Bearer token on
  CONNECT and reject cleanly (STOMP ERROR) if invalid.
- **Reconnect:** fixed 2 s delay, unlimited retries. On every (re)connect the
  client **re-fetches the order list** to catch anything published while it was
  disconnected (deploy drain, blip). So: drain gracefully, and it's fine if a few
  messages are missed during a deploy — the reconnect re-sync covers it.

### Subscriptions (vendor)
| Destination | Purpose |
|-------------|---------|
| `/topic/restaurants/{restaurantId}/orders` | New orders **and every status change** (incl. server-driven auto-cancel/complete/refund) |
| `/topic/restaurants/{restaurantId}/kitchen` | Kitchen tickets |
| `/topic/users/{userId}/notifications` | Per-user notifications (**canonical**) |

- **`/user/queue/notifications` is no longer subscribed** — you confirmed it was
  never published to (stale Swagger text). Canonical per-user destination is
  `/topic/users/{userId}/notifications`.
- **Order-topic message payloads must include at least `id` and `status`.** The
  client reads `payload.status` (or `payload.order.status`) to decide whether to
  fire the new-order alarm — it only alarms when `status === 'created'`. It reads
  `payload.id` / `payload.orderId` to locate the order.

---

## 6. Reviews, ratings, financial, notifications

### Reviews
- `GET /api/v1/restaurants/{id}/reviews?page&size` → `{ success, data: { content:
  ReviewDto[], page, size, totalElements, totalPages } }` (client unwraps `data`).
- `ReviewDto`: `id, orderId, consumerId, consumerName, restaurantId, courierId,
  restaurantRating, foodRating, courierRating, comment, tags, createdAt`.
- Client maps `consumerName → customerName`, `restaurantRating → rating`
  (fallback `foodRating`, then 0), `createdAt → date`.

### Ratings (analytics)
- `GET /api/v1/analytics/cx/ratings/restaurant/{id}?startDate&endDate&includeDistribution=true`
  → `{ distribution: Record<'1'..'5', number>, ratingCount, ... }`. Used for the
  distribution bars; the headline avg/total come from the restaurant object.

### Financial report
- `GET /api/v1/restaurants/{id}/financial-report?startDate&endDate` →
  `FinancialReportData` (see fields below).
- `GET /api/v1/analytics/financial/restaurants/{id}/payouts?startDate&endDate`.
- Fields consumed: `totalRevenue, totalOrders, averageOrderValue, foodRevenue,
  deliveryFeeRevenue, tipRevenue, growthRate, grossSales, commissionsDeducted,
  deliverySubsidies, promotionCosts, adjustments, fees, netPayout, pendingPayouts,
  completedPayouts, dailyRevenueTrend[], dailyPayoutTrend[]`.
- **Runtime validation (new):** the client now runs this payload through a zod
  schema that **defaults any missing/null numeric to 0** and missing trend arrays
  to `[]`. So a partial report won't crash the money screen — but ideally send
  complete numbers. `refunds` / `cancellations` are **not** in this payload today;
  those two report cards are hidden on the client until you add them (see §7).

### Notifications
- `GET /api/v1/notifications/me?role=RESTAURANT&isRead&category&page&pageSize` →
  `{ notifications[], unreadCount, hasNext, ... }`.
- `GET /api/v1/notifications/user/{userId}/unread-count?role=RESTAURANT`.
- `PATCH /api/v1/notifications/{id}/read`, `POST /api/v1/notifications/read-all`.
- `POST /api/v1/device-tokens` (register) / `DELETE /api/v1/device-tokens` (unregister on logout).
- **The client always passes `role=RESTAURANT`.** Notifications for other roles
  must not leak into this feed.
- **No per-event SMS/email** — delivery is WebSocket + push only. 
- **Push payloads:** the client validates `data.orderId` is a **numeric string**
  before navigating to `/order/{id}` (deep-link hardening). Send a numeric
  `orderId` in the notification data.

---

## 7. Endpoints the client is WAITING for (feature-flagged off)

These UIs previously "worked" but silently discarded data. They're now hidden
behind flags in `constants/features.ts`; flipping a flag to `true` re-enables the
UI in one line **once the endpoint exists**. Please build:

| Feature | Needed endpoint (suggested) | Client flag |
|---------|------------------------------|-------------|
| Vendor reply to a review | `POST /api/v1/restaurants/{id}/reviews/{reviewId}/reply { text }` | `reviewReplies` |
| Courier rating after pickup | `POST` courier-rating (stars, criteria[], note, orderId) | `courierRatings` |
| Notification preferences | persist per-category prefs + honor them server-side when sending | `notificationPrefs` |
| Refunds / cancellations totals | add `refunds` + `cancellations` to the financial report payload | `reportsRefunds` |
| Sold items breakdown | add `soldItems[]` to the report (or a dedicated endpoint) | (self-hidden when empty) |
| Staff accounts | a staff CRUD API (list/invite/toggle) | (screen currently unlinked) |

If you'd prefer different routes/shapes, tell us and we'll match the client to
whatever you build.

---

## 8. Restos integration (SSRF)

- `POST /api/v1/restos/preview-menu` — `{ baseUrl, externalRestaurantId, apiKey? }`
- `POST /api/v1/restos/import-menu` — `{ baseUrl, externalRestaurantId, apiKey?,
  localRestaurantId?, overwriteExisting? }`
- The `baseUrl` is **user-entered** and your server fetches it → SSRF surface.
  The client now rejects non-`http(s)` and obvious internal/metadata hosts
  (`localhost`, `127.*`, `169.254.*`, `10/192.168/172.16-31`, `*.local`,
  `*.internal`) before sending — **but this is defense-in-depth only. The
  authoritative allowlist must be server-side.**
- Import result the client renders: `{ categoriesCreated, categoriesUpdated,
  productsCreated, productsUpdated, productsSkipped, errors[], warnings[] }`.
- `overwriteExisting: false` = skip duplicates (Import); `true` = update (Sync).

---

## 9. Open questions / suspected backend issues

1. **`isCurrentlyOpen` semantics.** We've seen payloads with `isOpen: false` and
   `isCurrentlyOpen: true`. If `isCurrentlyOpen` means "open right now," it should
   be `false` whenever `isOpen` is `false`, regardless of schedule. Please
   confirm/fix. (The client's toggle uses `isOpen`, so it's cosmetically fine, but
   consumer-facing surfaces may be affected.)
2. **`courierPhone` on WS payloads.** Confirmed added to `OrderDto`; please confirm
   it also rides the `/topic/restaurants/{id}/orders` messages, not just REST.
3. **Idempotency.** We retry briefly across deploy drains. Please confirm order
   status/cancel mutations are idempotent (idempotency key or natural-key safe).
4. **Order-topic payload shape.** Minimum `{ id, status }` — confirm what else is
   included (full order vs delta) so we can skip a re-fetch when the payload is
   complete.
5. **Live courier tracking.** If/when a courier map is wanted on the vendor order
   screen, we'll consume `GET /api/v1/orders/{orderId}/tracking` (name/phone/lat/
   lng) — not built on the client yet.

---

## 10. What changed on the client this cycle (context)

Security & correctness work that touches the contract with you:
- Tokens + the Restos API key moved to the OS keystore (was plaintext).
- All debug/PII logging stripped from release builds.
- Order mapping hardened + zod-validated (drops structurally-broken records).
- Financial report zod-validated (numeric fields default to 0).
- Notification-nav + Restos-URL input validation (deep-link / SSRF hardening).
- WebSocket: token re-read on reconnect, re-sync orders on (re)connect, dropped
  the dead `/user/queue/notifications` subscription.
- Server-driven order transitions + `COURIER_ASSIGNED` handled.
- Cash-only: card UI hidden; `role=RESTAURANT` on all notification calls.
- Fake-success features hidden behind flags pending your endpoints (§7).

Engineering hygiene (no contract impact, FYI): jest test suite (37 tests) + CI
(lint/typecheck/test on every PR), strict TypeScript flags, ESLint.

---

*Questions or contract changes: ping the mobile team. When an endpoint in §7 is
ready, tell us the route + shape and we'll wire it up and flip the flag.*
