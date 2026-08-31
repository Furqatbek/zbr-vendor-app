import { Platform } from 'react-native';
import * as Application from 'expo-application';
import AsyncStorage from '@react-native-async-storage/async-storage';

const FALLBACK_DEVICE_ID_KEY = 'zbr_device_id';

/**
 * A stable identifier for THIS install, used as the upsert key for the push
 * token on the backend.
 *
 * Single source of truth on purpose. This previously existed twice with
 * different logic, and the copy in authStore returned
 * `Application.applicationId` on iOS — the bundle identifier, which is
 * `com.zbr.owner` on every iPhone. Registration used one value and logout used
 * another, so unregister-on-logout never matched a row and the backend kept
 * pushing to signed-out devices.
 */
export async function getDeviceId(): Promise<string> {
  try {
    if (Platform.OS === 'android') {
      const androidId = Application.getAndroidId();
      if (androidId) return androidId;
    } else {
      // identifierForVendor: stable per vendor per device, resets only when all
      // of this vendor's apps are uninstalled.
      const idfv = await Application.getIosIdForVendorAsync();
      if (idfv) return idfv;
    }
  } catch {
    // fall through to the generated id
  }

  // Last resort: a random id persisted on device, so it stays stable across
  // launches instead of registering a new "device" every time.
  try {
    const existing = await AsyncStorage.getItem(FALLBACK_DEVICE_ID_KEY);
    if (existing) return existing;
    const generated = `${Platform.OS}-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 12)}`;
    await AsyncStorage.setItem(FALLBACK_DEVICE_ID_KEY, generated);
    return generated;
  } catch {
    return `${Platform.OS}-unknown`;
  }
}
