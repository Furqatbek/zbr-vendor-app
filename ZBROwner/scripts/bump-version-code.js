#!/usr/bin/env node
/**
 * Increment android.versionCode by exactly 1 and keep ios.buildNumber in sync.
 *
 * Play rejects an upload whose versionCode it has already seen, and the number
 * must strictly INCREASE — it is not a version name and it is never reset.
 * EAS used to do this automatically; building locally means it is ours to own.
 *
 * Deliberately +1 rather than a timestamp or random value:
 *   - the sequence stays human-readable and auditable in git history
 *   - a large jump can never be walked back (Play remembers the highest ever
 *     uploaded, so an accidental 1700000000 burns every number below it forever)
 *
 * Run automatically by `npm run go-live` immediately BEFORE prebuild, so the
 * generated native project carries the new number. Skip with `--no-bump`.
 *
 * Usage:
 *   node scripts/bump-version-code.js            +1
 *   node scripts/bump-version-code.js --dry-run  show what would change
 *   node scripts/bump-version-code.js --to 42    set explicitly (must be higher)
 */

const fs = require('fs');
const path = require('path');

const appJsonPath = path.resolve(__dirname, '..', 'app.json');
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const toIndex = args.indexOf('--to');
const explicit = toIndex !== -1 ? Number(args[toIndex + 1]) : null;

const raw = fs.readFileSync(appJsonPath, 'utf8');
const config = JSON.parse(raw);
const expo = config.expo;

const current = expo?.android?.versionCode;
if (typeof current !== 'number' || !Number.isInteger(current) || current < 1) {
  console.error(
    `\napp.json: expo.android.versionCode must be a positive integer, got ${JSON.stringify(current)}.\n`,
  );
  process.exit(1);
}

let next;
if (explicit !== null) {
  if (!Number.isInteger(explicit) || explicit <= current) {
    console.error(
      `\n--to must be an integer greater than the current versionCode (${current}), got ${args[toIndex + 1]}.\n` +
        'versionCode must strictly increase — Play remembers the highest value ever uploaded.\n',
    );
    process.exit(1);
  }
  next = explicit;
} else {
  next = current + 1;
}

// Android caps versionCode at 2100000000.
if (next > 2100000000) {
  console.error('\nversionCode would exceed the Android maximum of 2100000000.\n');
  process.exit(1);
}

if (dryRun) {
  console.log(`\nversionCode ${current} -> ${next} (dry run, nothing written)\n`);
  process.exit(0);
}

expo.android.versionCode = next;
// Keep the iOS build number aligned so the two platforms never diverge.
if (expo.ios) expo.ios.buildNumber = String(next);

// Preserve the file's 2-space formatting and trailing newline.
fs.writeFileSync(appJsonPath, JSON.stringify(config, null, 2) + '\n');

console.log(`\nversionCode ${current} -> ${next}   (ios buildNumber ${next})`);
console.log('Commit app.json so the number is recorded against this release.\n');
