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

### Android — Firebase  ← **start here, this unblocks Android entirely**

> **iOS does not need Firebase.** Because we send to APNs directly, there is no
> iOS Firebase app, no `GoogleService-Info.plist`, and nothing to add to
> `app.json` for iOS beyond the entitlements already there. Firebase is
> **Android-only** in this design.

**Run `npm run check:push` after each step — it verifies what you just did.**

**1. Create the project**
- <https://console.firebase.google.com> → **Create a project**
- Name it e.g. `zbr-production`. Google Analytics is **not required** — skip it.
- ⚠️ Use a **company-owned Google account**, not a personal one. Moving a
  Firebase project between owners later is painful, and whoever owns it controls
  push for every installed app.

**2. Register the Android app**
- In the project → **Add app** → Android.
- **Android package name** must be exactly:
  ```
  com.zbr.owner
  ```
  This must match `expo.android.package` in `app.json` **character for
  character**. A mismatch is the #1 cause of "push just never arrives": FCM
  issues a token for a non-existent app and silently drops every send.
- App nickname: anything. **Debug signing certificate SHA-1: leave blank** — it's
  only needed for Google Sign-In / Dynamic Links, not FCM.

**3. Download `google-services.json`**
- Save it to **`ZBROwner/google-services.json`** (next to `package.json`).
- `app.json` already references it, so nothing to wire up.
- **Commit it.** It's client configuration, not a secret — the API key in it is
  restricted to this app. (The *service account* key in step 4 is the secret.)
- Verify: `npm run check:push` should print
  `ok  google-services.json matches package com.zbr.owner`.

**4. Backend service account** (backend team)
- Project settings → **Service accounts** → **Generate new private key** → JSON.
- This is the credential the Firebase Admin SDK uses to send.
- 🔒 **This one IS a secret.** Env var or secret manager — never the repo. Anyone
  holding it can push to every vendor device.
- The backend does **not** need `google-services.json`; the app does. They are
  different files and are not interchangeable.

**5. Confirm FCM is on**
- Project settings → **Cloud Messaging** → the **Firebase Cloud Messaging API
  (V1)** should be *Enabled*. It is on by default for new projects.
- The old "Cloud Messaging API (Legacy)" / server key is **deprecated and
  disabled by Google** — if the backend is following an old tutorial that uses a
  legacy server key, it will not work. They must use the Admin SDK / HTTP v1.

**6. Environments**
- One Firebase project is fine to start. If you later want staging isolated from
  production, create a **second project** and swap `google-services.json` per EAS
  build profile — do not try to share one project across both.

### iOS — Apple (APNs)

> **No Firebase here.** iOS talks to APNs directly. And note: **building the iOS
> app requires a Mac with Xcode** — but the steps below (getting the key) do
> **not**, and the backend needs that key regardless. You can complete all of
> this without a Mac; only the build itself is blocked.

**1. Apple Developer Program** — paid membership ($99/yr),
<https://developer.apple.com/programs/>. Enrolment as an *organization* needs a
D-U-N-S number and can take days; budget for that.

**2. Register the App ID**
- <https://developer.apple.com/account> → **Certificates, IDs & Profiles** →
  **Identifiers** → **+**
- Type **App IDs → App**. Bundle ID (explicit):
  ```
  com.zbr.owner
  ```
  Must match `expo.ios.bundleIdentifier` exactly.
- Under **Capabilities**, tick **Push Notifications**.

**3. Create the APNs Auth Key (.p8)** — this is what the backend uses
- **Keys** → **+** → name it e.g. `ZBR APNs` → tick **Apple Push Notifications
  service (APNs)** → Continue → Register
- **Download the `.p8`. You can only download it once** — Apple will not let you
  re-download it. Lose it and you must revoke and create a new one.
- Record the **Key ID** (10 chars, on that page) and your **Team ID** (10 chars,
  top-right of the portal, or under Membership).

You now have the three values the backend needs: **`.p8` file, Key ID, Team ID.**

> **Prefer the `.p8` auth key over `.p12` certificates.** One key works for
> *both* sandbox and production and for *all* your apps, and it **never
> expires**. The old `.p12` certificates are per-environment and expire yearly —
> a classic cause of "push suddenly stopped on a Tuesday".

🔒 The `.p8` is a **secret** — anyone with it can push to every user of your
apps. `*.p8` is already gitignored. Give it to the backend through a secret
manager, not Slack or email.

**4. Sandbox vs production — the one thing that trips everyone up**

APNs has two isolated environments and **a device token from one is rejected by
the other** with `400 BadDeviceToken`:

| Build | Entitlement | APNs host |
|---|---|---|
| Xcode debug / development profile | `development` | `api.sandbox.push.apple.com` |
| TestFlight / App Store | `production` | `api.push.apple.com` |

`app.config.js` defaults the entitlement to `production`. For a local debug
build:

```bash
APS_ENVIRONMENT=development npx expo prebuild --platform ios --clean
```

The entitlement must also match your provisioning profile, or the build won't
sign.

**5. Verify the key before the backend is written**

Apple provides **no test console** for APNs (unlike Firebase, which has one
built into the Cloud Messaging tab). So this repo ships a sender:

```bash
npm run push:test:ios -- \
  --key ~/keys/AuthKey_ABC123XYZ.p8 \
  --key-id ABC123XYZ \
  --team-id DEF456UVW \
  --token <device token printed by the app> \
  --env sandbox
```

It sends the exact payload from §3, so a success means the backend only has to
reproduce it. It decodes APNs' terse error codes — `BadDeviceToken`,
`DeviceTokenNotForTopic`, `InvalidProviderToken` — into what's actually wrong.
Use this to prove the key works *before* anyone writes backend code; otherwise a
failure could be in either half and you won't know which.

To get the device token: run the app on a physical device and log the value from
`registerForPushNotifications()`. It's a 64-character hex string. **If it looks
like `ExponentPushToken[...]`, something is wrong** — the app must call
`getDevicePushTokenAsync()`.

### EAS — not used
This project builds locally with Gradle/Xcode. No `eas init`, no `projectId`,
and `eas.json`'s placeholder hosts are inert. See `docs/LOCAL_BUILD.md`.

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

## 6. Verifying your config

```bash
npm run check:push
```

Validates the things that otherwise fail *silently*: that
`google-services.json` exists and its `package_name` matches `app.json`, that the
alarm sound is bundled with an Android-legal filename, that the channel id in
`app.json` matches `utils/notifications.ts` (and tells you the `channel_id` the
backend must send), and that the EAS project id and iOS entitlements are set.

Missing config is a **warning**; contradictory config is a **failure**. It also
runs in CI, so a wrong-package `google-services.json` can't be merged.

---

## 7. Checklist

- [x] Firebase project + `google-services.json` committed
- [ ] Firebase service-account key in backend secrets
- [ ] Apple Developer account enrolled
- [ ] App ID `com.zbr.owner` registered with Push Notifications capability
- [ ] APNs `.p8` downloaded (one chance only) + Key ID + Team ID recorded
- [ ] `.p8` handed to backend via a secret manager
- [ ] `npm run push:test:ios` succeeds against a real device
- [ ] `eas init` → `projectId` in `app.json`
- [ ] Real hosts in `eas.json` (replacing `*.zbr.example.com`)
- [ ] Backend sends the two payloads in §3, with `priority: high` / `apns-priority: 10`
- [ ] Backend prunes dead tokens and dedupes by `deviceId`
- [ ] Dev build installed on a real Android + iPhone
- [ ] **Killed + screen-off test passes on both**
- [ ] Vendor onboarding mentions OEM auto-start (Android)
