# Order Events via Push — Backend Integration

**Audience:** ZBR backend team
**Replaces:** the per-vendor STOMP subscription for order events
**Client status:** implemented, running alongside the socket until you send push

---

## 1. Why this exists

A STOMP subscription is a connection the backend holds open for every
signed-in vendor. A thousand vendors is a thousand sockets, plus heartbeats,
the memory behind each connection, and a reconnect storm every deploy. It also
makes the order path depend on the socket layer staying healthy.

Push moves that fan-out to infrastructure Google and Apple already operate. The
app holds no connection at all between orders.

**The tradeoff, stated plainly:** push delivery is best-effort. Neither FCM nor
APNs guarantees delivery or ordering, and iOS throttles by priority. The app
compensates by polling every 45 seconds while it is in the foreground, so a
dropped push costs at most 45 seconds rather than a lost order. Push is what
makes the alarm instant; the poll is the safety net. **Do not treat a delivered
push as confirmation the vendor saw the order.**

---

## 2. The contract

Send a **data-only** message. The app reads exactly two fields:

| Field | Type | Required | Notes |
|---|---|---|---|
| `type` | string | **yes** | One of the three values below, uppercase, exact |
| `orderId` | string or number | recommended | Omitted is tolerated; see §6 |

```json
{ "type": "NEW_ORDER_RECEIVED", "orderId": "10432" }
```

That is the whole payload. **Do not serialise the order into the
notification** — the app fetches it from `GET /api/v1/restaurants/{id}/orders`
the moment the event lands.

Three reasons this is the right shape:

1. A push that arrives late, twice, or out of order still produces correct
   state, because state comes from the API rather than the message.
2. Order contents — customer names, addresses, phone numbers — never transit
   Google's or Apple's servers.
3. You never have to keep a notification payload in sync with the order schema.

### Event types

| `type` | Send when | What the app does |
|---|---|---|
| `NEW_ORDER_RECEIVED` | An order reaches `created` for this restaurant | Full-screen alert + looping alarm until a human accepts or declines |
| `ORDER_CANCELLED` | An order is cancelled or refunded by anyone other than this vendor | Reloads; if the order was being cooked, full-screen **"stop preparing"** alert + alarm |
| `ORDER_UPDATED` | Any other status change the vendor should see (courier assigned, picked up, delivered) | Silent refresh of the orders list |

Any other `type` is ignored — not an error. Notifications for other purposes
(marketing, account notices) can share the same channel safely.

> **`ORDER_CANCELLED` and `ORDER_UPDATED` are interchangeable in effect.** Both
> reload, and the app detects a cancellation by comparing each order's previous
> status against the new one. Sending `ORDER_UPDATED` for a cancellation still
> raises the stop-cooking alert. Use the specific type anyway — it makes logs
> readable and lets us treat them differently later.

---

## 3. Android — FCM HTTP v1

Send `data` only, **not** `notification`. A `notification` block makes the
system tray draw the message and the app never sees it while backgrounded.

```bash
curl -X POST \
  "https://fcm.googleapis.com/v1/projects/push-notifications-for-zbr/messages:send" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": {
      "token": "<vendor device token>",
      "data": {
        "type": "NEW_ORDER_RECEIVED",
        "orderId": "10432"
      },
      "android": {
        "priority": "HIGH",
        "ttl": "120s",
        "notification": {
          "channel_id": "orders_v3",
          "sound": "new_order",
          "title": "New order",
          "body": "Tap to open"
        }
      }
    }
  }'
```

**Each of these matters:**

- `priority: HIGH` — the only way to wake a device in Doze. Normal priority is
  batched and an order can sit for minutes.
- `channel_id: orders_v3` — **changed from `orders_v2`, please update.** Must
  match exactly. The app creates this channel
  with the alarm sound and max importance. **A channel's sound and importance
  are immutable once created on a device**, which is why the id is versioned; if
  those ever need to change, the app ships a new id, not an edit. That is
  exactly why v3 exists: the orders channel now plays on the device's **alarm**
  stream rather than the notification stream, so it is audible in a kitchen
  where the ringer is down, and that could not be applied to v2 in place.

  A device that still has `orders_v2` will keep the old channel until the app
  next runs, which deletes it. Sending to a retired id means **no sound and no
  heads-up** — the notification still appears in the shade, silently.
- `sound: new_order` — the bundled file, named **without** the extension here.
- `ttl: 120s` — an order alert is worthless once stale. Let it expire rather
  than wake a phone ten minutes later.
- The `data` values must be **strings**. FCM rejects nested objects, and
  numbers arrive as strings anyway.

`$ACCESS_TOKEN` is an OAuth2 token minted from the service account
(`https://www.googleapis.com/auth/firebase.messaging`), not the legacy server
key — the legacy API is switched off.

---

## 4. iOS — APNs

The app must be woken while backgrounded, so the payload needs **both**
`content-available: 1` and an `alert`, and the entitlement is `production`
(TestFlight and App Store builds both use production APNs).

