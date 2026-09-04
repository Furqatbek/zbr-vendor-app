#!/usr/bin/env node
/**
 * One command to produce an upload-ready release AAB.
 *
 * Runs every gate in order and STOPS at the first failure, so a build that
 * would be rejected — or worse, accepted while pointing at the wrong backend —
 * never reaches Play. Each gate here exists because it caught a real problem:
 *
 *   config      wrong/placeholder host, missing versionCode, debug signing
 *   push        google-services.json for the wrong package (silent no-delivery)
 *   privacy     a policy URL that 200s but serves no policy (review rejection)
 *   typecheck   the strict flags that surfaced real null bugs
 *   tests       order state machine + API mapping
 *   lint        errors only
 *   prebuild    regenerates android/ so it can't be stale
 *   build       the AAB itself
 *
 * Usage — prefer these, they cannot be mangled by npm's argument parsing:
 *   npm run go-live                full run, ends with an AAB
 *   npm run go-live:checks         gates only, no build (safe to run anytime)
 *   npm run go-live:apk            build an APK instead (device testing)
 *   npm run go-live:no-privacy     don't let the policy URL block the build
 *   npm run go-live:no-bump        rebuild without consuming a versionCode
 *
 * Cross-platform: uses gradlew.bat on Windows and ./gradlew elsewhere.
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
/**
 * `npm run go-live -- --skip-privacy` does NOT reliably reach this script: npm
 * parses unknown dashed args as its OWN config and warns
 * "Unknown cli config", so argv arrives empty and the flag is silently ignored.
 * It does export what it swallowed as `npm_config_<name>` with dashes turned
 * into underscores, so read that too — the command works as typed either way.
 * The dedicated `go-live:*` package scripts avoid the problem entirely.
 */
function hasFlag(name) {
  if (args.includes(`--${name}`)) return true;
  // npm normalises "--no-bump" to bump=false rather than no_bump=true.
  if (name.startsWith('no-')) {
    return process.env[`npm_config_${name.slice(3).replace(/-/g, '_')}`] === 'false';
  }
  const env = process.env[`npm_config_${name.replace(/-/g, '_')}`];
  return env === 'true' || env === '';
}

const checksOnly = hasFlag('checks');
const wantApk = hasFlag('apk');
const skipPrivacy = hasFlag('skip-privacy');
const isWindows = process.platform === 'win32';

const C = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m',
};

const warnings = [];

function run(label, cmd, cmdArgs, opts = {}) {
  process.stdout.write(`${C.cyan}▸${C.reset} ${C.bold}${label}${C.reset}\n`);
  const res = spawnSync(cmd, cmdArgs, {
    cwd: opts.cwd || root,
    stdio: 'inherit',
    shell: opts.shell ?? isWindows, // npm/npx need a shell on Windows
  });
  if (res.status !== 0) {
    if (opts.nonFatal) {
      console.warn(`${C.yellow}⚠ ${label} — continuing (${opts.nonFatal})${C.reset}\n`);
      warnings.push(label);
      return;
    }
    console.error(`\n${C.red}✖ FAILED: ${label}${C.reset}`);
    console.error(`${C.dim}  Nothing was built. Fix the above and re-run.${C.reset}\n`);
    process.exit(res.status || 1);
  }
  console.log(`${C.green}✔${C.reset} ${label}\n`);
}

const npx = isWindows ? 'npx.cmd' : 'npx';

console.log(`\n${C.bold}ZBR Owner — release gate${C.reset}`);
console.log(`${C.dim}${checksOnly ? 'checks only (no build)' : wantApk ? 'building APK' : 'building AAB for Play'}${C.reset}`);
if (skipPrivacy) console.log(`${C.yellow}--skip-privacy: the policy URL check will warn, not block${C.reset}`);
console.log('');

