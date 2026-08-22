/**
 * Expo config plugin: give the RELEASE build type a real signing config.
 *
 * The React Native / Expo Android template ships this:
 *
 *     release {
 *       // Caution! In production, you need to generate your own keystore file.
 *       signingConfig signingConfigs.debug     <-- DEBUG KEYSTORE
 *     }
 *
 * A release AAB built that way is signed with the shared `androiddebugkey`, and
 * Google Play REJECTS it at upload ("You uploaded an APK or Android App Bundle
 * that was signed in debug mode"). It never reaches review.
 *
 * `android/` is generated and gitignored, so hand-editing build.gradle is wiped
 * by the next `expo prebuild --clean`. This plugin re-applies the change on
 * every prebuild instead.
 *
 * Credentials are read from Gradle properties, which live OUTSIDE the repo in
 * ~/.gradle/gradle.properties (Windows: %USERPROFILE%\.gradle\gradle.properties):
 *
 *     ZBR_UPLOAD_STORE_FILE=C:/keys/zbr-owner-upload.jks
 *     ZBR_UPLOAD_KEY_ALIAS=zbr-owner
 *     ZBR_UPLOAD_STORE_PASSWORD=...
 *     ZBR_UPLOAD_KEY_PASSWORD=...
 *
 * If those properties are absent the release config falls back to the debug
 * keystore so local `assembleRelease` smoke builds still work — but
 * `scripts/check-release-config.js` fails the build in that case, so an
 * unsigned-for-production artifact cannot be produced by the npm build scripts.
 */

const { withAppBuildGradle } = require('@expo/config-plugins');

const RELEASE_SIGNING_CONFIG = `
        release {
            if (project.hasProperty('ZBR_UPLOAD_STORE_FILE')) {
                storeFile file(ZBR_UPLOAD_STORE_FILE)
                storePassword ZBR_UPLOAD_STORE_PASSWORD
                keyAlias ZBR_UPLOAD_KEY_ALIAS
                keyPassword ZBR_UPLOAD_KEY_PASSWORD
            } else {
                // No upload key on this machine — fall back so debug/CI builds
                // still run. check:release refuses to ship such a build.
                storeFile file('debug.keystore')
                storePassword 'android'
                keyAlias 'androiddebugkey'
                keyPassword 'android'
            }
        }`;

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let gradle = cfg.modResults.contents;

    if (gradle.includes('ZBR_UPLOAD_STORE_FILE')) {
      return cfg; // already applied
    }

    // 1. Add a `release` entry to signingConfigs, right after the debug one.
    const debugSigningBlock = /(signingConfigs\s*\{\s*debug\s*\{[^}]*\})/;
    if (!debugSigningBlock.test(gradle)) {
      throw new Error(
        '[withReleaseSigning] Could not find the debug signingConfigs block in ' +
          'android/app/build.gradle. The Expo template changed — update this plugin.',
      );
    }
    gradle = gradle.replace(debugSigningBlock, `$1${RELEASE_SIGNING_CONFIG}`);

    // 2. Point buildTypes.release at it. Anchor on the template's caution
    //    comment so we cannot accidentally rewrite buildTypes.debug.
    const releaseUsesDebugKey =
      /(\/\/ Caution! In production, you need to generate your own keystore file\.[\s\S]*?)signingConfig signingConfigs\.debug/;
    if (!releaseUsesDebugKey.test(gradle)) {
      throw new Error(
        '[withReleaseSigning] Could not find the release buildType signing line in ' +
          'android/app/build.gradle. Verify the release build is not debug-signed.',
      );
    }
    gradle = gradle.replace(releaseUsesDebugKey, '$1signingConfig signingConfigs.release');

    cfg.modResults.contents = gradle;
    return cfg;
  });
};
