import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, Typography, BorderRadius, Shadows } from '../../constants/theme';
import { useStore } from '../../store';
import Card from '../../components/Card';
import PillSwitch from '../../components/PillSwitch';

export default function MoreScreen() {
  const { restaurantName, isOpen, toggleOpen } = useStore();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const menuItems = [
    { icon: 'storefront-outline' as const, label: 'Restaurant Profile', onPress: () => {} },
    { icon: 'time-outline' as const, label: 'Working Hours', onPress: () => {} },
    { icon: 'card-outline' as const, label: 'Payment Settings', onPress: () => {} },
    { icon: 'notifications-outline' as const, label: 'Notification Preferences', onPress: () => {} },
    { icon: 'people-outline' as const, label: 'Staff Accounts', onPress: () => {} },
    { icon: 'document-text-outline' as const, label: 'Order History', onPress: () => {} },
    { icon: 'help-circle-outline' as const, label: 'Help Center', onPress: () => {} },
    { icon: 'information-circle-outline' as const, label: 'About', onPress: () => {} },
  ];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]} showsVerticalScrollIndicator={false}>
      {/* Restaurant Header */}
      <View style={styles.restaurantHeader}>
        <View style={styles.avatarPlaceholder}>
          <Ionicons name="restaurant" size={28} color={Colors.accent} />
        </View>
        <View style={styles.restaurantInfo}>
          <Text style={styles.restaurantName}>{restaurantName}</Text>
          <PillSwitch isOn={isOpen} onToggle={toggleOpen} />
        </View>
      </View>

      {/* Settings Menu */}
      <Text style={styles.sectionTitle}>Settings</Text>
      <Card style={styles.menuCard}>
        {menuItems.map((item, index) => (
          <TouchableOpacity
            key={item.label}
            style={[styles.menuRow, index < menuItems.length - 1 && styles.menuRowBorder]}
            onPress={item.onPress}
            activeOpacity={0.7}
          >
            <Ionicons name={item.icon} size={22} color={Colors.gray600} />
            <Text style={styles.menuLabel}>{item.label}</Text>
            <Ionicons name="chevron-forward" size={18} color={Colors.gray400} />
          </TouchableOpacity>
        ))}
      </Card>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutButton} activeOpacity={0.7}>
        <Ionicons name="log-out-outline" size={20} color={Colors.danger} />
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>

      <Text style={styles.versionText}>ZBR Owner v1.0.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.gray50 },
  content: { padding: Spacing.base },
  restaurantHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.xl, gap: Spacing.base },
  avatarPlaceholder: { width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.accentLight, justifyContent: 'center', alignItems: 'center' },
  restaurantInfo: { flex: 1, gap: Spacing.sm },
  restaurantName: { ...Typography.title2, color: Colors.black },
  sectionTitle: { ...Typography.headline, color: Colors.black, marginBottom: Spacing.sm },
  menuCard: { padding: 0 },
  menuRow: { flexDirection: 'row', alignItems: 'center', padding: Spacing.base, gap: Spacing.md, minHeight: 48 },
  menuRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.gray100 },
  menuLabel: { ...Typography.body, color: Colors.black, flex: 1 },
  logoutButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.base, marginTop: Spacing.xl, gap: Spacing.sm, minHeight: 48 },
  logoutText: { ...Typography.headline, color: Colors.danger },
  versionText: { ...Typography.caption1, color: Colors.gray400, textAlign: 'center', marginTop: Spacing.md },
});
