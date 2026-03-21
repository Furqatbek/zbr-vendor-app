import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, BorderRadius, Shadows } from '../../constants/theme';
import { useStore } from '../../store';
import Card from '../../components/Card';
import { useT } from '../../i18n';
import { useRefresh } from '../../hooks/useRefresh';

type SortMode = 'units' | 'revenue';

export default function SoldItemsScreen() {
  const { revenueData } = useStore();
  const t = useT();
  const { refreshing, handleRefresh } = useRefresh();

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortMode>('units');

  const categories = useMemo(() => {
    const cats = [...new Set(revenueData.soldItems.map((i) => i.category))];
    return cats.sort();
  }, [revenueData.soldItems]);

  const filteredItems = useMemo(() => {
    let items = [...revenueData.soldItems];
    if (selectedCategory) {
      items = items.filter((i) => i.category === selectedCategory);
    }
    items.sort((a, b) => (sortBy === 'units' ? b.unitsSold - a.unitsSold : b.revenue - a.revenue));
    return items;
  }, [revenueData.soldItems, selectedCategory, sortBy]);

  const totals = useMemo(() => {
    const units = filteredItems.reduce((s, i) => s + i.unitsSold, 0);
    const revenue = filteredItems.reduce((s, i) => s + i.revenue, 0);
    return { units, revenue };
  }, [filteredItems]);

  const renderHeader = () => (
    <View>
      {/* Summary */}
      <View style={styles.summaryRow}>
        <Card style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>{t('soldItems.totalUnits' as any)}</Text>
          <Text style={styles.summaryValue}>{totals.units}</Text>
        </Card>
        <Card style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>{t('soldItems.totalRevenue' as any)}</Text>
          <Text style={styles.summaryValue}>{t('common.currency' as any, { amount: totals.revenue.toFixed(2) })}</Text>
        </Card>
      </View>

      {/* Category Filter */}
      <Text style={styles.filterLabel}>{t('soldItems.filterByCategory' as any)}</Text>
      <FlatList
        data={[null, ...categories]}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item ?? 'all'}
        contentContainerStyle={styles.filterList}
        renderItem={({ item: cat }) => {
          const isActive = cat === selectedCategory;
          return (
            <TouchableOpacity
              style={[styles.filterChip, isActive && styles.filterChipActive]}
              onPress={() => setSelectedCategory(cat)}
              activeOpacity={0.7}
            >
              <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                {cat ?? t('soldItems.allCategories' as any)}
              </Text>
            </TouchableOpacity>
          );
        }}
      />

      {/* Sort */}
      <View style={styles.sortRow}>
        <Text style={styles.sortLabel}>{t('soldItems.sortBy' as any)}</Text>
        <TouchableOpacity
          style={[styles.sortChip, sortBy === 'units' && styles.sortChipActive]}
          onPress={() => setSortBy('units')}
          activeOpacity={0.7}
        >
          <Text style={[styles.sortChipText, sortBy === 'units' && styles.sortChipTextActive]}>
            {t('soldItems.byUnits' as any)}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.sortChip, sortBy === 'revenue' && styles.sortChipActive]}
          onPress={() => setSortBy('revenue')}
          activeOpacity={0.7}
        >
          <Text style={[styles.sortChipText, sortBy === 'revenue' && styles.sortChipTextActive]}>
            {t('soldItems.byRevenue' as any)}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Count */}
      <Text style={styles.resultCount}>
        {t('soldItems.showingItems' as any, { count: filteredItems.length })}
      </Text>
    </View>
  );

  const renderItem = ({ item, index }: { item: typeof filteredItems[0]; index: number }) => (
    <Card style={styles.itemCard}>
      <View style={styles.itemRow}>
        <View style={styles.rankCircle}>
          <Text style={styles.rankText}>{index + 1}</Text>
        </View>
        <View style={styles.itemInfo}>
          <Text style={styles.itemName}>{item.name}</Text>
          <Text style={styles.itemCategory}>{item.category}</Text>
        </View>
        <View style={styles.itemStats}>
          <Text style={styles.itemUnits}>{t('reports.sold' as any, { count: item.unitsSold })}</Text>
          <Text style={styles.itemRevenue}>{t('common.currency' as any, { amount: item.revenue.toFixed(2) })}</Text>
        </View>
      </View>
    </Card>
  );

  return (
    <FlatList
      style={styles.screen}
      data={filteredItems}
      keyExtractor={(item) => item.name}
      renderItem={renderItem}
      ListHeaderComponent={renderHeader}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.accent} colors={[Colors.accent]} />}
      ListEmptyComponent={
        <View style={styles.emptyContainer}>
          <Ionicons name="bag-outline" size={48} color={Colors.gray300} />
          <Text style={styles.emptyText}>{t('soldItems.noItems' as any)}</Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.gray50 },
  listContent: { padding: Spacing.base, paddingBottom: 100 },
  summaryRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.base },
  summaryCard: { flex: 1, alignItems: 'center', gap: 4 },
  summaryLabel: { ...Typography.caption1, color: Colors.gray500 },
  summaryValue: { ...Typography.title3, color: Colors.black },
  filterLabel: { ...Typography.headline, color: Colors.black, marginBottom: Spacing.sm },
  filterList: { gap: Spacing.sm, marginBottom: Spacing.base },
  filterChip: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.gray200,
  },
  filterChipActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  filterChipText: { ...Typography.subhead, color: Colors.gray600 },
  filterChipTextActive: { color: Colors.white, fontWeight: '600' },
  sortRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.base },
  sortLabel: { ...Typography.subhead, color: Colors.gray500 },
  sortChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.chip,
    backgroundColor: Colors.gray100,
  },
  sortChipActive: { backgroundColor: Colors.accentLight },
  sortChipText: { ...Typography.caption1, color: Colors.gray500, fontWeight: '500' },
  sortChipTextActive: { color: Colors.accent },
  resultCount: { ...Typography.footnote, color: Colors.gray400, marginBottom: Spacing.sm },
  itemCard: { marginBottom: Spacing.sm },
  itemRow: { flexDirection: 'row', alignItems: 'center' },
  rankCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.accentLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  rankText: { ...Typography.subhead, color: Colors.accent, fontWeight: '600' },
  itemInfo: { flex: 1 },
  itemName: { ...Typography.body, color: Colors.black },
  itemCategory: { ...Typography.caption1, color: Colors.gray500, marginTop: 2 },
  itemStats: { alignItems: 'flex-end' },
  itemUnits: { ...Typography.subhead, color: Colors.gray600 },
  itemRevenue: { ...Typography.headline, color: Colors.black, marginTop: 2 },
  emptyContainer: { alignItems: 'center', paddingTop: Spacing['3xl'], gap: Spacing.md },
  emptyText: { ...Typography.body, color: Colors.gray400 },
});
