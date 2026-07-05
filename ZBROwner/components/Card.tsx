import React, { ReactNode } from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { Colors, Spacing, BorderRadius, Shadows } from '../constants/theme';

interface Props {
  children: ReactNode;
  // StyleProp so callers can pass arrays / conditional styles, e.g.
  // style={[styles.card, !read && styles.unread]}.
  style?: StyleProp<ViewStyle>;
}

export default function Card({ children, style }: Props) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.card,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: Colors.gray200,
    ...Shadows.card,
  },
});
