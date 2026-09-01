#!/usr/bin/env node
/**
 * One command to archive and upload an iOS build to App Store Connect.
 *
 * The Android counterpart is go-live.js; the gate list is deliberately the
 * same, because the JS bundle and its baked-in EXPO_PUBLIC_* values are shared.
 * What differs is everything after the gates: xcodebuild instead of Gradle, and
 * an actual upload step, since App Store Connect has no "drag the file in"
 * equivalent to the Play Console upload box.
 *
 *   config      wrong host, duplicate build number, dev APNs entitlement
 *   push        google-services.json / APNs sanity (shared with Android)
 *   privacy     a policy URL that 200s but serves no policy
 *   typecheck / tests / lint
 *   bump        buildNumber +1 (App Store Connect rejects a duplicate)
 *   prebuild    regenerates ios/ so it cannot be stale
 *   pods        CocoaPods install
 *   archive     xcodebuild archive
 *   export      xcodebuild -exportArchive -> .ipa
 *   upload      xcrun altool --upload-app
 *
 * Usage — prefer the named scripts, npm mangles `-- --flag`:
 *   npm run go-live:ios             gates -> archive -> upload to App Store Connect
 *   npm run go-live:ios:checks      gates only, no build (runs anywhere)
 *   npm run go-live:ios:no-upload   archive and export an .ipa, upload manually
 *   npm run go-live:ios:no-bump     rebuild without consuming a build number
 *
 * Requires macOS with Xcode, plus ZBR_APPLE_TEAM_ID, ZBR_ASC_KEY_ID and
 * ZBR_ASC_ISSUER_ID — see docs/APP_STORE_SUBMISSION.md.
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { KEY_DIRS, findAscKey } = require('./lib/asc-key');

const root = path.resolve(__dirname, '..');
const args = process.argv.slice(2);

// npm parses unknown dashed args as its own config and drops them before the
// script sees them, leaving npm_config_<name> behind. See go-live.js.
function hasFlag(name) {
  if (args.includes(`--${name}`)) return true;
  if (name.startsWith('no-')) {
    return process.env[`npm_config_${name.slice(3).replace(/-/g, '_')}`] === 'false';
  }
  const env = process.env[`npm_config_${name.replace(/-/g, '_')}`];
  return env === 'true' || env === '';
}

const checksOnly = hasFlag('checks');
const skipUpload = hasFlag('no-upload');
const skipPrivacy = hasFlag('skip-privacy');

const C = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m',
};

const warnings = [];

const shellQuote = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;

/**
 * Reprint the `error:` lines from a saved log.
 *
 * xcodebuild emits thousands of lines and puts the failure in the middle, then
 * buries it under a wall of "Run script build phase … will be run during every
 * build" notes. By the time it stops, the actual error has scrolled out of the
 * terminal — so the last thing printed must be the errors, not the notes.
 */
function summarizeErrors(logPath) {
  let log;
  try {
    log = fs.readFileSync(logPath, 'utf8');
  } catch {
    return;
  }
  const seen = new Set();
  for (const line of log.split('\n')) {
    // "note:" and "warning:" are noise; only "error:" stops a build.
    if (!/(^|\s)error:/.test(line) || /\berror: 0\b/.test(line)) continue;
    const trimmed = line.trim();
    if (!seen.has(trimmed)) seen.add(trimmed);
  }
  if (!seen.size) {
    console.error(`${C.dim}  No "error:" line in the log — full output: ${logPath}${C.reset}`);
    return;
  }
  console.error(`\n${C.bold}The actual error${seen.size > 1 ? 's' : ''}:${C.reset}`);
  for (const line of [...seen].slice(0, 12)) console.error(`  ${C.red}${line}${C.reset}`);
  if (seen.size > 12) console.error(`${C.dim}  …and ${seen.size - 12} more${C.reset}`);
  console.error(`${C.dim}  Full log: ${logPath}${C.reset}`);
}

