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

// ── Versioning (Play rejects duplicates / missing) ──────────────────────────
const versionCode = expo?.android?.versionCode;
if (typeof versionCode !== 'number' || !Number.isInteger(versionCode) || versionCode < 1) {
  problems.push(
    'app.json: expo.android.versionCode must be a positive integer. ' +
      'Play rejects an AAB without one.',
  );
} else {
  ok.push(`versionCode: ${versionCode} (must be HIGHER than any build already uploaded)`);
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

for (const p of gradlePropsPaths) {
  if (signingConfigured) break;
  const props = parseEnvFile(p);
  if (props && props[SIGNING_PROP]) {
    signingConfigured = true;
    keystorePath = props[SIGNING_PROP];
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
