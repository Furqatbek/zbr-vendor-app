const fs = require('fs');
const os = require('os');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');

/**
 * Locate the App Store Connect API private key.
 *
 * Shared by check-ios-release.js and go-live-ios.js because they MUST agree.
 * They previously kept separate copies of this list, the build script's being
 * one directory shorter — so a key in the third location made the preflight
 * report "API key configured" while the archive silently ran with no
 * authentication flags and failed with 'No Account for Team "X"'. A green
 * check and a build that ignores the key is the worst possible combination.
 *
 * Order matters only in that the first hit wins; ~/.appstoreconnect is the
 * conventional location and is listed first.
 */
const KEY_DIRS = [
  path.join(os.homedir(), '.appstoreconnect', 'private_keys'),
  path.join(os.homedir(), 'private_keys'),
  path.join(root, 'private_keys'),
];

/** Absolute path to AuthKey_<keyId>.p8, or null. */
function findAscKey(keyId) {
  if (!keyId) return null;
  const name = `AuthKey_${keyId}.p8`;
  return KEY_DIRS.map((d) => path.join(d, name)).find((p) => fs.existsSync(p)) ?? null;
}

/** Every AuthKey_*.p8 present, whatever its id — used to report near misses. */
function listAscKeys() {
  return KEY_DIRS.filter((d) => fs.existsSync(d)).flatMap((d) =>
    fs
      .readdirSync(d)
      .filter((f) => /^AuthKey_.+\.p8$/.test(f))
      .map((f) => path.join(d, f)),
  );
}

module.exports = { KEY_DIRS, findAscKey, listAscKeys };
