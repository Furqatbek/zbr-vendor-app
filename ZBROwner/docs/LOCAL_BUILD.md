# Building Locally & Publishing to Google Play (no EAS)

This project builds on your own machine with Gradle — **no EAS, no Expo
account, no cloud service.**

> **Important distinction:** you're dropping **EAS** (Expo's hosted *build
> service*). You are **not** dropping **Expo the framework** — the app is built
> on expo-router, expo-notifications, expo-secure-store and others, and those
> stay. `npx expo prebuild` runs entirely on your machine and needs no account.

---

## 1. What dropping EAS changes

| Concern | With EAS | Now (local) |
|---|---|---|
| API/WS URLs | `env` per profile in `eas.json` | **committed `.env.production` / `.env.development`** (see §3) |
| `versionCode` | `autoIncrement: true` | **auto-incremented by `go-live`** (see §6) |
| Signing keystore | managed by EAS | **you hold the `.jks`** (see §4) |
| Expo `projectId` | required | **not needed at all** |

`eas.json` is left in the repo but is now **unused**. It's harmless, and it's
your escape hatch if you ever want cloud builds. Ignore it otherwise — its
placeholder URLs no longer affect anything.

⚠️ EAS used to supply the production URL and bump the version code. Both are now
handled locally — `.env.production` for the URLs, and `npm run go-live` for the
version bump — with `npm run check:release` failing the build if either is wrong.

---

## 2. One-time machine setup

- **Node 20+**
- **JDK 17** (`java -version` → 17.x). Android Gradle Plugin 8 requires it.
- **Android Studio** → SDK Platform 36 + Build-Tools + Platform-Tools

### Windows: JAVA_HOME

`keytool : is not recognized` or a path that starts with `\bin\keytool.exe`
means `JAVA_HOME` is unset. **Android Studio already ships a JDK** — you rarely
need to install another:

```powershell
Test-Path "C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe"

# if False, find any JDK on the machine:
Get-ChildItem "C:\Program Files","C:\Program Files (x86)","$env:LOCALAPPDATA\Programs" `
  -Filter keytool.exe -Recurse -ErrorAction SilentlyContinue |
  Select-Object -First 5 FullName
```

```powershell
setx JAVA_HOME "C:\Program Files\Android\Android Studio\jbr"
setx ANDROID_HOME "$env:LOCALAPPDATA\Android\Sdk"
```

⚠️ `setx` only affects **new** shells — open a fresh PowerShell window, then
confirm with `java -version` (must be 17.x) and `keytool -help`.

No JDK at all? Install **Temurin 17** and tick "Set JAVA_HOME":
<https://adoptium.net/temurin/releases/?version=17>

macOS/Linux: `export ANDROID_HOME=$HOME/Library/Android/sdk`

> iOS release builds require **macOS + Xcode** and an Apple Developer account.
> Play Store is Android-only, so this doc covers Android; iOS is unchanged.

---

## 2b. ⚠️ This app cannot run in Expo Go

`npm start` + `a` opens **Expo Go**, which is a generic prebuilt shell. This app
will install there and then fail in the exact area you are usually testing:

- Expo Go **dropped remote push in SDK 53** — `getDevicePushTokenAsync()` cannot
  work, so no FCM/APNs token is ever issued.
- It has no `google-services.json`, so Firebase never initialises.
- Config plugins (`withReleaseSigning`, `expo-build-properties`, the
  notification channel and bundled alarm sound) do not exist in it.

Use a **development build** instead — same fast refresh, but it is really your
app with your native configuration:

```powershell
npm run android      # expo run:android — prebuild + compile + install + Metro
```

First run takes 5-15 minutes while Gradle downloads the toolchain; later runs are
quick. Requires the JAVA_HOME / ANDROID_HOME setup in §2.

For push testing prefer a **real device** over the emulator: the test that
matters — app force-killed, screen off — depends on Doze and OEM battery
behaviour that emulators do not reproduce. Build a sideloadable APK with
`npm run go-live:apk`.

> Emulator showing `INSTALL_FAILED_INSUFFICIENT_STORAGE`? Android Studio ->
> Device Manager -> ⋮ -> **Wipe Data**, or Edit -> Show Advanced Settings ->
> **Internal Storage** -> 8192 MB.

---

## 3. Backend URLs — already configured

Both env files are **committed and point at production**, so a fresh clone
builds correctly with no setup:

| File | Loaded when | Value |
|---|---|---|
| `.env.production` | release builds | `https://zbrr.uz` / `wss://zbrr.uz` |
| `.env.development` | `expo start`, debug builds | same |

