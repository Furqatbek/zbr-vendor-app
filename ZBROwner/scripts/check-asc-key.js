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
const BUNDLE_ID = JSON.parse(fs.readFileSync(`${__dirname}/../app.json`, 'utf8'))
  .expo?.ios?.bundleIdentifier;

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
    console.log('           the Admin or App Manager role. A Developer-role key gets');
    console.log('           exactly this far and no further.\n');
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
    console.log('Credentials are fully consistent. If xcodebuild still fails, the');
    console.log('problem is in Xcode\'s local state, not in the credentials.\n');
    return;
  }

  console.log('The key is valid and can see the App ID, but this team has no');
  console.log('certificates yet, so the team id could not be confirmed from Apple.');
  console.log(`If xcodebuild still reports 'No Account for Team ${TEAM_ID}', compare`);
  console.log('that value with developer.apple.com → Membership details.\n');
})();
