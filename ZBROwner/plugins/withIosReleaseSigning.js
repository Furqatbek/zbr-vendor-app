const { withXcodeProject } = require('@expo/config-plugins');

/**
 * Pin the signing TEAM on the Release configuration.
 *
 * `prebuild --clean` regenerates the Xcode project on every build, so anything
 * set in Xcode's Signing & Capabilities editor survives exactly until the next
 * prebuild. This is the iOS counterpart of plugins/withReleaseSigning.js.
 * go-live-ios.js also passes DEVELOPMENT_TEAM on the xcodebuild command line;
 * writing it here as well is what makes opening the project in Xcode behave the
 * same as the scripted build.
 *
 * ── Do NOT set CODE_SIGN_IDENTITY here ──────────────────────────────────────
 *
 * An earlier version of this plugin forced "Apple Distribution" on Release,
 * reasoning that an App Store build needs a distribution identity. That is
 * wrong, and Xcode rejects it outright:
 *
 *     error: ZBROwner has conflicting provisioning settings. ZBROwner is
 *     automatically signed for development, but a conflicting code signing
 *     identity Apple Distribution has been manually specified.
 *
 * Under automatic signing the ARCHIVE is signed for development by design.
 * Distribution happens at export: `xcodebuild -exportArchive` with
 * `method: app-store-connect` re-signs the app with the distribution
 * certificate and the App Store provisioning profile. So the template's
 * project-level "iPhone Developer" identity is correct and must be left alone.
 *
 * The error that prompted the change —
 *
 *     No profiles for 'com.zbr.owner' were found: Xcode couldn't find any iOS
 *     App Development provisioning profiles matching 'com.zbr.owner'
 *
 * — was not the wrong profile TYPE. It was a missing account: nothing could
 * authenticate to the developer portal to create the development profile that
 * the archive legitimately wanted. An App Store Connect API key fixed it.
 */
module.exports = function withIosReleaseSigning(config) {
  return withXcodeProject(config, (cfg) => {
    const project = cfg.modResults;
    const configurations = project.pbxXCBuildConfigurationSection();
    const team = process.env.ZBR_APPLE_TEAM_ID;
    let patched = 0;

    for (const key of Object.keys(configurations)) {
      const entry = configurations[key];
      if (!entry || typeof entry !== 'object' || !entry.buildSettings) continue;

      const settings = entry.buildSettings;
      // Only the app target carries PRODUCT_BUNDLE_IDENTIFIER; the project-level
      // and Pods configurations must be left alone.
      if (!settings.PRODUCT_BUNDLE_IDENTIFIER) continue;
      if (entry.name !== 'Release') continue;

      settings.CODE_SIGN_STYLE = 'Automatic';
      if (team) settings.DEVELOPMENT_TEAM = team;
      patched += 1;
    }

    if (patched === 0) {
      throw new Error(
        'withIosReleaseSigning: no Release configuration with a ' +
          'PRODUCT_BUNDLE_IDENTIFIER was found — the template layout changed.',
      );
    }

    return cfg;
  });
};
