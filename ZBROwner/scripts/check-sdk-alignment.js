#!/usr/bin/env node
/**
 * Fail if any expo-* package is off the installed SDK's major line.
 *
 * This exists because of a real, expensive failure. `expo-audio` declares
 * `peerDependencies: { "expo-asset": "*" }`. npm auto-installs peer
 * dependencies, `*` resolved to the newest PUBLISHED expo-asset — 57.0.15,
 * from a later SDK — and hoisted it above the 55.0.10 that `expo` itself
 * depends on. Nothing failed at install, nothing failed at typecheck, nothing
 * failed at lint, and the archive built and uploaded cleanly.
 *
 * On device the JS then asked for a native module the SDK 55 binary had never
 * registered:
 *
 *     Error: Cannot find native module 'ExpoAsset'
 *     Invariant Violation: "main" has not been registered
 *
 * which reaches the user as a blank white screen. App Review rejected the build
 * for it (Guideline 2.1(a)).
 *
 * A mismatched major is not always fatal, but it is never intentional here, and
 * the failure it causes is invisible until the app runs on a device.
 *
 * Usage: npm run check:sdk
 */

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const modules = path.join(root, 'node_modules');

const versionOf = (name) => {
  const p = path.join(modules, name, 'package.json');
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8')).version ?? null;
  } catch {
    return null;
  }
};

const expoVersion = versionOf('expo');
if (!expoVersion) {
  console.error('\nexpo is not installed — run npm install.\n');
  process.exit(1);
}

const sdkMajor = parseInt(expoVersion, 10);
const mismatched = [];
let checked = 0;

for (const name of fs.readdirSync(modules)) {
  // Only the versioned expo-* line. @expo/* scoped packages (vector-icons,
  // config-plugins) version independently and would be false positives.
  if (name !== 'expo' && !name.startsWith('expo-')) continue;
  const version = versionOf(name);
  if (!version) continue;
  checked += 1;
  const major = parseInt(version, 10);
  if (Number.isFinite(major) && major !== sdkMajor) {
    mismatched.push({ name, version });
  }
}

// A nested copy is how the hoisting problem shows itself: the correct version
// pushed down under expo/ while a newer one sits at the top level.
const nested = [];
const nestedDir = path.join(modules, 'expo', 'node_modules');
if (fs.existsSync(nestedDir)) {
  for (const name of fs.readdirSync(nestedDir)) {
    if (!name.startsWith('expo-')) continue;
    const top = versionOf(name);
    const inner = (() => {
      const p = path.join(nestedDir, name, 'package.json');
      try {
        return JSON.parse(fs.readFileSync(p, 'utf8')).version ?? null;
      } catch {
        return null;
      }
    })();
    if (top && inner && top !== inner) nested.push({ name, top, inner });
  }
}

console.log(`\nExpo SDK alignment check\n${'─'.repeat(50)}`);
console.log(`  expo ${expoVersion} — checked ${checked} expo-* packages`);

if (!mismatched.length && !nested.length) {
  console.log(`  ok       every expo-* package is on the ${sdkMajor}.x line`);
  console.log('─'.repeat(50));
  console.log('SDK alignment looks good.\n');
  process.exit(0);
}

for (const { name, version } of mismatched) {
  console.log(
    `  PROBLEM  ${name}@${version} is not on the ${sdkMajor}.x line.\n` +
      `           Pin it to the SDK version:  npx expo install ${name}`,
  );
}
for (const { name, top, inner } of nested) {
  console.log(
    `  PROBLEM  ${name} is installed twice — ${top} at the top level, ${inner}\n` +
      `           under expo/. The hoisted copy wins at runtime and its native\n` +
      `           module may not exist in this build.\n` +
      `           Fix with:  npx expo install ${name}`,
  );
}

console.log('─'.repeat(50));
console.log(
  'A skewed package builds and uploads cleanly, then fails on device with\n' +
    '"Cannot find native module" and a blank screen. Fix before building.\n',
);
process.exit(1);
