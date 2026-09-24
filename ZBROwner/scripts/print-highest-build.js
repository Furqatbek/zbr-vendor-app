#!/usr/bin/env node
/**
 * Print the highest build number App Store Connect holds for this app.
 *
 * A separate process because go-live-ios.js is CommonJS and runs its steps
 * synchronously: top-level await is a syntax error there, and wrapping the
 * whole script in an async IIFE to accommodate one lookup would be worse.
 *
 * Prints nothing and exits 1 when the answer is unknown — no credentials, no
 * network, unknown app — so the caller falls back rather than treating silence
 * as zero.
 */

const fs = require('fs');
const path = require('path');
const { fetchHighestBuild } = require('./lib/asc-api');

(async () => {
  const appJson = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'app.json'), 'utf8'),
  ).expo;
  const highest = await fetchHighestBuild(appJson?.ios?.bundleIdentifier);
  if (highest === null) process.exit(1);
  process.stdout.write(String(highest));
})();
