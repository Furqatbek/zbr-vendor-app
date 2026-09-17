#!/usr/bin/env node
/**
 * Preflight for a LOCAL release build (no EAS).
 *
 * EXPO_PUBLIC_* variables are inlined into the JS bundle at build time, so a
 * wrong value ships to real phones and can only be fixed with a new upload.
 * The two failures this exists to prevent:
 *   1. Shipping a build pointing at localhost or a placeholder host — the app
 *      installs and opens, then every request fails with no useful error.
 *   2. Uploading an AAB whose versionCode Play has already seen — rejected at
 *      upload, after the whole build.
 *
 * Usage: npm run check:release
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const root = path.resolve(__dirname, '..');
const problems = [];
const warnings = [];
const ok = [];

const expo = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8')).expo;

// go-live.js passes this: that run bumps and then regenerates android/ from
// app.json, so whatever build.gradle currently holds is about to be overwritten
// and cannot reach the AAB. Without it the gate blocks a run that was about to
// fix itself — the same sequencing mistake the iOS Info.plist check made.
const willPrebuild = process.argv.slice(2).includes('--will-prebuild');

// ── Versioning (Play rejects duplicates / missing) ──────────────────────────
const versionCode = expo?.android?.versionCode;
if (typeof versionCode !== 'number' || !Number.isInteger(versionCode) || versionCode < 1) {
  problems.push(
    'app.json: expo.android.versionCode must be a positive integer. ' +
      'Play rejects an AAB without one.',
  );
} else {
  ok.push(`versionCode: ${versionCode} (must be HIGHER than any build already uploaded)`);

  // Gradle stamps the AAB from android/app/build.gradle, NOT app.json. If the
  // native project is stale, you would ship the old versionCode and Play would
  // reject the upload as a duplicate — after the whole build.
  const appGradlePath = path.join(root, 'android', 'app', 'build.gradle');
  if (fs.existsSync(appGradlePath)) {
    const m = fs.readFileSync(appGradlePath, 'utf8').match(/versionCode\s+(\d+)/);
    const gradleVersionCode = m ? Number(m[1]) : null;
    if (gradleVersionCode !== null && gradleVersionCode !== versionCode) {
      (willPrebuild ? ok : problems).push(
        willPrebuild
          ? `build.gradle says ${gradleVersionCode}, app.json says ${versionCode} — prebuild will resolve it`
          : `versionCode mismatch — the build would ship ${gradleVersionCode}, not ${versionCode}.\n` +
            `     app.json says ${versionCode}; android/app/build.gradle says ${gradleVersionCode}.\n` +
            '     Either regenerate the project at the current number:\n' +
            '       npm run prebuild:android\n' +
            '     or let the build bump past both — drop --no-bump and re-run.\n' +
            '     app.json is version-controlled, so a pull can move versionCode\n' +
            '     backwards past a local bump. Commit it after each release build.',
      );
    } else if (gradleVersionCode !== null) {
      ok.push(`android/app/build.gradle versionCode matches (${gradleVersionCode})`);
    }
  }
}

if (!expo?.version) {
  problems.push('app.json: expo.version is missing (the user-visible version name).');
} else {
  ok.push(`version: ${expo.version}`);
}

if (expo?.ios && !expo.ios.buildNumber) {
  warnings.push('app.json: expo.ios.buildNumber is not set (needed only for App Store uploads).');
}

// ── Environment baked into the bundle ───────────────────────────────────────
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
const prodEnvPath = path.join(root, '.env.production');
const prodEnv = parseEnvFile(prodEnvPath);

// Shell env wins over the file, so honour it as a valid way to configure.
const resolved = {};
for (const key of REQUIRED_VARS) {
  resolved[key] = process.env[key] || (prodEnv && prodEnv[key]) || null;
}

if (!prodEnv && !REQUIRED_VARS.every((k) => process.env[k])) {
  problems.push(
    '.env.production not found and the variables are not set in the shell.\n' +
      '     A release build would fall back to http://localhost:8080 and be unusable.\n' +
      '     Create .env.production with the real https:// / wss:// hosts.',
  );
}

for (const key of REQUIRED_VARS) {
  const value = resolved[key];
  if (!value) {
    if (prodEnv) problems.push(`${key} is not set for the production build.`);
    continue;
  }

  const isWs = key.includes('WS');
  const secureScheme = isWs ? 'wss://' : 'https://';

  if (/localhost|127\.0\.0\.1|10\.0\.2\.2|192\.168\./.test(value)) {
    problems.push(`${key} points at a local address ("${value}"). Vendors' phones cannot reach it.`);
  } else if (/example\.com/.test(value)) {
    problems.push(
      `${key} is still a PLACEHOLDER ("${value}"). Replace it with the real backend host.`,
    );
  } else if (!value.startsWith(secureScheme)) {
    problems.push(
      `${key} must start with ${secureScheme} ("${value}").\n` +
        '     iOS ATS and the Android cleartext policy block plain http/ws in release builds.',
    );
  } else {
    ok.push(`${key} = ${value}`);
  }
}

// ── Signing ─────────────────────────────────────────────────────────────────
// A release AAB signed with the shared debug keystore is REJECTED at upload
// ("signed in debug mode"), after the whole build. Catch it before Gradle runs.
const SIGNING_PROP = 'ZBR_UPLOAD_STORE_FILE';
const gradlePropsPaths = [
  path.join(os.homedir(), '.gradle', 'gradle.properties'),
  path.join(root, 'android', 'gradle.properties'),
];

let signingConfigured = Boolean(process.env[SIGNING_PROP] || process.env.ORG_GRADLE_PROJECT_ZBR_UPLOAD_STORE_FILE);
let keystorePath = process.env[SIGNING_PROP] || null;

// Also collect the alias and store password, needed to read the certificate
// fingerprint out of the keystore below.
let keyAlias = process.env.ZBR_UPLOAD_KEY_ALIAS || null;
let storePassword = process.env.ZBR_UPLOAD_STORE_PASSWORD || null;

for (const p of gradlePropsPaths) {
  const props = parseEnvFile(p);
  if (!props) continue;
  if (!signingConfigured && props[SIGNING_PROP]) {
    signingConfigured = true;
    keystorePath = props[SIGNING_PROP];
  }
  keyAlias = keyAlias || props.ZBR_UPLOAD_KEY_ALIAS || null;
  storePassword = storePassword || props.ZBR_UPLOAD_STORE_PASSWORD || null;
}

/**
 * The upload certificate Google Play expects for com.zbr.owner.
 *
 * Play pins the upload key on first upload and rejects anything signed with a
 * different one — "App Bundle signed with the wrong key", naming this
 * fingerprint. Nothing local knew what Play expected, so a mismatched keystore
 * was only discoverable after a full build and an upload.
 *
 * Not a secret: it is shown in Play Console → Setup → App signing, and is
 * derivable from any released artifact.
 *
 * If the upload key is ever reset (Play Console → App signing → Request upload
 * key reset, ~2 days), replace this value with the new fingerprint.
 */
