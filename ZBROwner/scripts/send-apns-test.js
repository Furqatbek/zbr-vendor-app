#!/usr/bin/env node
/**
 * Send a real push to a real iPhone via APNs, from the command line.
 *
 * Why this exists: Firebase has a "send test message" console for FCM, but
 * Apple provides NO equivalent for APNs. Without this you cannot verify your
 * .p8 key, Key ID, Team ID, bundle id and device token until the backend's
 * sender is finished — turning a 2-minute check into a multi-day feedback loop
 * where a failure could be in either half.
 *
 * It sends the EXACT payload shape documented in docs/PUSH_SETUP.md §3, so a
 * success here means the backend just has to reproduce it.
 *
 * No dependencies — Node's built-in crypto (ES256 JWT) and http2.
 *
 * Usage:
 *   node scripts/send-apns-test.js \
 *     --key ~/keys/AuthKey_ABC123XYZ.p8 \
 *     --key-id ABC123XYZ \
 *     --team-id DEF456UVW \
 *     --token <64-char-hex-device-token> \
 *     --env sandbox
 *
 * Values may also come from env vars:
 *   APNS_KEY_PATH, APNS_KEY_ID, APNS_TEAM_ID, APNS_DEVICE_TOKEN, APNS_ENV
 */

const fs = require('fs');
const crypto = require('crypto');
const http2 = require('http2');
const path = require('path');

// ── args ────────────────────────────────────────────────────────────────────
const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a.startsWith('--')) {
    const key = a.slice(2);
    const next = process.argv[i + 1];
    if (next && !next.startsWith('--')) {
      args[key] = next;
      i++;
    } else {
      args[key] = 'true';
    }
  }
}

if (args.help) {
  console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0].replace(/^\/\*\*?/, ''));
  process.exit(0);
}

const keyPath = args.key || process.env.APNS_KEY_PATH;
const keyId = args['key-id'] || process.env.APNS_KEY_ID;
const teamId = args['team-id'] || process.env.APNS_TEAM_ID;
const deviceToken = (args.token || process.env.APNS_DEVICE_TOKEN || '').replace(/[\s<>]/g, '');
const env = (args.env || process.env.APNS_ENV || 'sandbox').toLowerCase();
const orderId = args['order-id'] || '1042';

// Bundle id comes from app.json so it can't drift from the built app.
let topic = args.topic;
if (!topic) {
  try {
    topic = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'app.json'), 'utf8'))
      .expo.ios.bundleIdentifier;
  } catch {
    /* fall through to the validation below */
  }
}

const missing = [];
if (!keyPath) missing.push('--key (path to AuthKey_XXXX.p8)');
if (!keyId) missing.push('--key-id (10-char Key ID from the Apple key page)');
if (!teamId) missing.push('--team-id (10-char Team ID, top-right of the developer portal)');
if (!deviceToken) missing.push('--token (device token logged by the app)');
if (!topic) missing.push('--topic (bundle id)');

if (missing.length) {
  console.error('\nMissing required arguments:\n  ' + missing.join('\n  '));
  console.error('\nRun with --help for usage.\n');
  process.exit(1);
}

if (env !== 'sandbox' && env !== 'production') {
  console.error(`\n--env must be "sandbox" or "production", got "${env}".\n`);
  process.exit(1);
}

if (!/^[0-9a-fA-F]+$/.test(deviceToken)) {
  console.error(
    '\nThe device token must be hex.\n' +
      `Got: ${deviceToken.slice(0, 40)}${deviceToken.length > 40 ? '…' : ''}\n` +
      'If it looks like "ExponentPushToken[...]" the app is using the wrong API —\n' +
      'it must call getDevicePushTokenAsync(), not getExpoPushTokenAsync().\n',
  );
  process.exit(1);
}