These are **inlined into the JS bundle at build time**, not read at runtime — a
wrong value ships to real phones and needs a new upload to fix. `check:release`
fails on a placeholder, a localhost/LAN address, or plain `http://`/`ws://`
(Android blocks cleartext in release builds).

To point at a local backend, create **`.env.local`** — gitignored, and it
overrides both files:

```
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.50:8080
EXPO_PUBLIC_WS_BASE_URL=ws://192.168.1.50:8080
```

Use your machine's LAN IP, never `localhost` — a phone resolves localhost to
itself. **Restart with `npx expo start --clear` after any env change**; Metro
caches these values, and without `--clear` you will keep seeing the old URL and
conclude the change did not work.

---

## 4. Signing key (one time — **do not lose this**)

```powershell
mkdir C:\keys -Force
keytool -genkeypair -v -keystore C:\keys\zbr-owner-upload.jks -alias zbr-owner -keyalg RSA -keysize 2048 -validity 10000
```

One line — PowerShell does not accept bash's `\` continuation. If `keytool` is
not found, see the JAVA_HOME section in §2, or call it by full path:

```powershell
& "$env:JAVA_HOME\bin\keytool.exe" -genkeypair -v -keystore C:\keys\zbr-owner-upload.jks -alias zbr-owner -keyalg RSA -keysize 2048 -validity 10000
```

It asks for a keystore password (reuse it for the key), then certificate details
that are never shown to users.

Store the `.jks` **outside the repo** — `*.jks` is gitignored, and it must stay
that way. Back it up somewhere durable (password manager / company vault).

> If you lose the upload key you can ask Google to reset it (with Play App
> Signing enabled), but it's a slow support process. Losing it *without* Play
> App Signing means you can never update the app again — a new package name is
> the only way out. Back it up now.

Put the credentials in your **global** Gradle config, never in the repo —
`~/.gradle/gradle.properties` (Windows: `%USERPROFILE%\.gradle\gradle.properties`):

```properties
ZBR_UPLOAD_STORE_FILE=C:/keys/zbr-owner-upload.jks
ZBR_UPLOAD_KEY_ALIAS=zbr-owner
ZBR_UPLOAD_STORE_PASSWORD=•••
ZBR_UPLOAD_KEY_PASSWORD=•••
```

That's all — **no `build.gradle` editing required.**
`plugins/withReleaseSigning.js` injects the release `signingConfig` on every
prebuild, so it survives `prebuild --clean`. Without those Gradle properties the
build falls back to the debug keystore, and `check:release` refuses to proceed
rather than let a debug-signed AAB reach Play (Play rejects those at upload).

---

## 5. Build

```bash
npm ci
npm run go-live               # gates -> bump -> prebuild -> AAB for Play
npm run go-live:apk           # same, but a sideloadable APK for device testing
npm run go-live:checks        # gates only, no build (safe anytime)
npm run go-live:no-privacy    # don't let the policy URL block the build
npm run go-live:no-bump       # rebuild without consuming a versionCode
```

> **Use these named scripts, not `npm run go-live -- --flag`.** npm parses an
> unrecognised dashed argument as its *own* config, prints
> `npm warn Unknown cli config "--skip-privacy"`, and the flag never reaches the
> script — which then runs as if you had not passed it. The script does recover
> the value from the `npm_config_*` variable npm leaves behind, so the `--`
> form works too, but the named scripts remove the ambiguity.

