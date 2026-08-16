# Push Notifications — Setup Runbook

Goal: a vendor gets a loud, screen-waking alert for a new order **while the
phone is locked and the app is closed**.

Delivery model (decided): the backend talks to **FCM (Android)** and **APNs
(iOS)** directly. No Expo push service.

> **Why the WebSocket isn't enough:** when the screen goes off or the app is
> backgrounded, iOS suspends the JS runtime within seconds and Android dozes.
> The STOMP socket dies, so the in-app alarm cannot fire. Only a remote push
> from the server can wake the device. The WebSocket remains the fast path while
> the app is open; push is the path when it isn't.

---

## 1. What the client already does (done, in code)

- Registers the **raw device token** — `getDevicePushTokenAsync()`:
  - **Android → FCM registration token**
  - **iOS → APNs device token** (hex)
- Sends it to `POST /api/v1/device-tokens` as `{ token, platform, deviceId }`
  where `platform` is `ANDROID` | `IOS`.
- Re-registers automatically when the OS **rotates** the token.
- Creates Android channels up front:
  | Channel id | Use | Importance | Sound |
  |---|---|---|---|
  | `orders_v2` | New orders | `MAX` (heads-up, wakes screen) | `new_order.wav` |
  | `updates_v2` | Status changes | `DEFAULT` | default |
- Taps navigate to `/order/{orderId}` (including the cold-start tap).
- While the app is **open**, `NewOrderAlert` loops the alarm sound + haptics
  until the vendor accepts/dismisses.

⚠️ **Channel ids are versioned.** Android freezes a channel's sound and
importance at creation. To change either, bump to `orders_v3` in
`utils/notifications.ts`, add the old id to `RETIRED_CHANNEL_IDS`, and update
`defaultChannel` in `app.json` **and** the backend's `channel_id`.

---

## 2. Credentials you must create (blocking)

### Android — Firebase
1. Create a Firebase project (free) → add an **Android app** with package
   `com.zbr.owner`.
