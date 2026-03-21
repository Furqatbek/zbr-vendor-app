import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors, BorderRadius, Typography, Spacing } from '../constants/theme';

interface Props {
  label: string;
  selected: boolean;
  onPress: () => void;
}

export default function Chip({ label, selected, onPress }: Props) {
  const handlePress = () => {
    Haptics.selectionAsync();
    onPress();
  };

  return (
    <TouchableOpacity
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={handlePress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: BorderRadius.chip,
    backgroundColor: Colors.gray100,
    marginRight: Spacing.sm,
    minHeight: 44,
    justifyContent: 'center',
  },
  chipSelected: {
    backgroundColor: Colors.accent,
  },
  label: {
    ...Typography.footnote,
    fontWeight: '500',
    color: Colors.gray700,
  },
  labelSelected: {
    color: Colors.white,
  },
});