// ── gates ───────────────────────────────────────────────────────────────────
run('Release + push configuration', 'node', ['scripts/check-release-config.js']);
// A package off the SDK's major line builds and uploads cleanly, then fails
// on device with "Cannot find native module" and a blank screen. Nothing
// else in this gate list can see it.
run('Expo SDK alignment', 'node', ['scripts/check-sdk-alignment.js']);
run('Push configuration', 'node', ['scripts/check-push-config.js']);
// The privacy policy blocks Play REVIEW, not the correctness of the binary, so
// it is downgraded to a warning when the artifact isn't going to Play (--apk)
// or when the policy is being handled outside this repo (--skip-privacy).
// Either way it still RUNS and still prints — silence would be worse than a
// warning, because the failure mode is invisible in a browser.
run('Privacy policy URL serves a real policy', 'node', ['scripts/check-privacy-url.js'], {
  nonFatal: wantApk
    ? 'APK is for device testing, not Play upload'
    : skipPrivacy
      ? '--skip-privacy: policy handled in Play Console'
      : undefined,
});
run('TypeScript', npx, ['tsc', '--noEmit']);
run('Tests', npx, ['jest', '--ci', '--runInBand']);
run('Lint', npx, ['eslint', '.']);

if (checksOnly) {
  console.log(`${C.green}${C.bold}All gates passed.${C.reset} Re-run without --checks to build.\n`);
  process.exit(0);
}

// ── build ───────────────────────────────────────────────────────────────────
// Bump BEFORE prebuild so the generated native project carries the new number —
// Gradle stamps the AAB from android/app/build.gradle, not from app.json.
if (!hasFlag('no-bump')) {
  run('Bumping versionCode (+1)', 'node', ['scripts/bump-version-code.js']);
} else {
  console.log(`${C.yellow}▸ Skipping versionCode bump (--no-bump)${C.reset}\n`);
}

// --no-install skips the npm install prebuild would otherwise run. node_modules
// is already present (tsc, jest and eslint just ran out of it), so it is pure
// waste — and it is the step that looks hung, printing nothing for minutes.
run('Regenerating android/ from app.json', npx, [
  'expo', 'prebuild', '--platform', 'android', '--clean', '--no-install',
]);

const gradlew = isWindows ? 'gradlew.bat' : './gradlew';
const task = wantApk ? 'assembleRelease' : 'bundleRelease';
run(`Gradle ${task}`, gradlew, [task], { cwd: path.join(root, 'android'), shell: true });

const out = wantApk
  ? path.join(root, 'android/app/build/outputs/apk/release/app-release.apk')
  : path.join(root, 'android/app/build/outputs/bundle/release/app-release.aab');

console.log(`${C.green}${C.bold}Build complete.${C.reset}`);
if (warnings.length) {
  console.log(`${C.yellow}  Not enforced this run: ${warnings.join(', ')}${C.reset}`);
  console.log(`${C.yellow}  The binary is fine; these are review-time concerns.${C.reset}`);
}
if (fs.existsSync(out)) {
  const mb = (fs.statSync(out).size / 1024 / 1024).toFixed(1);
  console.log(`  ${out}  ${C.dim}(${mb} MB)${C.reset}\n`);
} else {
  console.log(`  ${C.yellow}Expected artifact not found at ${out}${C.reset}\n`);
}

// ── what the script cannot check ────────────────────────────────────────────
const appJson = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8')).expo;
console.log(`${C.bold}Before uploading — these cannot be verified automatically:${C.reset}`);
console.log(`  • versionCode is ${C.bold}${appJson.android.versionCode}${C.reset} — Play rejects a duplicate. Bump it if this
    number was already uploaded.`);
if (skipPrivacy || wantApk) {
  console.log('  • Play Console → Store listing → Privacy policy: the URL you enter is');
  console.log('    FETCHED during review. Re-run `npm run check:privacy-url` against it');
  console.log('    if you ever point it back at a single-page app.');
}
console.log('  • Play Console → App access: demo credentials present and the account');
console.log('    still logs in and has data on every screen.');
console.log('  • Screenshots uploaded for phone AND both tablet slots.');
console.log('  • Push verified on a real device: app force-killed, screen off.');
console.log(`\n${C.dim}Upload to Internal testing first — no review delay.${C.reset}\n`);
