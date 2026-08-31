import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/**
 * Push notification setup.
 *
 * Delivery model: the backend talks to FCM (Android) and APNs (iOS) DIRECTLY,
 * so we register the RAW device token from `getDevicePushTokenAsync()`:
 *   - Android → an FCM registration token (Firebase Admin SDK `send()`)
 *   - iOS     → an APNs device token (HTTP/2 + .p8 JWT)
 * We deliberately do NOT use `getExpoPushTokenAsync()` — that returns an
 * `ExponentPushToken[...]` which is only usable via Expo's push service and
 * would be rejected by FCM/APNs.
 *
 * Screen-off delivery only works through these remote pushes. The in-app
 * WebSocket cannot wake a sleeping device — iOS suspends the JS runtime and
 * Android dozes, so the socket is gone.
 */

/**
 * Android channel IDs.
 *
 * VERSIONED ON PURPOSE: a channel's sound/importance are immutable once the OS
 * has created it, so changing them requires a NEW id. If you change the sound or
 * importance below, bump the suffix (…_v3) and add the old id to
 * `RETIRED_CHANNEL_IDS` so it's removed from the user's notification settings.
 * The FCM payload's `android.notification.channel_id` must match ORDERS_CHANNEL.
 */
export const ORDERS_CHANNEL = 'orders_v2';
export const UPDATES_CHANNEL = 'updates_v2';
const RETIRED_CHANNEL_IDS = ['orders', 'updates'];

/**
 * Bundled alarm sound. The expo-notifications config plugin copies this into
 * android `res/raw/` and the iOS bundle at build time (see app.json `sounds`).
 * Android raw-resource names may only contain [a-z0-9_], hence new_order.wav.
 */
const ALARM_SOUND = 'new_order.wav';

// How a notification is presented while the app is in the FOREGROUND.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Create the Android notification channels.
 *
 * Called unconditionally at startup — creating a channel does NOT require
 * notification permission, and doing it up front means the channel already
 * exists (with the right sound/importance) the moment the user grants
 * permission or the first push lands.
 */
export async function ensureNotificationChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;

  // Drop superseded channels so users don't see stale duplicates in settings.
  await Promise.all(
    RETIRED_CHANNEL_IDS.map((id) =>
      Notifications.deleteNotificationChannelAsync(id).catch(() => {}),
    ),
  );

  await Notifications.setNotificationChannelAsync(ORDERS_CHANNEL, {
    name: 'New orders',
    description: 'Alarm for incoming orders. Keep this enabled to avoid missing orders.',
    importance: Notifications.AndroidImportance.MAX, // heads-up + wakes the screen
    sound: ALARM_SOUND,
    vibrationPattern: [0, 400, 200, 400, 200, 400],
    enableVibrate: true,
    enableLights: true,
    lightColor: '#FF5A1F',
    bypassDnd: true, // honored only if the user grants DND access; harmless otherwise
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    showBadge: true,
  });

  await Notifications.setNotificationChannelAsync(UPDATES_CHANNEL, {
    name: 'Order updates',
    description: 'Status changes, courier assignment, and other non-urgent updates.',
    importance: Notifications.AndroidImportance.DEFAULT,
    // `sound` is OMITTED on purpose — that is how you request the system
    // default. Passing the string 'default' is treated as a FILENAME and
    // resolved against res/raw, where no file called "default" exists, so
    // expo-notifications logs "Custom sound 'default' not found in native app".
    // The channel still ends up with the default sound (the resolver falls back),
    // but the error is noisy and misleading.
    showBadge: true,
  });
}

export interface PushRegistration {
  /** Raw FCM (Android) or APNs (iOS) device token. */
  token: string;
  /** Which push service the token belongs to — tells the backend how to route. */
  service: 'fcm' | 'apns';
}

/**
 * Request notification permission and return the raw device push token.
 *
 * Returns null (without throwing) when push is unavailable: web, permission
 * denied, or a simulator/Expo Go where no token can be issued. Callers should
 * treat null as "no push on this device" rather than an error to retry forever.
 */
export async function registerForPushNotifications(): Promise<PushRegistration | null> {
  if (Platform.OS === 'web') return null;

  // Channels first: they must exist before the first notification arrives.
  await ensureNotificationChannels();

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
        // Only granted if the Critical Alerts entitlement is approved by Apple;
        // silently ignored otherwise, so it's safe to always ask.
        allowCriticalAlerts: true,
        provideAppNotificationSettings: true,
      },
    });
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return null;

  // RAW device token (FCM / APNs) — see the module docblock for why.
  const devicePushToken = await Notifications.getDevicePushTokenAsync();

  return {
    token: devicePushToken.data as string,
    service: Platform.OS === 'ios' ? 'apns' : 'fcm',
  };
}

/**
 * Fires when the OS rotates the device push token.
 *
 * FCM/APNs tokens are not permanent (app restore, data clear, long idle). If we
 * don't re-register the new one, the backend keeps pushing to a dead token and
 * the vendor silently stops receiving orders — so this must stay wired up.
 */
export function addPushTokenListener(callback: (registration: PushRegistration) => void) {
  return Notifications.addPushTokenListener((token) => {
    callback({
      token: token.data as string,
      service: Platform.OS === 'ios' ? 'apns' : 'fcm',
    });
  });
}

/**
 * The notification tap that cold-started the app.
 *
 * The response listener does not reliably fire when a tap launches the app from
 * a killed state, so this is checked once on mount to recover that navigation.
 */
export async function getInitialNotificationResponse() {
  return Notifications.getLastNotificationResponseAsync();
}

export function addNotificationReceivedListener(
  callback: (notification: Notifications.Notification) => void,
) {
  return Notifications.addNotificationReceivedListener(callback);
}

export function addNotificationResponseListener(
  callback: (response: Notifications.NotificationResponse) => void,
) {
  return Notifications.addNotificationResponseReceivedListener(callback);
}

export async function sendLocalNotification(
  title: string,
  body: string,
  channelId: string = ORDERS_CHANNEL,
) {
  if (Platform.OS === 'web') return;
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: channelId === ORDERS_CHANNEL ? ALARM_SOUND : true,
      ...(Platform.OS === 'android' ? { channelId } : {}),
    },
    trigger: null,
  });
}