const EXPECTED_UPLOAD_KEY_SHA1 = '11:3D:C7:A1:E3:F5:B4:D4:59:C6:ED:35:61:88:A8:6C:DB:22:16:40';

/** SHA-1 of the certificate in the configured keystore, or null if unreadable. */
function keystoreSha1() {
  if (!keystorePath || !keyAlias || !storePassword) return null;
  try {
    const { execFileSync } = require('child_process');
    // execFileSync, not a shell string: the password must never reach a command
    // line the shell could log or another process could read.
    const out = execFileSync(
      'keytool',
      ['-list', '-v', '-keystore', keystorePath, '-alias', keyAlias, '-storepass', storePassword],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    );
    const m = out.match(/SHA1:\s*([0-9A-F:]{59})/i);
    return m ? m[1].toUpperCase() : null;
  } catch {
    // keytool missing (no JAVA_HOME), wrong password, or unknown alias.
    return null;
  }
}

if (!signingConfigured) {
  problems.push(
    'No upload keystore configured — the release build would be signed with the\n' +
      '     DEBUG keystore and Play rejects it at upload ("signed in debug mode").\n' +
      `     Set ${SIGNING_PROP} (+ _KEY_ALIAS, _STORE_PASSWORD, _KEY_PASSWORD) in\n` +
      `     ${gradlePropsPaths[0]}\n` +
      '     See docs/LOCAL_BUILD.md §4.',
  );
} else {
  if (keystorePath && !fs.existsSync(keystorePath)) {
    problems.push(`${SIGNING_PROP} points at a file that does not exist: ${keystorePath}`);
  } else {
    ok.push(`Upload keystore configured${keystorePath ? ` (${keystorePath})` : ''}`);

    const sha1 = keystoreSha1();
    if (!sha1) {
      warnings.push(
        'Could not read the keystore fingerprint (keytool missing, or the alias/\n' +
          '     password properties are not set). Play checks it at upload, so a wrong\n' +
          '     keystore would only surface there.',
      );
    } else if (sha1 === EXPECTED_UPLOAD_KEY_SHA1) {
      ok.push(`Upload key matches the certificate Play expects (${sha1.slice(0, 17)}…)`);
    } else {
      problems.push(
        'This keystore is NOT the upload key Play expects for this app.\n' +
          `     Play wants:  ${EXPECTED_UPLOAD_KEY_SHA1}\n` +
          `     This key is: ${sha1}\n` +
          '     Play pins the upload certificate on first upload and rejects any\n' +
          '     other one. Either sign with the original keystore, or request an\n' +
          '     upload key reset in Play Console → Setup → App signing (takes about\n' +
          '     two days), then update EXPECTED_UPLOAD_KEY_SHA1 in this script.',
      );
    }
  }
}

