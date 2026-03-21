import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal, TextInput, Linking,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, Typography, BorderRadius } from '../../constants/theme';
import { useStore } from '../../store';
import type { OrderStatus, CourierRating } from '../../types';
import Card from '../../components/Card';
import StatusBadge from '../../components/StatusBadge';
import RatingStars from '../../components/RatingStars';
import Chip from '../../components/Chip';

const STATUS_STEPS: OrderStatus[] = ['received', 'confirmed', 'preparing', 'ready', 'picked_up', 'delivered'];
const STATUS_LABELS: Record<string, string> = {
  received: 'Received',
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  ready: 'Ready',
  picked_up: 'Picked Up',
  delivered: 'Delivered',
};

const CRITERIA = ['Behavior', 'Punctuality', 'Communication', 'Appearance'];

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { orders, updateOrderStatus, submitCourierRating } = useStore();
  const order = orders.find((o) => o.id === id);

  const [showRatingSheet, setShowRatingSheet] = useState(false);
  const [courierStars, setCourierStars] = useState(0);
  const [selectedCriteria, setSelectedCriteria] = useState<string[]>([]);
  const [courierNote, setCourierNote] = useState('');

  if (!order) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Order not found</Text>
      </View>
    );
  }

  const currentStepIndex = STATUS_STEPS.indexOf(order.status);

  const handleStatusChange = (newStatus: OrderStatus) => {
    Alert.alert('Update Status', `Change status to "${STATUS_LABELS[newStatus]}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm',
        onPress: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          updateOrderStatus(order.id, newStatus);
          if (newStatus === 'picked_up' && order.courierName) {
            setShowRatingSheet(true);
          }
        },
      },
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
          <Text style={styles.timeText}>Received {formatTime(order.receivedAt)}</Text>
        </View>
        <StatusBadge status={order.status} />
      </View>

      {/* Status Stepper */}
      <Card style={styles.stepperCard}>
        <Text style={styles.sectionTitle}>Order Progress</Text>
        {STATUS_STEPS.map((step, index) => {
          const isCompleted = index <= currentStepIndex;
          const isCurrent = index === currentStepIndex;
          return (
            <TouchableOpacity
              key={step}
              style={styles.stepRow}
              onPress={() => {
                if (index === currentStepIndex + 1) handleStatusChange(step);
              }}
              disabled={index !== currentStepIndex + 1}
              activeOpacity={index === currentStepIndex + 1 ? 0.6 : 1}
            >
              <View style={[styles.stepDot, isCompleted && styles.stepDotActive, isCurrent && styles.stepDotCurrent]} >
                {isCompleted && <Ionicons name="checkmark" size={12} color={Colors.white} />}
              </View>
              {index < STATUS_STEPS.length - 1 && (
                <View style={[styles.stepLine, isCompleted && styles.stepLineActive]} />
              )}
              <Text style={[styles.stepLabel, isCompleted && styles.stepLabelActive, isCurrent && styles.stepLabelCurrent]}>
                {STATUS_LABELS[step]}
              </Text>
              {index === currentStepIndex + 1 && (
                <Ionicons name="chevron-forward" size={16} color={Colors.accent} style={{ marginLeft: 'auto' }} />
              )}
            </TouchableOpacity>
          );
        })}
      </Card>

      {/* Customer Info */}
      <Card style={styles.infoCard}>
        <Text style={styles.sectionTitle}>Customer</Text>
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
      </Card>

      {/* Courier Info */}
      {order.courierName && (
        <Card style={styles.infoCard}>
          <Text style={styles.sectionTitle}>Courier</Text>
          <View style={styles.infoRow}>
            <Ionicons name="bicycle-outline" size={18} color={Colors.gray500} />
            <Text style={styles.infoText}>{order.courierName}</Text>
            {order.courierETA && <Text style={styles.etaText}>ETA {order.courierETA} min</Text>}
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
        <Text style={styles.sectionTitle}>Items</Text>
        {order.items.map((item) => (
          <View key={item.id} style={styles.itemRow}>
            <Text style={styles.itemQty}>{item.quantity}x</Text>
            <Text style={styles.itemName}>{item.name}</Text>
            <Text style={styles.itemPrice}>${(item.price * item.quantity).toFixed(2)}</Text>
          </View>
        ))}
        {order.specialNotes && (
          <View style={styles.notesSection}>
            <Ionicons name="chatbubble-ellipses-outline" size={16} color={Colors.gray500} />
            <Text style={styles.notesText}>{order.specialNotes}</Text>
          </View>
        )}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalPrice}>${order.totalPrice.toFixed(2)}</Text>
        </View>
      </Card>

      {/* Quick Contact */}
      <Card style={styles.contactSection}>
        <Text style={styles.sectionTitle}>Quick Contact</Text>
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
              <Text style={styles.contactTitle}>Customer</Text>
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
              <Text style={styles.contactTitle}>Courier</Text>
              <Text style={styles.contactSubtitle}>
                {order.courierName}{order.courierETA ? ` · ETA ${order.courierETA} min` : ''}
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
            <Text style={styles.contactTitle}>Platform Support</Text>
            <Text style={styles.contactSubtitle}>Live chat or hotline</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.gray400} />
        </TouchableOpacity>
      </Card>

      {/* Courier Rating Modal */}
      <Modal visible={showRatingSheet} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.ratingSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.ratingTitle}>Rate This Courier</Text>
            <Text style={styles.ratingSubtitle}>{order.courierName}</Text>

            <RatingStars
              rating={courierStars}
              size={36}
              interactive
              onRate={setCourierStars}
            />

            <Text style={styles.criteriaLabel}>What went well?</Text>
            <View style={styles.criteriaRow}>
              {CRITERIA.map((c) => (
                <Chip
                  key={c}
                  label={c}
                  selected={selectedCriteria.includes(c)}
                  onPress={() => toggleCriterion(c)}
                />
              ))}
            </View>

            <TextInput
              style={styles.noteInput}
              placeholder="Optional note..."
              value={courierNote}
              onChangeText={setCourierNote}
              multiline
            />

            <TouchableOpacity
              style={[styles.submitButton, courierStars === 0 && styles.submitDisabled]}
              onPress={handleSubmitRating}
              disabled={courierStars === 0}
            >
              <Text style={styles.submitText}>Submit Review</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.skipButton}
              onPress={() => setShowRatingSheet(false)}
            >
              <Text style={styles.skipText}>Skip</Text>
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
  infoText: { ...Typography.body, color: Colors.gray700 },
  etaText: { ...Typography.footnote, color: Colors.accent, marginLeft: 'auto' },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.gray100 },
  itemQty: { ...Typography.headline, color: Colors.accent, width: 32 },
  itemName: { ...Typography.body, color: Colors.black, flex: 1 },
  itemPrice: { ...Typography.subhead, color: Colors.gray600 },
  notesSection: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, paddingTop: Spacing.sm },
  notesText: { ...Typography.subhead, color: Colors.gray500, fontStyle: 'italic', flex: 1 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: Spacing.md, marginTop: Spacing.sm, borderTopWidth: 2, borderTopColor: Colors.gray200 },
  totalLabel: { ...Typography.headline, color: Colors.black },
  totalPrice: { ...Typography.title3, color: Colors.accent },
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
