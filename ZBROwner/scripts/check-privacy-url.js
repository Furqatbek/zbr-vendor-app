#!/usr/bin/env node
/**
 * Verify the privacy policy URL actually serves a privacy policy.
 *
 * Google fetches this URL during Play review, and "HTTP 200" is NOT enough:
 *
 *  - Single-page apps commonly serve index.html for EVERY path, so /privacy
 *    returns 200 with the same shell as /nonsense. Nothing is there.
 *  - A policy rendered only by client-side JavaScript may be invisible to the
 *    reviewing fetch, which does not reliably execute JS.
 *
 * Both are documented rejection causes and both look fine in a browser, so this
 * compares the policy URL against a deliberately nonsensical path on the same
 * origin and inspects the server-rendered text.
 *
 * Usage: npm run check:privacy-url
 * Network required; exits 0 with a warning if the host is unreachable.
 */

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const contactPath = path.join(root, 'constants', 'contact.ts');

function configuredUrl() {
  if (!fs.existsSync(contactPath)) return null;
  const src = fs.readFileSync(contactPath, 'utf8');
  const m = src.match(/privacyPolicyUrl:\s*(?:null|'([^']+)'|"([^"]+)")/);
  return m ? m[1] || m[2] || null : null;
}

function visibleText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Words any real privacy policy contains, in the languages this app ships.
const POLICY_MARKERS = [
  'privacy', 'personal data', 'we collect', 'information we',
  'конфиденциальн', 'персональн', 'данны',
  'maxfiy', "ma'lumot", 'maxfiylik',
  'махфий', 'маълумот',
];

(async () => {
  const url = configuredUrl();
  if (!url) {
    console.log('\nprivacyPolicyUrl is not set in constants/contact.ts — nothing to check.\n');
    process.exit(0);
  }

  let target;
  try {
    target = new URL(url);
  } catch {
    console.error(`\nprivacyPolicyUrl is not a valid URL: ${url}\n`);
    process.exit(1);
  }

  const controlUrl = new URL(
    `/zbr-nonexistent-control-${Date.now().toString(36)}`,
    target.origin,
  ).toString();

  const get = async (u) => {
    const res = await fetch(u, {
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ZBR-policy-check)' },
    });
    return { status: res.status, body: await res.text() };
  };

  let policy;
  let control;
  try {
    [policy, control] = await Promise.all([get(url), get(controlUrl)]);
  } catch (e) {
    console.log(`\nCould not reach ${target.origin} — ${e.message}`);
    console.log('Skipping (network problem, not necessarily a config problem).\n');
    process.exit(0);
  }

  const problems = [];
  const notes = [];

  if (policy.status !== 200) {
    problems.push(`Returned HTTP ${policy.status}. Google needs a reachable 200.`);
  }

  const policyText = visibleText(policy.body);
  const controlText = visibleText(control.body);

  if (policy.body === control.body) {
    problems.push(
      'This URL returns the EXACT same bytes as a nonsense path on the same host\n' +
        `     (${controlUrl}).\n` +
        '     The site serves index.html for every path, so /privacy is not a real\n' +
        '     page — the 200 is meaningless and a reviewer sees no policy.',
    );
  } else if (policyText === controlText) {
    problems.push(
      'The server-rendered TEXT is identical to a nonsense path on the same host.\n' +
        '     Any policy here is drawn by client-side JavaScript, which the review\n' +
        '     fetch does not reliably execute.',
    );
  }

  const lower = policyText.toLowerCase();
  const matched = POLICY_MARKERS.filter((m) => lower.includes(m));
  if (matched.length === 0) {
    problems.push(
      `No privacy-policy wording found in the server-rendered HTML (${policyText.length} chars).\n` +
        `     Text served: "${policyText.slice(0, 120)}${policyText.length > 120 ? '…' : ''}"`,
    );
  } else if (policyText.length < 500) {
    notes.push(`Only ${policyText.length} characters of text — unusually short for a policy.`);
  } else {
    notes.push(`${policyText.length} characters served, matched: ${matched.slice(0, 3).join(', ')}`);
  }

  console.log(`\nPrivacy policy URL check\n${'─'.repeat(50)}`);
  console.log(`  url: ${url}`);
  for (const n of notes) console.log(`  ok       ${n}`);
  for (const p of problems) console.log(`  PROBLEM  ${p}`);
  console.log('─'.repeat(50));

  if (problems.length) {
    console.log(
      'The page must serve the policy in its HTML response (server-rendered or\n' +
        'static). A JS-only page can pass in a browser and still fail review.\n',
    );
    process.exit(1);
  }
  console.log('Privacy policy URL looks good.\n');
})();
