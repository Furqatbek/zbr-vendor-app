# Google Play Submission Guide — ZBR Owner

Everything needed to publish `com.zbr.owner`, with the answers derived from an
audit of what the code **actually does** (not what we assume it does).

Build instructions: [`LOCAL_BUILD.md`](./LOCAL_BUILD.md).

---

## 0. Blockers — read first

| # | Blocker | Owner | Why it blocks |
|---|---|---|---|
| 1 | **Real TLS backend hostnames** | backend | Inlined into the bundle at build time. Until these exist, no shippable AAB can be produced. `npm run check:release` will refuse to build. |
| 2 | **Privacy policy served as real HTML** | you | **Mandatory** — Play Console will not accept a submission without it, and Google FETCHES the URL during review. A ready-to-host page is generated at `store-assets/privacy.html`; fill its remaining `[BRACKETED]` details and serve it. ⚠️ `https://app.zbrr.uz/privacy` currently returns the SPA shell for every path — verify with `npm run check:privacy-url`. |
| 3 | **Reviewer login credentials** | you | ⚠️ See §2 — the single most likely cause of rejection for this app. |
| 4 | **Screenshots (min 2)** | you | Require a running build on a device/emulator. |
| 5 | **Signing keystore** | you | See `LOCAL_BUILD.md` §4. Back it up before you build. The release build type is wired to it by `plugins/withReleaseSigning.js`; `check:release` fails if no upload key is configured, because a debug-signed AAB is rejected at upload. |
| 6 | **Support contact details** | you | `constants/contact.ts` — the Help Center and About links stay hidden until set. |

Everything else in this document is either done or is form-filling.

---

## 1. Technical compliance — ✅ done

Verified against the **generated** `AndroidManifest.xml` (via `expo prebuild`),
not just `app.json`, because libraries inject their own permissions.

| Requirement | Status |
|---|---|
| Target API 36 (mandatory for new apps from **2026-08-31**; uploads below it are **rejected**) | ✅ `targetSdkVersion=36` via `expo-build-properties` |
| min SDK | ✅ 24 (Android 7.0) |
| AAB, not APK | ✅ `npm run build:android:aab` |
| 64-bit | ✅ RN 0.83 arm64-v8a + x86_64 |
| Cleartext traffic blocked in release | ✅ no `usesCleartextTraffic`; default-deny at API ≥28 |
| `versionCode` present | ✅ `1` — **bump for every upload** |
| Debug logging stripped from release | ✅ `babel-plugin-transform-remove-console` |
| Play App Signing | ✅ supported (use it) |

### Release permissions — all justifiable

| Permission | Why |
|---|---|
| `INTERNET` | API + WebSocket |
| `POST_NOTIFICATIONS` | new-order alerts |
| `VIBRATE`, `WAKE_LOCK` | order alarm |
| `MODIFY_AUDIO_SETTINGS` | alarm playback (expo-av) |
| `ACCESS_COARSE_LOCATION` | one-shot foreground capture of the restaurant's coordinates (Balanced accuracy; **FINE is blocked**) |

> The list above is the **exact** set that survives into the release manifest.
> Regenerate and re-check any time permissions change:
> `npm run prebuild:android && grep uses-permission android/app/src/main/AndroidManifest.xml`
> — entries carrying `tools:node="remove"` are stripped from the build.

