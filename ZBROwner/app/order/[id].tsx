import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal, TextInput, Linking,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, Typography, BorderRadius } from '../../constants/theme';
import { useStore } from '../../store';
import type { OrderStatus, OrderType, CourierRating } from '../../types';
import Card from '../../components/Card';
import StatusBadge from '../../components/StatusBadge';
import RatingStars from '../../components/RatingStars';
import Chip from '../../components/Chip';
import { useT } from '../../i18n';

const DELIVERY_STEPS: OrderStatus[] = ['created', 'accepted', 'preparing', 'ready', 'picked_up', 'in_transit', 'delivered', 'completed'];
const TAKEAWAY_STEPS: OrderStatus[] = ['created', 'accepted', 'preparing', 'ready', 'completed'];
const DINE_IN_STEPS: OrderStatus[] = ['created', 'accepted', 'preparing', 'ready', 'delivered', 'completed'];

function getStatusSteps(orderType?: OrderType): OrderStatus[] {
  if (orderType === 'TAKEAWAY' || orderType === 'PICKUP') return TAKEAWAY_STEPS;
  if (orderType === 'DINE_IN') return DINE_IN_STEPS;
  return DELIVERY_STEPS;
}

const STATUS_LABEL_KEYS: Record<OrderStatus, string> = {
  created: 'orderStatus.created',
  accepted: 'orderStatus.accepted',
  preparing: 'orderStatus.preparing',
  ready: 'orderStatus.ready',
  picked_up: 'orderStatus.picked_up',
  in_transit: 'orderStatus.in_transit',
  delivered: 'orderStatus.delivered',
  completed: 'orderStatus.completed',
  cancelled: 'orderStatus.cancelled',
  refunded: 'orderStatus.refunded',
};

