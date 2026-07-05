import React from 'react';
import { View, Text, StyleSheet, ScrollView, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, BorderRadius } from '../../constants/theme';
import { useStore } from '../../store';
import Card from '../../components/Card';
import { useT } from '../../i18n';
import { FEATURES } from '../../constants/features';

export default function NotificationsScreen() {
  const { notificationPrefs, toggleNotificationPref } = useStore();
  const t = useT();

  const NOTIFICATION_CONFIG = [
    { key: 'newOrder', label: t('notificationsScreen.newOrders'), description: t('notificationsScreen.newOrdersDesc'), icon: 'receipt-outline' as const, important: true },
    { key: 'orderTimeout', label: t('notificationsScreen.orderTimeout'), description: t('notificationsScreen.orderTimeoutDesc'), icon: 'alarm-outline' as const, important: true },
    { key: 'courierAssigned', label: t('notificationsScreen.courierAssigned'), description: t('notificationsScreen.courierAssignedDesc'), icon: 'bicycle-outline' as const, important: false },
    { key: 'reviewReceived', label: t('notificationsScreen.newReviews'), description: t('notificationsScreen.newReviewsDesc'), icon: 'star-outline' as const, important: false },
    { key: 'promotions', label: t('notificationsScreen.promotions'), description: t('notificationsScreen.promotionsDesc'), icon: 'megaphone-outline' as const, important: false },
    { key: 'weeklyReport', label: t('notificationsScreen.weeklyReport'), description: t('notificationsScreen.weeklyReportDesc'), icon: 'bar-chart-outline' as const, important: false },
  ];

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
      {/* Prefs aren't persisted/enforced until the backend supports them
          (FEATURES.notificationPrefs). Until then the switch is disabled and
          shows the truthful state: all categories are currently delivered. */}
      <Switch
        value={FEATURES.notificationPrefs ? (notificationPrefs[item.key] ?? false) : true}
        onValueChange={() => { if (FEATURES.notificationPrefs) toggleNotificationPref(item.key); }}
        disabled={!FEATURES.notificationPrefs}
        trackColor={{ false: Colors.gray300, true: Colors.accentLight }}
        thumbColor={
          (FEATURES.notificationPrefs ? notificationPrefs[item.key] : true) ? Colors.accent : Colors.gray400
        }
      />
    </View>
  );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>{t('notificationsScreen.criticalAlerts')}</Text>
      <Text style={styles.sectionDesc}>{t('notificationsScreen.criticalDescription')}</Text>
      <Card style={styles.notifCard}>
        {criticalNotifs.map((item, i) => renderNotifItem(item, i, criticalNotifs))}
      </Card>

      <Text style={styles.sectionTitle}>{t('notificationsScreen.otherNotifications')}</Text>
      <Card style={styles.notifCard}>
        {otherNotifs.map((item, i) => renderNotifItem(item, i, otherNotifs))}
      </Card>

      <Card style={styles.infoCard}>
        <Ionicons name="information-circle-outline" size={20} color={Colors.info} />
        <Text style={styles.infoText}>
          {t('notificationsScreen.permissionNote')}
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
