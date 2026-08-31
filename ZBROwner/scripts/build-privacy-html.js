#!/usr/bin/env node
/**
 * Build store-assets/privacy.html from docs/PRIVACY_POLICY.md.
 *
 * The output is a standalone, dependency-free HTML file meant to be dropped on
 * a static host. Play and App Store reviewers fetch the URL and read the HTML
 * response, so everything must be in the markup — no JavaScript, no fonts, no
 * external stylesheet.
 *
 * The markdown is converted paragraph-by-paragraph, not line-by-line. An
 * earlier hand-built version of this file wrapped every SOURCE LINE in its own
 * <p>, which turned the policy into a wall of one-line paragraphs with no <h1>.
 *
 * Usage: npm run build:privacy
 */

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const SRC = path.join(root, 'docs', 'PRIVACY_POLICY.md');
const OUT = path.join(root, 'store-assets', 'privacy.html');

const escapeHtml = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Inline markdown: **bold**, *italic*, `code`. Applied after escaping. */
function inline(text) {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
}

function markdownToBody(md) {
  // Drop the "Draft for review" blockquote and the horizontal rule under it:
  // internal reviewer notes must never reach a published policy.
  const lines = md
    .split('\n')
    .filter((l) => !l.startsWith('>'))
    .join('\n')
    .replace(/^---$/gm, '');

  // A block is a run of non-blank lines. Soft line wraps inside a block are
  // joined with a space, which is what makes paragraphs come out as paragraphs.
  const blocks = lines.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);

  return blocks
    .map((block) => {
      const rows = block.split('\n').map((r) => r.trim());

      if (rows[0].startsWith('## ')) return `<h2>${inline(rows[0].slice(3))}</h2>`;
      if (rows[0].startsWith('# ')) return `<h1>${inline(rows[0].slice(2))}</h1>`;

      if (rows.every((r) => r.startsWith('- ') || !r.startsWith('-'))) {
        if (rows[0].startsWith('- ')) {
          // Continuation lines of a wrapped bullet belong to the bullet above.
          const items = [];
          for (const r of rows) {
            if (r.startsWith('- ')) items.push(r.slice(2));
            else if (items.length) items[items.length - 1] += ' ' + r;
          }
          return `<ul>\n${items.map((i) => `  <li>${inline(i)}</li>`).join('\n')}\n</ul>`;
        }
      }

      return `<p>${inline(rows.join(' '))}</p>`;
    })
    .join('\n\n');
}

const STYLE = `  :root { color-scheme: light dark; }
  body { max-width: 46rem; margin: 0 auto; padding: 2.5rem 1.25rem 5rem;
         font: 16px/1.65 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
         color: #1a1a1a; background: #fff; }
  h1 { font-size: 1.9rem; line-height: 1.25; margin-bottom: .25rem; }
  h2 { font-size: 1.15rem; margin-top: 2.25rem; }
  code { background: #f3f4f6; padding: .1em .35em; border-radius: 3px; font-size: .9em; }
  ul { padding-left: 1.25rem; }
  li { margin: .3rem 0; }
  @media (prefers-color-scheme: dark) {
    body { color: #e8e8e8; background: #17140f; }
    code { background: #2a2620; }
  }`;

const md = fs.readFileSync(SRC, 'utf8');
const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Privacy Policy — ZBR Owner</title>
<meta name="description" content="Privacy policy for the ZBR Owner restaurant partner app.">
<style>
${STYLE}
</style>
</head>
<body>
${markdownToBody(md)}
</body>
</html>
`;

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, html);

const rel = path.relative(root, OUT);
console.log(`\nWrote ${rel} (${html.length} bytes) from docs/PRIVACY_POLICY.md`);

// Unfilled placeholders are a documented rejection cause — a reviewer who sees
// "[LEGAL ENTITY NAME]" in a published policy rejects the submission.
const placeholders = [...new Set(html.match(/\[[A-Z][^\]]*\]/g) || [])];
if (placeholders.length) {
  console.log(
    `\n  WARNING  ${placeholders.length} unfilled placeholder(s) — fill these in\n` +
      '           docs/PRIVACY_POLICY.md and re-run before publishing:\n' +
      placeholders.map((p) => `             ${p}`).join('\n'),
  );
  console.log('\n  Do NOT publish this file until they are gone.\n');
  process.exitCode = 1;
} else {
  console.log('\n  No placeholders left. Ready to publish. See docs/PLAY_SUBMISSION.md §3.\n');
}