function run(label, cmd, cmdArgs, opts = {}) {
  process.stdout.write(`${C.cyan}▸${C.reset} ${C.bold}${label}${C.reset}\n`);

  // With logPath the command still streams to the terminal, via tee, and is
  // saved so the failure can be extracted afterwards. pipefail is required or
  // the exit status would be tee's, which is always 0.
  const res = opts.logPath
    ? spawnSync(
        'bash',
        [
          '-c',
          `set -o pipefail; ${[cmd, ...cmdArgs].map(shellQuote).join(' ')} 2>&1 | tee ${shellQuote(opts.logPath)}`,
        ],
        { cwd: opts.cwd || root, stdio: 'inherit' },
      )
    : spawnSync(cmd, cmdArgs, {
        cwd: opts.cwd || root,
        stdio: 'inherit',
        shell: opts.shell ?? false,
      });

  if (res.status !== 0) {
    if (opts.nonFatal) {
      console.warn(`${C.yellow}⚠ ${label} — continuing (${opts.nonFatal})${C.reset}\n`);
      warnings.push(label);
      return;
    }
    console.error(`\n${C.red}✖ FAILED: ${label}${C.reset}`);
    if (opts.logPath) summarizeErrors(opts.logPath);
    console.error(`${C.dim}\n  Nothing was uploaded. Fix the above and re-run.${C.reset}\n`);
    process.exit(res.status || 1);
  }
  console.log(`${C.green}✔${C.reset} ${label}\n`);
}

console.log(`\n${C.bold}ZBR Owner — iOS release${C.reset}`);
console.log(
  `${C.dim}${
    checksOnly ? 'checks only (no build)' : skipUpload ? 'archive + export, no upload' : 'archive -> App Store Connect'
  }${C.reset}`,
);
if (skipPrivacy) console.log(`${C.yellow}--skip-privacy: the policy URL check will warn, not block${C.reset}`);
console.log('');

// ── gates ───────────────────────────────────────────────────────────────────
// checksOnly is allowed to run on Linux/Windows so the config can be validated
// away from the Mac; anything past the gates genuinely needs Xcode.
run('iOS release configuration', 'node', [
  'scripts/check-ios-release.js',
  // Tells the check that this run stops at an .ipa, so missing upload
  // credentials warn instead of blocking.
  ...(skipUpload ? ['--no-upload'] : []),
  // A build run regenerates ios/ a few steps below, so state already in the
  // native project is about to be overwritten. --checks stops before that and
  // must keep judging the project as it stands.
  ...(checksOnly ? [] : ['--will-prebuild']),
], {
  nonFatal: checksOnly && process.platform !== 'darwin' ? 'not on macOS, checks-only run' : undefined,
});
// Only meaningful with an API key, and it costs a network round trip — but it
// is the only check that can prove ZBR_APPLE_TEAM_ID is the team the credential
// actually belongs to. A wrong team id is indistinguishable from a missing
// Xcode account in xcodebuild's output, and costs a full archive to discover.
if (process.env.ZBR_ASC_KEY_ID) {
  run('App Store Connect credentials', 'node', ['scripts/check-asc-key.js']);
}
run('Push configuration', 'node', ['scripts/check-push-config.js']);
run('Privacy policy URL serves a real policy', 'node', ['scripts/check-privacy-url.js'], {
  nonFatal: skipPrivacy ? '--skip-privacy: policy handled in App Store Connect' : undefined,
});
run('TypeScript', 'npx', ['tsc', '--noEmit'], { shell: true });
run('Tests', 'npx', ['jest', '--ci', '--runInBand'], { shell: true });
run('Lint', 'npx', ['eslint', '.'], { shell: true });

if (checksOnly) {
  console.log(`${C.green}${C.bold}All gates passed.${C.reset} Re-run without --checks to build.\n`);
  process.exit(0);
}

if (process.platform !== 'darwin') {
  console.error(`\n${C.red}✖ An iOS archive requires macOS with Xcode.${C.reset}\n`);
  process.exit(1);
}

// ── build ───────────────────────────────────────────────────────────────────
// Logs live alongside the artifacts, outside ios/ which prebuild --clean wipes.
const logDir = path.join(root, 'build', 'ios', 'logs');
fs.mkdirSync(logDir, { recursive: true });
const logFor = (name) => path.join(logDir, `${name}.log`);

// Bump BEFORE prebuild: Xcode stamps the archive from Info.plist, which
// prebuild generates from app.json.
if (!hasFlag('no-bump')) {
  run('Bumping buildNumber (+1)', 'node', ['scripts/bump-version-code.js']);
} else {
  console.log(`${C.yellow}▸ Skipping buildNumber bump (--no-bump)${C.reset}\n`);
}

