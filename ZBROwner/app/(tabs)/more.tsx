import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, Typography, BorderRadius, Shadows } from '../../constants/theme';
import { useStore } from '../../store';
import { useAuthStore } from '../../store/authStore';
import { toggleRestaurantOpen } from '../../services/api';
import Card from '../../components/Card';
import PillSwitch from '../../components/PillSwitch';
import RatingStars from '../../components/RatingStars';
import { useI18n, LOCALE_NAMES } from '../../i18n';
import type { Locale } from '../../i18n';
import { useRefresh } from '../../hooks/useRefresh';

export default function MoreScreen() {
  const isOpen = useStore((s) => s.isOpen);
  const setOpen = useStore((s) => s.setOpen);
  const orders = useStore((s) => s.orders) ?? [];
  const revenueData = useStore((s) => s.revenueData);
  const loadOrders = useStore((s) => s.loadOrders);
  const loadReviews = useStore((s) => s.loadReviews);
  const loadFinancialReport = useStore((s) => s.loadFinancialReport);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, locale, setLocale } = useI18n();
  const authLogout = useAuthStore((s) => s.logout);
  const restaurant = useAuthStore((s) => s.restaurant);
  const restaurants = useAuthStore((s) => s.restaurants);
  const selectRestaurant = useAuthStore((s) => s.selectRestaurant);
  const loadRestaurants = useAuthStore((s) => s.loadRestaurants);
  const [showLogout, setShowLogout] = useState(false);

  const refreshAll = async () => {
    await Promise.all([
      loadRestaurants().catch(() => {}),
      loadOrders().catch(() => {}),
      loadReviews().catch(() => {}),
      loadFinancialReport().catch(() => {}),
    ]);
  };
  const { refreshing, handleRefresh } = useRefresh(refreshAll);

  useEffect(() => {
    if (!restaurant?.id) return;
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurant?.id]);

  const handleToggleOpen = async () => {
    const newStatus = !isOpen;
    if (!restaurant?.id) return;
    try {
      await toggleRestaurantOpen(restaurant.id, newStatus);
      setOpen(newStatus);
    } catch {
      // API failed — don't update local state
    }
  };

  const locales: Locale[] = ['en', 'ru', 'uz-Latn', 'uz-Cyrl'];

  const stats = useMemo(() => {
    const activeOrders = orders.filter((o) =>
      ['created', 'accepted', 'preparing', 'ready'].includes(o.status),
    );
    const todayOrders = orders.filter((o) => o.status !== 'cancelled');
    return { todayOrders: todayOrders.length, activeOrders: activeOrders.length };
  }, [orders]);

  type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

  const settingsItems: { icon: IoniconsName; label: string; route: string; subtitle: string }[] = [
    { icon: 'storefront-outline', label: t('more.restaurantProfile'), route: '/settings/profile', subtitle: restaurant?.addressLine1 ?? '' },
    { icon: 'location-outline', label: t('more.restaurantLocation'), route: '/settings/location', subtitle: t('more.restaurantLocationSubtitle') },
    { icon: 'sync-outline', label: t('more.integration'), route: '/settings/integration', subtitle: t('more.integrationSubtitle') },
// Card payment hidden – no online payment integration yet
    // { icon: 'card-outline', label: t('more.paymentSettings'), route: '/settings/payments', subtitle: t('more.balancePayouts') },
    { icon: 'notifications-outline', label: t('more.notificationPrefs'), route: '/settings/notifications', subtitle: t('more.manageAlerts') },
    { icon: 'document-text-outline', label: t('more.orderHistory'), route: '/settings/order-history', subtitle: t('more.totalOrders', { count: orders.length }) },
    { icon: 'help-circle-outline', label: t('more.helpCenter'), route: '/settings/help', subtitle: t('more.faqSupport') },
    { icon: 'information-circle-outline', label: t('more.about'), route: '/settings/about', subtitle: 'v1.0.0' },
  ];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.accent} colors={[Colors.accent]} />}>
      {/* Restaurant Header */}
      <View style={styles.restaurantHeader}>
        <View style={styles.avatarPlaceholder}>
          <Ionicons name="restaurant" size={28} color={Colors.accent} />
        </View>
        <View style={styles.restaurantInfo}>
          <Text style={styles.restaurantName}>{restaurant?.name ?? ''}</Text>
          <Text style={styles.restaurantAddress} numberOfLines={1}>{restaurant?.fullAddress ?? ''}</Text>
        </View>
        <PillSwitch isOn={isOpen} onToggle={handleToggleOpen} />
      </View>

      {/* Restaurant Switcher */}
      {restaurants.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>{t('more.myRestaurants')}</Text>
          <Card style={styles.menuCard}>
            {restaurants.map((r, index) => {
              const isSelected = r.id === restaurant?.id;
              return (
                <TouchableOpacity
                  key={r.id}
                  style={[styles.menuRow, index < restaurants.length - 1 && styles.menuRowBorder]}
                  onPress={() => selectRestaurant(r.id)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.menuIconWrap, isSelected && styles.switcherIconActive]}>
                    <Ionicons name="storefront-outline" size={20} color={isSelected ? Colors.white : Colors.accent} />
                  </View>
                  <View style={styles.menuInfo}>
                    <Text style={[styles.menuLabel, isSelected && styles.switcherLabelActive]}>{r.name}</Text>
                    <Text style={styles.menuSubtitle} numberOfLines={1}>{r.addressLine1}</Text>
                  </View>
                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={22} color={Colors.accent} />
                  )}
                </TouchableOpacity>
              );
            })}
          </Card>
        </>
      )}

      {/* Quick Stats */}
      <View style={styles.statsGrid}>
        <Card style={styles.statCard}>
          <Ionicons name="receipt" size={20} color={Colors.info} />
          <Text style={styles.statValue}>{stats.activeOrders}</Text>
          <Text style={styles.statLabel}>{t('more.activeOrders')}</Text>
        </Card>
        <Card style={styles.statCard}>
          <Ionicons name="cash" size={20} color={Colors.success} />
          <Text style={styles.statValue}>{t('common.currency', { amount: revenueData.totalRevenue.toFixed(0) })}</Text>
          <Text style={styles.statLabel}>{t('more.todaysRevenue')}</Text>
        </Card>
        <Card style={styles.statCard}>
          <Ionicons name="star" size={20} color={Colors.warning} />
          <Text style={styles.statValue}>{(restaurant?.averageRating ?? 0).toFixed(1)}</Text>
          <Text style={styles.statLabel}>{t('more.avgRating')}</Text>
        </Card>
        <Card style={styles.statCard}>
          <Ionicons name="bag-check" size={20} color={Colors.accent} />
          <Text style={styles.statValue}>{stats.todayOrders}</Text>
          <Text style={styles.statLabel}>{t('more.todaysOrders')}</Text>
        </Card>
      </View>

      {/* Settings Menu */}
      <Text style={styles.sectionTitle}>{t('more.settingsManagement')}</Text>
      <Card style={styles.menuCard}>
        {settingsItems.map((item, index) => (
          <TouchableOpacity
            key={item.label}
            style={[styles.menuRow, index < settingsItems.length - 1 && styles.menuRowBorder]}
            onPress={() => router.push(item.route as any)}
            activeOpacity={0.7}
          >
            <View style={styles.menuIconWrap}>
              <Ionicons name={item.icon} size={20} color={Colors.accent} />
            </View>
            <View style={styles.menuInfo}>
              <Text style={styles.menuLabel}>{item.label}</Text>
              <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.gray400} />
          </TouchableOpacity>
        ))}
      </Card>

      {/* Language Selector */}
      <Text style={styles.sectionTitle}>{t('more.language')}</Text>
      <Card style={styles.menuCard}>
        {locales.map((loc, index) => {
          const isSelected = loc === locale;
          return (
            <TouchableOpacity
              key={loc}
              style={[styles.menuRow, index < locales.length - 1 && styles.menuRowBorder]}
              onPress={() => setLocale(loc)}
              activeOpacity={0.7}
            >
              <View style={[styles.menuIconWrap, isSelected && styles.langIconActive]}>
                <Ionicons name="language-outline" size={20} color={isSelected ? Colors.white : Colors.accent} />
              </View>
              <View style={styles.menuInfo}>
                <Text style={[styles.menuLabel, isSelected && styles.langLabelActive]}>{LOCALE_NAMES[loc]}</Text>
              </View>
              {isSelected && (
                <Ionicons name="checkmark-circle" size={22} color={Colors.accent} />
              )}
            </TouchableOpacity>
          );
        })}
      </Card>

      {/* Logout */}
      <TouchableOpacity
        style={styles.logoutButton}
        activeOpacity={0.7}
        onPress={() => setShowLogout(true)}
      >
        <Ionicons name="log-out-outline" size={20} color={Colors.danger} />
        <Text style={styles.logoutText}>{t('more.logOut')}</Text>
      </TouchableOpacity>

      <Text style={styles.versionText}>{t('more.appVersion')}</Text>

      {/* Logout Confirmation Modal */}
      <Modal visible={showLogout} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalIconWrap}>
              <Ionicons name="log-out-outline" size={28} color={Colors.danger} />
            </View>
            <Text style={styles.modalTitle}>{t('more.logOut')}</Text>
            <Text style={styles.modalMessage}>{t('more.logOutConfirm')}</Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowLogout(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalLogoutButton}
                onPress={async () => { setShowLogout(false); await authLogout(); router.replace('/login'); }}
                activeOpacity={0.7}
              >
                <Text style={styles.modalLogoutText}>{t('more.logOut')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.gray50 },
  content: { padding: Spacing.base },
  restaurantHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.xl, gap: Spacing.md },
  avatarPlaceholder: { width: 52, height: 52, borderRadius: 26, backgroundColor: Colors.accentLight, justifyContent: 'center', alignItems: 'center' },
  restaurantInfo: { flex: 1 },
  restaurantName: { ...Typography.title3, color: Colors.black },
  restaurantAddress: { ...Typography.caption1, color: Colors.gray500, marginTop: 2 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.xl },
  statCard: { width: '48%' as any, flexGrow: 1, flexBasis: '46%' as any, alignItems: 'center', gap: 4, paddingVertical: Spacing.md },
  statValue: { ...Typography.title3, color: Colors.black },
  statLabel: { ...Typography.caption1, color: Colors.gray500 },
  sectionTitle: { ...Typography.headline, color: Colors.black, marginBottom: Spacing.sm },
  menuCard: { padding: 0, marginBottom: Spacing.base },
  menuRow: { flexDirection: 'row', alignItems: 'center', padding: Spacing.base, minHeight: 56 },
  menuRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.gray100 },
  menuIconWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.accentLight, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md },
  menuInfo: { flex: 1 },
  menuLabel: { ...Typography.body, color: Colors.black },
  menuSubtitle: { ...Typography.caption1, color: Colors.gray500, marginTop: 2 },
  switcherIconActive: { backgroundColor: Colors.accent },
  switcherLabelActive: { fontWeight: '600', color: Colors.accent },
  langIconActive: { backgroundColor: Colors.accent },
  langLabelActive: { fontWeight: '600', color: Colors.accent },
  logoutButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.base, marginTop: Spacing.base, gap: Spacing.sm, minHeight: 48 },
  logoutText: { ...Typography.headline, color: Colors.danger },
  versionText: { ...Typography.caption1, color: Colors.gray400, textAlign: 'center', marginTop: Spacing.md },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: Colors.white, borderRadius: BorderRadius.card, padding: Spacing.xl, width: '85%', alignItems: 'center' },
  modalIconWrap: { width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.dangerLight, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.base },
  modalTitle: { ...Typography.title3, color: Colors.black, marginBottom: Spacing.sm },
  modalMessage: { ...Typography.body, color: Colors.gray500, textAlign: 'center', marginBottom: Spacing.xl },
  modalButtons: { flexDirection: 'row', gap: Spacing.md, width: '100%' },
  modalCancelButton: { flex: 1, paddingVertical: Spacing.md, borderRadius: BorderRadius.button, borderWidth: 1, borderColor: Colors.gray200, alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  modalCancelText: { ...Typography.headline, color: Colors.gray500 },
  modalLogoutButton: { flex: 1, paddingVertical: Spacing.md, borderRadius: BorderRadius.button, backgroundColor: Colors.danger, alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  modalLogoutText: { ...Typography.headline, color: Colors.white },
});