`go-live` runs every gate in order and **stops at the first failure**, so a
build that would be rejected — or accepted while pointing at the wrong backend —
never gets produced:

```
release+push config -> privacy URL -> typecheck -> tests -> lint
  -> versionCode bump -> prebuild -> gradle bundleRelease
```

Outputs:
- AAB → `android/app/build/outputs/bundle/release/app-release.aab`
- APK → `android/app/build/outputs/apk/release/app-release.apk`

**Use the APK for push testing** — you can sideload it; the AAB is Play-only.

The privacy-policy gate is a **hard failure for the AAB** (it blocks Play
review) but only a **warning** for `--apk` — a sideloaded test build never
reaches Play — or when you pass **`--skip-privacy`**, for when the policy is
managed outside this repo and `privacyPolicyUrl` in `constants/contact.ts` is
not the URL that ends up in the Play listing.

The check still **runs and prints** under both flags; it is only downgraded, not
silenced. That matters because the failure it detects is invisible in a browser:
a single-page app returns HTTP 200 with its shell for *every* path, so the URL
looks alive while a reviewer's fetch sees no policy. Point
`npm run check:privacy-url` at whatever URL you do submit.

Everything else — signing, backend URLs, versionCode, typecheck, tests, lint —
is enforced for every build and has no skip flag.

---

## 6. Version numbers — automatic

`npm run go-live` **increments `versionCode` by 1 before every build**, and keeps
`ios.buildNumber` in sync. You don't have to remember it.

```bash
npm run version:bump              # +1, standalone
npm run version:bump -- --dry-run # show what would change
npm run version:bump -- --to 42   # set explicitly (must be higher)
npm run go-live:no-bump           # rebuild WITHOUT consuming a number
```

It bumps **before** prebuild on purpose: Gradle stamps the AAB from
`android/app/build.gradle`, not from `app.json`, so bumping afterwards would
ship the old number. `check:release` cross-checks the two and fails if they
drift.

Why +1 and never a timestamp or random value: **Play remembers the highest
versionCode you have ever uploaded**, and you can never go below it. One
accidental `1700000000` burns every number beneath it permanently.

`version` (the user-visible name, e.g. `1.0.1`) is separate and still manual —
bump it in `app.json` for real releases. `versionCode` is independent of it and
simply counts uploads.

**Commit `app.json` after a release build** so the number is recorded in git
against that upload.

---

## 7. Preflight (run before every upload)

```bash
npm run check:release
```

Fails the build if the production URLs are missing, still placeholders, point at
localhost, or use `http://`/`ws://`; and if `versionCode` is missing. It also
runs the push checks (`google-services.json` matches the package, alarm sound
bundled, channel ids consistent).

This is wired into `build:android:apk` / `build:android:aab`, so a
misconfigured release build stops before Gradle starts rather than after you've
uploaded it.

---

## 8. Publishing to Play

1. [Play Console](https://play.google.com/console) → **Create app**
2. Keep **Play App Signing** enabled (the default) — Google holds the real app
   signing key; your `.jks` is only the *upload* key, which is recoverable.
3. **Testing → Internal testing** first. Add your own account as a tester and
   install from the Play link — this is the fastest way to validate a real
   signed build, and internal testing has no review delay.
4. Only promote to Production once push is verified end-to-end (see
   `docs/PUSH_SETUP.md` §5 — especially the **killed + screen-off** test).

First submission also needs: privacy policy URL, data-safety form, content
rating questionnaire, store listing assets. Budget time for these — they're
usually what actually delays a first release, not the build.

---

## 9. Push notifications still work

Nothing about local building changes push. FCM uses the **package name +
`google-services.json`**, which is already committed and verified.

One caveat: **Play App Signing changes the app's signing certificate.** That
does not affect FCM (which keys off the package name), but it *does* matter for
Google Sign-In or any API tied to a SHA-1. Not used here — noted in case that
changes.

Verify a real build with:

```bash
npm run check:push
```