// --no-install skips the npm install AND the pod install that prebuild would
// otherwise run for us. node_modules is already present (tsc, jest and eslint
// just ran out of it), so the npm step is pure waste, and it is the step that
// looks hung: it prints nothing for minutes. Pods are run explicitly below, so
// without this flag they would be installed twice.
run('Regenerating ios/ from app.json', 'npx', [
  'expo', 'prebuild', '--platform', 'ios', '--clean', '--no-install',
], { shell: true });

// prebuild generates the .xcodeproj; the .xcworkspace is created by CocoaPods.
// So the scheme name has to come from the project here, and the workspace can
// only be looked for AFTER pod install.
const iosDir = path.join(root, 'ios');
const project = fs.readdirSync(iosDir).find((f) => f.endsWith('.xcodeproj'));
if (!project) {
  console.error(`\n${C.red}✖ No .xcodeproj in ios/ after prebuild.${C.reset}\n`);
  process.exit(1);
}
const scheme = project.replace('.xcodeproj', '');
console.log(`${C.dim}  scheme: ${scheme}${C.reset}\n`);

// The first run on a machine clones the CocoaPods spec repo and can sit with no
// output for several minutes. That is normal, so say so before it starts rather
// than leaving it looking hung.
console.log(
  `${C.dim}  The first pod install on a machine downloads the spec repo — several\n` +
    `  minutes with little output is normal. Later runs are fast.${C.reset}`,
);
run('CocoaPods install', 'pod', ['install'], { cwd: iosDir, logPath: logFor('pod-install') });

const workspace = fs.readdirSync(iosDir).find((f) => f.endsWith('.xcworkspace'));
if (!workspace) {
  console.error(
    `\n${C.red}✖ No .xcworkspace in ios/ after pod install.${C.reset}\n` +
      `${C.dim}  CocoaPods creates it. Check the pod install output above.${C.reset}\n`,
  );
  process.exit(1);
}
console.log(`${C.dim}  workspace: ${workspace}${C.reset}\n`);

// Everything generated lives OUTSIDE ios/, which `prebuild --clean` wipes.
const buildDir = path.join(root, 'build', 'ios');
fs.mkdirSync(buildDir, { recursive: true });

const archivePath = path.join(buildDir, `${scheme}.xcarchive`);
const exportPath = path.join(buildDir, 'ipa');

// `prebuild --clean` regenerates the project with no DEVELOPMENT_TEAM, so the
// team has to be supplied on the command line — setting it only in
// ExportOptions.plist is too late, that is read at export time and the archive
// fails first with "Signing for X requires a development team".
//
// -allowProvisioningUpdates lets Xcode create the distribution certificate and
// App Store provisioning profile on first use. It needs credentials for the
// developer portal: an App Store Connect API key if one is configured, and
// otherwise the Apple ID signed into Xcode (Settings -> Accounts), because an
// app-specific password authenticates uploads but not the portal.
//
// The key path comes from the shared helper the preflight also uses. These two
// once kept their own copies of the search list, the one here being a directory
// shorter — so a key in that directory passed the check and was then silently
// omitted from the xcodebuild command, which failed with 'No Account for Team'
// as though no key existed at all.
const ascKeyPath = findAscKey(process.env.ZBR_ASC_KEY_ID);

if (process.env.ZBR_ASC_KEY_ID && !ascKeyPath) {
  console.error(
    `\n${C.red}\u2716 ZBR_ASC_KEY_ID is set but AuthKey_${process.env.ZBR_ASC_KEY_ID}.p8 was not found.${C.reset}`,
  );
  console.error(`${C.dim}  Looked in:\n${KEY_DIRS.map((d) => `    ${d}`).join('\n')}${C.reset}\n`);
  process.exit(1);
}

console.log(
  `${C.dim}  Portal auth: ${
    ascKeyPath ? `API key ${ascKeyPath}` : "Xcode's signed-in account (no API key configured)"
  }${C.reset}`,
);

