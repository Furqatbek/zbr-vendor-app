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
 * Credentials come from `keystore.properties` at the REPO ROOT — gitignored,
 * so it never leaves the machine:
 *
 *     ZBR_UPLOAD_STORE_FILE=C:/keys/zbr-owner-upload.jks
 *     ZBR_UPLOAD_KEY_ALIAS=zbr-owner
 *     ZBR_UPLOAD_STORE_PASSWORD=...
 *     ZBR_UPLOAD_KEY_PASSWORD=...
 *
 * It lives beside the project rather than in ~/.gradle/gradle.properties
 * because that file is GLOBAL: every Android project on the machine shares it,
 * so whichever one wrote those property names last wins. That is not
 * hypothetical — this app was once signed with another project's key, and Play
 * rejected the upload for a certificate mismatch.
 *
 * ~/.gradle/gradle.properties still works as a fallback for a single-project
 * machine or CI, but the per-project file takes precedence.
 *
 * If those properties are absent the release config falls back to the debug
 * keystore so local `assembleRelease` smoke builds still work — but
 * `scripts/check-release-config.js` fails the build in that case, so an
 * unsigned-for-production artifact cannot be produced by the npm build scripts.
 */

const { withAppBuildGradle } = require('@expo/config-plugins');

const RELEASE_SIGNING_CONFIG = `
        release {
            // keystore.properties sits at the repo root, one level above
            // android/. Checked first so a per-project key always beats
            // whatever another project left in ~/.gradle/gradle.properties.
            def zbrKeystoreProps = new Properties()
            def zbrKeystoreFile = rootProject.file('../keystore.properties')
            if (zbrKeystoreFile.exists()) {
                zbrKeystoreFile.withInputStream { zbrKeystoreProps.load(it) }
            }

            if (zbrKeystoreProps['ZBR_UPLOAD_STORE_FILE']) {
                storeFile file(zbrKeystoreProps['ZBR_UPLOAD_STORE_FILE'])
                storePassword zbrKeystoreProps['ZBR_UPLOAD_STORE_PASSWORD']
                keyAlias zbrKeystoreProps['ZBR_UPLOAD_KEY_ALIAS']
                keyPassword zbrKeystoreProps['ZBR_UPLOAD_KEY_PASSWORD']
            } else if (project.hasProperty('ZBR_UPLOAD_STORE_FILE')) {
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
