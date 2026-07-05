import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, BorderRadius } from '../constants/theme';
import { useT } from '../i18n';

/**
 * Inline "couldn't load / retry" state for data screens, so a fetch failure is
 * distinguishable from genuinely-empty data (the app previously rendered the
 * same friendly empty state for both).
 */
export default function ErrorState({ onRetry }: { onRetry: () => void }) {
  const t = useT();
  return (
    <View style={styles.container}>
      <Ionicons name="cloud-offline-outline" size={44} color={Colors.gray300} />
      <Text style={styles.title}>{t('common.loadError')}</Text>
      <TouchableOpacity style={styles.button} onPress={onRetry} activeOpacity={0.8}>
        <Ionicons name="refresh" size={16} color={Colors.accent} />
        <Text style={styles.buttonText}>{t('common.retry')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', padding: Spacing.xl, gap: Spacing.md },
  title: { ...Typography.subhead, color: Colors.gray500, textAlign: 'center' },
  button: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.base, borderRadius: BorderRadius.button, borderWidth: 1, borderColor: Colors.accent },
  buttonText: { ...Typography.subhead, color: Colors.accent, fontWeight: '600' as const },
});
