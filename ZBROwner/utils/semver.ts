/**
 * Semantic version comparison.
 *
 * String comparison is wrong in a way that only shows up later: "1.10.0" sorts
 * BELOW "1.9.0" lexically, so the day the app reaches a two-digit minor every
 * user silently stops being offered updates. The same trap catches "2.0.0" vs
 * "1.99.99".
 *
 * Deliberately dependency-free — this is a dozen lines of arithmetic, and the
 * app already carries enough native modules.
 */

/** A parsed version: numeric core plus an optional prerelease tag. */
interface Parsed {
  parts: number[];
  prerelease: string | null;
}

/**
 * Parse "1.2.3", "1.2", "v1.2.3", "1.2.3-beta.1", "1.2.3+build.42".
 *
 * Build metadata (everything after `+`) is discarded: semver says it must be
 * ignored when determining precedence, and app stores use it for their own
 * bookkeeping. Missing components default to 0, so "1.2" === "1.2.0".
 */
function parse(version: string): Parsed {
  const cleaned = String(version ?? '').trim().replace(/^v/i, '');
  const withoutBuild = cleaned.split('+')[0] ?? '';
  const [core = '', ...prereleaseParts] = withoutBuild.split('-');

  const parts = core.split('.').map((p) => {
    const n = Number.parseInt(p, 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  });

  return {
    parts,
    prerelease: prereleaseParts.length ? prereleaseParts.join('-') : null,
  };
}

/**
 * -1 if a < b, 0 if equal, 1 if a > b.
 *
 * Compares as many components as the longer version has, treating absent ones
 * as 0 so "1.2" and "1.2.0" are equal rather than the shorter sorting first.
 */
export function compareVersions(a: string, b: string): -1 | 0 | 1 {
  const pa = parse(a);
  const pb = parse(b);

  const length = Math.max(pa.parts.length, pb.parts.length);
  for (let i = 0; i < length; i++) {
    const na = pa.parts[i] ?? 0;
    const nb = pb.parts[i] ?? 0;
    if (na !== nb) return na < nb ? -1 : 1;
  }

  // Equal cores. A prerelease ranks BELOW the release it leads to, so
  // 1.0.0-beta < 1.0.0. Two prereleases compare as plain strings, which is
  // close enough: this app does not ship them, and the alternative is the full
  // dot-separated identifier algorithm for no practical gain.
  if (pa.prerelease === pb.prerelease) return 0;
  if (pa.prerelease === null) return 1;
  if (pb.prerelease === null) return -1;
  return pa.prerelease < pb.prerelease ? -1 : 1;
}

/** True when `version` is strictly older than `other`. */
export function isOlderThan(version: string, other: string): boolean {
  return compareVersions(version, other) < 0;
}

/**
 * True when the string looks like a version at all.
 *
 * Used to ignore a malformed value from the server rather than treating it as
 * 0.0.0 — which would read as "everything is newer" and nag every user forever.
 */
export function isValidVersion(version: unknown): version is string {
  return typeof version === 'string' && /^v?\d+(\.\d+)*([-+].*)?$/.test(version.trim());
}
