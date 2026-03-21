import React from 'react';
import { View, Text, StyleSheet, ScrollView, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, BorderRadius } from '../../constants/theme';
import { useStore } from '../../store';
import Card from '../../components/Card';

const NOTIFICATION_CONFIG = [
  { key: 'newOrder', label: 'New Orders', description: 'Alert when a new order is received', icon: 'receipt-outline' as const, important: true },
  { key: 'orderTimeout', label: 'Order Timeout Warning', description: 'Urgent alert when order is about to expire', icon: 'alarm-outline' as const, important: true },
  { key: 'courierAssigned', label: 'Courier Assigned', description: 'Notification when a courier is assigned', icon: 'bicycle-outline' as const, important: false },
  { key: 'reviewReceived', label: 'New Reviews', description: 'Alert when a customer leaves a review', icon: 'star-outline' as const, important: false },
  { key: 'promotions', label: 'Promotions & Updates', description: 'Platform news and promotional offers', icon: 'megaphone-outline' as const, important: false },
  { key: 'weeklyReport', label: 'Weekly Report', description: 'Weekly summary of revenue and performance', icon: 'bar-chart-outline' as const, important: false },
];

export default function NotificationsScreen() {
  const { notificationPrefs, toggleNotificationPref } = useStore();

  const criticalNotifs = NOTIFICATION_CONFIG.filter((n) => n.important);
  const otherNotifs = NOTIFICATION_CONFIG.filter((n) => !n.important);

  const renderNotifItem = (item: typeof NOTIFICATION_CONFIG[0], index: number, arr: typeof NOTIFICATION_CONFIG) => (
    <View key={item.key} style={[styles.notifRow, index < arr.length - 1 && styles.notifBorder]}>
      <View style={[styles.notifIcon, item.important && styles.notifIconImportant]}>
        <Ionicons name={item.icon} size={20} color={item.important ? Colors.accent : Colors.gray500} />
      </View>
      <View style={styles.notifInfo}>
        <Text style={styles.notifLabel}>{item.label}</Text>
        <Text style={styles.notifDesc}>{item.description}</Text>
      </View>
      <Switch
        value={notificationPrefs[item.key] ?? false}
        onValueChange={() => toggleNotificationPref(item.key)}
        trackColor={{ false: Colors.gray300, true: Colors.accentLight }}
        thumbColor={notificationPrefs[item.key] ? Colors.accent : Colors.gray400}
      />
    </View>
  );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>Critical Alerts</Text>
      <Text style={styles.sectionDesc}>These notifications are essential for order management</Text>
      <Card style={styles.notifCard}>
        {criticalNotifs.map((item, i) => renderNotifItem(item, i, criticalNotifs))}
      </Card>

      <Text style={styles.sectionTitle}>Other Notifications</Text>
      <Card style={styles.notifCard}>
        {otherNotifs.map((item, i) => renderNotifItem(item, i, otherNotifs))}
      </Card>

      <Card style={styles.infoCard}>
        <Ionicons name="information-circle-outline" size={20} color={Colors.info} />
        <Text style={styles.infoText}>
          Push notifications require device permission. Go to your device settings to manage app notification permissions.
        </Text>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.gray50 },
  content: { padding: Spacing.base, paddingBottom: 100 },
  sectionTitle: { ...Typography.headline, color: Colors.black, marginBottom: 4, marginTop: Spacing.base },
  sectionDesc: { ...Typography.footnote, color: Colors.gray500, marginBottom: Spacing.sm },
  notifCard: { padding: 0, marginBottom: Spacing.sm },
  notifRow: { flexDirection: 'row', alignItems: 'center', padding: Spacing.base, minHeight: 64 },
  notifBorder: { borderBottomWidth: 1, borderBottomColor: Colors.gray100 },
  notifIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.gray100, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md },
  notifIconImportant: { backgroundColor: Colors.accentLight },
  notifInfo: { flex: 1, marginRight: Spacing.sm },
  notifLabel: { ...Typography.subhead, fontWeight: '600', color: Colors.black },
  notifDesc: { ...Typography.caption1, color: Colors.gray500, marginTop: 2 },
  infoCard: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, marginTop: Spacing.base },
  infoText: { ...Typography.footnote, color: Colors.gray500, flex: 1, lineHeight: 18 },
});
