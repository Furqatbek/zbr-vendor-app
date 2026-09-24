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

/** Duration and format of a PCM WAV, or null if it cannot be read. */
function describeWav(file) {
  try {
    const b = fs.readFileSync(file);
    if (b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WAVE') return null;
    let off = 12;
    let fmt = null;
    let dataLen = 0;
    while (off + 8 <= b.length) {
      const id = b.toString('ascii', off, off + 4);
      const size = b.readUInt32LE(off + 4);
      if (id === 'fmt ') {
        fmt = {
          channels: b.readUInt16LE(off + 10),
          sampleRate: b.readUInt32LE(off + 12),
          bitsPerSample: b.readUInt16LE(off + 22),
        };
      } else if (id === 'data') {
        dataLen = size;
      }
      off += 8 + size + (size % 2);
    }
    if (!fmt || !dataLen) return null;
    const bytesPerSecond = (fmt.sampleRate * fmt.channels * fmt.bitsPerSample) / 8;
    if (!bytesPerSecond) return null;
    return { ...fmt, seconds: dataLen / bytesPerSecond };
  } catch {
    return null;
  }
}

/** First match for a filename anywhere under dir, or null. */
function findFile(dir, name) {
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'Pods' && entry.name !== 'build') stack.push(full);
      } else if (entry.name === name) {
        return full;
      }
    }
  }
  return null;
}

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

      // A WAV that is corrupt, or longer than iOS allows, fails SILENTLY at
      // runtime: iOS substitutes the default sound and Android may refuse to
      // decode. Neither is a build error, so it has to be checked here.
      const wav = describeWav(soundPath);
      if (!wav) {
        problems.push(
          `${base} is not a readable PCM WAV. expo-notifications copies it\n` +
            '     verbatim; a broken file is only discovered when a push arrives.',
        );
      } else if (wav.seconds > 30) {
        problems.push(
          `${base} is ${wav.seconds.toFixed(1)}s. iOS ignores a custom notification\n` +
            '     sound longer than 30s and plays the default instead, so the alarm\n' +
            '     would silently revert. Shorten it (npm run build:alarm).',
        );
      } else {
        ok.push(
          `  ${wav.seconds.toFixed(1)}s, ${wav.sampleRate} Hz — under the 30s iOS limit`,
        );
      }

      // The generated native projects are where the file actually has to land.
      // Both have gone wrong before: a hyphenated name that never reached
      // res/raw, and a sound the channel referenced but the bundle lacked.
      const androidRaw = path.join(root, 'android', 'app', 'src', 'main', 'res', 'raw', base);
      if (fs.existsSync(path.join(root, 'android'))) {
        if (!fs.existsSync(androidRaw)) {
          problems.push(
            `${base} is missing from android/app/src/main/res/raw/.\n` +
              '     The channel would reference a resource that does not exist, so the\n' +
              '     notification arrives silent. Re-run npm run prebuild:android.',
          );
        } else if (
          !fs.readFileSync(androidRaw).equals(fs.readFileSync(soundPath))
        ) {
          problems.push(
            `${base} in res/raw/ differs from the asset — the native project is\n` +
              '     stale. Re-run npm run prebuild:android.',
          );
        } else {
          ok.push(`  bundled into android res/raw/`);
        }
      }

      const iosDir = path.join(root, 'ios');
      if (fs.existsSync(iosDir)) {
        const inIos = findFile(iosDir, base);
        if (!inIos) {
          problems.push(
            `${base} is missing from ios/. APNs names it in the payload, so the\n` +
              '     push would arrive with no sound. Re-run npm run prebuild:ios.',
          );
        } else {
          // Present on disk is not enough — it must be in the Resources build
          // phase or Xcode never copies it into the .app.
          const pbxproj = findFile(iosDir, 'project.pbxproj');
          const referenced = pbxproj
            ? fs.readFileSync(pbxproj, 'utf8').includes(base)
            : false;
          if (!referenced) {
            problems.push(
              `${base} exists in ios/ but is not referenced by the Xcode project,\n` +
                '     so it will not be copied into the app bundle.',
            );
          } else {
            ok.push(`  bundled into the iOS app`);
          }
        }
      }
    }
  }

  // Every `sound:` string the app sets on a channel must name a BUNDLED file.
  // Android resolves it against res/raw with the extension stripped, so a name
  // like 'default' silently resolves to nothing — the channel falls back to the
  // system sound and only a console error hints that anything is wrong.
  const notifSrc = path.join(root, 'utils', 'notifications.ts');
  if (fs.existsSync(notifSrc)) {
    const src = fs.readFileSync(notifSrc, 'utf8');
    const bundled = sounds.map((rel) => path.basename(rel).replace(/\.[^.]+$/, ''));
    for (const m of src.matchAll(/sound:\s*'([^']+)'/g)) {
      const value = m[1];
      // Skip identifiers/constants — only literal filenames are resolvable.
      const base = value.replace(/\.[^.]+$/, '');
      if (!bundled.includes(base)) {
        problems.push(
          `utils/notifications.ts sets sound: '${value}', which is not a bundled sound.\n` +
            `     Android strips the extension and looks for res/raw/${base} — it does not exist.\n` +
            `     Bundled: ${bundled.join(', ') || '(none)'}\n` +
            "     To use the system default, OMIT the sound key entirely.",
        );
      }
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
// Deliberately NOT required: it's only needed for EAS cloud builds or Expo's
// push service. This app builds locally and registers raw FCM/APNs device
// tokens, so no Expo project id is involved.
if (expo?.extra?.eas?.projectId) {
  ok.push(`EAS projectId: ${expo.extra.eas.projectId}`);
}

// ── iOS ─────────────────────────────────────────────────────────────────────
// iOS uses APNs DIRECTLY (not FCM), so no GoogleService-Info.plist is needed.
const entitlements = expo?.ios?.entitlements || {};
if (!entitlements['aps-environment']) {
  warnings.push('app.json: ios.entitlements["aps-environment"] is not set — iOS push will not be enabled.');
} else {
  ok.push(
    `iOS aps-environment: ${entitlements['aps-environment']} ` +
      '(default; override per build with APS_ENVIRONMENT=development — see app.config.js)',
  );
}
if (!entitlements['com.apple.developer.usernotifications.time-sensitive']) {
  warnings.push(
    'app.json: the time-sensitive entitlement is not set — iOS alerts will not ' +
      'break through Focus / Do Not Disturb.',
  );
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