const CRITERIA_KEYS = [
  'orderDetail.criteriaBehavior',
  'orderDetail.criteriaPunctuality',
  'orderDetail.criteriaCommunication',
  'orderDetail.criteriaAppearance',
];

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { orders: _orders, updateOrderStatus, acceptOrder, declineOrder, submitCourierRating } = useStore();
  const orders = _orders ?? [];
  const order = orders.find((o) => o.id === id);
  const t = useT();

  const [showRatingSheet, setShowRatingSheet] = useState(false);
  const [courierStars, setCourierStars] = useState(0);
  const [selectedCriteria, setSelectedCriteria] = useState<string[]>([]);
  const [courierNote, setCourierNote] = useState('');

  if (!order) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{t('orderDetail.orderNotFound')}</Text>
      </View>
    );
  }

  const statusSteps = getStatusSteps(order.orderType);
  const currentStepIndex = statusSteps.indexOf(order.status);

  const handleStatusChange = (newStatus: OrderStatus) => {
    Alert.alert(t('orderDetail.updateStatus'), t('orderDetail.changeStatusTo', { status: t(STATUS_LABEL_KEYS[newStatus] as any) }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.confirm'),
        onPress: async () => {
          try {
            await updateOrderStatus(order.id, newStatus);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            if (newStatus === 'picked_up' && order.courierName) {
              setShowRatingSheet(true);
            }
          } catch {
            Alert.alert(t('common.error'), t('orders.statusUpdateFailed'));
          }
        },
      },
    ]);
  };

  const handleAccept = async () => {
    try {
      await acceptOrder(order.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert(t('common.error'), t('orders.acceptFailed'));
    }
  };

  const handleDecline = () => {
    const reasons = [
      { label: t('orders.reasonOutOfStock'), value: 'Out of stock' },
      { label: t('orders.reasonTooBusy'), value: 'Too busy' },
      { label: t('orders.reasonClosingSoon'), value: 'Closing soon' },
      { label: t('orders.reasonOther'), value: 'Other' },
    ];
    Alert.alert(t('orders.declineOrder'), t('orders.selectReason'), [
      ...reasons.map((r) => ({
        text: r.label,
        onPress: async () => {
          try {
            await declineOrder(order.id, r.value);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          } catch {
            Alert.alert(t('common.error'), t('orders.declineFailed'));
          }
        },
      })),
      { text: t('common.cancel'), style: 'cancel' as const },
    ]);
  };

  const handleSubmitRating = () => {
    if (courierStars > 0) {
      submitCourierRating({
        courierName: order.courierName || 'Unknown',
        orderId: order.id,
        stars: courierStars,
        criteria: selectedCriteria,
        note: courierNote || undefined,
      });
      setShowRatingSheet(false);
      setCourierStars(0);
      setSelectedCriteria([]);
      setCourierNote('');
    }
  };

  const toggleCriterion = (c: string) => {
    setSelectedCriteria((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
    );
  };

  const formatTime = (iso?: string) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* Order Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.orderNumber}>{order.orderNumber}</Text>
          <Text style={styles.timeText}>{t('orderDetail.receivedAt', { time: formatTime(order.receivedAt) })}</Text>
        </View>
        <StatusBadge status={order.status} />
      </View>

      {/* Status Stepper */}
      <Card style={styles.stepperCard}>
        <Text style={styles.sectionTitle}>{t('orderDetail.orderProgress')}</Text>
        {statusSteps.map((step, index) => {
          const isCompleted = index <= currentStepIndex;
          const isCurrent = index === currentStepIndex;
          const isNext = index === currentStepIndex + 1;
          return (
            <TouchableOpacity
              key={step}
              style={styles.stepRow}
              onPress={() => { if (isNext) handleStatusChange(step); }}
              disabled={!isNext}
              activeOpacity={isNext ? 0.6 : 1}
            >
              <View style={[styles.stepDot, isCompleted && styles.stepDotActive, isCurrent && styles.stepDotCurrent]} >
                {isCompleted && <Ionicons name="checkmark" size={12} color={Colors.white} />}
              </View>
              {index < statusSteps.length - 1 && (
                <View style={[styles.stepLine, isCompleted && styles.stepLineActive]} />
              )}
              <Text style={[styles.stepLabel, isCompleted && styles.stepLabelActive, isCurrent && styles.stepLabelCurrent]}>
                {t(STATUS_LABEL_KEYS[step] as any)}
              </Text>
              {isNext && (
                <Ionicons name="chevron-forward" size={16} color={Colors.accent} style={{ marginLeft: 'auto' }} />
              )}
            </TouchableOpacity>
          );
        })}
      </Card>

      {/* Order Info */}
      <Card style={styles.infoCard}>
        <Text style={styles.sectionTitle}>{t('orderDetail.orderInfo')}</Text>
        {order.orderType && (
          <View style={styles.infoRow}>
            <Ionicons name="bag-outline" size={18} color={Colors.gray500} />
            <Text style={styles.infoLabel}>{t('orderDetail.orderType')}</Text>
            <Text style={styles.infoValue}>{order.orderType}</Text>
          </View>
        )}
        {order.paymentStatus && (
          <View style={styles.infoRow}>
            <Ionicons name="card-outline" size={18} color={Colors.gray500} />
            <Text style={styles.infoLabel}>{t('orderDetail.paymentStatus')}</Text>
            <Text style={styles.infoValue}>{order.paymentStatus}</Text>
          </View>
        )}
        {order.estimatedPrepTimeMinutes != null && (
          <View style={styles.infoRow}>
            <Ionicons name="timer-outline" size={18} color={Colors.gray500} />
            <Text style={styles.infoLabel}>{t('orderDetail.estimatedPrepTime')}</Text>
            <Text style={styles.infoValue}>{order.estimatedPrepTimeMinutes} {t('common.minutes')}</Text>
          </View>
        )}
        {order.estimatedDeliveryTime && (
          <View style={styles.infoRow}>
            <Ionicons name="time-outline" size={18} color={Colors.gray500} />
            <Text style={styles.infoLabel}>{t('orderDetail.estimatedDelivery')}</Text>
            <Text style={styles.infoValue}>{formatTime(order.estimatedDeliveryTime)}</Text>
          </View>
        )}
      </Card>

      {/* Customer Info */}
      <Card style={styles.infoCard}>
        <Text style={styles.sectionTitle}>{t('orderDetail.customer')}</Text>
        <View style={styles.infoRow}>
          <Ionicons name="person-outline" size={18} color={Colors.gray500} />
          <Text style={styles.infoText}>{order.customerName}</Text>
        </View>
        {order.customerPhone && (
          <TouchableOpacity style={styles.infoRow} onPress={() => Linking.openURL(`tel:${order.customerPhone}`)}>
            <Ionicons name="call-outline" size={18} color={Colors.accent} />
            <Text style={[styles.infoText, { color: Colors.accent }]}>{order.customerPhone}</Text>
          </TouchableOpacity>
        )}
        {order.deliveryAddress && (
          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={18} color={Colors.gray500} />
            <Text style={[styles.infoText, { flex: 1 }]}>{order.deliveryAddress}</Text>
          </View>
        )}
        {order.deliveryInstructions && (
          <View style={styles.infoRow}>
            <Ionicons name="document-text-outline" size={18} color={Colors.gray500} />
            <Text style={[styles.infoText, { flex: 1, fontStyle: 'italic' }]}>{order.deliveryInstructions}</Text>
          </View>
        )}
      </Card>

      {/* Courier Info */}
      {order.courierName && (
        <Card style={styles.infoCard}>
          <Text style={styles.sectionTitle}>{t('orderDetail.courier')}</Text>
          <View style={styles.infoRow}>
            <Ionicons name="bicycle-outline" size={18} color={Colors.gray500} />
            <Text style={styles.infoText}>{order.courierName}</Text>
            {order.courierETA && <Text style={styles.etaText}>{t('orders.etaMin', { minutes: order.courierETA })}</Text>}
          </View>
          {order.courierPhone && (
            <TouchableOpacity style={styles.infoRow} onPress={() => Linking.openURL(`tel:${order.courierPhone}`)}>
              <Ionicons name="call-outline" size={18} color={Colors.accent} />
              <Text style={[styles.infoText, { color: Colors.accent }]}>{order.courierPhone}</Text>
            </TouchableOpacity>
          )}
        </Card>
      )}

      {/* Items */}
      <Card style={styles.infoCard}>
        <Text style={styles.sectionTitle}>{t('orderDetail.items')}</Text>
        {order.items.map((item) => (
          <View key={item.id} style={styles.itemBlock}>
            <View style={styles.itemRow}>
              <Text style={styles.itemQty}>{item.quantity}x</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>{item.name}</Text>
                {item.variantName && (
                  <Text style={styles.itemDetail}>{t('orderDetail.variant')}: {item.variantName}</Text>
                )}
                {item.modifiers && item.modifiers.length > 0 && (
                  <View style={styles.modifiersList}>
                    {item.modifiers.map((mod) => (
                      <Text key={mod.id} style={styles.itemDetail}>
                        + {mod.name} ({t('common.currency', { amount: mod.price.toFixed(2) })})
                      </Text>
                    ))}
                  </View>
                )}
                {item.specialNotes && (
                  <Text style={styles.itemSpecialNote}>{item.specialNotes}</Text>
                )}
              </View>
              <Text style={styles.itemPrice}>{t('common.currency', { amount: item.totalPrice.toFixed(2) })}</Text>
            </View>
          </View>
        ))}
      </Card>

      {/* Price Summary */}
      <Card style={styles.infoCard}>
        <Text style={styles.sectionTitle}>{t('orderDetail.priceSummary')}</Text>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>{t('orderDetail.subtotal')}</Text>
          <Text style={styles.summaryValue}>{t('common.currency', { amount: order.subtotal.toFixed(2) })}</Text>
        </View>
        {order.tax != null && order.tax > 0 && (
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t('orderDetail.tax')}</Text>
            <Text style={styles.summaryValue}>{t('common.currency', { amount: order.tax.toFixed(2) })}</Text>
          </View>
        )}
        {order.deliveryFee != null && order.deliveryFee > 0 && (
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t('orderDetail.deliveryFee')}</Text>
            <Text style={styles.summaryValue}>{t('common.currency', { amount: order.deliveryFee.toFixed(2) })}</Text>
          </View>
        )}
        {order.discount != null && order.discount > 0 && (
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t('orderDetail.discount')}</Text>
            <Text style={[styles.summaryValue, { color: Colors.success }]}>-{t('common.currency', { amount: order.discount.toFixed(2) })}</Text>
          </View>
        )}
        {order.tipAmount != null && order.tipAmount > 0 && (
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t('orderDetail.tipAmount')}</Text>
            <Text style={styles.summaryValue}>{t('common.currency', { amount: order.tipAmount.toFixed(2) })}</Text>
          </View>
        )}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>{t('orderDetail.total')}</Text>
          <Text style={styles.totalPrice}>{t('common.currency', { amount: order.totalPrice.toFixed(2) })}</Text>
        </View>
      </Card>

      {/* Action Buttons */}
      {order.status === 'created' && (
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.acceptButton} onPress={handleAccept} activeOpacity={0.8}>
            <Ionicons name="checkmark-circle" size={22} color={Colors.white} />
            <Text style={styles.acceptButtonText}>{t('orderDetail.acceptOrder')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.declineButton} onPress={handleDecline} activeOpacity={0.8}>
            <Ionicons name="close-circle" size={22} color={Colors.white} />
            <Text style={styles.declineButtonText}>{t('orderDetail.declineOrder')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Quick Contact */}
      <Card style={styles.contactSection}>
        <Text style={styles.sectionTitle}>{t('orderDetail.quickContact')}</Text>
        {order.customerPhone && (
          <TouchableOpacity
            style={styles.contactCard}
            onPress={() => Linking.openURL(`tel:${order.customerPhone}`)}
            activeOpacity={0.7}
          >
            <View style={[styles.contactIcon, { backgroundColor: Colors.infoLight }]}>
              <Ionicons name="person-outline" size={22} color={Colors.info} />
            </View>
            <View style={styles.contactInfo}>
              <Text style={styles.contactTitle}>{t('orderDetail.customer')}</Text>
              <Text style={styles.contactSubtitle}>{order.customerName}</Text>
            </View>
            <View style={styles.contactActions}>
              <TouchableOpacity
                style={styles.contactActionBtn}
                onPress={() => Linking.openURL(`tel:${order.customerPhone}`)}
              >
                <Ionicons name="call" size={18} color={Colors.accent} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.contactActionBtn}>
                <Ionicons name="chatbubble" size={18} color={Colors.accent} />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        )}
        {order.courierName && (
          <TouchableOpacity
            style={styles.contactCard}
            onPress={() => order.courierPhone && Linking.openURL(`tel:${order.courierPhone}`)}
            activeOpacity={0.7}
          >
            <View style={[styles.contactIcon, { backgroundColor: Colors.accentLight }]}>
              <Ionicons name="bicycle-outline" size={22} color={Colors.accent} />
            </View>
            <View style={styles.contactInfo}>
              <Text style={styles.contactTitle}>{t('orderDetail.courier')}</Text>
              <Text style={styles.contactSubtitle}>
                {order.courierName}{order.courierETA ? ` · ${t('orders.etaMin', { minutes: order.courierETA })}` : ''}
              </Text>
            </View>
            {order.courierPhone && (
              <View style={styles.contactActions}>
                <TouchableOpacity
                  style={styles.contactActionBtn}
                  onPress={() => Linking.openURL(`tel:${order.courierPhone}`)}
                >
                  <Ionicons name="call" size={18} color={Colors.accent} />
                </TouchableOpacity>
              </View>
            )}
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.contactCard} activeOpacity={0.7}>
          <View style={[styles.contactIcon, { backgroundColor: Colors.successLight }]}>
            <Ionicons name="headset-outline" size={22} color={Colors.success} />
          </View>
          <View style={styles.contactInfo}>
            <Text style={styles.contactTitle}>{t('orderDetail.platformSupport')}</Text>
            <Text style={styles.contactSubtitle}>{t('orderDetail.liveChatOrHotline')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.gray400} />
        </TouchableOpacity>
      </Card>

      {/* Courier Rating Modal */}
      <Modal visible={showRatingSheet} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.ratingSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.ratingTitle}>{t('orderDetail.rateThisCourier')}</Text>
            <Text style={styles.ratingSubtitle}>{order.courierName}</Text>

            <RatingStars
              rating={courierStars}
              size={36}
              interactive
              onRate={setCourierStars}
            />

            <Text style={styles.criteriaLabel}>{t('orderDetail.whatWentWell')}</Text>
            <View style={styles.criteriaRow}>
              {CRITERIA_KEYS.map((key) => (
                <Chip
                  key={key}
                  label={t(key as any)}
                  selected={selectedCriteria.includes(key)}
                  onPress={() => toggleCriterion(key)}
                />
              ))}
            </View>

            <TextInput
              style={styles.noteInput}
              placeholder={t('orderDetail.optionalNote')}
              value={courierNote}
              onChangeText={setCourierNote}
              multiline
            />

            <TouchableOpacity
              style={[styles.submitButton, courierStars === 0 && styles.submitDisabled]}
              onPress={handleSubmitRating}
              disabled={courierStars === 0}
            >
              <Text style={styles.submitText}>{t('orderDetail.submitReview')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.skipButton}
              onPress={() => setShowRatingSheet(false)}
            >
              <Text style={styles.skipText}>{t('common.skip')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.gray50 },
  content: { padding: Spacing.base, paddingBottom: 100 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { ...Typography.body, color: Colors.gray500 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.base },
  orderNumber: { ...Typography.title1, color: Colors.black },
  timeText: { ...Typography.footnote, color: Colors.gray500, marginTop: 2 },
  stepperCard: { marginBottom: Spacing.base },
  sectionTitle: { ...Typography.headline, color: Colors.black, marginBottom: Spacing.md },
  stepRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, minHeight: 44 },
  stepDot: { width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.gray200, justifyContent: 'center', alignItems: 'center', zIndex: 1 },
  stepDotActive: { backgroundColor: Colors.accent },
  stepDotCurrent: { borderWidth: 3, borderColor: Colors.accentLight },
  stepLine: { position: 'absolute', left: 11, top: 32, width: 2, height: 20, backgroundColor: Colors.gray200 },
  stepLineActive: { backgroundColor: Colors.accent },
  stepLabel: { ...Typography.subhead, color: Colors.gray400, marginLeft: Spacing.md },
  stepLabelActive: { color: Colors.gray700 },
  stepLabelCurrent: { color: Colors.accent, fontWeight: '600' },
  infoCard: { marginBottom: Spacing.base },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 6, minHeight: 44 },
  infoLabel: { ...Typography.body, color: Colors.gray500, flex: 1 },
  infoValue: { ...Typography.body, color: Colors.gray700, fontWeight: '500' },
  infoText: { ...Typography.body, color: Colors.gray700 },
  etaText: { ...Typography.footnote, color: Colors.accent, marginLeft: 'auto' },
  itemBlock: { paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.gray100 },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start' },
  itemQty: { ...Typography.headline, color: Colors.accent, width: 32, marginTop: 2 },
  itemName: { ...Typography.body, color: Colors.black },
  itemDetail: { ...Typography.footnote, color: Colors.gray500, marginTop: 2 },
  modifiersList: { marginTop: 2 },
  itemSpecialNote: { ...Typography.footnote, color: Colors.gray500, fontStyle: 'italic', marginTop: 4 },
  itemPrice: { ...Typography.subhead, color: Colors.gray600, marginTop: 2, marginLeft: Spacing.sm },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  summaryLabel: { ...Typography.body, color: Colors.gray500 },
  summaryValue: { ...Typography.body, color: Colors.gray700 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: Spacing.md, marginTop: Spacing.sm, borderTopWidth: 2, borderTopColor: Colors.gray200 },
  totalLabel: { ...Typography.headline, color: Colors.black },
  totalPrice: { ...Typography.title3, color: Colors.accent },
  actionButtons: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.base },
  acceptButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.success, borderRadius: BorderRadius.button, paddingVertical: 14, gap: Spacing.sm, minHeight: 48 },
  acceptButtonText: { ...Typography.headline, color: Colors.white },
  declineButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.danger, borderRadius: BorderRadius.button, paddingVertical: 14, gap: Spacing.sm, minHeight: 48 },
  declineButtonText: { ...Typography.headline, color: Colors.white },
  contactSection: { marginBottom: Spacing.base },
  contactCard: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.gray100, minHeight: 56 },
  contactIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md },
  contactInfo: { flex: 1 },
  contactTitle: { ...Typography.headline, color: Colors.black },
  contactSubtitle: { ...Typography.footnote, color: Colors.gray500, marginTop: 2 },
  contactActions: { flexDirection: 'row', gap: Spacing.sm },
  contactActionBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.accentLight, justifyContent: 'center', alignItems: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  ratingSheet: { backgroundColor: Colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: Spacing.xl, paddingBottom: 40, alignItems: 'center' },
  sheetHandle: { width: 36, height: 5, borderRadius: 3, backgroundColor: Colors.gray300, marginBottom: Spacing.xl },
  ratingTitle: { ...Typography.title2, color: Colors.black },
  ratingSubtitle: { ...Typography.subhead, color: Colors.gray500, marginTop: 4, marginBottom: Spacing.xl },
  criteriaLabel: { ...Typography.subhead, color: Colors.gray700, fontWeight: '600', marginTop: Spacing.xl, marginBottom: Spacing.sm, alignSelf: 'flex-start' },
  criteriaRow: { flexDirection: 'row', flexWrap: 'wrap', alignSelf: 'flex-start' },
  noteInput: { width: '100%', borderWidth: 1, borderColor: Colors.gray200, borderRadius: BorderRadius.chip, padding: Spacing.md, ...Typography.body, marginTop: Spacing.base, height: 80, textAlignVertical: 'top' },
  submitButton: { width: '100%', backgroundColor: Colors.accent, borderRadius: BorderRadius.button, paddingVertical: 14, alignItems: 'center', marginTop: Spacing.base, minHeight: 48 },
  submitDisabled: { opacity: 0.5 },
  submitText: { ...Typography.headline, color: Colors.white },
  skipButton: { marginTop: Spacing.md, minHeight: 44, justifyContent: 'center' },
  skipText: { ...Typography.subhead, color: Colors.gray500 },
});
