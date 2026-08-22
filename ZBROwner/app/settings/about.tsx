import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, BorderRadius } from '../../constants/theme';
import Card from '../../components/Card';
import { useT } from '../../i18n';
import { CONTACT, hasLegalLinks } from '../../constants/contact';

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

      {/* Links — only rows with a configured destination are rendered. A row
          with an "opens externally" chevron that does nothing is worse than no
          row at all. Fill in constants/contact.ts to enable them. */}
      {hasLegalLinks && (
        <>
          <Text style={styles.sectionTitle}>{t('aboutScreen.legal')}</Text>
          <Card style={styles.linksCard}>
            {([
              { label: t('aboutScreen.termsOfService'), icon: 'document-text-outline' as const, url: CONTACT.termsUrl },
              { label: t('aboutScreen.privacyPolicy'), icon: 'shield-checkmark-outline' as const, url: CONTACT.privacyPolicyUrl },
              { label: t('aboutScreen.licenses'), icon: 'code-slash-outline' as const, url: CONTACT.licensesUrl },
              { label: t('aboutScreen.deleteAccount'), icon: 'trash-outline' as const, url: CONTACT.dataDeletionUrl },
            ].filter((l) => !!l.url) as { label: string; icon: any; url: string }[]).map((link, index, arr) => (
              <TouchableOpacity
                key={link.label}
                style={[styles.linkRow, index < arr.length - 1 && styles.linkBorder]}
                activeOpacity={0.7}
                onPress={() => Linking.openURL(link.url)}
              >
                <Ionicons name={link.icon} size={20} color={Colors.gray600} />
                <Text style={styles.linkLabel}>{link.label}</Text>
                <Ionicons name="open-outline" size={16} color={Colors.gray400} />
              </TouchableOpacity>
            ))}
          </Card>
        </>
      )}

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
  copyright: { ...Typography.caption1, color: Colors.gray400, textAlign: 'center', marginTop: Spacing.md },
});
