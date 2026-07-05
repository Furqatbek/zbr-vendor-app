import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

/**
 * Secure key-value storage for sensitive values (auth tokens).
 *
 * On native, values are stored in the OS keystore (iOS Keychain / Android
 * Keystore-backed EncryptedSharedPreferences) via expo-secure-store, so they
 * are encrypted at rest rather than sitting in the plaintext AsyncStorage
 * SQLite/plist. SecureStore is not available on web, so there we fall back to
 * AsyncStorage (web builds are dev/preview only).
 */

const useSecure = Platform.OS !== 'web';

export async function setSecureItem(key: string, value: string): Promise<void> {
  if (useSecure) {
    await SecureStore.setItemAsync(key, value);
  } else {
    await AsyncStorage.setItem(key, value);
  }
}

export async function getSecureItem(key: string): Promise<string | null> {
  if (useSecure) {
    return SecureStore.getItemAsync(key);
  }
  return AsyncStorage.getItem(key);
}

export async function deleteSecureItem(key: string): Promise<void> {
  if (useSecure) {
    await SecureStore.deleteItemAsync(key);
  } else {
    await AsyncStorage.removeItem(key);
  }
}

/**
 * One-time migration: if a token still lives in the legacy plaintext
 * AsyncStorage slot, move it into secure storage and clear the old copy.
 * Returns the value (from either location) so callers can use it immediately.
 */
export async function migrateFromAsyncStorage(key: string): Promise<string | null> {
  const secure = await getSecureItem(key);
  if (secure != null) return secure;
  if (!useSecure) return null;

  const legacy = await AsyncStorage.getItem(key);
  if (legacy != null) {
    await setSecureItem(key, legacy);
    await AsyncStorage.removeItem(key);
    return legacy;
  }
  return null;
}
