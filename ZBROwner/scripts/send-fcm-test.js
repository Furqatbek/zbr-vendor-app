#!/usr/bin/env node
/**
 * Send a real high-priority push to an Android device via FCM HTTP v1.
 *
 * Why not just use the Firebase console? Its "send test message" posts a
 * NOTIFICATION-ONLY message at DEFAULT priority. That proves the token and the
 * channel, but it does NOT exercise:
 *   - `priority: "high"`, which is what punches through Doze when the screen is
 *     off — the single behaviour this app depends on
 *   - the `data` payload the app reads (type, orderId)
 *   - `channel_id` / custom sound selection
 * So a console test can pass while real screen-off delivery still fails.
 *
 * This sends the EXACT payload documented in docs/PUSH_SETUP.md §3, so a
 * success here means the backend only has to reproduce it — and a failure
 * isolates the problem to the client/Firebase side rather than the backend.
 *
 * No dependencies — Node's crypto (RS256 JWT) and global fetch.
 *
 * Usage:
 *   node scripts/send-fcm-test.js \
 *     --key ./service-account.json \
 *     --token <FCM registration token>
 *
 * Env fallbacks: FCM_SERVICE_ACCOUNT, FCM_DEVICE_TOKEN
 *
 * 🔒 The service-account JSON is a SECRET — keep it outside the repo.
 */

const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

// ── args ────────────────────────────────────────────────────────────────────
const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (!a.startsWith('--')) continue;
  const next = process.argv[i + 1];
  if (next && !next.startsWith('--')) {
    args[a.slice(2)] = next;
    i++;
  } else {
    args[a.slice(2)] = 'true';
  }
}

const keyPath = args.key || process.env.FCM_SERVICE_ACCOUNT;
const deviceToken = (args.token || process.env.FCM_DEVICE_TOKEN || '').trim();
const orderId = args['order-id'] || '1042';

const missing = [];
if (!keyPath) missing.push('--key (path to the Firebase service-account JSON)');
if (!deviceToken) missing.push('--token (FCM registration token from the device)');
if (missing.length) {
  console.error('\nMissing required arguments:\n  ' + missing.join('\n  '));
  console.error(
    '\nGet the service account from: Firebase console -> Project settings ->\n' +
      'Service accounts -> Generate new private key.\n' +
      'Get the device token from a dev build:\n' +
      '  adb logcat -s ReactNativeJS | grep "device token"\n',
  );
  process.exit(1);
}

if (/^ExponentPushToken/i.test(deviceToken)) {
  console.error(
    '\nThat is an Expo push token, not an FCM token.\n' +
      'The app must call getDevicePushTokenAsync(), not getExpoPushTokenAsync().\n',
  );
  process.exit(1);
}

// ── service account ─────────────────────────────────────────────────────────
let sa;
try {
  sa = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
} catch (e) {
  console.error(`\nCould not read the service-account JSON at ${keyPath}\n  ${e.message}\n`);
  process.exit(1);
}
for (const field of ['client_email', 'private_key', 'project_id']) {
  if (!sa[field]) {
    console.error(
      `\n${keyPath} is missing "${field}".\n` +
        'This must be the SERVICE ACCOUNT key (Project settings -> Service accounts),\n' +
        'not google-services.json — those are different files.\n',
    );
    process.exit(1);
  }
}

// Cross-check against the app's own Firebase config so a mismatched project is
// caught here rather than as a silent non-delivery.
try {
  const gs = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, '..', 'google-services.json'), 'utf8'),
  );
  const appProject = gs.project_info?.project_id;
  if (appProject && appProject !== sa.project_id) {
    console.error(
      `\nProject mismatch — the push would go to a different Firebase project.\n` +
        `  service account : ${sa.project_id}\n` +
        `  app config      : ${appProject}\n`,
    );
    process.exit(1);
  }
} catch {
  // google-services.json unreadable; not fatal for sending.
}

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    }),
  );
  const signature = crypto
    .sign('RSA-SHA256', Buffer.from(`${header}.${claims}`), sa.private_key)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${header}.${claims}.${signature}`,
    }),
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(
      `OAuth token exchange failed (${res.status}): ${body.error_description || body.error || JSON.stringify(body)}`,
    );
  }
  return body.access_token;
}

// ── payload — mirrors docs/PUSH_SETUP.md §3 exactly ─────────────────────────
const message = {
  message: {
    token: deviceToken,
    notification: { title: 'New order', body: `#A-${orderId} · test push` },
    data: { type: 'NEW_ORDER_RECEIVED', orderId: String(orderId) },
    android: {
      priority: 'high',
      notification: {
        channel_id: 'orders_v2',
        sound: 'new_order',
        notification_priority: 'PRIORITY_MAX',
        visibility: 'PUBLIC',
      },
    },
  },
};

(async () => {
  console.log('\nSending FCM test push');
  console.log(`  project  : ${sa.project_id}`);
  console.log(`  channel  : orders_v2   sound: new_order   priority: high`);
  console.log(`  device   : ${deviceToken.slice(0, 16)}…${deviceToken.slice(-8)}`);

  let accessToken;
  try {
    accessToken = await getAccessToken();
  } catch (e) {
    console.error(`\n  ❌ ${e.message}\n`);
    process.exit(1);
  }

  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    },
  );
  const body = await res.json().catch(() => ({}));

  if (res.ok) {
    console.log(`\n  ✅ FCM accepted the push (${body.name || 'sent'}).\n`);
    console.log('  If nothing appears: delivery is fine but presentation is not —');
    console.log('  check notification permission, the orders_v2 channel in system');
    console.log('  settings, and Android OEM battery restrictions.\n');
    return;
  }

  const status = body.error?.details?.[0]?.errorCode || body.error?.status || '';
  const EXPLANATIONS = {
    UNREGISTERED:
      'The token is dead — app uninstalled, data cleared, or token rotated.\n' +
      '      In production this is the signal to DELETE it from your database.',
    INVALID_ARGUMENT:
      'Malformed token or payload. Most often the token is truncated or belongs\n' +
      '      to a different Firebase project than this service account.',
    SENDER_ID_MISMATCH:
      'The token was issued by a DIFFERENT Firebase project than this key.\n' +
      '      Check google-services.json matches the service account project.',
    THIRD_PARTY_AUTH_ERROR: 'APNs credentials missing/invalid (only affects iOS via FCM).',
    QUOTA_EXCEEDED: 'Rate limited — retry with backoff.',
    UNAVAILABLE: 'FCM is temporarily unavailable — retry with backoff.',
  };

  console.error(`\n  ❌ FCM rejected the push — HTTP ${res.status} ${status}`);
  if (EXPLANATIONS[status]) console.error(`\n      ${EXPLANATIONS[status]}\n`);
  else console.error(`\n      ${JSON.stringify(body, null, 2).slice(0, 800)}\n`);
  process.exit(1);
})();
