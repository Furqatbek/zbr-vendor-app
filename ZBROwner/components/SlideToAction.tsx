import React, { useRef, useMemo } from 'react';
import { View, StyleSheet, Animated, PanResponder } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors, BorderRadius, Typography, Spacing } from '../constants/theme';
import { useT } from '../i18n';

const SLIDER_HEIGHT = 56;
const THUMB_SIZE = 48;

interface Props {
  onAccept: () => void;
  onDecline: () => void;
}

export default function SlideToAction({ onAccept, onDecline }: Props) {
  const t = useT();
  const pan = useRef(new Animated.Value(0)).current;
  const containerWidth = useRef(0);
  const callbacksRef = useRef({ onAccept, onDecline });
  callbacksRef.current = { onAccept, onDecline };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 5 && Math.abs(g.dx) > Math.abs(g.dy * 2),
        onMoveShouldSetPanResponderCapture: (_, g) => Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy * 2),
        onPanResponderTerminationRequest: () => false,
        onPanResponderMove: (_, g) => {
          const maxRight = containerWidth.current - THUMB_SIZE - 8;
          const maxLeft = -(containerWidth.current - THUMB_SIZE - 8);
          const clamped = Math.min(maxRight, Math.max(maxLeft, g.dx));
          pan.setValue(clamped);
        },
        onPanResponderRelease: (_, g) => {
          const threshold = (containerWidth.current - THUMB_SIZE) * 0.6;
          if (g.dx > threshold) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Animated.spring(pan, { toValue: containerWidth.current - THUMB_SIZE - 8, useNativeDriver: true }).start(() => {
              pan.setValue(0);
              callbacksRef.current.onAccept();
            });
          } else if (g.dx < -threshold) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            Animated.spring(pan, { toValue: -(containerWidth.current - THUMB_SIZE - 8), useNativeDriver: true }).start(() => {
              pan.setValue(0);
              callbacksRef.current.onDecline();
            });
          } else {
            Animated.spring(pan, { toValue: 0, useNativeDriver: true }).start();
          }
        },
      }),
    [pan],
  );

  const acceptOpacity = pan.interpolate({ inputRange: [0, 100], outputRange: [0.3, 1], extrapolate: 'clamp' });
  const declineOpacity = pan.interpolate({ inputRange: [-100, 0], outputRange: [1, 0.3], extrapolate: 'clamp' });

  return (
    <View style={styles.container} onLayout={(e) => { containerWidth.current = e.nativeEvent.layout.width; }}>
      <Animated.Text style={[styles.labelLeft, { opacity: declineOpacity }]}>
        {t('slideToAction.decline')}
      </Animated.Text>
      <Animated.Text style={[styles.labelRight, { opacity: acceptOpacity }]}>
        {t('slideToAction.accept')}
      </Animated.Text>
      <Animated.View style={[styles.thumb, { transform: [{ translateX: pan }] }]} {...panResponder.panHandlers}>
        <Ionicons name="swap-horizontal" size={24} color={Colors.white} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { height: SLIDER_HEIGHT, backgroundColor: Colors.gray100, borderRadius: BorderRadius.card, justifyContent: 'center', alignItems: 'center', overflow: 'hidden', marginTop: Spacing.sm },
  thumb: { width: THUMB_SIZE, height: THUMB_SIZE, borderRadius: BorderRadius.button, backgroundColor: Colors.accent, justifyContent: 'center', alignItems: 'center', position: 'absolute' },
  labelLeft: { position: 'absolute', left: Spacing.base, ...Typography.subhead, fontWeight: '600', color: Colors.danger },
  labelRight: { position: 'absolute', right: Spacing.base, ...Typography.subhead, fontWeight: '600', color: Colors.success },
});
