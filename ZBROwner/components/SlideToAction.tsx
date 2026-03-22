import React, { useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
  runOnJS,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors, BorderRadius, Typography, Spacing } from '../constants/theme';
import { useT } from '../i18n';

const SLIDER_HEIGHT = 56;
const THUMB_SIZE = 48;
const SPRING_CONFIG = { damping: 20, stiffness: 200 };

interface Props {
  onAccept: () => void;
  onDecline: () => void;
}

export default function SlideToAction({ onAccept, onDecline }: Props) {
  const t = useT();
  const translateX = useSharedValue(0);
  const containerWidth = useSharedValue(0);

  const fireAccept = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onAccept();
  }, [onAccept]);

  const fireDecline = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    onDecline();
  }, [onDecline]);

  const pan = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-10, 10])
    .onUpdate((e) => {
      const maxRight = containerWidth.value - THUMB_SIZE - 8;
      const maxLeft = -maxRight;
      translateX.value = Math.min(maxRight, Math.max(maxLeft, e.translationX));
    })
    .onEnd((e) => {
      const threshold = (containerWidth.value - THUMB_SIZE) * 0.6;
      if (e.translationX > threshold) {
        // Fire immediately — don't wait for the animation
        runOnJS(fireAccept)();
        translateX.value = withSpring(containerWidth.value - THUMB_SIZE - 8, SPRING_CONFIG, () => {
          translateX.value = withSpring(0, SPRING_CONFIG);
        });
      } else if (e.translationX < -threshold) {
        runOnJS(fireDecline)();
        translateX.value = withSpring(-(containerWidth.value - THUMB_SIZE - 8), SPRING_CONFIG, () => {
          translateX.value = withSpring(0, SPRING_CONFIG);
        });
      } else {
        translateX.value = withSpring(0, SPRING_CONFIG);
      }
    });

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const acceptLabelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, 100], [0.3, 1], 'clamp'),
  }));

  const declineLabelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-100, 0], [1, 0.3], 'clamp'),
  }));

  return (
    <View
      style={styles.container}
      onLayout={(e) => { containerWidth.value = e.nativeEvent.layout.width; }}
    >
      <Animated.Text style={[styles.labelLeft, declineLabelStyle]}>
        {t('slideToAction.decline')}
      </Animated.Text>
      <Animated.Text style={[styles.labelRight, acceptLabelStyle]}>
        {t('slideToAction.accept')}
      </Animated.Text>
      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.thumb, thumbStyle]}>
          <Ionicons name="swap-horizontal" size={24} color={Colors.white} />
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { height: SLIDER_HEIGHT, backgroundColor: Colors.gray100, borderRadius: BorderRadius.card, justifyContent: 'center', alignItems: 'center', overflow: 'hidden', marginTop: Spacing.sm },
  thumb: { width: THUMB_SIZE, height: THUMB_SIZE, borderRadius: BorderRadius.button, backgroundColor: Colors.accent, justifyContent: 'center', alignItems: 'center', position: 'absolute' },
  labelLeft: { position: 'absolute', left: Spacing.base, ...Typography.subhead, fontWeight: '600', color: Colors.danger },
  labelRight: { position: 'absolute', right: Spacing.base, ...Typography.subhead, fontWeight: '600', color: Colors.success },
});
