import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Modal, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, Typography, BorderRadius } from '../constants/theme';
import { startAlarm, stopAlarm } from '../utils/orderAlarm';
import { useT } from '../i18n';
import type { Order } from '../types';

interface Props {
  order: Order | null;
  visible: boolean;
  onAcknowledge: (orderId: string) => void;
}

/**
 * Blocking alert for an order cancelled while the kitchen was cooking it.
 *
 * Until this existed the only signal was a push notification, which is exactly
 * the wrong channel: the phone is on a shelf across the kitchen, the push may
 * be missed, silenced or swiped away, and nothing in the app itself changed
 * except a status chip on a card nobody was looking at. Meanwhile someone keeps
 * cooking food that is going in the bin.
 *
 * So this behaves like the new-order alert, deliberately: full screen, alarm
 * sound, and it does not go away on its own. Dismissal requires one explicit
 * tap, which is also the point — it means a person saw it, rather than the app
 * assuming they did.
 *
 * It lists the items, because the person reading it needs to know what to stop
 * making, not just that something was cancelled.
 */
export default function OrderCancelledAlert({ order, visible, onAcknowledge }: Props) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (visible && order) {
      startAlarm();
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        ]),
      ).start();
    } else {
      stopAlarm();
      pulseAnim.setValue(1);
    }
    return () => { stopAlarm(); };
  }, [visible, order?.id, pulseAnim]);

  if (!order) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { paddingBottom: insets.bottom + Spacing.lg }]}>
          <Animated.View style={[styles.iconWrap, { transform: [{ scale: pulseAnim }] }]}>
            <Ionicons name="close-circle" size={44} color={Colors.white} />
          </Animated.View>

          <Text style={styles.title}>{t('cancelledAlert.title')}</Text>
          <Text style={styles.subtitle}>{t('cancelledAlert.stopCooking')}</Text>

          <View style={styles.orderRow}>
            <Text style={styles.orderNumber}>{order.orderNumber}</Text>
            <Text style={styles.customer} numberOfLines={1}>{order.customerName}</Text>
          </View>

          {order.items?.length > 0 && (
            <ScrollView style={styles.items} contentContainerStyle={styles.itemsContent}>
              {order.items.map((item, i) => (
                <View key={`${item.name}-${i}`} style={styles.itemRow}>
                  <Text style={styles.itemQty}>{item.quantity}×</Text>
                  <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
                </View>
              ))}
            </ScrollView>
          )}

          {order.cancellationReason ? (
            <Text style={styles.reason} numberOfLines={3}>
              {t('cancelledAlert.reason', { reason: order.cancellationReason })}
            </Text>
          ) : null}

          <TouchableOpacity
            style={styles.button}
            onPress={() => onAcknowledge(order.id)}
            activeOpacity={0.85}
          >
            <Ionicons name="checkmark" size={20} color={Colors.danger} />
            <Text style={styles.buttonText}>{t('cancelledAlert.acknowledge')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.danger,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    alignItems: 'center',
  },
  iconWrap: { marginBottom: Spacing.sm },
  title: { ...Typography.title2, color: Colors.white, textAlign: 'center' },
  subtitle: {
    ...Typography.headline,
    color: Colors.white,
    opacity: 0.95,
    textAlign: 'center',
    marginTop: 4,
  },
  orderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.base,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: BorderRadius.button,
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  orderNumber: { ...Typography.headline, color: Colors.white, fontWeight: '700' },
  customer: { ...Typography.subhead, color: Colors.white, opacity: 0.9, flexShrink: 1 },
  items: { alignSelf: 'stretch', maxHeight: 160, marginTop: Spacing.sm },
  itemsContent: { paddingVertical: Spacing.xs },
  itemRow: { flexDirection: 'row', gap: Spacing.sm, paddingVertical: 3 },
  itemQty: { ...Typography.subhead, color: Colors.white, fontWeight: '700', minWidth: 28 },
  itemName: { ...Typography.subhead, color: Colors.white, opacity: 0.95, flex: 1 },
  reason: {
    ...Typography.footnote,
    color: Colors.white,
    opacity: 0.9,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.button,
    paddingVertical: Spacing.base,
    marginTop: Spacing.lg,
    alignSelf: 'stretch',
    minHeight: 54,
  },
  buttonText: { ...Typography.headline, color: Colors.danger, fontWeight: '700' },
});
