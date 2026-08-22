/**
 * Client-side guard for user-entered URLs that the backend will fetch
 * server-side (the Restos integration base URL). This is defense-in-depth
 * against SSRF — the authoritative allowlist must live on the server — but it
 * blocks the obvious internal/metadata targets and non-http(s) schemes before
 * they ever leave the device.
 */

const PRIVATE_HOST_PATTERNS: RegExp[] = [
  /^localhost$/i,
  /^127\./,
  /^0\.0\.0\.0$/,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./, // 172.16.0.0 – 172.31.255.255
  /^169\.254\./, // link-local (incl. cloud metadata 169.254.169.254)
  /^::1$/,
  /\.local$/i,
  /\.internal$/i,
];

export function isSafeExternalUrl(input: string): boolean {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return false;
  }
  // HTTPS only. The backend fetches this URL server-side and the request body
  // carries the partner API key, so allowing http: would send that credential
  // in cleartext — and the UI already promises "a valid public https:// URL".
  if (url.protocol !== 'https:') return false;
  const host = url.hostname;
  if (!host) return false;
  return !PRIVATE_HOST_PATTERNS.some((re) => re.test(host));
}
