import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../constants/theme';

interface Props {
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  visible: boolean;
  onDismiss: () => void;
  actionLabel?: string;
  onAction?: () => void;
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

export default function InAppToast({ message, type = 'info', visible, onDismiss, actionLabel, onAction }: Props) {
  const translateY = useRef(new Animated.Value(-100)).current;
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (visible) {
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 15 }).start();
      const timer = setTimeout(onDismiss, 4000);
      return () => clearTimeout(timer);
    } else {
      Animated.spring(translateY, { toValue: -100, useNativeDriver: true }).start();
    }
  }, [visible]);

  return (
    <Animated.View style={[styles.container, { top: insets.top + 8, transform: [{ translateY }] }]}>
      <Ionicons name={iconMap[type]} size={20} color={colorMap[type]} />
      <Text style={styles.message} numberOfLines={2}>{message}</Text>
      {actionLabel && onAction && (
        <TouchableOpacity onPress={onAction} style={styles.action}>
          <Text style={styles.actionText}>{actionLabel}</Text>
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
  actionText: {
    ...Typography.subhead,
    fontWeight: '600',
    color: Colors.accent,
  },
});