// ── provider JWT (ES256) ────────────────────────────────────────────────────
function base64url(input) {
  return Buffer.from(input).toString('base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

let privateKey;
try {
  privateKey = crypto.createPrivateKey(fs.readFileSync(keyPath, 'utf8'));
} catch (e) {
  console.error(`\nCould not read the .p8 private key at ${keyPath}\n  ${e.message}\n`);
  process.exit(1);
}

const header = base64url(JSON.stringify({ alg: 'ES256', kid: keyId }));
const claims = base64url(JSON.stringify({ iss: teamId, iat: Math.floor(Date.now() / 1000) }));
// APNs requires the raw R||S (P1363) form, NOT the DER form crypto emits by default.
const signature = crypto
  .sign('sha256', Buffer.from(`${header}.${claims}`), {
    key: privateKey,
    dsaEncoding: 'ieee-p1363',
  })
  .toString('base64')
  .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
const jwt = `${header}.${claims}.${signature}`;

// ── payload — mirrors docs/PUSH_SETUP.md §3 exactly ─────────────────────────
const payload = JSON.stringify({
  aps: {
    alert: { title: 'New order', body: `#A-${orderId} · test push` },
    sound: 'new_order.wav',
    badge: 1,
    'interruption-level': 'time-sensitive',
  },
  type: 'NEW_ORDER_RECEIVED',
  orderId: String(orderId),
});

const host = env === 'production'
  ? 'https://api.push.apple.com'
  : 'https://api.sandbox.push.apple.com';

console.log(`\nSending test push`);
console.log(`  environment : ${env}  (${host})`);
console.log(`  topic       : ${topic}`);
console.log(`  key id      : ${keyId}`);
console.log(`  device      : ${deviceToken.slice(0, 12)}…${deviceToken.slice(-6)}`);

// ── send ────────────────────────────────────────────────────────────────────
const client = http2.connect(host);

client.on('error', (err) => {
  console.error(`\nConnection failed: ${err.message}\n`);
  process.exit(1);
});

const req = client.request({
  ':method': 'POST',
  ':path': `/3/device/${deviceToken}`,
  authorization: `bearer ${jwt}`,
  'apns-topic': topic,
  'apns-push-type': 'alert',
  'apns-priority': '10',
  'content-type': 'application/json',
});

let status = 0;
let body = '';

req.on('response', (headers) => {
  status = headers[':status'];
});
req.setEncoding('utf8');
req.on('data', (chunk) => {
  body += chunk;
});

req.on('end', () => {
  client.close();

  if (status === 200) {
    console.log('\n  ✅ APNs accepted the push.\n');
    console.log('  If nothing appears on the phone, the delivery is fine but the');
    console.log('  presentation is not — check: notification permission granted,');
    console.log('  Focus/DND, and that the app is actually backgrounded.\n');
    return;
  }

  let reason = '';
  try {
    reason = JSON.parse(body).reason || '';
  } catch {
    reason = body;
  }

  // APNs reasons are terse; translate the ones that actually happen.
  const EXPLANATIONS = {
    BadDeviceToken:
      'The token is not valid for THIS environment.\n' +
      `      You sent to "${env}". A token from an Xcode debug build only works with\n` +
      '      --env sandbox; a TestFlight/App Store build only with --env production.\n' +
      '      Try the other one — this is the most common APNs mistake.',
    DeviceTokenNotForTopic:
      'The token belongs to a different app.\n' +
      `      --topic is "${topic}"; it must equal the bundle id of the installed build.`,
    TopicDisallowed: 'This key is not permitted to send to that bundle id.',
    InvalidProviderToken:
      'The JWT was rejected. Usually one of:\n' +
      '      • --key-id does not match the .p8 file\n' +
      '      • --team-id is wrong (it is the 10-char Team ID, not the app id)\n' +
      '      • the key was not created with the APNs service enabled',
    ExpiredProviderToken: 'The JWT is too old (>1h). Re-run — it is generated fresh each time.',
    Unregistered:
      'The app was uninstalled from this device, or the token is stale.\n' +
      '      In production this is the signal to DELETE the token from your database.',
    PayloadTooLarge: 'The payload exceeds 4KB.',
    MissingTopic: 'No apns-topic header was sent.',
    BadCertificateEnvironment: 'The key/certificate is for the other environment.',
  };

  console.error(`\n  ❌ APNs rejected the push — HTTP ${status} ${reason}\n`);
  if (EXPLANATIONS[reason]) {
    console.error(`      ${EXPLANATIONS[reason]}\n`);
  } else if (body) {
    console.error(`      ${body}\n`);
  }
  process.exit(1);
});

req.on('error', (err) => {
  console.error(`\nRequest failed: ${err.message}\n`);
  process.exit(1);
});

req.end(payload);
