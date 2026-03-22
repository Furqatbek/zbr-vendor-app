import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
  Platform, RefreshControl,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, BorderRadius } from '../../constants/theme';
import Card from '../../components/Card';
import { useT } from '../../i18n';
import { useAuthStore } from '../../store/authStore';
import { fetchPayouts } from '../../services/api';
import type { Payout } from '../../types';

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfDay(d: Date): Date {
  const e = new Date(d);
  e.setHours(23, 59, 59, 999);
  return e;
}

function fmtISO(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function fmtDisplay(d: Date): string {
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

const STATUS_COLORS: Record<string, string> = {
  COMPLETED: Colors.success,
  PENDING: Colors.warning,
  PROCESSING: Colors.info,
  FAILED: Colors.danger,
};

export default function PaymentSettingsScreen() {
  const t = useT();
  const restaurant = useAuthStore((s) => s.restaurant);

  const [startDate, setStartDate] = useState(() => startOfMonth(new Date()));
  const [endDate, setEndDate] = useState(() => endOfDay(new Date()));
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Date picker visibility (Android shows inline, iOS uses modal)
  const [showStart, setShowStart] = useState(false);
  const [showEnd, setShowEnd] = useState(false);

  const loadPayouts = useCallback(async (start: Date, end: Date) => {
    if (!restaurant) return;
    setError(null);
    try {
      const res = await fetchPayouts(restaurant.id, fmtISO(start), fmtISO(endOfDay(end)));
      setPayouts(res.data ?? []);
    } catch {
      setError(t('payments.failedToLoad'));
    }
  }, [restaurant, t]);

  useEffect(() => {
    setLoading(true);
    loadPayouts(startDate, endDate).finally(() => setLoading(false));
  }, []); // initial load

  const handleApply = useCallback(() => {
    setLoading(true);
    loadPayouts(startDate, endDate).finally(() => setLoading(false));
  }, [startDate, endDate, loadPayouts]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadPayouts(startDate, endDate).finally(() => setRefreshing(false));
  }, [startDate, endDate, loadPayouts]);

  const onChangeStart = (_: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') setShowStart(false);
    if (date) setStartDate(date);
  };

  const onChangeEnd = (_: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') setShowEnd(false);
    if (date) setEndDate(date);
  };

  const statusLabel = (status: Payout['status']): string => {
    const map: Record<string, string> = {
      PENDING: t('payments.statusPending'),
      PROCESSING: t('payments.statusProcessing'),
      COMPLETED: t('payments.statusCompleted'),
      FAILED: t('payments.statusFailed'),
    };
    return map[status] ?? status;
  };

  const total = payouts.reduce((sum, p) => sum + p.amount, 0);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.accent} />}
    >
      {/* Date Range Picker */}
      <Text style={styles.sectionTitle}>{t('payments.dateRange')}</Text>
      <Card style={styles.dateCard}>
        {/* Start date */}
        <View style={styles.dateRow}>
          <Text style={styles.dateLabel}>{t('payments.startDate')}</Text>
          <TouchableOpacity style={styles.datePill} onPress={() => setShowStart(!showStart)}>
            <Ionicons name="calendar-outline" size={16} color={Colors.accent} />
            <Text style={styles.datePillText}>{fmtDisplay(startDate)}</Text>
          </TouchableOpacity>
        </View>
        {showStart && (
          <DateTimePicker
            value={startDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            maximumDate={endDate}
            onChange={onChangeStart}
          />
        )}

        {/* End date */}
        <View style={[styles.dateRow, { marginTop: Spacing.sm }]}>
          <Text style={styles.dateLabel}>{t('payments.endDate')}</Text>
          <TouchableOpacity style={styles.datePill} onPress={() => setShowEnd(!showEnd)}>
            <Ionicons name="calendar-outline" size={16} color={Colors.accent} />
            <Text style={styles.datePillText}>{fmtDisplay(endDate)}</Text>
          </TouchableOpacity>
        </View>
        {showEnd && (
          <DateTimePicker
            value={endDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            minimumDate={startDate}
            maximumDate={new Date()}
            onChange={onChangeEnd}
          />
        )}

        {/* Apply button */}
        <TouchableOpacity style={styles.applyBtn} onPress={handleApply}>
          <Text style={styles.applyBtnText}>{t('payments.apply')}</Text>
        </TouchableOpacity>
      </Card>

      {/* Total */}
      {!loading && !error && payouts.length > 0 && (
        <Card style={styles.totalCard}>
          <Text style={styles.totalLabel}>{t('payments.totalPayout')}</Text>
          <Text style={styles.totalValue}>{t('common.currency', { amount: total.toFixed(2) })}</Text>
          <Text style={styles.totalNote}>
            {fmtDisplay(startDate)} – {fmtDisplay(endDate)}
          </Text>
        </Card>
      )}

      {/* Payouts List */}
      <Text style={styles.sectionTitle}>{t('payments.payouts')}</Text>

      {loading ? (
        <Card style={styles.centerCard}>
          <ActivityIndicator size="small" color={Colors.accent} />
          <Text style={styles.emptyText}>{t('payments.loadingPayouts')}</Text>
        </Card>
      ) : error ? (
        <Card style={styles.centerCard}>
          <Ionicons name="alert-circle-outline" size={24} color={Colors.danger} />
          <Text style={[styles.emptyText, { color: Colors.danger }]}>{error}</Text>
          <TouchableOpacity onPress={handleApply}>
            <Text style={styles.retryText}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </Card>
      ) : payouts.length === 0 ? (
        <Card style={styles.centerCard}>
          <Ionicons name="wallet-outline" size={32} color={Colors.gray300} />
          <Text style={styles.emptyText}>{t('payments.noPayouts')}</Text>
        </Card>
      ) : (
        <Card style={styles.listCard}>
          {payouts.map((payout, index) => (
            <View key={payout.id} style={[styles.payoutRow, index < payouts.length - 1 && styles.payoutBorder]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.payoutDate}>
                  {fmtDisplay(new Date(payout.createdAt))}
                </Text>
                <Text style={[styles.payoutStatus, { color: STATUS_COLORS[payout.status] ?? Colors.gray500 }]}>
                  {statusLabel(payout.status)}
                </Text>
              </View>
              <Text style={styles.payoutAmount}>
                {t('common.currency', { amount: payout.amount.toFixed(2) })}
              </Text>
            </View>
          ))}
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.gray50 },
  content: { padding: Spacing.base, paddingBottom: 100 },
  sectionTitle: { ...Typography.headline, color: Colors.black, marginBottom: Spacing.sm, marginTop: Spacing.sm },

  // Date range
  dateCard: { marginBottom: Spacing.base },
  dateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dateLabel: { ...Typography.subhead, color: Colors.gray500 },
  datePill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.gray50, paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: BorderRadius.button, borderWidth: 1, borderColor: Colors.gray200,
  },
  datePillText: { ...Typography.subhead, color: Colors.black },
  applyBtn: {
    marginTop: Spacing.md, backgroundColor: Colors.accent,
    paddingVertical: 12, borderRadius: BorderRadius.button, alignItems: 'center',
  },
  applyBtnText: { ...Typography.headline, color: Colors.white },

  // Total
  totalCard: { alignItems: 'center', marginBottom: Spacing.base },
  totalLabel: { ...Typography.footnote, color: Colors.gray500 },
  totalValue: { ...Typography.largeTitle, color: Colors.accent, marginTop: 4 },
  totalNote: { ...Typography.caption1, color: Colors.gray400, marginTop: Spacing.sm },

  // List
  listCard: { padding: 0, marginBottom: Spacing.base },
  payoutRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.base },
  payoutBorder: { borderBottomWidth: 1, borderBottomColor: Colors.gray100 },
  payoutDate: { ...Typography.subhead, color: Colors.black },
  payoutStatus: { ...Typography.caption1, marginTop: 2 },
  payoutAmount: { ...Typography.headline, color: Colors.black },

  // States
  centerCard: { alignItems: 'center', paddingVertical: Spacing.xl, gap: Spacing.sm },
  emptyText: { ...Typography.footnote, color: Colors.gray500 },
  retryText: { ...Typography.headline, color: Colors.accent, marginTop: Spacing.sm },
});
