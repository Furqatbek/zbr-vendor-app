import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors, BorderRadius, Typography, Spacing } from '../constants/theme';
import { useT } from '../i18n';

interface Props {
  isOn: boolean;
  onToggle: () => void;
}

export default function PillSwitch({ isOn, onToggle }: Props) {
  const t = useT();

  const handleToggle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onToggle();
  };

  return (
    <TouchableOpacity
      style={[styles.pill, isOn ? styles.pillOn : styles.pillOff]}
      onPress={handleToggle}
      accessibilityLabel={isOn ? t('pillSwitch.openAccessibility') : t('pillSwitch.closedAccessibility')}
      accessibilityRole="switch"
      activeOpacity={0.8}
    >
      <View style={[styles.indicator, isOn ? styles.indicatorOn : styles.indicatorOff]} />
      <Text style={[styles.label, isOn ? styles.labelOn : styles.labelOff]}>
        {isOn ? t('pillSwitch.open') : t('pillSwitch.closed')}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: BorderRadius.full, minHeight: 44 },
  pillOn: { backgroundColor: Colors.successLight },
  pillOff: { backgroundColor: Colors.dangerLight },
  indicator: { width: 10, height: 10, borderRadius: 5, marginRight: Spacing.sm },
  indicatorOn: { backgroundColor: Colors.success },
  indicatorOff: { backgroundColor: Colors.danger },
  label: { ...Typography.subhead, fontWeight: '600' },
  labelOn: { color: Colors.success },
  labelOff: { color: Colors.danger },
});
