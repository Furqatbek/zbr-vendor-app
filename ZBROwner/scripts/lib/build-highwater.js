const fs = require('fs');
const path = require('path');

/**
 * A machine-local record of the highest build number this machine has ever
 * sent to Apple.
 *
 * Two sources already inform the bump — app.json and App Store Connect — and
 * both have a blind spot that has now cost three builds (11, 15, and the 15
 * collision):
 *
 *   app.json lags, because a successful upload bumps it locally and the number
 *   only reaches the repo if someone commits it. A later pull resets it.
 *
 *   App Store Connect lags too, briefly. A build that has just been accepted
 *   spends a few minutes before it appears under /v1/builds, so a second run
 *   started right after a successful upload asks Apple, is told the OLD
 *   highest, and picks the number it just consumed. That is exactly the
 *   -19232 "must be higher than the previously uploaded version" rejection,
 *   arriving after a full archive.
 *
 * This file closes that window. It is written the moment a number is chosen —
 * before the archive, not after the upload — because a number is burned by
 * being sent, and a run that fails somewhere in the middle must not hand the
 * same number to the next one.
 *
 * It lives under build/, which is gitignored and survives `prebuild --clean`
 * (that wipes ios/). Deleting build/ resets it, which is safe: it is only ever
 * a floor, and the other two sources still apply.
 */

const FILE = (root) => path.join(root, 'build', 'ios', '.last-build-number');

/** The highest number this machine has used, or 0 if there is no record. */
function readHighwater(root) {
  try {
    const n = Number(fs.readFileSync(FILE(root), 'utf8').trim());
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

/** Record a number as used. Never lowers an existing mark. */
function writeHighwater(root, value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return;
  if (n <= readHighwater(root)) return;
  try {
    fs.mkdirSync(path.dirname(FILE(root)), { recursive: true });
    fs.writeFileSync(FILE(root), `${n}\n`);
  } catch {
    // Best effort: the bump still works from app.json and App Store Connect.
  }
}

module.exports = { readHighwater, writeHighwater };
