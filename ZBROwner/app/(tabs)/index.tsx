import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, Animated,
  ScrollView, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, BorderRadius, Shadows } from '../../constants/theme';
import { useStore } from '../../store';
import { useAuthStore } from '../../store/authStore';
import { toggleRestaurantOpen } from '../../services/api';
import type { Order, DeclineReason } from '../../types';
import Card from '../../components/Card';
import StatusBadge from '../../components/StatusBadge';
import SlideToAction from '../../components/SlideToAction';
import CountdownTimer from '../../components/CountdownTimer';
import PillSwitch from '../../components/PillSwitch';
import { useT } from '../../i18n';
import { useRefresh } from '../../hooks/useRefresh';

type Segment = 'new' | 'preparing' | 'waiting';

export default function OrdersScreen() {
  const [segment, setSegment] = useState<Segment>('new');
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const t = useT();

  const {
    restaurantName, isOpen, setOpen,
    orders, acceptOrder, declineOrder, updateOrderStatus,
  } = useStore();
  const restaurantId = useAuthStore((s) => s.user?.restaurantId);

  const handleToggleOpen = useCallback(async () => {
    const newStatus = !isOpen;
    if (!restaurantId) return;
    try {
      await toggleRestaurantOpen(restaurantId, newStatus);
      setOpen(newStatus);
    } catch {
      // API failed — don't update local state
    }
  }, [isOpen, restaurantId, setOpen]);

  const { refreshing, handleRefresh } = useRefresh();

  const newOrders = useMemo(() => orders.filter((o) => o.status === 'received'), [orders]);
  const preparingOrders = useMemo(() => orders.filter((o) => o.status === 'preparing'), [orders]);
  const waitingOrders = useMemo(() => orders.filter((o) => o.status === 'ready'), [orders]);

  const currentOrders = segment === 'new' ? newOrders : segment === 'preparing' ? preparingOrders : waitingOrders;

  const todayRevenue = useMemo(() => {
    const delivered = orders.filter((o) => o.status === 'delivered');
    const total = delivered.reduce((sum, o) => sum + o.totalPrice, 0);
    return { total, count: delivered.length, avg: delivered.length > 0 ? total / delivered.length : 0 };
  }, [orders]);

  const handleDecline = useCallback((orderId: string) => {
    const reasons: { label: string; value: DeclineReason }[] = [
      { label: t('orders.reasonOutOfStock'), value: 'out_of_stock' },
      { label: t('orders.reasonTooBusy'), value: 'too_busy' },
      { label: t('orders.reasonClosingSoon'), value: 'closing_soon' },
      { label: t('orders.reasonOther'), value: 'other' },
    ];
    Alert.alert(t('orders.declineOrder'), t('orders.selectReason'), [
      ...reasons.map((r) => ({ text: r.label, onPress: () => declineOrder(orderId, r.value) })),
      { text: t('common.cancel'), style: 'cancel' as const },
    ]);
  }, [declineOrder, t]);

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderHeader = () => (
    <View>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <View>
          <Text style={styles.restaurantName}>{restaurantName}</Text>
          <Text style={styles.dateText}>
            {new Date().toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}
          </Text>
        </View>
        <PillSwitch isOn={isOpen} onToggle={handleToggleOpen} />
      </View>

      {/* Revenue Snapshot */}
      <View style={styles.revenueRow}>
        <Card style={styles.revenueCard}>
          <Text style={styles.revenueLabel}>{t('orders.revenue')}</Text>
          <Text style={styles.revenueValue}>{t('common.currency', { amount: todayRevenue.total.toFixed(2) })}</Text>
        </Card>
        <Card style={styles.revenueCard}>
          <Text style={styles.revenueLabel}>{t('orders.ordersCount')}</Text>
          <Text style={styles.revenueValue}>{todayRevenue.count}</Text>
        </Card>
        <Card style={styles.revenueCard}>
          <Text style={styles.revenueLabel}>{t('orders.avgValue')}</Text>
          <Text style={styles.revenueValue}>{t('common.currency', { amount: todayRevenue.avg.toFixed(2) })}</Text>
        </Card>
      </View>

      {/* Order Counter Badges */}
      <View style={styles.counterRow}>
        <View style={[styles.counterBadge, { backgroundColor: Colors.infoLight }]}>
          <Text style={[styles.counterNum, { color: Colors.info }]}>{newOrders.length}</Text>
          <Text style={[styles.counterLabel, { color: Colors.info }]}>{t('orders.newLabel')}</Text>
        </View>
        <View style={[styles.counterBadge, { backgroundColor: Colors.warningLight }]}>
          <Text style={[styles.counterNum, { color: Colors.warning }]}>{preparingOrders.length}</Text>
          <Text style={[styles.counterLabel, { color: Colors.warning }]}>{t('orders.cooking')}</Text>
        </View>
        <View style={[styles.counterBadge, { backgroundColor: Colors.successLight }]}>
          <Text style={[styles.counterNum, { color: Colors.success }]}>{waitingOrders.length}</Text>
          <Text style={[styles.counterLabel, { color: Colors.success }]}>{t('orders.readyLabel')}</Text>
        </View>
      </View>

      {/* Segmented Control */}
      <View style={styles.segmentContainer}>
        {(['new', 'preparing', 'waiting'] as Segment[]).map((s) => (
          <TouchableOpacity
            key={s}
            style={[styles.segmentButton, segment === s && styles.segmentActive]}
            onPress={() => setSegment(s)}
            accessibilityRole="tab"
            accessibilityState={{ selected: segment === s }}
          >
            <Text style={[styles.segmentText, segment === s && styles.segmentTextActive]}>
              {s === 'new' ? t('orders.newOrders') : s === 'preparing' ? t('orders.preparingOrders') : t('orders.waitingOrders')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderNewOrder = (order: Order) => (
    <Card style={styles.orderCard}>
      <TouchableOpacity onPress={() => router.push(`/order/${order.id}`)} activeOpacity={0.7}>
        <View style={styles.orderHeader}>
          <Text style={styles.orderNumber}>{order.orderNumber}</Text>
          <Text style={styles.orderTime}>{formatTime(order.receivedAt)}</Text>
        </View>
        <Text style={styles.customerName}>{order.customerName}</Text>
        <Text style={styles.itemsSummary} numberOfLines={2}>
          {order.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}
        </Text>
        {order.specialNotes && (
          <View style={styles.notesRow}>
            <Ionicons name="chatbubble-ellipses-outline" size={14} color={Colors.gray500} />
            <Text style={styles.notesText} numberOfLines={1}>{order.specialNotes}</Text>
          </View>
        )}
        <Text style={styles.totalPrice}>{t('common.currency', { amount: order.totalPrice.toFixed(2) })}</Text>
      </TouchableOpacity>
      <SlideToAction
        onAccept={() => acceptOrder(order.id)}
        onDecline={() => handleDecline(order.id)}
      />
    </Card>
  );

  const renderPreparingOrder = (order: Order) => (
    <Card style={styles.orderCard}>
      <TouchableOpacity onPress={() => router.push(`/order/${order.id}`)} activeOpacity={0.7}>
        <View style={styles.orderHeader}>
          <Text style={styles.orderNumber}>{order.orderNumber}</Text>
          {order.prepStartedAt && (
            <CountdownTimer startedAt={order.prepStartedAt} durationMinutes={order.prepTimeMinutes} />
          )}
        </View>
        <Text style={styles.customerName}>{order.customerName}</Text>
        <Text style={styles.itemsSummary} numberOfLines={2}>
          {order.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}
        </Text>
        <Text style={styles.totalPrice}>{t('common.currency', { amount: order.totalPrice.toFixed(2) })}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.markReadyButton}
        onPress={() => updateOrderStatus(order.id, 'ready')}
        activeOpacity={0.8}
      >
        <Ionicons name="checkmark-circle" size={20} color={Colors.white} />
        <Text style={styles.markReadyText}>{t('orders.markReady')}</Text>
      </TouchableOpacity>
    </Card>
  );

  const renderWaitingOrder = (order: Order) => (
    <Card style={styles.orderCard}>
      <TouchableOpacity onPress={() => router.push(`/order/${order.id}`)} activeOpacity={0.7}>
        <View style={styles.orderHeader}>
          <Text style={styles.orderNumber}>{order.orderNumber}</Text>
          <StatusBadge status="ready" />
        </View>
        <Text style={styles.customerName}>{order.customerName}</Text>
        <Text style={styles.itemsSummary} numberOfLines={2}>
          {order.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}
        </Text>
        {order.courierName && (
          <View style={styles.courierRow}>
            <Ionicons name="bicycle-outline" size={16} color={Colors.accent} />
            <Text style={styles.courierName}>{order.courierName}</Text>
            {order.courierETA && (
              <Text style={styles.courierEta}>{t('orders.etaMin', { minutes: order.courierETA })}</Text>
            )}
          </View>
        )}
        <Text style={styles.totalPrice}>{t('common.currency', { amount: order.totalPrice.toFixed(2) })}</Text>
      </TouchableOpacity>
    </Card>
  );

  const renderOrder = ({ item }: { item: Order }) => {
    if (segment === 'new') return renderNewOrder(item);
    if (segment === 'preparing') return renderPreparingOrder(item);
    return renderWaitingOrder(item);
  };

  return (
    <View style={styles.screen}>
      <FlatList
        data={currentOrders}
        keyExtractor={(item) => item.id}
        renderItem={renderOrder}
        ListHeaderComponent={renderHeader}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.accent} colors={[Colors.accent]} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons
              name={segment === 'new' ? 'receipt-outline' : segment === 'preparing' ? 'flame-outline' : 'time-outline'}
              size={48}
              color={Colors.gray300}
            />
            <Text style={styles.emptyText}>
              {segment === 'new' ? t('orders.noNewOrders') : segment === 'preparing' ? t('orders.nothingCooking') : t('orders.noOrdersWaiting')}
            </Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.gray50 },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.base,
    backgroundColor: Colors.white,
  },
  restaurantName: { ...Typography.title2, color: Colors.black },
  dateText: { ...Typography.footnote, color: Colors.gray500, marginTop: 2 },
  revenueRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.base,
    gap: Spacing.sm,
  },
  revenueCard: { flex: 1, alignItems: 'center' },
  revenueLabel: { ...Typography.caption1, color: Colors.gray500 },
  revenueValue: { ...Typography.title3, color: Colors.black, marginTop: 4 },
  counterRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.base,
    gap: Spacing.sm,
  },
  counterBadge: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.card,
  },
  counterNum: { ...Typography.title2 },
  counterLabel: { ...Typography.caption1, marginTop: 2 },
  segmentContainer: {
    flexDirection: 'row',
    marginHorizontal: Spacing.base,
    marginTop: Spacing.base,
    marginBottom: Spacing.sm,
    backgroundColor: Colors.gray100,
    borderRadius: BorderRadius.button,
    padding: 4,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: BorderRadius.button - 2,
    minHeight: 44,
    justifyContent: 'center',
  },
  segmentActive: { backgroundColor: Colors.white, ...Shadows.card },
  segmentText: { ...Typography.subhead, color: Colors.gray500 },
  segmentTextActive: { color: Colors.black, fontWeight: '600' },
  orderCard: { marginHorizontal: Spacing.base, marginTop: Spacing.sm },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderNumber: { ...Typography.headline, color: Colors.black },
  orderTime: { ...Typography.footnote, color: Colors.gray500 },
  customerName: { ...Typography.subhead, color: Colors.gray700, marginTop: 4 },
  itemsSummary: { ...Typography.footnote, color: Colors.gray500, marginTop: 4 },
  notesRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 4 },
  notesText: { ...Typography.footnote, color: Colors.gray500, flex: 1, fontStyle: 'italic' },
  totalPrice: { ...Typography.headline, color: Colors.accent, marginTop: 8 },
  markReadyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.success,
    borderRadius: BorderRadius.button,
    paddingVertical: 14,
    marginTop: Spacing.sm,
    gap: Spacing.sm,
    minHeight: 48,
  },
  markReadyText: { ...Typography.headline, color: Colors.white },
  courierRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 6 },
  courierName: { ...Typography.subhead, color: Colors.gray700, fontWeight: '500' },
  courierEta: { ...Typography.footnote, color: Colors.accent, marginLeft: 'auto' },
  emptyContainer: { alignItems: 'center', paddingTop: Spacing['3xl'], gap: Spacing.md },
  emptyText: { ...Typography.body, color: Colors.gray400 },
});
