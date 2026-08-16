#!/usr/bin/env node
/**
 * Preflight check for push-notification configuration.
 *
 * Catches the misconfigurations that make push fail SILENTLY — the app builds,
 * installs and runs, but no notification ever arrives and there is no error to
 * chase. The big one is a google-services.json whose package_name doesn't match
 * the app: FCM happily issues a token for the wrong app and every send is
 * dropped on the floor.
 *
 * Usage: npm run check:push
 *
 * Exit codes: 0 = ok (or not configured yet, with warnings), 1 = broken config.
 */

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const problems = [];
const warnings = [];
const ok = [];

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

// ── app.json ────────────────────────────────────────────────────────────────
const appJsonPath = path.join(root, 'app.json');
let expo;
try {
  expo = readJson(appJsonPath).expo;
} catch (e) {
  console.error(`Cannot read app.json: ${e.message}`);
  process.exit(1);
}

const androidPackage = expo?.android?.package;
const iosBundleId = expo?.ios?.bundleIdentifier;

if (!androidPackage) problems.push('app.json: expo.android.package is missing.');
if (!iosBundleId) problems.push('app.json: expo.ios.bundleIdentifier is missing.');

// ── Android: google-services.json ───────────────────────────────────────────
const gsPath = path.join(root, 'google-services.json');
if (!fs.existsSync(gsPath)) {
  warnings.push(
    'google-services.json is MISSING — Android push cannot work and ' +
      '`eas build -p android` will fail.\n' +
      '     Firebase console → Project settings → Your apps → Android app ' +
      `(package "${androidPackage}") → download google-services.json\n` +
      `     → save it to ${gsPath}`,
  );
} else {
  let gs;
  try {
    gs = readJson(gsPath);
  } catch (e) {
    problems.push(`google-services.json is not valid JSON: ${e.message}`);
  }

  if (gs) {
    const clients = Array.isArray(gs.client) ? gs.client : [];
    const packages = clients
      .map((c) => c?.client_info?.android_client_info?.package_name)
      .filter(Boolean);

    if (packages.length === 0) {
      problems.push('google-services.json has no client[].client_info.android_client_info.package_name.');
    } else if (!packages.includes(androidPackage)) {
      problems.push(
        `google-services.json is for the WRONG APP.\n` +
          `     app.json android.package : ${androidPackage}\n` +
          `     google-services.json has : ${packages.join(', ')}\n` +
          '     FCM would issue tokens for a different app and every push would be ' +
          'silently dropped. Re-download the file for the correct Android app.',
      );
    } else {
      ok.push(`google-services.json matches package ${androidPackage}`);
    }

    const projectId = gs.project_info?.project_id;
    if (projectId) {
      ok.push(`Firebase project: ${projectId}`);
    } else {
      problems.push('google-services.json is missing project_info.project_id.');
    }

    const matching = clients.find(
      (c) => c?.client_info?.android_client_info?.package_name === androidPackage,
    );
    const hasApiKey = matching?.api_key?.some?.((k) => k?.current_key);
    if (matching && !hasApiKey) {
      problems.push('google-services.json: the matching client has no api_key.current_key.');
    }
  }
}

// ── expo-notifications plugin: bundled sound ────────────────────────────────
const plugins = Array.isArray(expo?.plugins) ? expo.plugins : [];
const notifPlugin = plugins.find(
  (p) => p === 'expo-notifications' || (Array.isArray(p) && p[0] === 'expo-notifications'),
);

if (!notifPlugin) {
  problems.push('app.json: the expo-notifications plugin is not configured.');
} else if (Array.isArray(notifPlugin)) {
  const opts = notifPlugin[1] || {};
  const sounds = Array.isArray(opts.sounds) ? opts.sounds : [];

  if (sounds.length === 0) {
    warnings.push('app.json: expo-notifications has no `sounds` — the custom alarm tone will not be bundled.');
  }

  for (const rel of sounds) {
    const soundPath = path.join(root, rel);
    const base = path.basename(rel);

    if (!fs.existsSync(soundPath)) {
      problems.push(`Bundled sound not found: ${rel}`);
      continue;
    }
    // Android copies these into res/raw/, where names may only contain
    // lowercase letters, digits and underscores. A hyphen breaks the build.
    if (!/^[a-z0-9_]+\.[a-z0-9]+$/.test(base)) {
      problems.push(
        `Sound "${base}" is not a valid Android resource name.\n` +
          '     Use only lowercase letters, digits and underscores (e.g. new_order.wav).',
      );
    } else {
      ok.push(`Bundled sound ok: ${base}`);
    }
  }

  // The channel the backend targets must be the one the app creates.
  const notificationsSrc = path.join(root, 'utils', 'notifications.ts');
  if (fs.existsSync(notificationsSrc)) {
    const src = fs.readFileSync(notificationsSrc, 'utf8');
    const m = src.match(/ORDERS_CHANNEL\s*=\s*['"]([^'"]+)['"]/);
    const codeChannel = m && m[1];
    if (codeChannel && opts.defaultChannel && codeChannel !== opts.defaultChannel) {
      problems.push(
        `Channel id mismatch — notifications would use a default-sound channel.\n` +
          `     app.json defaultChannel      : ${opts.defaultChannel}\n` +
          `     utils/notifications.ts       : ${codeChannel}\n` +
          "     These must match, and so must the backend's android.notification.channel_id.",
      );
    } else if (codeChannel) {
      ok.push(`Orders channel: ${codeChannel} (backend must send this as channel_id)`);
    }
  }
}

// ── EAS project id ──────────────────────────────────────────────────────────
if (!expo?.extra?.eas?.projectId) {
  warnings.push(
    'app.json has no extra.eas.projectId — run `eas init`. Required for EAS builds.',
  );
} else {
  ok.push(`EAS projectId: ${expo.extra.eas.projectId}`);
}

// ── iOS ─────────────────────────────────────────────────────────────────────
// iOS uses APNs DIRECTLY (not FCM), so no GoogleService-Info.plist is needed.
const entitlements = expo?.ios?.entitlements || {};
if (!entitlements['aps-environment']) {
  warnings.push('app.json: ios.entitlements["aps-environment"] is not set — iOS push will not be enabled.');
} else {
  ok.push(`iOS aps-environment: ${entitlements['aps-environment']}`);
}
const backgroundModes = expo?.ios?.infoPlist?.UIBackgroundModes || [];
if (!backgroundModes.includes('remote-notification')) {
  warnings.push('app.json: ios.infoPlist.UIBackgroundModes is missing "remote-notification".');
}

// ── Report ──────────────────────────────────────────────────────────────────
console.log('\nPush configuration check\n' + '─'.repeat(50));
for (const line of ok) console.log(`  ok       ${line}`);
for (const line of warnings) console.log(`  WARN     ${line}`);
for (const line of problems) console.log(`  PROBLEM  ${line}`);

console.log('─'.repeat(50));
if (problems.length) {
  console.log(`${problems.length} problem(s) must be fixed. See docs/PUSH_SETUP.md\n`);
  process.exit(1);
}
if (warnings.length) {
  console.log(`No blocking problems, ${warnings.length} warning(s). See docs/PUSH_SETUP.md\n`);
} else {
  console.log('Push configuration looks complete.\n');
}
