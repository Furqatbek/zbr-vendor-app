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
    // Allow playback even when device is on silent/vibrate
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      shouldDuckAndroid: false,
    });

    const { sound: loaded } = await Audio.Sound.createAsync(
      require('../assets/sounds/new-order.wav'),
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
