import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, BorderRadius } from '../../constants/theme';
import Card from '../../components/Card';

export default function AboutScreen() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Logo / Hero */}
      <View style={styles.hero}>
        <View style={styles.logoCircle}>
          <Ionicons name="storefront" size={40} color={Colors.accent} />
        </View>
        <Text style={styles.appName}>ZBR Owner</Text>
        <Text style={styles.version}>Version 1.0.0 (Build 1)</Text>
        <Text style={styles.tagline}>Restaurant management made simple</Text>
      </View>

      {/* App Info */}
      <Card style={styles.infoCard}>
        <Text style={styles.infoText}>
          ZBR Owner helps restaurant owners manage orders, menus, staff, and finances
          all from one place. Built for speed and simplicity.
        </Text>
      </Card>

      {/* Links */}
      <Text style={styles.sectionTitle}>Legal</Text>
      <Card style={styles.linksCard}>
        {[
          { label: 'Terms of Service', icon: 'document-text-outline' as const },
          { label: 'Privacy Policy', icon: 'shield-checkmark-outline' as const },
          { label: 'Cookie Policy', icon: 'information-circle-outline' as const },
          { label: 'Licenses', icon: 'code-slash-outline' as const },
        ].map((link, index, arr) => (
          <TouchableOpacity key={link.label} style={[styles.linkRow, index < arr.length - 1 && styles.linkBorder]} activeOpacity={0.7}>
            <Ionicons name={link.icon} size={20} color={Colors.gray600} />
            <Text style={styles.linkLabel}>{link.label}</Text>
            <Ionicons name="open-outline" size={16} color={Colors.gray400} />
          </TouchableOpacity>
        ))}
      </Card>

      {/* System Info */}
      <Text style={styles.sectionTitle}>System Info</Text>
      <Card style={styles.systemCard}>
        {[
          { label: 'Platform', value: 'Expo SDK 55' },
          { label: 'Runtime', value: 'React Native 0.83' },
          { label: 'Navigation', value: 'Expo Router' },
          { label: 'State Management', value: 'Zustand' },
        ].map((info, index, arr) => (
          <View key={info.label} style={[styles.sysRow, index < arr.length - 1 && styles.sysBorder]}>
            <Text style={styles.sysLabel}>{info.label}</Text>
            <Text style={styles.sysValue}>{info.value}</Text>
          </View>
        ))}
      </Card>

      <Text style={styles.copyright}>© 2026 ZBR. All rights reserved.</Text>
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