run('Archiving', 'xcodebuild', [
  '-workspace', path.join(iosDir, workspace),
  '-scheme', scheme,
  '-configuration', 'Release',
  '-destination', 'generic/platform=iOS',
  '-archivePath', archivePath,
  '-allowProvisioningUpdates',
  ...(ascKeyPath
    ? [
        '-authenticationKeyPath', ascKeyPath,
        '-authenticationKeyID', process.env.ZBR_ASC_KEY_ID,
        '-authenticationKeyIssuerID', process.env.ZBR_ASC_ISSUER_ID,
      ]
    : []),
  `DEVELOPMENT_TEAM=${process.env.ZBR_APPLE_TEAM_ID}`,
  'CODE_SIGN_STYLE=Automatic',
  'archive',
], { logPath: logFor('archive') });

// Written fresh each run so a changed team id can never be served from a stale
// file, and because ios/ is not the place for it — prebuild --clean deletes it.
const exportOptions = path.join(buildDir, 'ExportOptions.plist');
fs.writeFileSync(
  exportOptions,
  `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key><string>app-store-connect</string>
  <key>teamID</key><string>${process.env.ZBR_APPLE_TEAM_ID}</string>
  <key>signingStyle</key><string>automatic</string>
  <key>uploadSymbols</key><true/>
  <key>destination</key><string>export</string>
</dict>
</plist>
`,
);

run('Exporting .ipa', 'xcodebuild', [
  '-exportArchive',
  '-archivePath', archivePath,
  '-exportOptionsPlist', exportOptions,
  '-exportPath', exportPath,
], { logPath: logFor('export') });

const ipa = fs.existsSync(exportPath)
  ? fs.readdirSync(exportPath).find((f) => f.endsWith('.ipa'))
  : null;
if (!ipa) {
  console.error(`\n${C.red}✖ No .ipa produced in ${exportPath}${C.reset}\n`);
  process.exit(1);
}
const ipaPath = path.join(exportPath, ipa);
const mb = (fs.statSync(ipaPath).size / 1024 / 1024).toFixed(1);

if (skipUpload) {
  console.log(`${C.green}${C.bold}Archive complete.${C.reset}`);
  console.log(`  ${ipaPath}  ${C.dim}(${mb} MB)${C.reset}`);
  console.log(`${C.dim}  Upload it with Transporter.app, or re-run without --no-upload.${C.reset}\n`);
  process.exit(0);
}

// altool --upload-app targets App Store Connect. notarytool is NOT the
// replacement for it — that superseded altool's notarization subcommands only,
// and talks to the notary service, which has nothing to do with the App Store.
//
// Either credential form works; check-ios-release.js has already established
// that one of them is complete. The password is passed via @env: so it is read
// from the environment by altool itself and never appears in the process list.
const auth = process.env.ZBR_ASC_KEY_ID
  ? ['--apiKey', process.env.ZBR_ASC_KEY_ID, '--apiIssuer', process.env.ZBR_ASC_ISSUER_ID]
  : ['-u', process.env.ZBR_APPLE_ID, '-p', '@env:ZBR_APP_SPECIFIC_PASSWORD'];

run('Uploading to App Store Connect', 'xcrun', [
  'altool', '--upload-app', '-f', ipaPath, '-t', 'ios', ...auth,
], { logPath: logFor('upload') });

const appJson = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8')).expo;

console.log(`${C.green}${C.bold}Uploaded.${C.reset}`);
console.log(`  ${ipaPath}  ${C.dim}(${mb} MB)${C.reset}`);
console.log(`  version ${appJson.version} (${appJson.ios.buildNumber})\n`);
if (warnings.length) {
  console.log(`${C.yellow}  Not enforced this run: ${warnings.join(', ')}${C.reset}`);
  console.log(`${C.yellow}  The binary is fine; these are review-time concerns.${C.reset}\n`);
}

console.log(`${C.bold}Next — these cannot be verified from here:${C.reset}`);
console.log('  • Processing takes 5-30 min. Watch App Store Connect → TestFlight;');
console.log('    a failure arrives by email, not in this terminal.');
console.log('  • Export compliance is pre-answered by ITSAppUsesNonExemptEncryption.');
console.log(`  • ${C.yellow}Account deletion (Guideline 5.1.1(v)) needs the backend endpoint${C.reset}`);
console.log('    DELETE /api/v1/auth/account. A reviewer WILL walk that flow.');
console.log('  • App Privacy answers and the demo account: docs/APP_STORE_SUBMISSION.md.');
console.log(`\n${C.dim}Ship to TestFlight first — no review delay for internal testers.${C.reset}\n`);
