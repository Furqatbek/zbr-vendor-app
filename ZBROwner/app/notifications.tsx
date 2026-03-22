import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, BorderRadius } from '../constants/theme';
import { useAuthStore } from '../store/authStore';
import { useT } from '../i18n';
import { useRefresh } from '../hooks/useRefresh';
import Card from '../components/Card';
import Chip from '../components/Chip';
import type { AppNotification, NotificationCategory } from '../types';
import {
  fetchMyNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '../services/api';

type Filter = 'all' | NotificationCategory;

const CATEGORY_ICONS: Record<NotificationCategory, keyof typeof Ionicons.glyphMap> = {
  ORDER: 'bag-outline',
  FINANCE: 'card-outline',
  SUPPORT: 'headset-outline',
  SYSTEM: 'settings-outline',
  PROMOTION: 'pricetag-outline',
  ACCOUNT: 'person-outline',
  DELIVERY: 'bicycle-outline',
  RESTAURANT_OPS: 'restaurant-outline',
  ALERT: 'alert-circle-outline',
};

const CATEGORY_COLORS: Record<NotificationCategory, string> = {
  ORDER: Colors.accent,
  FINANCE: Colors.success,
  SUPPORT: Colors.info,
  SYSTEM: Colors.gray500,
  PROMOTION: Colors.warning,
  ACCOUNT: '#8B5CF6',
  DELIVERY: '#06B6D4',
  RESTAURANT_OPS: Colors.accent,
  ALERT: Colors.danger,
};

const FILTER_CATEGORIES: Filter[] = ['all', 'ORDER', 'FINANCE', 'DELIVERY', 'RESTAURANT_OPS', 'ALERT', 'PROMOTION', 'SUPPORT', 'ACCOUNT', 'SYSTEM'];

export default function NotificationsScreen() {
  const t = useT();
  const user = useAuthStore((s) => s.user);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState<Filter>('all');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadNotifications = useCallback(async (reset = true) => {
    if (!user) return;
    try {
      const pageNum = reset ? 0 : page;
      const res = await fetchMyNotifications({
        category: filter === 'all' ? undefined : filter as NotificationCategory,
        page: pageNum,
        pageSize: 20,
      });
      const items = res.notifications ?? [];
      if (reset) {
        setNotifications(items);
        setUnreadCount(res.unreadCount ?? 0);
        setPage(1);
      } else {
        setNotifications((prev) => [...prev, ...items]);
        setPage((p) => p + 1);
      }
      setHasMore(res.hasNext ?? false);
    } catch {
      // Non-fatal
    }
  }, [user, filter, page]);

  const initialLoad = useCallback(async () => {
    setLoading(true);
    await loadNotifications(true);
    setLoading(false);
  }, [loadNotifications]);

  useEffect(() => { initialLoad(); }, [filter]);

  const { refreshing, handleRefresh } = useRefresh(() => loadNotifications(true));

  const handleLoadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    await loadNotifications(false);
    setLoadingMore(false);
  };

  const handleMarkRead = async (item: AppNotification) => {
    if (item.isRead) return;
    try {
      await markNotificationRead(item.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n)),
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      // Non-fatal
    }
  };

  const handleMarkAllRead = async () => {
    if (!user || unreadCount === 0) return;
    try {
      await markAllNotificationsRead(user.id);
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true, readAt: n.readAt ?? new Date().toISOString() })));
      setUnreadCount(0);
    } catch {
      // Non-fatal
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return t('notifInbox.justNow');
    if (diffMin < 60) return t('notifInbox.minutesAgo', { count: diffMin });
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return t('notifInbox.hoursAgo', { count: diffHr });
    const diffDays = Math.floor(diffHr / 24);
    if (diffDays < 7) return t('notifInbox.daysAgo', { count: diffDays });
    return date.toLocaleDateString();
  };

  const filterKeys: Record<Filter, string> = {
    all: 'common.all',
    ORDER: 'notifInbox.orders',
    FINANCE: 'notifInbox.finance',
    SUPPORT: 'notifInbox.support',
    SYSTEM: 'notifInbox.system',
    PROMOTION: 'notifInbox.promotions',
    ACCOUNT: 'notifInbox.account',
    DELIVERY: 'notifInbox.delivery',
    RESTAURANT_OPS: 'notifInbox.restaurantOps',
    ALERT: 'notifInbox.alerts',
  };

  const renderNotification = ({ item }: { item: AppNotification }) => {
    const iconName = CATEGORY_ICONS[item.category] ?? 'notifications-outline';
    const iconColor = CATEGORY_COLORS[item.category] ?? Colors.gray500;

    return (
      <TouchableOpacity activeOpacity={0.7} onPress={() => handleMarkRead(item)}>
        <Card style={[styles.notifCard, !item.isRead && styles.notifUnread]}>
          <View style={styles.notifRow}>
            <View style={[styles.iconCircle, { backgroundColor: iconColor + '15' }]}>
              <Ionicons name={iconName} size={20} color={iconColor} />
            </View>
            <View style={styles.notifContent}>
              <View style={styles.notifTitleRow}>
                <Text style={[styles.notifTitle, !item.isRead && styles.notifTitleUnread]} numberOfLines={1}>
                  {item.title}
                </Text>
                {!item.isRead && <View style={styles.unreadDot} />}
              </View>
              <Text style={styles.notifMessage} numberOfLines={2}>{item.message}</Text>
              <View style={styles.notifMeta}>
                <Text style={styles.notifTime}>{item.timeAgo ?? formatTime(item.createdAt)}</Text>
                <View style={[styles.categoryBadge, { backgroundColor: iconColor + '15' }]}>
                  <Text style={[styles.categoryBadgeText, { color: iconColor }]}>
                    {t(filterKeys[item.category] as any)}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </Card>
      </TouchableOpacity>
    );
  };

  const renderHeader = () => (
    <View>
      {unreadCount > 0 && (
        <View style={styles.unreadBar}>
          <Text style={styles.unreadText}>
            {t('notifInbox.unreadCount', { count: unreadCount })}
          </Text>
          <TouchableOpacity onPress={handleMarkAllRead} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.markAllText}>{t('notifInbox.markAllRead')}</Text>
          </TouchableOpacity>
        </View>
      )}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterRow}>
        {FILTER_CATEGORIES.map((f) => (
          <Chip
            key={f}
            label={t(filterKeys[f] as any)}
            selected={filter === f}
            onPress={() => setFilter(f)}
          />
        ))}
      </ScrollView>
    </View>
  );

  const renderEmpty = () => (
    !loading ? (
      <View style={styles.emptyContainer}>
        <Ionicons name="notifications-off-outline" size={48} color={Colors.gray300} />
        <Text style={styles.emptyText}>{t('notifInbox.noNotifications')}</Text>
      </View>
    ) : null
  );

  const renderFooter = () => (
    loadingMore ? (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={Colors.accent} />
      </View>
    ) : null
  );

  if (loading && notifications.length === 0) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator size="large" color={Colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <FlatList
        data={notifications}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderNotification}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderFooter}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.accent} colors={[Colors.accent]} />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.gray50 },
  centered: { justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: Spacing.base, paddingBottom: 100 },
  unreadBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  unreadText: { ...Typography.subhead, color: Colors.gray600 },
  markAllText: { ...Typography.subhead, color: Colors.accent, fontWeight: '600' },
  filterScroll: { marginBottom: Spacing.base, marginHorizontal: -Spacing.base },
  filterRow: { flexDirection: 'row', gap: Spacing.xs, paddingHorizontal: Spacing.base },
  notifCard: { marginBottom: Spacing.sm },
  notifUnread: { backgroundColor: Colors.accentLight },
  notifRow: { flexDirection: 'row', gap: Spacing.md },
  iconCircle: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  notifContent: { flex: 1 },
  notifTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  notifTitle: { ...Typography.subhead, color: Colors.gray700, flex: 1 },
  notifTitleUnread: { ...Typography.headline, color: Colors.black },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.accent },
  notifMessage: { ...Typography.footnote, color: Colors.gray500, marginTop: 2 },
  notifMeta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: 4 },
  notifTime: { ...Typography.caption1, color: Colors.gray400 },
  categoryBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
  categoryBadgeText: { ...Typography.caption2, fontWeight: '600' },
  emptyContainer: { alignItems: 'center', paddingTop: 60, gap: Spacing.md },
  emptyText: { ...Typography.body, color: Colors.gray400 },
  footerLoader: { paddingVertical: Spacing.base, alignItems: 'center' },
});