```bash
curl -X POST \
  --http2 \
  "https://api.push.apple.com/3/device/<vendor device token>" \
  -H "authorization: bearer $APNS_JWT" \
  -H "apns-topic: com.zbr.owner" \
  -H "apns-push-type: alert" \
  -H "apns-priority: 10" \
  -H "apns-expiration: $(($(date +%s) + 120))" \
  -d '{
    "aps": {
      "alert": { "title": "New order", "body": "Tap to open" },
      "sound": { "critical": 0, "name": "new_order.wav", "volume": 1.0 },
      "content-available": 1,
      "interruption-level": "time-sensitive"
    },
    "type": "NEW_ORDER_RECEIVED",
    "orderId": "10432"
  }'
```

**Each of these matters:**

- Custom keys (`type`, `orderId`) go **beside** `aps`, never inside it.
- `sound.name: new_order.wav` — **with** the extension, unlike FCM.
- `interruption-level: time-sensitive` — the app requests the matching
  entitlement, so this is what lets an order alert break through Focus. Without
  it a vendor in Do Not Disturb hears nothing.
- `apns-priority: 10` for immediate delivery.
- `apns-expiration` — same reasoning as the Android TTL. `0` means "deliver
  once, do not retry", which is worse; a short absolute expiry is right.

`$APNS_JWT` is ES256 over the `.p8` key, and the signature must be **raw
P1363 (r‖s), not DER** — the usual crypto libraries emit DER by default and
Apple rejects it as a malformed token. `scripts/send-apns-test.js` in the app
repo is a working reference implementation.

---

## 5. Device tokens

Already implemented; unchanged by this document.

| Endpoint | When the app calls it |
|---|---|
| `POST /api/v1/device-tokens` | On login, and whenever the OS rotates the token |
| `DELETE /api/v1/device-tokens?deviceId=<id>` | On logout and on account deletion |

```jsonc
// POST body
{
  "token": "<device token>",
  "platform": "IOS",          // or "ANDROID"
  "deviceId": "<stable per-install id>"
}
```

**Upsert on `deviceId`, not on token.** The OS rotates tokens; keying on the
token accumulates dead rows that you will keep pushing to forever.

**Prune aggressively.** FCM returns `UNREGISTERED` and APNs returns `410` for a
dead token — delete the row on either. A vendor who reinstalls leaves a token
behind that will never deliver again.

> `deviceId` is `Application.getAndroidId()` / `getIosIdForVendorAsync()`, with
> a persisted random fallback. It is stable per install, and **different across
> devices** — a vendor signed in on a phone and a tablet is two rows, and both
> should receive the push.

---

## 6. Behaviour details worth knowing

**Omitting `orderId`.** For `NEW_ORDER_RECEIVED` the app falls back to the
oldest order in `created` status. That works, but it is ambiguous when two
orders arrive together — send the id.

**Duplicates are safe.** The app tracks which order ids it has already alarmed
for, so a retry, or the same event over both transports during a migration,
will not restart the alarm.

**A vendor's own actions never alarm them.** The app writes its own status
changes optimistically, so the echo back produces no transition and no alert.
You do not need to exclude the acting device.

**Multiple devices.** Push every registered device for the restaurant. Whichever
vendor acts first wins; the others see the order is no longer `created` on their
next refresh and fall silent on their own.

---

## 7. Migration

The app has a transport switch in `constants/features.ts`:

| Value | Meaning |
|---|---|
| `'both'` | **Current default.** Socket and push both active; duplicates are absorbed. |
| `'push'` | No socket is opened. **Switch to this only once push is live and verified** — until then it would leave vendors with no alarm at all. |
| `'websocket'` | Original behaviour, no polling. |

Suggested sequence:

1. Backend starts sending push **in addition to** publishing on the socket.
2. Verify on real devices — foreground, backgrounded, and screen off.
3. App ships with `'push'` (already the case).
4. Once no clients report `'websocket'` or `'both'`, retire the vendor order
   topic.

Because `'both'` is safe, there is no flag-day.

---

## 8. Testing

The app repo has working senders that read the same credentials:

```bash
npm run push:test:android   # FCM HTTP v1
npm run push:test:ios       # APNs, correct P1363 JWT
npm run check:push          # verifies channel id, sound file, bundle id, aps-environment
```

**Verify on a real device, not a simulator.** Push does not work on the iOS
simulator at all, and the checks that matter — Doze wake, alarm sound, Focus
break-through — are device behaviours.

What to confirm:

- [ ] App **foregrounded**: alert and alarm within a second or two
- [ ] App **backgrounded**: same
- [ ] App **force-killed**: notification arrives; tapping opens the order
- [ ] **Screen off, phone locked**: alarm audible — this is the one that matters
- [ ] **Do Not Disturb / Focus on (iOS)**: still audible, via
      `interruption-level`
- [ ] **Cancellation while cooking**: stop-preparing alert and alarm
- [ ] **Airplane mode for two minutes, then back**: the foreground poll catches
      up, proving the safety net works

---

## 9. Open question for you

Is there a rate limit or quota on the order-events sender we should know about?
The app will not retry a missed push — it relies on the poll — but if you batch
or coalesce pushes under load, we would rather size the poll interval to match
than discover it in production.