**Removed during this audit** — each was a rejection or friction risk:
`USE_FULL_SCREEN_INTENT` (never implemented; Android 14 restricts it to
calls/alarms), `RECEIVE_BOOT_COMPLETED` (no boot receiver),
`SYSTEM_ALERT_WINDOW` (injected into the release manifest by the Expo template
though the app never draws overlays), `ACCESS_FINE_LOCATION` (the map prefill
only needs Balanced accuracy), and `CAMERA` / `RECORD_AUDIO` / `READ_MEDIA_*` /
storage (the photo picker needs none of them, and `READ_MEDIA_IMAGES` would have
triggered Google's Photo and Video Permissions policy).

> **No background location.** Explicitly disabled in both platform configs. If
> Play ever flags background location, something regressed — it would require a
> declaration form and video review.

---

## 2. ⚠️ App access — the most likely rejection

**The app has no public sign-up.** Vendor accounts are provisioned by ZBR, so a
Play reviewer who installs it hits a login wall and can see nothing. Reviewers
reject what they cannot open, and this trips up most B2B apps on first submit.

In Play Console → **App content → App access**:

1. Choose **All or some functionality is restricted**
2. Add an instruction set:
   - **Name:** `Vendor login`
   - **Username / Password:** a **permanent demo vendor account** on production
   - **Any other instructions:** explain that accounts are issued by ZBR to
     partner restaurants and there is no self sign-up; note that the account has
     sample orders and menu items so every screen can be exercised.

**The demo account must:**
- stay valid indefinitely (a reviewer may re-check on any future update),
- have realistic data — orders in several states, menu items, a completed
  financial period — so no screen is empty,
- not be rate-limited or IP-restricted (reviewers connect from outside Uzbekistan).

---

## 3. Data Safety form — exact answers

Derived from reading `services/api.ts`, `store/`, `hooks/`, `utils/`.

**No analytics, advertising, or crash-reporting SDK is present.** The only
third-party SDK is Firebase Cloud Messaging (push transport).

### Does your app collect or share any of the required user data types? → **Yes**

| Data type | Collected | Shared | Purpose | Required? |
|---|---|---|---|---|
| **Name** | Yes | No | Account management, app functionality | Required |
| **Email address** | Yes | No | Account management (login) | Required |
| **Phone number** | Yes | No | Account management | Optional |
| **Approximate location** | Yes | No | App functionality — set the restaurant's map coordinates | Optional |
| **Photos** | Yes | No | App functionality — menu item and profile images | Optional |
| **Device or other IDs** | Yes | No | App functionality — push notification delivery (FCM token) | Required |

Answer for **every** row above:
- **Is this data collected, shared, or both?** → *Collected*
- **Is this data processed ephemerally?** → *No*
- **Is this data required or optional?** → as in the table

### Security practices
- **Is all user data encrypted in transit?** → **Yes** (HTTPS/WSS; cleartext is
  blocked in release builds)
- **Do you provide a way for users to request that their data is deleted?** →
  **Yes**, *provided you publish the deletion URL* — see §4.

### Notes to avoid a false declaration
- Customer names/phones/addresses appear on order cards, but that data is
  **received from the backend for display**, not collected from this device — it
  is not declared here.
- Financial figures (revenue, payouts) are likewise **displayed**, not collected.
- Auth tokens and the Restos API key are stored in the **OS keystore**
  (`expo-secure-store`). Profile/locale/config preferences are in AsyncStorage.
- **Location is foreground and one-shot** — captured only when the owner taps
  "detect location" while setting the restaurant address. Never background.

---

## 4. Account deletion

**Shipped in-app.** A full deletion flow lives at
`app/settings/delete-account.tsx`, reachable from **More → Delete account** and
**About → Account**, translated in all four locales. It explains the
consequences, takes an optional reason, requires the vendor to type their own
email address to confirm, and then calls `DELETE /api/v1/auth/account`.

That covers both stores:

- **Google** — Data safety → *Data deletion*: answer **Yes, users can request
  data deletion**, and describe the in-app path. You may additionally publish a
  web deletion-request page and declare its URL; that is optional now.
- **Apple** — Guideline **5.1.1(v)** requires deletion to be *initiated in the
  app*. A web link does not satisfy Apple, which is why this is a real screen
  and not an external row.

> ⚠️ **The backend endpoint does not exist yet.** `DELETE /api/v1/auth/account`
> is documented as a blocking ask in
> [`BACKEND_HANDOFF.md` §2.1](./BACKEND_HANDOFF.md). Until it ships, the screen
> surfaces the server error to the vendor — deliberately, because a fake success
> on a deletion request is precisely what reviewers test for. **Do not submit to
> the App Store before the endpoint is live**; a reviewer will walk this flow.

`constants/contact.ts` drives the Privacy Policy, Terms and Licenses rows, and the Help
Center's phone/email/chat cards — all hidden until configured. **`privacyPolicyUrl`
is required for submission**; the rest are optional but recommended.

---

## 5. Store listing — copy

**App name** (max 30) — `ZBR Owner` *(9)*

**Short description** (max 80):
```
Manage orders, menu and payouts for your restaurant on ZBR.
```
*(58 characters)*

**Full description** (max 4000):
```
ZBR Owner is the restaurant partner app for the ZBR delivery platform. It gives
restaurant owners and managers everything they need to run their storefront from
a phone.

RECEIVE AND MANAGE ORDERS
• Get an audible alert the moment a new order arrives, even when your phone is
  locked
• Accept or decline orders with an estimated preparation time
• Move orders through preparing, ready and picked up with a single tap
• See customer details, delivery notes and every item with its modifiers
• Call the assigned courier directly from the order

MENU MANAGEMENT
• Create and edit categories, items, variants and option groups
• Upload photos for menu items
• Mark items in or out of stock instantly
• Import an existing menu from a Restos POS system

BUSINESS INSIGHTS
• Track revenue, order counts and average order value by day, week or month
• Review payout totals and commission breakdowns
• See daily revenue trends at a glance

RATINGS AND REVIEWS
• Read customer reviews and ratings for your restaurant
• Monitor your overall rating and its distribution

BUILT FOR A BUSY KITCHEN
• Open or close your restaurant for new orders at any time
• Works in Uzbek (Latin and Cyrillic), Russian and English
• Clear alerts designed to be noticed in a noisy kitchen

ZBR Owner requires a partner account issued by ZBR. It is intended for
restaurants that have joined the ZBR platform — it is not a food ordering app
for customers.
```

**Assets**
| Asset | Spec | Status |
|---|---|---|
| App icon | 512×512, 32-bit PNG | ✅ `store-assets/play-icon-512.png` |
| Feature graphic | 1024×500, no alpha | ✅ `store-assets/play-feature-graphic-1024x500.png` |
| Phone screenshots | 2–8, portrait 1080×1920 | ⛔ **you must capture these** |
| 7" tablet screenshots | up to 8, portrait 1200×1920 | ⛔ needed for tablet surfacing |
| 10" tablet screenshots | up to 8, portrait 1600×2560 | ⛔ needed for tablet surfacing |

→ Designer prompts and per-screen direction:
[`STORE_SCREENSHOTS_PROMPT.md`](./STORE_SCREENSHOTS_PROMPT.md)

**Screenshots to capture** (use the demo account so nothing is empty): Orders
board with live orders · Order detail with the status stepper · Menu management ·
Reports/revenue · Reviews. Portrait, from a real device or emulator.

**Category:** Business · **Tags:** food delivery, restaurant management
**Contact email:** a monitored address — Google shows it publicly.

---

## 6. Content rating questionnaire

Category: **Utility, Productivity, Communication, or Other**.

Answer **No** to violence, sexuality, profanity, controlled substances and
gambling. Expected outcome: **Everyone / PEGI 3**.

⚠️ **The user-generated-content question needs your judgement — an earlier
version of this doc said to answer "No", which is arguably wrong.** Two facts cut
against a flat No:
- the app **displays customer-written reviews**, which are UGC shown in-app; and
- vendors **upload menu photos and text that are published to consumers**, so the
  app is an upload surface for content other people see.

Answering "Yes" typically requires you to state that a moderation and reporting
mechanism exists. Note the in-app review **Report button is currently disabled**
(no moderation endpoint — `FEATURES.reviewReports`), so a "Yes" answer claiming
in-app reporting would not be accurate today.

Two defensible routes: (a) answer **Yes** and describe moderation as handled by
ZBR platform operations rather than in-app, or (b) build the reporting endpoint,
enable the flag, and answer **Yes** with in-app reporting. **Do not answer "No"
without a deliberate decision** — a misdeclaration here is an enforcement
category, not a warning.

Ads: **No, this app does not contain ads.** (Verified — no ad SDK.)

---

## 7. Release strategy

1. **Internal testing** first — up to 100 testers, **no review delay**, and the
   fastest way to validate a real signed build.
2. Verify on internal testing:
   - login against the production backend over TLS
   - **push arrives with the app force-killed and the screen off**
   - order accept/decline round-trips
3. **Closed testing** with the pilot restaurants.
4. **Production** once push is proven in the field.

> New personal-developer accounts must run a closed test with **12+ testers for
> 14 days** before production. **Organization accounts are exempt** — worth
> confirming which account type you enrolled with, because it changes the
> timeline by two weeks.

---

## 8. Checklist

**Before building**
- [ ] Real TLS hostnames in `.env.production`
- [ ] `npm run check:release` passes
- [ ] `versionCode` bumped
- [ ] Keystore created and **backed up**

**Play Console — App content**
- [ ] Privacy policy URL
- [ ] **App access: demo vendor credentials** ← most common rejection
- [ ] Data safety form (§3)
- [ ] Data deletion URL (§4)
- [ ] Content rating questionnaire
- [ ] Target audience: adults / not designed for children
- [ ] Ads declaration: no ads
- [ ] Government app: no · Financial features: no

**Store listing**
- [ ] Icon + feature graphic uploaded
- [ ] 2+ phone screenshots
- [ ] Short + full description
- [ ] Contact email

**Verification**
- [ ] Internal testing build installs and logs in
- [ ] Push works: foreground, background, **killed + screen off**
- [ ] Pre-launch report reviewed (Play runs the app on real devices — check the
      crash and accessibility findings it returns)
