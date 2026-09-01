# App Store Submission Guide — ZBR Owner

Everything needed to ship `com.zbr.owner` to TestFlight and the App Store from
a local Mac, with no EAS. The Play equivalent is
[`PLAY_SUBMISSION.md`](./PLAY_SUBMISSION.md).

---

## 0. Blockers — read first

| # | Blocker | Owner | Why it blocks |
|---|---|---|---|
| 1 | **`DELETE /api/v1/auth/account`** | backend | Guideline **5.1.1(v)**: an app with accounts must let the user delete one **from inside the app**. The screen ships in this build and a reviewer **will** walk it — with no endpoint they hit a server error. Contract in [`BACKEND_HANDOFF.md`](./BACKEND_HANDOFF.md) §2.1. |
| 2 | **Apple Developer Program membership** | you | $99/yr. Nothing below works without it. |
| 3 | **App Store Connect API key** | you | §2. The upload step authenticates with it. |
| 4 | **Reviewer demo account** | you | Same problem as Play: no public sign-up, so a reviewer sees a login wall. §5. |
| 5 | **Screenshots** | you | 6.7" iPhone required; 12.9" iPad required because `supportsTablet: true`. |
| 6 | **Privacy policy URL** | you | Required in the App Store Connect listing, and Apple fetches it. |

Not a blocker but do it early: **App Privacy** answers (§4) must match the Data
Safety answers already worked out for Play.

---

## 1. The command

```bash
npm run go-live:ios              # gates -> bump -> archive -> upload
npm run go-live:ios:checks       # gates only, runs on any OS
npm run go-live:ios:no-upload    # archive + export an .ipa, upload by hand
npm run go-live:ios:no-privacy   # policy URL warns instead of blocking
npm run go-live:ios:no-bump      # rebuild without consuming a build number
```

> **Use the named scripts, not `npm run go-live:ios -- --flag`.** npm parses an
> unrecognised dashed argument as its own config and the flag never reaches the
> script. (It is recovered from `npm_config_*` as a fallback, but don't rely on
> it.)

`go-live:ios:checks` runs on Linux and Windows too — the macOS-only checks
degrade to a warning — so the configuration can be validated before you get to
the Mac. Anything past the gates needs Xcode.

What it does, stopping at the first failure:

```
ios config -> push config -> privacy URL -> typecheck -> tests -> lint
  -> buildNumber +1 -> prebuild --clean -> pod install
  -> xcodebuild archive -> -exportArchive -> xcrun altool --upload-app
```

Artifacts land in `build/ios/` — **outside** `ios/`, which `prebuild --clean`
deletes on every run. `ExportOptions.plist` is generated there each time from
`ZBR_APPLE_TEAM_ID`, so a changed team id can never be served from a stale file.

---

## 2. One-time setup on the Mac

**Xcode** from the App Store, then:

```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
sudo xcodebuild -license accept
brew install cocoapods          # or: sudo gem install cocoapods
```

**App Store Connect API key** — App Store Connect → Users and Access →
Integrations → App Store Connect API → **+**, role **App Manager**. Download
the `.p8` **once**; Apple never shows it again.

```bash
mkdir -p ~/.appstoreconnect/private_keys
mv ~/Downloads/AuthKey_XXXXXXXXXX.p8 ~/.appstoreconnect/private_keys/
```

> This is a **different key from the APNs `.p8`** you already have for push.
> Same file format, different key, different purpose. Swapping them produces an
> unhelpful authentication error.

**Environment** — add to `~/.zshrc`:

