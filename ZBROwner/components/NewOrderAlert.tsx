import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, Typography, BorderRadius } from '../constants/theme';
import { startAlarm, stopAlarm } from '../utils/orderAlarm';
import { useT } from '../i18n';
import type { Order } from '../types';

interface Props {
  order: Order | null;
  visible: boolean;
  onAccept: (orderId: string) => void;
  onDecline: (orderId: string) => void;
  onView: (orderId: string) => void;
}

export default function NewOrderAlert({ order, visible, onAccept, onDecline, onView }: Props) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(300)).current;

  // Start/stop alarm with visibility
  useEffect(() => {
    if (visible && order) {
      startAlarm();
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 15 }).start();
      // Pulse animation for the icon
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        ]),
      ).start();
    } else {
      stopAlarm();
      slideAnim.setValue(300);
      pulseAnim.setValue(1);
    }

    return () => { stopAlarm(); };
  }, [visible, order?.id]);

  if (!order) return null;

  const itemsSummary = order.items
    .map((i) => `${i.quantity}x ${i.name}`)
    .join(', ');

  const handleAccept = () => {
    stopAlarm();
    onAccept(order.id);
  };

  const handleDecline = () => {
    stopAlarm();
    onDecline(order.id);
  };

  const handleView = () => {
    stopAlarm();
    onView(order.id);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.overlay}>
        <Animated.View style={[styles.card, { transform: [{ translateY: slideAnim }], paddingBottom: insets.bottom + Spacing.base }]}>
          {/* Pulsing bell icon */}
          <Animated.View style={[styles.iconContainer, { transform: [{ scale: pulseAnim }] }]}>
            <Ionicons name="notifications" size={36} color={Colors.white} />
          </Animated.View>

          <Text style={styles.title}>{t('newOrderAlert.title' as any)}</Text>

          {/* Order details */}
          <View style={styles.orderInfo}>
            <View style={styles.orderRow}>
              <Text style={styles.orderNumber}>{order.orderNumber}</Text>
              {order.orderType && (
                <View style={styles.orderTypeBadge}>
                  <Ionicons
                    name={order.orderType === 'DELIVERY' ? 'bicycle-outline' : order.orderType === 'DINE_IN' ? 'restaurant-outline' : 'bag-handle-outline'}
                    size={14}
                    color={Colors.accent}
                  />
                  <Text style={styles.orderTypeText}>{order.orderType}</Text>
                </View>
              )}
            </View>

            <Text style={styles.customerName}>{order.customerName}</Text>

            <Text style={styles.items} numberOfLines={3}>{itemsSummary}</Text>

            {order.deliveryAddress && (
              <View style={styles.addressRow}>
                <Ionicons name="location-outline" size={14} color={Colors.gray400} />
                <Text style={styles.addressText} numberOfLines={1}>{order.deliveryAddress}</Text>
              </View>
            )}

            <Text style={styles.totalPrice}>
              {t('common.currency' as any, { amount: order.totalPrice.toFixed(2) })}
            </Text>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.declineButton} onPress={handleDecline} activeOpacity={0.8}>
              <Ionicons name="close" size={22} color={Colors.danger} />
              <Text style={styles.declineText}>{t('newOrderAlert.decline' as any)}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.acceptButton} onPress={handleAccept} activeOpacity={0.8}>
              <Ionicons name="checkmark" size={22} color={Colors.white} />
              <Text style={styles.acceptText}>{t('newOrderAlert.accept' as any)}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.viewButton} onPress={handleView} activeOpacity={0.7}>
            <Text style={styles.viewText}>{t('newOrderAlert.viewDetails' as any)}</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: Spacing.lg,
    paddingHorizontal: Spacing.base,
    alignItems: 'center',
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  title: {
    ...Typography.title2,
    color: Colors.black,
    marginBottom: Spacing.base,
  },
  orderInfo: {
    width: '100%',
    backgroundColor: Colors.gray50,
    borderRadius: BorderRadius.card,
    padding: Spacing.base,
    marginBottom: Spacing.base,
  },
  orderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderNumber: {
    ...Typography.headline,
    color: Colors.black,
  },
  orderTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.accentLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.chip,
  },
  orderTypeText: {
    ...Typography.caption1,
    color: Colors.accent,
    fontWeight: '600',
  },
  customerName: {
    ...Typography.subhead,
    color: Colors.gray700,
    marginTop: 6,
  },
  items: {
    ...Typography.footnote,
    color: Colors.gray500,
    marginTop: 6,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  addressText: {
    ...Typography.footnote,
    color: Colors.gray500,
    flex: 1,
    fontStyle: 'italic',
  },
  totalPrice: {
    ...Typography.title2,
    color: Colors.accent,
    marginTop: Spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    width: '100%',
    gap: Spacing.sm,
  },
  declineButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.dangerLight,
    borderRadius: BorderRadius.button,
    paddingVertical: 16,
    minHeight: 56,
  },
  declineText: {
    ...Typography.headline,
    color: Colors.danger,
  },
  acceptButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.success,
    borderRadius: BorderRadius.button,
    paddingVertical: 16,
    minHeight: 56,
  },
  acceptText: {
    ...Typography.headline,
    color: Colors.white,
  },
  viewButton: {
    marginTop: Spacing.md,
    paddingVertical: Spacing.sm,
    minHeight: 44,
    justifyContent: 'center',
  },
  viewText: {
    ...Typography.subhead,
    color: Colors.accent,
    fontWeight: '600',
  },
});
