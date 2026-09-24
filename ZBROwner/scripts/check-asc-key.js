#!/usr/bin/env node
/**
 * Ask App Store Connect what our API key can actually see.
 *
 * xcodebuild reports signing failures in terms of Xcode's local state ("No
 * Account for Team X") whether the cause is a bad key, a role without
 * permission, or a team mismatch. Those need very different fixes, and the
 * build log cannot tell them apart. This calls the API directly, so the answer
 * comes from Apple.
 *
 * It reads the same ZBR_ASC_* variables and the same key locations the build
 * uses, so a pass here means the build is holding a working credential.
 *
 * Usage: npm run check:asc-key
 */

const crypto = require('crypto');
const fs = require('fs');
const { KEY_DIRS, findAscKey } = require('./lib/asc-key');

const KEY_ID = process.env.ZBR_ASC_KEY_ID;
const ISSUER_ID = process.env.ZBR_ASC_ISSUER_ID;
const TEAM_ID = process.env.ZBR_APPLE_TEAM_ID;
const APP_JSON = JSON.parse(fs.readFileSync(`${__dirname}/../app.json`, 'utf8')).expo;
const BUNDLE_ID = APP_JSON?.ios?.bundleIdentifier;
// go-live-ios runs this BEFORE bumping, so without knowing a bump is coming the
// check would reject the pre-bump number and block a run that was about to fix
// itself — the same sequencing mistake the Info.plist check made.
const WILL_BUMP = process.argv.slice(2).includes('--will-bump');
const BUILD_NUMBER = Number(APP_JSON?.ios?.buildNumber) + (WILL_BUMP ? 1 : 0);
const MARKETING_VERSION = APP_JSON?.version;

const b64url = (buf) =>
  Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/**
 * App Store Connect wants an ES256 JWT whose signature is raw R||S (JOSE), not
 * the DER encoding Node produces by default — the same P1363 detail as the APNs
 * script. A DER signature is rejected as a malformed token.
 */
function makeToken(privateKey) {
  const header = { alg: 'ES256', kid: KEY_ID, typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: ISSUER_ID,
    iat: now,
    exp: now + 600, // Apple rejects anything over 20 minutes.
    aud: 'appstoreconnect-v1',
  };
  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const signature = crypto.sign('sha256', Buffer.from(signingInput), {
    key: privateKey,
    dsaEncoding: 'ieee-p1363',
  });
  return `${signingInput}.${b64url(signature)}`;
}

