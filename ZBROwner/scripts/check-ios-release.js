#!/usr/bin/env node
/**
 * Preflight for a LOCAL App Store build (no EAS).
 *
 * The Android equivalent is check-release-config.js; this covers what only
 * Apple cares about. Every check here maps to a failure that costs a full
 * archive-and-upload cycle to discover:
 *
 *   - a duplicate CFBundleVersion is rejected by App Store Connect on upload
 *   - a stale ios/ project ships the OLD build number, so the bump is silently lost
 *   - aps-environment: development means pushes are dead in TestFlight
 *   - a missing usage string is an automatic review rejection, not a warning
 *   - no export-compliance key means every upload stalls on a manual question
 *
 * Usage: npm run check:ios
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const root = path.resolve(__dirname, '..');
const problems = [];
const warnings = [];
const ok = [];

const expo = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8')).expo;
const ios = expo?.ios ?? {};

// ── Identity ────────────────────────────────────────────────────────────────
if (!ios.bundleIdentifier) {
  problems.push('app.json: expo.ios.bundleIdentifier is missing.');
} else if (!/^[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/.test(ios.bundleIdentifier)) {
  problems.push(`app.json: expo.ios.bundleIdentifier is not reverse-DNS ("${ios.bundleIdentifier}").`);
} else if (/example|changeme|yourcompany|todo/i.test(ios.bundleIdentifier)) {
  problems.push(`app.json: expo.ios.bundleIdentifier is a placeholder ("${ios.bundleIdentifier}").`);
} else {
  ok.push(`bundleIdentifier: ${ios.bundleIdentifier} (must match the App Store Connect record exactly)`);
}

if (!expo?.version) {
  problems.push('app.json: expo.version is missing (the user-visible version).');
} else {
  ok.push(`version: ${expo.version}`);
}

// ── Build number ────────────────────────────────────────────────────────────
// App Store Connect rejects a CFBundleVersion it has already seen for this
// version string, exactly like Play and versionCode.
const buildNumber = ios.buildNumber;
if (!buildNumber || !/^\d+$/.test(String(buildNumber))) {
  problems.push(
    'app.json: expo.ios.buildNumber must be a positive integer string.\n' +
      '     App Store Connect rejects an upload without one. `npm run version:bump`\n' +
      '     increments it alongside the Android versionCode.',
  );
} else {
  ok.push(`buildNumber: ${buildNumber} (must be HIGHER than any build already uploaded)`);
}

// ── The generated project, when it exists ───────────────────────────────────
// Xcode stamps the archive from Info.plist, NOT app.json. A stale ios/ ships
// the old build number and the upload is rejected as a duplicate — after the
// entire archive. Same class of bug as the Android build.gradle drift.
const iosDir = path.join(root, 'ios');
const plistPath = (() => {
  if (!fs.existsSync(iosDir)) return null;
  for (const entry of fs.readdirSync(iosDir)) {
    const candidate = path.join(iosDir, entry, 'Info.plist');
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
})();

if (!plistPath) {
  ok.push('ios/ not generated yet — it will be created by prebuild before the archive');
} else {
  const plist = fs.readFileSync(plistPath, 'utf8');
  const stringAfter = (key) => {
    const m = plist.match(
      new RegExp(`<key>${key}</key>\\s*<string>([^<]*)</string>`),
    );
    return m ? m[1] : null;
  };
  const hasTrue = (key) => new RegExp(`<key>${key}</key>\\s*<true\\s*/>`).test(plist);
  const hasFalse = (key) => new RegExp(`<key>${key}</key>\\s*<false\\s*/>`).test(plist);

  const plistBuild = stringAfter('CFBundleVersion');
  // Expo templates leave $(CURRENT_PROJECT_VERSION) here, resolved by Xcode.
  if (plistBuild && !plistBuild.startsWith('$') && String(buildNumber) !== plistBuild) {
    problems.push(
      `buildNumber mismatch — the archive would ship ${plistBuild}, not ${buildNumber}.\n` +
        `     app.json says ${buildNumber}; ${path.relative(root, plistPath)} says ${plistBuild}.\n` +
        '     Run `npm run prebuild:ios` to regenerate the native project.',
    );
  } else {
    ok.push('Info.plist build number is in sync');
  }

  // Missing purpose strings are an automatic rejection, and the app calls both
  // APIs. They come from the expo-location / expo-image-picker plugin config,
  // so a missing one means a plugin was dropped from app.json.
  const USAGE_KEYS = {
    NSLocationWhenInUseUsageDescription: 'expo-location (detect restaurant coordinates)',
    NSPhotoLibraryUsageDescription: 'expo-image-picker (menu and profile images)',
  };
  for (const [key, why] of Object.entries(USAGE_KEYS)) {
    const value = stringAfter(key);
    if (!value) {
      problems.push(
        `Info.plist is missing ${key} — required by ${why}.\n` +
          '     Apple rejects a build that calls the API without a purpose string.',
      );
    } else if (value.length < 12) {
      warnings.push(`${key} is very short ("${value}") — reviewers want a real reason.`);
    }
  }

  // Without this key, every upload stops on the export-compliance question in
  // App Store Connect and the build never reaches TestFlight unattended.
  if (!hasTrue('ITSAppUsesNonExemptEncryption') && !hasFalse('ITSAppUsesNonExemptEncryption')) {
    warnings.push(
      'Info.plist does not declare ITSAppUsesNonExemptEncryption. Every upload will\n' +
        '     stall on the export-compliance question. The app uses only standard\n' +
        '     HTTPS/TLS, so `false` is the correct answer — set it in app.json under\n' +
        '     expo.ios.infoPlist and re-run prebuild.',
    );
  } else {
    ok.push('Export compliance declared (ITSAppUsesNonExemptEncryption)');
  }

  if (!/<string>remote-notification<\/string>/.test(plist)) {
    problems.push(
      'Info.plist UIBackgroundModes is missing "remote-notification".\n' +
        '     Without it iOS will not wake the app for an order push.',
    );
  }
}

// ── Push entitlement ────────────────────────────────────────────────────────
// A TestFlight or App Store build must use the production APNs environment; a
// development entitlement means silence on every device that installs it.
const apsEnv = ios?.entitlements?.['aps-environment'];
if (apsEnv === 'production') {
  ok.push('aps-environment: production (correct for TestFlight and the App Store)');
} else if (apsEnv === 'development') {
  problems.push(
    'app.json: aps-environment is "development". Pushes are DEAD in any build\n' +
      '     distributed through TestFlight or the App Store. Rebuild without\n' +
      '     APS_ENVIRONMENT=development (see app.config.js).',
  );
} else {
  problems.push(`app.json: aps-environment is ${JSON.stringify(apsEnv)} — expected "production".`);
}

// ── Environment baked into the bundle ───────────────────────────────────────
// EXPO_PUBLIC_* is inlined when the JS bundle is built, which on iOS happens
// inside xcodebuild. A wrong value ships and can only be fixed by a new upload.
function parseEnvFile(file) {
  const out = {};
  if (!fs.existsSync(file)) return null;
  for (const rawLine of fs.readFileSync(file, 'utf8').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    out[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
  }
  return out;
}

const REQUIRED_VARS = ['EXPO_PUBLIC_API_BASE_URL', 'EXPO_PUBLIC_WS_BASE_URL'];
const prodEnv = parseEnvFile(path.join(root, '.env.production'));

if (!prodEnv && !REQUIRED_VARS.every((k) => process.env[k])) {
  problems.push(
    '.env.production not found and the variables are not set in the shell.\n' +
      '     The build would fall back to http://localhost:8080 and be unusable.',
  );
}

for (const key of REQUIRED_VARS) {
  const value = process.env[key] || (prodEnv && prodEnv[key]) || null;
  if (!value) {
    if (prodEnv) problems.push(`${key} is not set for the production build.`);
    continue;
  }
  const secureScheme = key.includes('WS') ? 'wss://' : 'https://';
  if (/localhost|127\.0\.0\.1|192\.168\./.test(value)) {
    problems.push(`${key} points at a local address ("${value}"). Reviewers cannot reach it.`);
  } else if (!value.startsWith(secureScheme)) {
    problems.push(
      `${key} must start with ${secureScheme} ("${value}") — iOS ATS blocks plain http/ws.`,
    );
  } else {
    ok.push(`${key} = ${value}`);
  }
}

// ── Toolchain ───────────────────────────────────────────────────────────────
if (process.platform !== 'darwin') {
  problems.push(
    `An iOS archive requires macOS with Xcode; this is ${process.platform}.\n` +
      '     Everything above still validated, so run this on the Mac to continue.',
  );
} else {
  ok.push('Running on macOS');
}

// ── Upload credentials ──────────────────────────────────────────────────────
// altool authenticates with an App Store Connect API key. This is a DIFFERENT
// key from the APNs .p8 used to send pushes — same file format, different key,
// and mixing them up produces an opaque auth error.
const TEAM_ID = process.env.ZBR_APPLE_TEAM_ID;
const KEY_ID = process.env.ZBR_ASC_KEY_ID;
const ISSUER_ID = process.env.ZBR_ASC_ISSUER_ID;

const APPLE_ID = process.env.ZBR_APPLE_ID;
const APP_PASSWORD = process.env.ZBR_APP_SPECIFIC_PASSWORD;

// With --no-upload the run stops at an exported .ipa, so missing upload
// credentials are not a reason to refuse to build. Signing still needs the team
// id, which is checked above regardless.
const uploadPlanned = !process.argv.slice(2).includes('--no-upload');
const credential = uploadPlanned ? problems : warnings;

if (!TEAM_ID) {
  problems.push(
    'ZBR_APPLE_TEAM_ID is not set. It goes in the export options that tell Xcode\n' +
      '     which team to sign the archive for. It is the 10-character code in\n' +
      '     https://developer.apple.com/account → Membership details, and it is also\n' +
      '     in the parentheses here if you already have a certificate installed:\n' +
      '       security find-identity -v -p codesigning',
  );
} else if (!/^[A-Z0-9]{10}$/.test(TEAM_ID)) {
  warnings.push(`ZBR_APPLE_TEAM_ID is "${TEAM_ID}" — team ids are 10 alphanumerics.`);
} else {
  ok.push(`Apple team: ${TEAM_ID}`);
}

// altool accepts either an App Store Connect API key or an Apple ID with an
// app-specific password. The API key is better for repeat use (no 2FA, works
// unattended); the password is faster to get hold of the first time.
if (KEY_ID && ISSUER_ID) {
  const KEY_DIRS = [
    path.join(os.homedir(), '.appstoreconnect', 'private_keys'),
    path.join(os.homedir(), 'private_keys'),
    path.join(root, 'private_keys'),
  ];
  const keyName = `AuthKey_${KEY_ID}.p8`;
  const searched = KEY_DIRS.map((d) => path.join(d, keyName));

  // Both ids are 10 alphanumerics, so shape alone cannot tell them apart — but
  // they are never equal, and confusing them is the easy mistake to make.
  if (TEAM_ID && KEY_ID === TEAM_ID) {
    credential.push(
      `ZBR_ASC_KEY_ID is set to your TEAM id (${KEY_ID}). They are different\n` +
        '     identifiers that happen to share a format:\n' +
        '       team id  — identifies your Apple Developer organisation\n' +
        '       key id   — identifies one App Store Connect API key\n' +
        '     Either use the Apple ID route instead:\n' +
        '       unset ZBR_ASC_KEY_ID ZBR_ASC_ISSUER_ID\n' +
        '       export ZBR_APPLE_ID=you@example.com\n' +
        '       export ZBR_APP_SPECIFIC_PASSWORD=xxxx-xxxx-xxxx-xxxx\n' +
        '     or take the real Key ID from App Store Connect → Users and Access\n' +
        '     → Integrations → App Store Connect API.',
    );
  } else if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(ISSUER_ID)) {
    credential.push(
      `ZBR_ASC_ISSUER_ID is "${ISSUER_ID}" — the issuer id is a UUID, shown above\n` +
        '     the key list in App Store Connect → Users and Access → Integrations.',
    );
  } else if (searched.some((p) => fs.existsSync(p))) {
    ok.push(`Upload auth: App Store Connect API key (${keyName})`);
  } else {
    // Naming the keys that ARE present usually reveals the right Key ID.
    const present = KEY_DIRS.filter((d) => fs.existsSync(d)).flatMap((d) =>
      fs.readdirSync(d).filter((f) => /^AuthKey_.+\.p8$/.test(f)).map((f) => path.join(d, f)),
    );
    credential.push(
      `${keyName} not found. altool looks for it in:\n` +
        searched.map((p) => `       ${p}`).join('\n') +
        (present.length
          ? '\n     These API keys ARE present — set ZBR_ASC_KEY_ID to match one:\n' +
            present.map((p) => `       ${p}`).join('\n')
          : '\n     No AuthKey_*.p8 anywhere. Either download the key from App Store\n' +
            '     Connect, or use the Apple ID + app-specific password route instead.'),
    );
  }
} else if (APPLE_ID && APP_PASSWORD) {
  if (!/^[a-z]{4}-[a-z]{4}-[a-z]{4}-[a-z]{4}$/i.test(APP_PASSWORD)) {
    credential.push(
      'ZBR_APP_SPECIFIC_PASSWORD is not in the xxxx-xxxx-xxxx-xxxx form Apple issues.\n' +
        '     Your normal Apple ID password will NOT work — generate an app-specific\n' +
        '     one at https://account.apple.com → Sign-In and Security → App-Specific\n' +
        '     Passwords.',
    );
  } else {
    ok.push(`Upload auth: Apple ID ${APPLE_ID} with an app-specific password`);
  }
} else if (KEY_ID || ISSUER_ID) {
  credential.push(
    'Incomplete App Store Connect API key — set BOTH ZBR_ASC_KEY_ID and\n' +
      '     ZBR_ASC_ISSUER_ID, or use the Apple ID route instead.',
  );
} else {
  credential.push(
    `No upload credentials configured${uploadPlanned ? ' — the upload step cannot authenticate' : " (fine for --no-upload; you'll upload the .ipa yourself)"}.\n` +
      '     Pick either:\n' +
      '\n' +
      '     A) Apple ID + app-specific password (quickest to set up)\n' +
      '        https://account.apple.com → Sign-In and Security → App-Specific\n' +
      '        Passwords → generate one, then:\n' +
      '          export ZBR_APPLE_ID=you@example.com\n' +
      '          export ZBR_APP_SPECIFIC_PASSWORD=xxxx-xxxx-xxxx-xxxx\n' +
      '\n' +
      '     B) App Store Connect API key (better for repeat/CI use)\n' +
      '        App Store Connect → Users and Access → Integrations → App Store\n' +
      '        Connect API → + (role: App Manager). The .p8 downloads ONCE.\n' +
      '          export ZBR_ASC_KEY_ID=XXXXXXXXXX\n' +
      '          export ZBR_ASC_ISSUER_ID=<issuer uuid>\n' +
      '          mv ~/Downloads/AuthKey_*.p8 ~/.appstoreconnect/private_keys/\n' +
      '        This is NOT the APNs key used for push — separate key, same format.',
  );
}

// ── Report ──────────────────────────────────────────────────────────────────
console.log('\niOS release configuration check\n' + '─'.repeat(50));
for (const line of ok) console.log(`  ok       ${line}`);
for (const line of warnings) console.log(`  WARN     ${line}`);
for (const line of problems) console.log(`  PROBLEM  ${line}`);
console.log('─'.repeat(50));

if (problems.length) {
  console.log(
    `${problems.length} problem(s) must be fixed before archiving. See docs/APP_STORE_SUBMISSION.md\n`,
  );
  process.exit(1);
}
console.log(
  warnings.length
    ? `No blocking problems, ${warnings.length} warning(s).\n`
    : 'iOS release configuration looks good.\n',
);
