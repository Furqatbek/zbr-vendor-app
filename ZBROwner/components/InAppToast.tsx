import React, { useEffect, useRef, useState } from 'react';
import { Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../constants/theme';

interface Props {
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  visible: boolean;
  /** Called when the toast times out by itself. NOT a user decision. */
  onDismiss: () => void;
  actionLabel?: string;
  onAction?: () => void;
  /**
   * Optional explicit close. When given, an × is shown — so a caller that
   * treats being closed as a real choice (remembering it, suppressing the
   * message) has a way for the user to actually make that choice, rather than
   * inferring it from a timer that fired while nobody was looking.
   */
  onClose?: () => void;
  /** Accessible name for the × — an icon-only button needs one. */
  closeLabel?: string;
}

const iconMap = {
  info: 'information-circle' as const,
  success: 'checkmark-circle' as const,
  warning: 'alert-circle' as const,
  error: 'close-circle' as const,
};

const colorMap = {
  info: Colors.info,
  success: Colors.success,
  warning: Colors.warning,
  error: Colors.danger,
};

const AUTO_DISMISS_MS = 4000;

/**
 * Where to park the toast before it has been measured. Comfortably taller than
 * any two-line toast plus the largest safe-area inset, so the very first hide
 * is off-screen even though nothing has laid out yet.
 */
const ASSUMED_OFFSCREEN = 400;

export default function InAppToast({ message, type = 'info', visible, onDismiss, actionLabel, onAction, onClose, closeLabel = 'Close' }: Props) {
  const insets = useSafeAreaInsets();
  const top = insets.top + Spacing.sm;

  // Measured, because clearing the screen means clearing the toast's OWN height
  // as well as the inset that pushes it down. The previous fixed -100 did
  // neither: on a Dynamic Island phone the inset alone is ~59, so a two-line
  // banner ended up around -33 and roughly a third of it sat above the status
  // bar permanently — visible, and still able to take a tap.
  const [height, setHeight] = useState(0);

  // Read inside the animation callbacks, which must not re-run when a relayout
  // changes the number — depending on it would restart the auto-dismiss timer.
  const hiddenYRef = useRef(-ASSUMED_OFFSCREEN);
  hiddenYRef.current = height ? -(top + height + Spacing.sm) : -ASSUMED_OFFSCREEN;

  // A toast with nothing to say must not occupy the screen. Callers drive
  // `visible` from truthiness — `visible={!!toastMessage}` — and a message that
  // is empty or only whitespace is truthy enough to pass that and still render
  // as a bare card with an icon and no text, which is what appeared above the
  // menu categories. Emptiness is decided here so no caller can reintroduce it.
  const hasText = message.trim().length > 0;
  const shown = visible && hasText;

  // Unmounted while hidden, so no arithmetic mistake here can ever leave a
  // sliver on screen or swallow a touch near the top of the display again.
  const [mounted, setMounted] = useState(shown);
  const translateY = useRef(new Animated.Value(-ASSUMED_OFFSCREEN)).current;

  // Asked to show nothing: clear the caller's state rather than sit on it, or
  // the blank message stays set and the next real one has to fight it.
  useEffect(() => {
    if (visible && !hasText) onDismiss();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, hasText]);

  useEffect(() => {
    if (shown) {
      setMounted(true);
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 15 }).start();
      const timer = setTimeout(onDismiss, AUTO_DISMISS_MS);
      return () => clearTimeout(timer);
    }

    Animated.spring(translateY, { toValue: hiddenYRef.current, useNativeDriver: true }).start(
      ({ finished }) => {
        if (finished) setMounted(false);
      },
    );
    return undefined;
    // Deliberately keyed on `shown` alone. onDismiss is usually an inline
    // closure, so depending on it would restart the auto-dismiss timer on every
    // parent render and the toast would never go away.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown]);

  const onLayout = (e: LayoutChangeEvent) => {
    const measured = Math.round(e.nativeEvent.layout.height);
    if (measured && measured !== height) setHeight(measured);
  };

  // hasText is checked here as well as through `shown`, so a blank message
  // disappears at once instead of playing a hide animation on an empty card.
  if (!mounted || !hasText) return null;

  return (
    <Animated.View
      onLayout={onLayout}
      pointerEvents={shown ? 'auto' : 'none'}
      style={[styles.container, { top, transform: [{ translateY }] }]}
    >
      <Ionicons name={iconMap[type]} size={20} color={colorMap[type]} />
      <Text style={styles.message} numberOfLines={2}>{message}</Text>
      {actionLabel && onAction && (
        <TouchableOpacity onPress={onAction} style={styles.action}>
          <Text style={styles.actionText}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
      {onClose && (
        <TouchableOpacity
          onPress={onClose}
          style={styles.close}
          accessibilityRole="button"
          accessibilityLabel={closeLabel}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="close" size={18} color={Colors.gray400} />
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: Spacing.base,
    right: Spacing.base,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.card,
    padding: Spacing.md,
    gap: Spacing.sm,
    zIndex: 9999,
    ...Shadows.cardHover,
  },
  message: {
    ...Typography.subhead,
    color: Colors.gray800,
    flex: 1,
  },
  action: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.sm,
  },
  close: {
    minHeight: 44,
    minWidth: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    ...Typography.subhead,
    fontWeight: '600',
    color: Colors.accent,
  },
});