// The generated project must actually reference that config.
const appGradle = path.join(root, 'android', 'app', 'build.gradle');
if (fs.existsSync(appGradle)) {
  const gradleSrc = fs.readFileSync(appGradle, 'utf8');
  const releaseBlock = gradleSrc.split(/buildTypes\s*\{/)[1] || '';
  const releaseUsesDebug = /release\s*\{[\s\S]*?signingConfig\s+signingConfigs\.debug/.test(releaseBlock);
  if (releaseUsesDebug) {
    problems.push(
      'android/app/build.gradle: buildTypes.release still uses signingConfigs.debug.\n' +
        '     Re-run `npm run prebuild:android` so plugins/withReleaseSigning.js applies.',
    );
  } else if (gradleSrc.includes('signingConfigs.release')) {
    ok.push('Release build type uses the release signing config');
  }
}

// ── Contact / legal destinations ────────────────────────────────────────────
// The privacy policy URL is a MANDATORY Play Console field and Google fetches
// it to confirm it resolves without a login. Everything else is optional, but a
// placeholder value is worse than an empty one: unset entries are hidden in the
// UI, whereas a fake one ships to vendors and 404s for reviewers.
const contactSrc = (() => {
  const p = path.join(root, 'constants', 'contact.ts');
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
})();

if (contactSrc) {
  const valueOf = (key) => {
    const m = contactSrc.match(new RegExp(`${key}:\\s*(null|'([^']*)'|"([^"]*)")`));
    if (!m || m[1] === 'null') return null;
    return m[2] ?? m[3] ?? null;
  };

  const PLACEHOLDER = /example\.com|example\.org|1-800-|zbr\.com|yourdomain|changeme|TODO|localhost/i;
  const CONTACT_KEYS = [
    'privacyPolicyUrl',
    'termsUrl',
    'licensesUrl',
    'dataDeletionUrl',
    'supportPhone',
    'supportEmail',
    'liveChatUrl',
  ];

  for (const key of CONTACT_KEYS) {
    const value = valueOf(key);
    if (!value) continue;
    if (PLACEHOLDER.test(value)) {
      problems.push(
        `constants/contact.ts: ${key} looks like a PLACEHOLDER ("${value}").\n` +
          '     Use the real value or set it back to null — null hides the row,\n' +
          '     a fake value ships to vendors and fails for Play reviewers.',
      );
    } else if (key.endsWith('Url') && !value.startsWith('https://')) {
      problems.push(`constants/contact.ts: ${key} must be an https:// URL ("${value}").`);
    } else {
      ok.push(`contact.${key} = ${value}`);
    }
  }

  if (!valueOf('privacyPolicyUrl')) {
    problems.push(
      'constants/contact.ts: privacyPolicyUrl is not set.\n' +
        '     Google Play REQUIRES a public, no-login privacy policy URL and fetches\n' +
        '     it during review. Publish docs/PRIVACY_POLICY.md and set it here and in\n' +
        '     Play Console → App content → Privacy policy.',
    );
  }
  if (!valueOf('supportEmail')) {
    warnings.push(
      'constants/contact.ts: supportEmail is not set — the Help Center contact\n' +
        '     cards stay hidden, and Play requires a public contact email on the listing.',
    );
  }
}

// ── Report ──────────────────────────────────────────────────────────────────
console.log('\nRelease configuration check\n' + '─'.repeat(50));
for (const line of ok) console.log(`  ok       ${line}`);
for (const line of warnings) console.log(`  WARN     ${line}`);
for (const line of problems) console.log(`  PROBLEM  ${line}`);
console.log('─'.repeat(50));

if (problems.length) {
  console.log(`${problems.length} problem(s) must be fixed before building. See docs/LOCAL_BUILD.md\n`);
  process.exit(1);
}
console.log(
  warnings.length
    ? `No blocking problems, ${warnings.length} warning(s).\n`
    : 'Release configuration looks good.\n',
);
