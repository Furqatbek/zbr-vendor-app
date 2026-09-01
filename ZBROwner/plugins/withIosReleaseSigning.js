const { withXcodeProject } = require('@expo/config-plugins');

/**
 * Make the Release configuration sign for DISTRIBUTION.
 *
 * The Expo iOS template sets, at the PROJECT level, for both Debug and Release:
 *
 *     "CODE_SIGN_IDENTITY[sdk=iphoneos*]" = "iPhone Developer";
 *
 * and the app target's Release configuration does not override it. With
 * automatic signing, Xcode picks the profile type from that identity — so an
 * archive looks for a *development* profile and fails with:
 *
 *     error: No profiles for 'com.zbr.owner' were found: Xcode couldn't find
 *     any iOS App Development provisioning profiles matching 'com.zbr.owner'.
 *
 * which reads like a missing profile but is really the wrong profile type being
 * requested. An App Store archive needs "Apple Distribution".
 *
 * This is the iOS counterpart of plugins/withReleaseSigning.js: `prebuild
 * --clean` regenerates the project every build, so the fix has to be a plugin.
 * Editing the setting in Xcode would survive exactly until the next prebuild.
 *
 * DEVELOPMENT_TEAM is written in too when ZBR_APPLE_TEAM_ID is set, so opening
 * the project in Xcode behaves the same as the scripted build. go-live-ios.js
 * also passes it on the command line, which covers the case where prebuild ran
 * in a shell that did not have the variable.
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

      // Both halves need their quotes written literally. The pbxproj grammar
      // rejects a bare key containing brackets — an unquoted
      // CODE_SIGN_IDENTITY[sdk=iphoneos*] fails the next parse with
      // 'Expected "/*", "=", or [A-Za-z0-9_.] but "[" found' — and a value
      // containing a space must be quoted as well.
      settings['"CODE_SIGN_IDENTITY[sdk=iphoneos*]"'] = '"Apple Distribution"';
      settings.CODE_SIGN_STYLE = 'Automatic';
      if (team) settings.DEVELOPMENT_TEAM = team;
      patched += 1;
    }

    if (patched === 0) {
      throw new Error(
        'withIosReleaseSigning: no Release configuration with a ' +
          'PRODUCT_BUNDLE_IDENTIFIER was found. The template layout changed — ' +
          'the archive would silently sign for development again.',
      );
    }

    return cfg;
  });
};
