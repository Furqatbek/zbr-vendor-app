import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, Typography, BorderRadius, Shadows } from '../../constants/theme';
import { useStore } from '../../store';
import Card from '../../components/Card';
import PillSwitch from '../../components/PillSwitch';
import RatingStars from '../../components/RatingStars';

export default function MoreScreen() {
  const { restaurantName, isOpen, toggleOpen, orders, reviews, revenueData, restaurantProfile, staffMembers } = useStore();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const stats = useMemo(() => {
    const todayOrders = orders.filter((o) => o.status !== 'cancelled');
    const activeOrders = orders.filter((o) => ['received', 'preparing', 'ready'].includes(o.status));
    const avgRating = reviews.length > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;
    const activeStaff = staffMembers.filter((s) => s.isActive).length;
    return { todayOrders: todayOrders.length, activeOrders: activeOrders.length, avgRating, activeStaff };
  }, [orders, reviews, staffMembers]);

  type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

  const settingsItems: { icon: IoniconsName; label: string; route: string; subtitle: string }[] = [
    { icon: 'storefront-outline', label: 'Restaurant Profile', route: '/settings/profile', subtitle: restaurantProfile.address.split(',')[0] },
    { icon: 'time-outline', label: 'Working Hours', route: '/settings/working-hours', subtitle: isOpen ? 'Currently open' : 'Currently closed' },
    { icon: 'card-outline', label: 'Payment Settings', route: '/settings/payments', subtitle: 'Balance & payouts' },
    { icon: 'notifications-outline', label: 'Notification Preferences', route: '/settings/notifications', subtitle: 'Manage alerts' },
    { icon: 'people-outline', label: 'Staff Accounts', route: '/settings/staff', subtitle: `${stats.activeStaff} active members` },
    { icon: 'document-text-outline', label: 'Order History', route: '/settings/order-history', subtitle: `${orders.length} total orders` },
    { icon: 'help-circle-outline', label: 'Help Center', route: '/settings/help', subtitle: 'FAQ & support' },
    { icon: 'information-circle-outline', label: 'About', route: '/settings/about', subtitle: 'v1.0.0' },
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
          <Text style={styles.restaurantAddress} numberOfLines={1}>{restaurantProfile.address}</Text>
        </View>
        <PillSwitch isOn={isOpen} onToggle={toggleOpen} />
      </View>

      {/* Quick Stats */}
      <View style={styles.statsGrid}>
        <Card style={styles.statCard}>
          <Ionicons name="receipt" size={20} color={Colors.info} />
          <Text style={styles.statValue}>{stats.activeOrders}</Text>
          <Text style={styles.statLabel}>Active Orders</Text>
        </Card>
        <Card style={styles.statCard}>
          <Ionicons name="cash" size={20} color={Colors.success} />
          <Text style={styles.statValue}>${revenueData.totalRevenue.toFixed(0)}</Text>
          <Text style={styles.statLabel}>Today's Revenue</Text>
        </Card>
        <Card style={styles.statCard}>
          <Ionicons name="star" size={20} color={Colors.warning} />
          <Text style={styles.statValue}>{stats.avgRating.toFixed(1)}</Text>
          <Text style={styles.statLabel}>Avg Rating</Text>
        </Card>
        <Card style={styles.statCard}>
          <Ionicons name="people" size={20} color={Colors.accent} />
          <Text style={styles.statValue}>{stats.activeStaff}</Text>
          <Text style={styles.statLabel}>Staff Online</Text>
        </Card>
      </View>

      {/* Settings Menu */}
      <Text style={styles.sectionTitle}>Settings & Management</Text>
      <Card style={styles.menuCard}>
        {settingsItems.map((item, index) => (
          <TouchableOpacity
            key={item.label}
            style={[styles.menuRow, index < settingsItems.length - 1 && styles.menuRowBorder]}
            onPress={() => router.push(item.route as any)}
            activeOpacity={0.7}
          >
            <View style={styles.menuIconWrap}>
              <Ionicons name={item.icon} size={20} color={Colors.accent} />
            </View>
            <View style={styles.menuInfo}>
              <Text style={styles.menuLabel}>{item.label}</Text>
              <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.gray400} />
          </TouchableOpacity>
        ))}
      </Card>

      {/* Logout */}
      <TouchableOpacity
        style={styles.logoutButton}
        activeOpacity={0.7}
        onPress={() => Alert.alert('Log Out', 'Are you sure you want to log out?', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Log Out', style: 'destructive' },
        ])}
      >
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
  restaurantHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.xl, gap: Spacing.md },
  avatarPlaceholder: { width: 52, height: 52, borderRadius: 26, backgroundColor: Colors.accentLight, justifyContent: 'center', alignItems: 'center' },
  restaurantInfo: { flex: 1 },
  restaurantName: { ...Typography.title3, color: Colors.black },
  restaurantAddress: { ...Typography.caption1, color: Colors.gray500, marginTop: 2 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.xl },
  statCard: { width: '48%' as any, flexGrow: 1, flexBasis: '46%' as any, alignItems: 'center', gap: 4, paddingVertical: Spacing.md },
  statValue: { ...Typography.title3, color: Colors.black },
  statLabel: { ...Typography.caption1, color: Colors.gray500 },
  sectionTitle: { ...Typography.headline, color: Colors.black, marginBottom: Spacing.sm },
  menuCard: { padding: 0, marginBottom: Spacing.base },
  menuRow: { flexDirection: 'row', alignItems: 'center', padding: Spacing.base, minHeight: 56 },
  menuRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.gray100 },
  menuIconWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.accentLight, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md },
  menuInfo: { flex: 1 },
  menuLabel: { ...Typography.body, color: Colors.black },
  menuSubtitle: { ...Typography.caption1, color: Colors.gray500, marginTop: 2 },
  logoutButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.base, marginTop: Spacing.base, gap: Spacing.sm, minHeight: 48 },
  logoutText: { ...Typography.headline, color: Colors.danger },
  versionText: { ...Typography.caption1, color: Colors.gray400, textAlign: 'center', marginTop: Spacing.md },
});
