/**
 * Dynamic Expo config.
 *
 * `app.json` stays the source of truth for everything; this file only overrides
 * the values that must differ between a local debug build and a release build.
 *
 * ── aps-environment ────────────────────────────────────────────────────────
 * APNs has two completely separate environments, and a device token minted in
 * one is INVALID in the other (APNs replies 400 BadDeviceToken — the single most
 * common iOS push mistake):
 *
 *   development → api.sandbox.push.apple.com   (Xcode debug builds)
 *   production  → api.push.apple.com           (TestFlight / App Store)
 *
 * The entitlement must also match the provisioning profile or the build fails
 * to sign: a Development profile requires `development`, a Distribution profile
 * requires `production`.
 *
 * Defaults to `production` so a release build is correct by default. For a local
 * debug build on a Mac:
 *
 *   APS_ENVIRONMENT=development npx expo prebuild --platform ios --clean
 *
 * Then send test pushes with `--env sandbox` (see scripts/send-apns-test.js).
 */
module.exports = ({ config }) => {
  const apsEnvironment = process.env.APS_ENVIRONMENT || 'production';

  if (apsEnvironment !== 'development' && apsEnvironment !== 'production') {
    throw new Error(
      `APS_ENVIRONMENT must be "development" or "production", got "${apsEnvironment}".`,
    );
  }

  return {
    ...config,
    ios: {
      ...config.ios,
      entitlements: {
        ...config.ios?.entitlements,
        'aps-environment': apsEnvironment,
      },
    },
  };
};
