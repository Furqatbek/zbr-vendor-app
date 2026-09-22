import { Platform, Linking } from 'react-native';
import * as Application from 'expo-application';

/**
 * Where to send a vendor to update the app.
 *
 * Configured per platform, never shared: opening a Play URL on an iPhone lands
 * on a web page that cannot install anything, which reads to the user as the
 * update being broken.
 *
 * Values come from the environment so they can change without a code edit, with
 * the real store URLs as defaults — the bundle id and package name are fixed for
 * this app's lifetime, so a default here is a fact rather than a placeholder.
 */
export const IOS_APP_STORE_URL =
  process.env.EXPO_PUBLIC_IOS_APP_STORE_URL ??
  'https://apps.apple.com/app/id6753371866';

export const ANDROID_PLAY_STORE_URL =
  process.env.EXPO_PUBLIC_ANDROID_PLAY_STORE_URL ??
  'https://play.google.com/store/apps/details?id=com.zbr.owner';

/** The store URL for the platform this build is running on. */
export function storeUrlForPlatform(): string {
  return Platform.OS === 'ios' ? IOS_APP_STORE_URL : ANDROID_PLAY_STORE_URL;
}

/**
 * Does this URL point at THIS app's page in THIS platform's store?
 *
 * Two independent ways to get it wrong, and both have already happened:
 *
 * 1. **Wrong platform.** The backend answers without knowing who asked, so a
 *    single stored `storeUrl` may be the other platform's.
 * 2. **Wrong app.** The backend's seeded value was
 *    `play.google.com/store/apps/details?id=app.zbr.customer` — the customer
 *    app. A host-only check passes that happily and sends a restaurant owner to
 *    install the consumer app.
 *
 * So the Android check compares the `id` parameter against this build's own
 * package, read from the binary rather than a constant that could drift.
 *
 * iOS store URLs carry a numeric App Store id that cannot be derived from the
 * bundle id, so that one is host-checked only — worth knowing as a gap rather
 * than assuming it is covered.
 *
 * Host comparison, not substring: `https://evil.example/play.google.com` would
 * pass a naive `includes()`.
 */
export function isStoreUrlForPlatform(
  url: unknown,
  platform: 'ios' | 'android',
  androidPackage?: string | null,
): url is string {
  if (typeof url !== 'string') return false;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:') return false;

  const host = parsed.hostname.toLowerCase();

  if (platform === 'ios') {
    return host === 'apps.apple.com' || host === 'itunes.apple.com';
  }

  if (host !== 'play.google.com') return false;
  // No package to compare against (web, or the native value is unavailable):
  // fall back to the host check rather than rejecting a probably-fine URL.
  if (!androidPackage) return true;
  return parsed.searchParams.get('id') === androidPackage;
}

/** Same check, bound to the running platform and this build's package. */
export function isStoreUrlForThisPlatform(url: unknown): url is string {
  return isStoreUrlForPlatform(
    url,
    Platform.OS === 'ios' ? 'ios' : 'android',
    Application.applicationId,
  );
}

/**
 * Open the store, preferring a valid server-supplied URL.
 *
 * The server value wins when it checks out — that is how the link can be
 * corrected without shipping a build — and the configured constant is the
 * fallback for when it is missing, malformed, for the other platform, or for a
 * different app.
 */
export async function openAppStore(serverUrl?: string | null): Promise<void> {
  const url = isStoreUrlForThisPlatform(serverUrl) ? serverUrl : storeUrlForPlatform();
  try {
    await Linking.openURL(url);
  } catch {
    // No browser or store app to handle it. Nothing useful to fall back to —
    // the caller's dialog stays on screen so the user can try again.
  }
}
