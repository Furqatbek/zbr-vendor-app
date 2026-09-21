import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, BorderRadius } from '../constants/theme';
import { openAppStore } from '../constants/stores';
import { useT } from '../i18n';

interface Props {
  visible: boolean;
  /** Store URL from the server, if it was valid for this platform. */
  storeUrl?: string;
}

/**
 * Blocking update dialog.
 *
 * Deliberately has no dismiss: no close button, and `onRequestClose` is a no-op
 * so the Android back button cannot escape it. A mandatory update means the
 * installed build can no longer be trusted against the current API, and letting
 * someone tap past that just moves the failure somewhere less obvious.
 *
 * The optional case is a toast instead — see app/_layout.tsx. Blocking a
 * restaurant mid-service for a nice-to-have would be its own outage.
 */
export default function UpdateRequiredModal({ visible, storeUrl }: Props) {
  const t = useT();

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={() => {}}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons name="arrow-up-circle" size={40} color={Colors.accent} />
          </View>

          <Text style={styles.title}>{t('update.requiredTitle')}</Text>
          <Text style={styles.body}>{t('update.requiredMessage')}</Text>

          <TouchableOpacity
            style={styles.button}
            onPress={() => openAppStore(storeUrl)}
            activeOpacity={0.85}
          >
            <Ionicons name="cloud-download-outline" size={18} color={Colors.white} />
            <Text style={styles.buttonText}>{t('update.updateNow')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: Spacing.lg,
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.accentLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.base,
  },
  title: { ...Typography.title3, color: Colors.black, textAlign: 'center' },
  body: {
    ...Typography.subhead,
    color: Colors.gray600,
    textAlign: 'center',
    marginTop: Spacing.sm,
    lineHeight: 21,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.accent,
    borderRadius: BorderRadius.button,
    paddingVertical: Spacing.base,
    marginTop: Spacing.lg,
    alignSelf: 'stretch',
    minHeight: 52,
  },
  buttonText: { ...Typography.headline, color: Colors.white },
});
