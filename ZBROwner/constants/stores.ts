import { Platform, Linking } from 'react-native';

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
 * Does a server-supplied URL belong to THIS platform's store?
 *
 * The backend sends one `storeUrl` without knowing which platform is asking, so
 * it may well be the other one. Checking the host rather than trusting the field
 * is what stops an iPhone being sent to Google Play.
 *
 * Host-based, not substring-based: `https://evil.example/play.google.com` would
 * pass a naive `includes()`.
 */
export function isStoreUrlForThisPlatform(url: unknown): url is string {
  if (typeof url !== 'string') return false;

  let host: string;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    host = parsed.hostname.toLowerCase();
  } catch {
    return false;
  }

  return Platform.OS === 'ios'
    ? host === 'apps.apple.com' || host === 'itunes.apple.com'
    : host === 'play.google.com';
}

/**
 * Open the store, preferring a valid server-supplied URL.
 *
 * The server value wins when it matches the platform — that is how the store
 * link can be corrected without shipping a build — and the configured constant
 * is the fallback for when it is missing, malformed, or meant for the other
 * platform.
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
