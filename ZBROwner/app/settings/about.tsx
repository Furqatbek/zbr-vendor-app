import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, BorderRadius } from '../../constants/theme';
import Card from '../../components/Card';
import { useT } from '../../i18n';

export default function AboutScreen() {
  const t = useT();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Logo / Hero */}
      <View style={styles.hero}>
        <View style={styles.logoCircle}>
          <Ionicons name="storefront" size={40} color={Colors.accent} />
        </View>
        <Text style={styles.appName}>{t('aboutScreen.appName')}</Text>
        <Text style={styles.version}>{t('aboutScreen.version')}</Text>
        <Text style={styles.tagline}>{t('aboutScreen.tagline')}</Text>
      </View>

      {/* App Info */}
      <Card style={styles.infoCard}>
        <Text style={styles.infoText}>
          {t('aboutScreen.appDescription')}
        </Text>
      </Card>

      {/* Links */}
      <Text style={styles.sectionTitle}>{t('aboutScreen.legal')}</Text>
      <Card style={styles.linksCard}>
        {[
          { label: t('aboutScreen.termsOfService'), icon: 'document-text-outline' as const },
          { label: t('aboutScreen.privacyPolicy'), icon: 'shield-checkmark-outline' as const },
          { label: t('aboutScreen.cookiePolicy'), icon: 'information-circle-outline' as const },
          { label: t('aboutScreen.licenses'), icon: 'code-slash-outline' as const },
        ].map((link, index, arr) => (
          <TouchableOpacity key={link.label} style={[styles.linkRow, index < arr.length - 1 && styles.linkBorder]} activeOpacity={0.7}>
            <Ionicons name={link.icon} size={20} color={Colors.gray600} />
            <Text style={styles.linkLabel}>{link.label}</Text>
            <Ionicons name="open-outline" size={16} color={Colors.gray400} />
          </TouchableOpacity>
        ))}
      </Card>

      {/* System Info */}
      <Text style={styles.sectionTitle}>{t('aboutScreen.systemInfo')}</Text>
      <Card style={styles.systemCard}>
        {[
          { label: t('aboutScreen.platform'), value: 'Expo SDK 55' },
          { label: t('aboutScreen.runtime'), value: 'React Native 0.83' },
          { label: t('aboutScreen.navigation'), value: 'Expo Router' },
          { label: t('aboutScreen.stateManagement'), value: 'Zustand' },
        ].map((info, index, arr) => (
          <View key={info.label} style={[styles.sysRow, index < arr.length - 1 && styles.sysBorder]}>
            <Text style={styles.sysLabel}>{info.label}</Text>
            <Text style={styles.sysValue}>{info.value}</Text>
          </View>
        ))}
      </Card>

      <Text style={styles.copyright}>{t('aboutScreen.copyright')}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.gray50 },
  content: { padding: Spacing.base, paddingBottom: 100 },
  hero: { alignItems: 'center', paddingVertical: Spacing.xl },
  logoCircle: { width: 80, height: 80, borderRadius: 20, backgroundColor: Colors.accentLight, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.md },
  appName: { ...Typography.title1, color: Colors.black },
  version: { ...Typography.footnote, color: Colors.gray500, marginTop: 4 },
  tagline: { ...Typography.subhead, color: Colors.gray600, marginTop: Spacing.sm },
  infoCard: { marginBottom: Spacing.xl },
  infoText: { ...Typography.body, color: Colors.gray700, lineHeight: 24, textAlign: 'center' },
  sectionTitle: { ...Typography.headline, color: Colors.black, marginBottom: Spacing.sm },
  linksCard: { padding: 0, marginBottom: Spacing.xl },
  linkRow: { flexDirection: 'row', alignItems: 'center', padding: Spacing.base, gap: Spacing.md, minHeight: 48 },
  linkBorder: { borderBottomWidth: 1, borderBottomColor: Colors.gray100 },
  linkLabel: { ...Typography.body, color: Colors.black, flex: 1 },
  systemCard: { padding: 0, marginBottom: Spacing.xl },
  sysRow: { flexDirection: 'row', justifyContent: 'space-between', padding: Spacing.base },
  sysBorder: { borderBottomWidth: 1, borderBottomColor: Colors.gray100 },
  sysLabel: { ...Typography.subhead, color: Colors.gray500 },
  sysValue: { ...Typography.subhead, color: Colors.black, fontWeight: '500' },
  copyright: { ...Typography.caption1, color: Colors.gray400, textAlign: 'center', marginTop: Spacing.md },
});
