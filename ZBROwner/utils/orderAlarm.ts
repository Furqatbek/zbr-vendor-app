/**
 * Persistent alarm sound for new incoming orders.
 * Plays a repeating alert tone until explicitly stopped.
 * Uses expo-av with system notification sound as fallback.
 */
import { Audio } from 'expo-av';
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

let sound: Audio.Sound | null = null;
let hapticInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Start playing the alarm sound in a loop with haptic vibration.
 * Safe to call multiple times — will not stack.
 */
export async function startAlarm() {
  // Already playing
  if (sound) return;

  try {
    // playsInSilentModeIOS is what makes the alarm audible with the ringer off,
    // and it needs no background mode.
    //
    // staysActiveInBackground is deliberately false: this alarm only plays while
    // the NewOrderAlert modal is on screen, i.e. always in the foreground.
    // Claiming background audio would mean declaring the "audio" UIBackgroundMode
    // without ever using it — an App Store rejection reason. Screen-off alerting
    // comes from the FCM/APNs notification channel sound, not from here.
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: false,
    });

    const { sound: loaded } = await Audio.Sound.createAsync(
      require('../assets/sounds/new_order.wav'),
      { isLooping: true, volume: 1.0, shouldPlay: true },
    );
    sound = loaded;
  } catch {
    // Sound file may be missing — fall back to haptics only
  }

  // Haptic pulse every 1.5s
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  hapticInterval = setInterval(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  }, 1500);
}

/**
 * Stop the alarm sound and haptic vibrations.
 */
export async function stopAlarm() {
  if (hapticInterval) {
    clearInterval(hapticInterval);
    hapticInterval = null;
  }

  if (sound) {
    try {
      await sound.stopAsync();
      await sound.unloadAsync();
    } catch {
      // Already unloaded
    }
    sound = null;
  }
}
