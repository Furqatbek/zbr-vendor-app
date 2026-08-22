# Google Play Submission Guide — ZBR Owner

Everything needed to publish `com.zbr.owner`, with the answers derived from an
audit of what the code **actually does** (not what we assume it does).

Build instructions: [`LOCAL_BUILD.md`](./LOCAL_BUILD.md).

---

## 0. Blockers — read first

| # | Blocker | Owner | Why it blocks |
|---|---|---|---|
| 1 | **Real TLS backend hostnames** | backend | Inlined into the bundle at build time. Until these exist, no shippable AAB can be produced. `npm run check:release` will refuse to build. |
| 2 | **Privacy policy hosted at a public URL** | you | Play requires a reachable URL on the store listing. Draft: [`PRIVACY_POLICY.md`](./PRIVACY_POLICY.md) — host it, then paste the URL. |
| 3 | **Reviewer login credentials** | you | ⚠️ See §2 — the single most likely cause of rejection for this app. |
| 4 | **Screenshots (min 2)** | you | Require a running build on a device/emulator. |
| 5 | **Signing keystore** | you | See `LOCAL_BUILD.md` §4. Back it up before you build. |

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
| `ACCESS_COARSE_LOCATION`, `ACCESS_FINE_LOCATION` | one-shot foreground capture of the restaurant's coordinates |

**Removed during this audit** — each was a rejection or friction risk:
`USE_FULL_SCREEN_INTENT` (never implemented; Android 14 restricts it to
calls/alarms), `RECEIVE_BOOT_COMPLETED` (no boot receiver),
`SYSTEM_ALERT_WINDOW` (injected into the release manifest by the Expo template
though the app never draws overlays), and `CAMERA` / `RECORD_AUDIO` /
`READ_MEDIA_*` / storage (the photo picker needs none of them, and
`READ_MEDIA_IMAGES` would have triggered Google's Photo and Video Permissions
policy).

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
| **Precise location** | Yes | No | App functionality — set the restaurant's map coordinates | Optional |
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

Google requires an in-app deletion path **for apps that allow account creation
in-app**. This app does **not** — there is no sign-up, only login and password
reset — so that specific requirement does not bind.

However, Data Safety still asks whether users can request data deletion, and
answering *No* is a bad look for an app holding business and location data.

**Recommended (small, removes all ambiguity):**
1. Publish a deletion-request page (can be a section of the privacy policy) with
   an email address or form.
2. Add a **"Delete account & data"** row in the More screen linking to it.
3. Declare that URL in Play Console → App content → **Data deletion**.

> I did not add the in-app row because it needs a real URL or support address you
> own. Tell me the URL and it's a ten-minute change.

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
| Phone screenshots | 2–8, 16:9 or 9:16, 320–3840px | ⛔ **you must capture these** |
| Tablet screenshots | optional | — |

**Screenshots to capture** (use the demo account so nothing is empty): Orders
board with live orders · Order detail with the status stepper · Menu management ·
Reports/revenue · Reviews. Portrait, from a real device or emulator.

**Category:** Business · **Tags:** food delivery, restaurant management
**Contact email:** a monitored address — Google shows it publicly.

---

## 6. Content rating questionnaire

Category: **Utility, Productivity, Communication, or Other**.

Answer **No** to everything about violence, sexuality, profanity, controlled
substances, gambling and user-generated content. The app displays reviews written
by customers, but vendors cannot post public content, so it is not a UGC social
app. Expected outcome: **Everyone / PEGI 3**.

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
