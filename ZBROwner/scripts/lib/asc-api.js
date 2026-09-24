const crypto = require('crypto');
const fs = require('fs');
const { findAscKey } = require('./asc-key');

/**
 * Minimal App Store Connect API client.
 *
 * Shared by check-asc-key.js (which reports credential problems) and
 * go-live-ios.js (which needs the highest uploaded build before bumping), so
 * the two cannot disagree about what Apple holds.
 */

const b64url = (buf) =>
  Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/**
 * ES256 JWT for App Store Connect.
 *
 * The signature must be raw R||S (JOSE / P1363), not the DER encoding Node
 * emits by default — Apple rejects DER as a malformed token, and the error says
 * nothing about encoding.
 */
function makeToken(keyId, issuerId, privateKeyPem) {
  const header = { alg: 'ES256', kid: keyId, typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: issuerId,
    iat: now,
    exp: now + 600, // Apple rejects anything over 20 minutes.
    aud: 'appstoreconnect-v1',
  };
  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const signature = crypto.sign('sha256', Buffer.from(signingInput), {
    key: crypto.createPrivateKey(privateKeyPem),
    dsaEncoding: 'ieee-p1363',
  });
  return `${signingInput}.${b64url(signature)}`;
}

/** An authenticated GET against /v1/<path>, or null if credentials are absent. */
async function ascGet(path) {
  const keyId = process.env.ZBR_ASC_KEY_ID;
  const issuerId = process.env.ZBR_ASC_ISSUER_ID;
  if (!keyId || !issuerId) return null;

  const keyPath = findAscKey(keyId);
  if (!keyPath) return null;

  const token = makeToken(keyId, issuerId, fs.readFileSync(keyPath, 'utf8'));
  return fetch(`https://api.appstoreconnect.apple.com/v1/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

/**
 * The highest build number App Store Connect holds for a bundle id, or null if
 * it cannot be determined (no credentials, no network, unknown app).
 *
 * Build numbers are unique per APP, not per version train, so this is the only
 * value that matters when picking the next one. null means "don't know" and
 * callers must fall back rather than assume zero.
 */
async function fetchHighestBuild(bundleId) {
  try {
    const appRes = await ascGet(`apps?filter[bundleId]=${encodeURIComponent(bundleId)}&limit=1`);
    if (!appRes || !appRes.ok) return null;

    const appId = (await appRes.json()).data?.[0]?.id;
    if (!appId) return null;

    const buildRes = await ascGet(`builds?filter[app]=${appId}&limit=200`);
    if (!buildRes || !buildRes.ok) return null;

    const numbers = ((await buildRes.json()).data ?? [])
      .map((b) => Number(b.attributes?.version))
      .filter((n) => Number.isFinite(n));

    return numbers.length ? Math.max(...numbers) : 0;
  } catch {
    return null;
  }
}


/**
 * App Store version states that REFUSE new builds.
 *
 * Once a version is approved or released its "train" is closed, and an upload
 * under the same CFBundleShortVersionString is rejected with 90186/90062 —
 * after a full archive. The fix is always a new marketing version, never a new
 * build number.
 *
 * Deliberately a closed list: anything unrecognised is treated as open, so a
 * state Apple adds later cannot block a legitimate release.
 */
const CLOSED_VERSION_STATES = new Set([
  'ACCEPTED',
  'DEVELOPER_REMOVED_FROM_SALE',
  'PENDING_APPLE_RELEASE',
  'PENDING_DEVELOPER_RELEASE',
  'PREORDER_READY_FOR_SALE',
  'READY_FOR_SALE',
  'REMOVED_FROM_SALE',
  'REPLACED_BY_NEW_VERSION',
]);

/**
 * State of a marketing version in App Store Connect.
 *
 * Returns { state, closed } for the matching version, or null when it cannot be
 * determined — no credentials, no network, or the version does not exist yet
 * (which is the normal case for a version about to be created).
 */
async function fetchVersionState(bundleId, versionString) {
  try {
    const appRes = await ascGet(`apps?filter[bundleId]=${encodeURIComponent(bundleId)}&limit=1`);
    if (!appRes || !appRes.ok) return null;

    const appId = (await appRes.json()).data?.[0]?.id;
    if (!appId) return null;

    const versionsRes = await ascGet(`apps/${appId}/appStoreVersions?limit=50`);
    if (!versionsRes || !versionsRes.ok) return null;

    const match = ((await versionsRes.json()).data ?? []).find(
      (v) => v.attributes?.versionString === versionString,
    );
    if (!match) return null;

    // Older responses use appStoreState; newer ones appVersionState.
    const state = match.attributes?.appStoreState ?? match.attributes?.appVersionState ?? null;
    if (!state) return null;

    return { state, closed: CLOSED_VERSION_STATES.has(state) };
  } catch {
    return null;
  }
}

/** Next patch version: 1.0.2 -> 1.0.3. */
function nextPatchVersion(version) {
  const parts = String(version).split('.').map((p) => Number.parseInt(p, 10) || 0);
  while (parts.length < 3) parts.push(0);
  parts[parts.length - 1] += 1;
  return parts.join('.');
}

module.exports = { makeToken, ascGet, fetchHighestBuild, fetchVersionState, nextPatchVersion, CLOSED_VERSION_STATES };
