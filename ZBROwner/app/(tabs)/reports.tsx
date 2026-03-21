import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LineChart } from 'react-native-chart-kit';
import { Colors, Spacing, Typography, BorderRadius, Shadows } from '../../constants/theme';
import { useStore } from '../../store';
import Card from '../../components/Card';
import { useT } from '../../i18n';
import { useRefresh } from '../../hooks/useRefresh';

type Period = 'day' | 'week' | 'month';

const screenWidth = Dimensions.get('window').width;

const periodKeys: Record<Period, string> = {
  day: 'reports.day',
  week: 'reports.week',
  month: 'reports.month',
};

export default function ReportsScreen() {
  const { revenueData, selectedPeriod, setSelectedPeriod } = useStore();
  const t = useT();
  const router = useRouter();
  const { refreshing, handleRefresh } = useRefresh();
  const previewItems = revenueData.soldItems.slice(0, 5);

  const chartConfig = {
    backgroundGradientFrom: Colors.white,
    backgroundGradientTo: Colors.white,
    color: (opacity = 1) => `rgba(255, 90, 31, ${opacity})`,
    labelColor: () => Colors.gray500,
    strokeWidth: 2,
    propsForDots: { r: '4', strokeWidth: '1', stroke: Colors.accent },
    decimalPlaces: 0,
    propsForBackgroundLines: { stroke: Colors.gray100 },
  };

  const chartData = {
    labels: revenueData.chartData.map((d) => d.label),
    datasets: [{ data: revenueData.chartData.map((d) => d.value) }],
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.accent} colors={[Colors.accent]} />}>
      {/* Period Selector */}
      <View style={styles.segmentContainer}>
        {(['day', 'week', 'month'] as Period[]).map((p) => (
          <TouchableOpacity
            key={p}
            style={[styles.segmentButton, selectedPeriod === p && styles.segmentActive]}
            onPress={() => setSelectedPeriod(p)}
            accessibilityRole="tab"
          >
            <Text style={[styles.segmentText, selectedPeriod === p && styles.segmentTextActive]}>
              {t(periodKeys[p] as any)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Export Button */}
      <TouchableOpacity style={styles.exportButton} activeOpacity={0.7}>
        <Ionicons name="download-outline" size={18} color={Colors.accent} />
        <Text style={styles.exportText}>{t('reports.exportPdf' as any)}</Text>
      </TouchableOpacity>

      {/* Revenue Summary */}
      <Card style={styles.revenueCard}>
        <Text style={styles.revenueLabel}>{t('reports.totalRevenue' as any)}</Text>
        <Text style={styles.revenueValue}>{t('common.currency' as any, { amount: revenueData.totalRevenue.toFixed(2) })}</Text>
      </Card>

      <View style={styles.statsRow}>
        <Card style={styles.statCard}>
          <Text style={styles.statLabel}>{t('reports.orders' as any)}</Text>
          <Text style={styles.statValue}>{revenueData.ordersCount}</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={styles.statLabel}>{t('reports.avgValue' as any)}</Text>
          <Text style={styles.statValue}>{t('common.currency' as any, { amount: revenueData.avgOrderValue.toFixed(2) })}</Text>
        </Card>
      </View>

      {/* Chart */}
      <Card style={styles.chartCard}>
        <Text style={styles.chartTitle}>{t('reports.earningsOverTime' as any)}</Text>
        <LineChart
          data={chartData}
          width={screenWidth - Spacing.base * 2 - Spacing.base * 2}
          height={200}
          chartConfig={chartConfig}
          bezier
          withInnerLines={false}
          withOuterLines={false}
          withHorizontalLabels
          withVerticalLabels
          style={styles.chart}
          fromZero
        />
      </Card>

      {/* Sold Items Preview */}
      <Card style={styles.soldItemsCard}>
        <Text style={styles.sectionTitle}>{t('reports.soldItems' as any)}</Text>
        {previewItems.map((item, index) => (
          <View key={item.name} style={[styles.soldItemRow, index < previewItems.length - 1 && styles.soldItemBorder]}>
            <View style={styles.soldItemInfo}>
              <Text style={styles.soldItemName}>{item.name}</Text>
              <Text style={styles.soldItemCategory}>{item.category}</Text>
            </View>
            <View style={styles.soldItemStats}>
              <Text style={styles.soldItemUnits}>{t('reports.sold' as any, { count: item.unitsSold })}</Text>
              <Text style={styles.soldItemRevenue}>{t('common.currency' as any, { amount: item.revenue.toFixed(2) })}</Text>
            </View>
          </View>
        ))}
        <TouchableOpacity style={styles.viewAllButton} activeOpacity={0.7} onPress={() => router.push('/settings/sold-items' as any)}>
          <Text style={styles.viewAllText}>{t('reports.viewAllItems' as any, { count: revenueData.soldItems.length })}</Text>
          <Ionicons name="chevron-forward" size={16} color={Colors.accent} />
        </TouchableOpacity>
      </Card>

      {/* Refunds & Cancellations */}
      <View style={styles.statsRow}>
        <Card style={styles.statCard}>
          <Ionicons name="arrow-undo-outline" size={20} color={Colors.warning} />
          <Text style={styles.statLabel}>{t('reports.refunds' as any)}</Text>
          <Text style={styles.statValue}>{revenueData.refunds}</Text>
        </Card>
        <Card style={styles.statCard}>
          <Ionicons name="close-circle-outline" size={20} color={Colors.danger} />
          <Text style={styles.statLabel}>{t('reports.cancellations' as any)}</Text>
          <Text style={styles.statValue}>{revenueData.cancellations}</Text>
        </Card>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.gray50 },
  content: { padding: Spacing.base, paddingBottom: 100 },
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.gray100,
    borderRadius: BorderRadius.button,
    padding: 4,
    marginBottom: Spacing.base,
  },
  segmentButton: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: BorderRadius.button - 2, minHeight: 44, justifyContent: 'center' },
  segmentActive: { backgroundColor: Colors.white, ...Shadows.card },
  segmentText: { ...Typography.subhead, color: Colors.gray500 },
  segmentTextActive: { color: Colors.black, fontWeight: '600' },
  exportButton: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', gap: 4, marginBottom: Spacing.sm, minHeight: 44, paddingHorizontal: Spacing.sm },
  exportText: { ...Typography.subhead, color: Colors.accent, fontWeight: '600' },
  revenueCard: { alignItems: 'center', marginBottom: Spacing.base },
  revenueLabel: { ...Typography.footnote, color: Colors.gray500 },
  revenueValue: { ...Typography.largeTitle, color: Colors.accent, marginTop: 4 },
  statsRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.base },
  statCard: { flex: 1, alignItems: 'center', gap: 4 },
  statLabel: { ...Typography.caption1, color: Colors.gray500 },
  statValue: { ...Typography.title3, color: Colors.black },
  chartCard: { marginBottom: Spacing.base },
  chartTitle: { ...Typography.headline, color: Colors.black, marginBottom: Spacing.md },
  chart: { borderRadius: BorderRadius.card, marginLeft: -Spacing.base },
  soldItemsCard: { marginBottom: Spacing.base, padding: 0 },
  sectionTitle: { ...Typography.headline, color: Colors.black, padding: Spacing.base, paddingBottom: Spacing.sm },
  soldItemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.md, paddingHorizontal: Spacing.base },
  soldItemBorder: { borderBottomWidth: 1, borderBottomColor: Colors.gray100 },
  soldItemInfo: { flex: 1 },
  soldItemName: { ...Typography.body, color: Colors.black },
  soldItemCategory: { ...Typography.caption1, color: Colors.gray500, marginTop: 2 },
  soldItemStats: { alignItems: 'flex-end' },
  soldItemUnits: { ...Typography.subhead, color: Colors.gray600 },
  soldItemRevenue: { ...Typography.headline, color: Colors.black, marginTop: 2 },
  viewAllButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.base, borderTopWidth: 1, borderTopColor: Colors.gray100, gap: Spacing.xs },
  viewAllText: { ...Typography.subhead, color: Colors.accent, fontWeight: '600' },
});