```bash
export ZBR_APPLE_TEAM_ID=XXXXXXXXXX      # developer.apple.com → Membership details
export ZBR_ASC_KEY_ID=XXXXXXXXXX         # the 10-character Key ID
export ZBR_ASC_ISSUER_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

**App Store Connect record** — create the app with bundle ID `com.zbr.owner`,
matching `app.json` exactly. Register the App ID first at
developer.apple.com → Identifiers, with **Push Notifications** capability
enabled.

Verify everything with `npm run check:ios` before archiving.

---

## 3. Version numbers

`npm run version:bump` increments **both** `android.versionCode` and
`ios.buildNumber` by 1, and `go-live:ios` calls it automatically.

App Store Connect rejects a `CFBundleVersion` it has already accepted for the
same `version` string — the same rule as Play and `versionCode`. Two things the
check catches that cost a full archive to discover otherwise:

- a **stale `ios/`** whose `Info.plist` still holds the previous build number,
  so the bump is silently lost and the upload is rejected as a duplicate;
- `aps-environment: development`, which makes push **silently dead** in every
  TestFlight and App Store build.

Use `go-live:ios:no-bump` when re-archiving after a failed upload, so you don't
burn numbers.

> An iOS build advances the Android `versionCode` too, since the two are kept
> equal. That is harmless — Play only requires the number to strictly increase,
> never to be contiguous — so expect gaps in the Play sequence.

---

## 4. App Privacy — answers

Same underlying facts as the Play Data Safety table
([`PLAY_SUBMISSION.md`](./PLAY_SUBMISSION.md) §3); Apple's form asks differently.

**Data used to track you:** *None.* The app contains no advertising SDK, no
analytics, and no `AppTrackingTransparency` prompt — nothing is shared with a
data broker or used for cross-app tracking.

**Data linked to you:**

| Apple category | What it is | Purpose |
|---|---|---|
| Contact Info → Name, Email, Phone | vendor account | App Functionality |
| User Content → Photos | menu and profile images you pick | App Functionality |
| Location → Coarse Location | one-shot, foreground, only when you tap "detect location" | App Functionality |
| Identifiers → Device ID | APNs token, for order alerts | App Functionality |

**Data not collected:** everything else. Customer names, addresses and phone
numbers appear on order cards but are **received from the server for display**,
not collected from the device — do not declare them.

**Account deletion:** answer **Yes**. The flow is `app/settings/delete-account.tsx`,
reachable from **More → Delete account** and **About → Account**.

---

## 5. App Review notes

The app has **no public sign-up** — accounts are issued by ZBR to partner
restaurants — so a reviewer who installs it hits a login wall and sees nothing.
This is the most likely rejection, exactly as on Play.

In **App Store Connect → App Review Information**:

- **Sign-in required:** Yes, with a permanent demo vendor account on production
- **Notes:** explain that accounts are provisioned by ZBR and there is no self
  sign-up; that the demo restaurant carries orders in several states, menu items
  and a completed financial period so no screen is empty; and that push
  notifications require a real device.

The demo account must stay valid indefinitely, not be rate-limited, and not be
IP-restricted — reviewers connect from outside Uzbekistan.

---

## 6. Screenshots

Required, and `supportsTablet: true` makes the iPad set mandatory:

| Device | Size | Count |
|---|---|---|
| iPhone 6.7" / 6.9" | 1290×2796 or 1320×2868 | 3–10 |
| iPad Pro 12.9" (2nd gen) | 2048×2732 | 3–10 |

The Play art direction in
[`STORE_SCREENSHOTS_PROMPT.md`](./STORE_SCREENSHOTS_PROMPT.md) applies; only the
frame sizes differ. Apple rejects screenshots showing a device frame with a
status bar that doesn't match the target device.

---

## 7. Push notifications on iOS

Already configured and verified — see [`PUSH_SETUP.md`](./PUSH_SETUP.md).

Two iOS-specific facts worth repeating, because both fail *silently*:

- `aps-environment` is **production** in any archive built by `go-live:ios`.
  Production APNs is what TestFlight and App Store builds use; a development
  entitlement means no notifications at all. For a debug device build, use
  `npm run prebuild:ios:dev`.
- The entitlement requests
  `com.apple.developer.usernotifications.time-sensitive`, which lets an order
  alert break through Focus. The backend must set
  `"interruption-level": "time-sensitive"` in the `aps` payload for it to apply.

Test with `npm run push:test:ios` against a TestFlight build, phone locked.

---

## 8. Checklist

- [ ] `DELETE /api/v1/auth/account` live on production — **blocks review**
- [ ] Apple Developer membership active
- [ ] App ID registered with Push Notifications; App Store Connect record created
- [ ] `ZBR_APPLE_TEAM_ID`, `ZBR_ASC_KEY_ID`, `ZBR_ASC_ISSUER_ID` exported; `.p8` in place
- [ ] `npm run check:ios` clean
- [ ] Demo account works from outside Uzbekistan and has data on every screen
- [ ] Screenshots for iPhone **and** iPad
- [ ] App Privacy answers entered per §4
- [ ] Privacy policy URL reachable and serving real HTML
- [ ] `supportEmail` set in `constants/contact.ts`
- [ ] `npm run go-live:ios`
- [ ] Build appears in TestFlight; push verified on a locked device
