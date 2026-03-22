import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, BorderRadius } from '../../constants/theme';
import { useStore } from '../../store';
import Card from '../../components/Card';
import StatusBadge from '../../components/StatusBadge';
import { useT } from '../../i18n';
import { useRefresh } from '../../hooks/useRefresh';
import type { Order } from '../../types';

export default function OrderHistoryScreen() {
  const { orders, loadOrders } = useStore();
  const router = useRouter();
  const t = useT();

  useEffect(() => { loadOrders(); }, []);

  const { refreshing, handleRefresh } = useRefresh(loadOrders);

  const allOrders = useMemo(() =>
    [...orders].sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime()),
    [orders]
  );

  const stats = useMemo(() => {
    const delivered = orders.filter((o) => o.status === 'delivered');
    const cancelled = orders.filter((o) => o.status === 'cancelled');
    const total = delivered.reduce((s, o) => s + o.totalPrice, 0);
    return { delivered: delivered.length, cancelled: cancelled.length, total };
  }, [orders]);

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' +
           d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderOrder = ({ item }: { item: Order }) => (
    <TouchableOpacity activeOpacity={0.7} onPress={() => router.push(`/order/${item.id}`)}>
      <Card style={styles.orderCard}>
        <View style={styles.orderHeader}>
          <Text style={styles.orderNumber}>{item.orderNumber}</Text>
          <StatusBadge status={item.status} />
        </View>
        <Text style={styles.customerName}>{item.customerName}</Text>
        <Text style={styles.itemsSummary} numberOfLines={1}>
          {item.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}
        </Text>
        <View style={styles.orderFooter}>
          <Text style={styles.orderTime}>{formatTime(item.receivedAt)}</Text>
          <Text style={styles.orderTotal}>{t('common.currency', { amount: item.totalPrice.toFixed(2) })}</Text>
        </View>
      </Card>
    </TouchableOpacity>
  );

  return (
    <View style={styles.screen}>
      <FlatList
        data={allOrders}
        keyExtractor={(item) => item.id}
        renderItem={renderOrder}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <Card style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={[styles.statNum, { color: Colors.success }]}>{stats.delivered}</Text>
              <Text style={styles.statLabel}>{t('orderHistoryScreen.delivered')}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statNum, { color: Colors.danger }]}>{stats.cancelled}</Text>
              <Text style={styles.statLabel}>{t('orderHistoryScreen.cancelled')}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statNum, { color: Colors.accent }]}>{t('common.currency', { amount: stats.total.toFixed(0) })}</Text>
              <Text style={styles.statLabel}>{t('orderHistoryScreen.revenue')}</Text>
            </View>
          </Card>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="receipt-outline" size={48} color={Colors.gray300} />
            <Text style={styles.emptyText}>{t('orderHistoryScreen.noHistory')}</Text>
          </View>
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.accent} colors={[Colors.accent]} />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.gray50 },
  content: { padding: Spacing.base, paddingBottom: 100 },
  statsRow: { flexDirection: 'row', marginBottom: Spacing.base },
  statItem: { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, height: 32, backgroundColor: Colors.gray200 },
  statNum: { ...Typography.title2 },
  statLabel: { ...Typography.caption1, color: Colors.gray500, marginTop: 2 },
  orderCard: { marginBottom: Spacing.sm },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderNumber: { ...Typography.headline, color: Colors.black },
  customerName: { ...Typography.subhead, color: Colors.gray700, marginTop: 4 },
  itemsSummary: { ...Typography.footnote, color: Colors.gray500, marginTop: 4 },
  orderFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.sm },
  orderTime: { ...Typography.caption1, color: Colors.gray400 },
  orderTotal: { ...Typography.headline, color: Colors.accent },
  empty: { alignItems: 'center', paddingTop: Spacing['3xl'], gap: Spacing.md },
  emptyText: { ...Typography.body, color: Colors.gray400 },
});