(async () => {
  if (!KEY_ID || !ISSUER_ID) {
    console.error('\nZBR_ASC_KEY_ID and ZBR_ASC_ISSUER_ID must be set.\n');
    process.exit(1);
  }

  const keyPath = findAscKey(KEY_ID);
  if (!keyPath) {
    console.error(`\nAuthKey_${KEY_ID}.p8 not found in:\n${KEY_DIRS.map((d) => `  ${d}`).join('\n')}\n`);
    process.exit(1);
  }

  let token;
  try {
    token = makeToken(crypto.createPrivateKey(fs.readFileSync(keyPath, 'utf8')));
  } catch (e) {
    console.error(`\nCould not sign with ${keyPath}: ${e.message}`);
    console.error('The file must be the unmodified .p8 downloaded from App Store Connect.\n');
    process.exit(1);
  }

  console.log(`\nApp Store Connect API key check\n${'─'.repeat(50)}`);
  console.log(`  key:    ${keyPath}`);
  console.log(`  issuer: ${ISSUER_ID}`);

  const call = async (path) =>
    fetch(`https://api.appstoreconnect.apple.com/v1/${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

  let res;
  try {
    res = await call(`bundleIds?limit=200`);
  } catch (e) {
    console.log(`\n  Could not reach Apple: ${e.message}\n`);
    process.exit(0);
  }

  if (res.status === 401) {
    console.log('\n  PROBLEM  401 Unauthorized — Apple rejected the credential itself.');
    console.log('           Either ZBR_ASC_ISSUER_ID does not match this key, or the key');
    console.log('           has been revoked. The issuer id is shown ABOVE the key list');
    console.log('           in App Store Connect → Users and Access → Integrations.\n');
    process.exit(1);
  }
  if (res.status === 403) {
    console.log('\n  PROBLEM  403 Forbidden — the key authenticates but lacks permission.');
    console.log('           Creating signing certificates and provisioning profiles needs');
    console.log('           the Admin role. A lower-role key gets this far and no further.\n');
    process.exit(1);
  }
  if (!res.ok) {
    console.log(`\n  PROBLEM  HTTP ${res.status}: ${(await res.text()).slice(0, 300)}\n`);
    process.exit(1);
  }

  const body = await res.json();
  const ids = (body.data ?? []).map((d) => d.attributes?.identifier).filter(Boolean);
  console.log(`  ok      Key authenticates, and can read ${ids.length} App ID(s)`);

  if (BUNDLE_ID && ids.includes(BUNDLE_ID)) {
    console.log(`  ok      ${BUNDLE_ID} exists in this team`);
  } else if (BUNDLE_ID) {
    console.log(`\n  PROBLEM  ${BUNDLE_ID} is NOT registered in the team this key belongs to.`);
    console.log('           Signing cannot create a profile for an App ID that is not there.');
    console.log(
      ids.length
        ? `           The team does have: ${ids.slice(0, 12).join(', ')}${ids.length > 12 ? ', …' : ''}`
        : '           This team has no App IDs at all.',
    );
    console.log('           Either register it at developer.apple.com → Identifiers (with');
    console.log('           Push Notifications enabled), or the key belongs to a different');
    console.log(`           team than ZBR_APPLE_TEAM_ID=${TEAM_ID}.\n`);
    process.exit(1);
  }

  // Two upload rejections in a row came from App Store Connect state that
  // nothing local could see, each after a full archive:
  //
  //   90186  the version's train is closed for new build submissions
  //   -19232 the bundle version must be higher than the previously uploaded '10'
  //
  // Build numbers are unique per APP, not per version train, so a new marketing
  // version does not reset them. Asking Apple what it already has turns both
  // into a two-second failure.
  try {
    const appRes = await call(`apps?filter[bundleId]=${encodeURIComponent(BUNDLE_ID)}&limit=1`);
    const appId = appRes.ok ? (await appRes.json()).data?.[0]?.id : null;

    if (appId) {
      const buildRes = await call(`builds?filter[app]=${appId}&limit=200`);
      if (buildRes.ok) {
        const builds = (await buildRes.json()).data ?? [];
        const numbers = builds
          .map((b) => Number(b.attributes?.version))
          .filter((n) => Number.isFinite(n));
        const highest = numbers.length ? Math.max(...numbers) : 0;

        if (!highest) {
          console.log('  ok      No builds uploaded yet — any build number is free');
        } else if (BUILD_NUMBER > highest) {
          console.log(`  ok      buildNumber ${BUILD_NUMBER} is above the highest uploaded (${highest})`);
        } else {
          console.log(
            `\n  PROBLEM  buildNumber ${BUILD_NUMBER} was already uploaded — the highest`,
          );
          console.log(`           App Store Connect has is ${highest}, and it must strictly increase.`);
          console.log('           Build numbers are unique per APP, not per version, so');
          console.log(`           moving to a new marketing version (${MARKETING_VERSION}) does not free them.`);
          console.log('');
          console.log(`             node scripts/bump-version-code.js --to ${highest + 1}`);
          console.log('             node scripts/go-live-ios.js --skip-privacy --no-bump');
          console.log('');
          console.log('           --no-bump on the second command, because the first already');
          console.log('           set the number; bumping again would skip one for nothing.');
          console.log('');
          console.log('           A normal build run bumps past this by itself — it asks App');
          console.log('           Store Connect first. This only blocks --no-bump runs.');
          console.log('');
          process.exit(1);
        }
      }
    }
  } catch {
    // Non-fatal: this is a convenience check, and the upload still enforces it.
  }

  // Nothing in the API returns "the team id" as a field, but every certificate
  // Apple issues carries it as the OU of its subject. Reading it back beats
  // asking someone to transcribe it from a web page — that transcription is
  // exactly where a wrong team id comes from.
  let teamIds = [];
  try {
    const certRes = await call('certificates?limit=200');
    if (certRes.ok) {
      const certs = (await certRes.json()).data ?? [];
      const found = new Set();
      for (const c of certs) {
        const content = c.attributes?.certificateContent;
        if (!content) continue;
        try {
          const subject = new crypto.X509Certificate(Buffer.from(content, 'base64')).subject;
          const m = subject.match(/OU=([A-Z0-9]{10})/);
          if (m) found.add(m[1]);
        } catch {
          // Unparseable certificate; the others still tell us what we need.
        }
      }
      teamIds = [...found];
    }
  } catch {
    // Non-fatal: the checks above already passed.
  }

  console.log(`${'─'.repeat(50)}`);

  if (teamIds.length && TEAM_ID && !teamIds.includes(TEAM_ID)) {
    console.log(`  PROBLEM  ZBR_APPLE_TEAM_ID is ${TEAM_ID}, but this key's certificates`);
    console.log(`           belong to team ${teamIds.join(' / ')}.`);
    console.log('           That mismatch is exactly what makes xcodebuild report');
    console.log(`           'No Account for Team "${TEAM_ID}"'. Fix it with:`);
    console.log(`             export ZBR_APPLE_TEAM_ID=${teamIds[0]}\n`);
    process.exit(1);
  }

  if (teamIds.length) {
    console.log(`  ok      Team ${teamIds.join(' / ')} matches ZBR_APPLE_TEAM_ID\n`);
    console.log('Credentials are consistent.\n');
    console.log('Note: this proves READ access. Creating the distribution certificate');
    console.log('needs the ADMIN role, and there is no way to test that without');
    console.log('actually creating one. If the export fails with "Cloud signing');
    console.log('permission error", the key is below Admin — revoke it and issue a new');
    console.log('one, as a key\'s role cannot be changed.\n');
    return;
  }

  console.log('The key is valid and can see the App ID, but this team has no');
  console.log('certificates yet, so the team id could not be confirmed from Apple.');
  console.log(`If xcodebuild still reports 'No Account for Team ${TEAM_ID}', compare`);
  console.log('that value with developer.apple.com → Membership details.\n');
})();
