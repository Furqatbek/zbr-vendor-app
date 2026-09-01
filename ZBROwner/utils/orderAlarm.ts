/**
 * Persistent alarm sound for new incoming orders.
 * Plays a repeating alert tone until explicitly stopped.
 *
 * Uses expo-audio. expo-av was removed: it no longer compiles against this SDK
 * (its EXAV.h imports ExpoModulesCore/EXEventEmitter.h, which no longer exists),
 * so an iOS archive fails outright with "could not build Objective-C module
 * 'EXAV'". Android never surfaced it because the break is in the iOS sources.
 */
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';

let player: AudioPlayer | null = null;
let hapticInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Start playing the alarm sound in a loop with haptic vibration.
 * Safe to call multiple times — will not stack.
 */
export async function startAlarm() {
  // Already playing
  if (player) return;

  try {
    // playsInSilentMode is what makes the alarm audible with the ringer off,
    // and it needs no background mode. (expo-av called this playsInSilentModeIOS.)
    //
    // shouldPlayInBackground is deliberately false: this alarm only plays while
    // the NewOrderAlert modal is on screen, i.e. always in the foreground.
    // Claiming background audio would mean declaring the "audio" UIBackgroundMode
    // without ever using it — an App Store rejection reason. Screen-off alerting
    // comes from the FCM/APNs notification channel sound, not from here.
    //
    // doNotMix takes exclusive audio focus: a new order must not be a quiet layer
    // under whatever else is playing in the restaurant.
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: false,
      interruptionMode: 'doNotMix',
    });

    const created = createAudioPlayer(require('../assets/sounds/new_order.wav'));
    created.loop = true;
    created.volume = 1.0;
    created.play();
    player = created;
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

  if (player) {
    try {
      player.pause();
      // remove() releases the native player. Without it each alert would leak
      // one, and they are a finite resource.
      player.remove();
    } catch {
      // Already released
    }
    player = null;
  }
}
