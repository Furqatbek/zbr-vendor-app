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
| API/WS URLs | `env` per profile in `eas.json` | **`.env.production`** (see §3) |
| `versionCode` | `autoIncrement: true` | **manual in `app.json`** (see §6) |
| Signing keystore | managed by EAS | **you hold the `.jks`** (see §4) |
| Expo `projectId` | required | **not needed at all** |

`eas.json` is left in the repo but is now **unused**. It's harmless, and it's
your escape hatch if you ever want cloud builds. Ignore it otherwise — its
placeholder URLs no longer affect anything.

⚠️ The first two rows are the dangerous ones: EAS used to supply the production
URL and bump the version code. Nothing does that automatically now, so
`npm run check:release` exists to catch both (§7).

---

## 2. One-time machine setup

- **Node 20+**
- **JDK 17** (`java -version` → 17.x). Android Gradle Plugin 8 requires it.
- **Android Studio** → SDK Platform 35 + Build-Tools + Platform-Tools
- `ANDROID_HOME` set:
  - Windows: `setx ANDROID_HOME "%LOCALAPPDATA%\Android\Sdk"`
  - macOS/Linux: `export ANDROID_HOME=$HOME/Library/Android/sdk`

> iOS release builds require **macOS + Xcode** and an Apple Developer account.
> Play Store is Android-only, so this doc covers Android; iOS is unchanged.

---

## 3. Configure the backend URLs

Create **`ZBROwner/.env.production`**:

```
EXPO_PUBLIC_API_BASE_URL=https://api.yourrealhost.com
EXPO_PUBLIC_WS_BASE_URL=wss://api.yourrealhost.com
```

These are **inlined into the JS bundle at build time**, not read at runtime — a
wrong value ships to real phones and needs a new upload to fix.

Must be **`https://` / `wss://`**. Android blocks cleartext traffic in release
builds, so an `http://` host fails with a confusing "network error" on every
request, on a build that otherwise looks fine.

---

## 4. Signing key (one time — **do not lose this**)

```bash
keytool -genkey -v -keystore zbr-owner-upload.jks \
  -keyalg RSA -keysize 2048 -validity 10000 -alias zbr-owner
```

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

Then in `android/app/build.gradle`, add the release signing config:

```gradle
android {
    signingConfigs {
        release {
            if (project.hasProperty('ZBR_UPLOAD_STORE_FILE')) {
                storeFile file(ZBR_UPLOAD_STORE_FILE)
                storePassword ZBR_UPLOAD_STORE_PASSWORD
                keyAlias ZBR_UPLOAD_KEY_ALIAS
                keyPassword ZBR_UPLOAD_KEY_PASSWORD
            }
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release   // replaces signingConfigs.debug
        }
    }
}
```

⚠️ **`android/` is generated and gitignored**, so `prebuild --clean` wipes this
edit. Two options:

- **A — re-apply after each clean prebuild.** Fine if you build rarely. Keep the
  snippet handy.
- **B — stop regenerating it.** After your first successful build, remove
  `/android` from `.gitignore` and commit the folder. You then own the native
  project: signing survives, but **`app.json` plugin changes no longer apply
  automatically** — you'd hand-maintain `AndroidManifest.xml`, channels, etc.

Recommended: **A** while things are still changing (we're actively editing
`app.json` for push), then switch to **B** once the config settles.

---

## 5. Build

```bash
npm ci
npm run prebuild:android          # generates ./android from app.json
npm run build:android:aab         # AAB for Play  (runs check:release first)
# or
npm run build:android:apk         # APK for sideloading / device testing
```

Outputs:
- AAB → `android/app/build/outputs/bundle/release/app-release.aab`
- APK → `android/app/build/outputs/apk/release/app-release.apk`

**Use the APK for push testing** (you can sideload it directly); the AAB is
Play-only.

---

## 6. Version numbers — every upload

Play rejects an AAB whose `versionCode` it has already seen. Before each
upload, bump in `app.json`:

```jsonc
"version": "1.0.1",          // user-visible; bump for real releases
"android": { "versionCode": 2 }   // MUST increase every single upload
```

`versionCode` must strictly increase and is **independent** of `version` — many
teams just increment it by 1 for every upload, including re-uploads of the same
version name after a rejected build.

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