2. Download **`google-services.json`** → place at `ZBROwner/google-services.json`.
   `app.json` already points at it; **the Android build fails until it exists.**
   Commit it (it's client config, not a secret).
3. Backend: create a **service account** (Project settings → Service accounts →
   Generate new private key) for the Firebase Admin SDK. **That JSON is a secret**
   — env var / secret manager, never the repo.

### iOS — Apple
1. Paid **Apple Developer account** ($99/yr).
2. Create an **APNs Auth Key (.p8)** (Keys → new key → APNs). Note the **Key ID**
   and **Team ID**. `.p8` is already gitignored — it is a secret.
3. Enable **Push Notifications** on the `com.zbr.owner` App ID.
4. EAS manages the push certificate: `eas credentials` (or automatically on
   first `eas build -p ios`).

### EAS
`eas init` — the project has **no `extra.eas.projectId`** yet. Also replace the
`*.zbr.example.com` placeholder URLs in `eas.json` with the real hosts.

---

## 3. Backend: what to send

Both payloads must carry a **`notification`** block (so the OS displays it when
the app is killed) **and** a `data` block (so the app can act on it).

`data.orderId` **must be numeric** — the client rejects non-numeric ids before
routing (deep-link hardening).

### Android (Firebase Admin SDK)
```json
{
  "token": "<FCM token>",
  "notification": { "title": "New order", "body": "#A-1042 · 87 000 so'm" },
  "data": { "type": "NEW_ORDER_RECEIVED", "orderId": "1042" },
  "android": {
    "priority": "high",
    "notification": {
      "channel_id": "orders_v2",
      "sound": "new_order",
      "notification_priority": "PRIORITY_MAX",
      "visibility": "PUBLIC",
      "default_vibrate_timings": false,
      "vibrate_timings": ["0s", "0.4s", "0.2s", "0.4s"]
    }
  }
}
```
- `priority: high` is **required** to punch through Doze. Normal priority is
  batched and may arrive minutes late — unusable for orders.
- `sound` is the resource name **without** the extension (`new_order`).
- `channel_id` must match `ORDERS_CHANNEL` in `utils/notifications.ts`.

### iOS (APNs, HTTP/2 + .p8 JWT)
Headers:
```
apns-push-type: alert
apns-priority: 10
apns-topic: com.zbr.owner
```
Payload:
```json
{
  "aps": {
    "alert": { "title": "New order", "body": "#A-1042 · 87 000 so'm" },
    "sound": "new_order.wav",
    "badge": 1,
    "interruption-level": "time-sensitive"
  },
  "type": "NEW_ORDER_RECEIVED",
  "orderId": "1042"
}
```
- `interruption-level: time-sensitive` breaks through Focus/Do Not Disturb.
  Requires the entitlement already in `app.json`. **No Apple approval needed.**
- iOS sound files must be **< 30 s** or iOS silently plays the default.
  Check `new_order.wav`.

### Delivery hygiene
- **Prune dead tokens.** FCM `UNREGISTERED`/`INVALID_ARGUMENT` and APNs
  `410 Unregistered` mean the token is gone — delete it, or you accumulate
  garbage and waste quota.
- **One row per `deviceId`**, not per login — re-registering the same device
  must update, not duplicate, or the vendor gets N copies of every alert.
- **Don't push to the device that caused the change.** A vendor tapping
  "Accept" shouldn't get pushed their own action.
- Send push **in addition to** the WebSocket event, always. The client dedupes
  (the new-order alarm won't double-fire for the same order id).

---

## 4. Still open — the "alarm until acknowledged" gap

You asked for alarm-style alerts. Here's the honest split:

**Shipping now (no approvals):** high-priority push + `MAX` channel + custom
sound + Time Sensitive. This **wakes the screen and makes noise** on both
platforms, and once the app is open the looping alarm takes over. For most
kitchens this is enough.

**NOT possible with the current library** — both need extra work:

| Want | Blocker | Cost |
|---|---|---|
| **Android full-screen intent** (alarm takeover on the lock screen) | `expo-notifications` doesn't support it. Needs `@notifee/react-native` or a small native module. Android 14+ restricts the permission to calls/alarms — Play Store review risk. | ~2–3 days + review risk |
| **iOS Critical Alerts** (ignores mute switch + DND, up to 100% volume) | Requires a special Apple entitlement you must **apply** for, justifying why it's life-safety-adjacent. Food orders are **often rejected**. | Weeks, may be denied |
| **Sound longer than 30 s** | iOS caps notification sound at 30 s. Only Critical Alerts or an in-app loop can exceed it. | Tied to the above |

**Recommendation:** ship the Stage-1 setup, pilot it, and only pursue full-screen
intent if vendors actually report missed orders. Don't block launch on an Apple
entitlement that may be denied.

---

## 5. Testing (nothing here works in Expo Go)

Push requires a **development build on a physical device**. Expo Go dropped
remote push in SDK 53, and simulators/emulators can't receive APNs at all
(an Android emulator *with* Play Services can receive FCM).

```bash
eas build --profile development --platform android   # or ios
```

Then verify, in order:

1. **Token reaches the backend** — log in, confirm a row appears for the device.
   Android tokens look like `dXk3...:APA91b...`; iOS is a 64-char hex string.
   If you see `ExponentPushToken[...]`, the wrong API is being used.
2. **App foregrounded** → push arrives, alarm modal opens.
3. **App backgrounded** → notification appears with the custom sound.
4. **App force-killed + screen off** → ← *this is the actual requirement*.
   Screen should wake and the alarm sound play.
5. **Tap the notification from killed state** → app opens on the right order.
6. **Airplane mode 5 min → back online** → queued push arrives (FCM/APNs hold it).
7. **Battery saver / Doze on Android** → still arrives (this is what
   `priority: high` buys).

### Android OEM warning
Xiaomi, Huawei, Oppo, Vivo and Samsung aggressively kill background apps.
Vendors on those devices must add ZBR Owner to **protected/auto-start apps**, or
pushes stop when the app is swiped away. Worth a line in the vendor onboarding
guide — this is the single most common "push stopped working" cause in the
field, and it is not something the app can fix in code.

---

## 6. Checklist

- [ ] Firebase project + `google-services.json` committed
- [ ] Firebase service-account key in backend secrets
- [ ] Apple Developer account, APNs `.p8`, Key ID, Team ID
- [ ] `eas init` → `projectId` in `app.json`
- [ ] Real hosts in `eas.json` (replacing `*.zbr.example.com`)
- [ ] Backend sends the two payloads in §3, with `priority: high` / `apns-priority: 10`
- [ ] Backend prunes dead tokens and dedupes by `deviceId`
- [ ] Dev build installed on a real Android + iPhone
- [ ] **Killed + screen-off test passes on both**
- [ ] Vendor onboarding mentions OEM auto-start (Android)
