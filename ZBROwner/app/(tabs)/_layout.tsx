import React, { useEffect, useState, useCallback } from 'react';
import { Platform, TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing } from '../../constants/theme';
import { useStore } from '../../store';
import { useAuthStore } from '../../store/authStore';
import { useT } from '../../i18n';
import { fetchUnreadCount } from '../../services/api';

function NotificationBell() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [unread, setUnread] = useState(0);

  const loadCount = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetchUnreadCount(user.id);
      setUnread(res.unreadCount);
    } catch { /* ignore */ }
  }, [user]);

  useEffect(() => { loadCount(); }, [loadCount]);

  // Poll every 30s for unread count
  useEffect(() => {
    const interval = setInterval(loadCount, 30000);
    return () => clearInterval(interval);
  }, [loadCount]);

  return (
    <TouchableOpacity
      onPress={() => router.push('/notifications')}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={bellStyles.container}
    >
      <Ionicons name="notifications-outline" size={24} color={Colors.accent} />
      {unread > 0 && (
        <View style={bellStyles.badge}>
          <Text style={bellStyles.badgeText}>{unread > 99 ? '99+' : unread}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const bellStyles = StyleSheet.create({
  container: { marginRight: Spacing.base, position: 'relative' },
  badge: {
    position: 'absolute', top: -4, right: -6,
    backgroundColor: Colors.danger, borderRadius: 9,
    minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { ...Typography.caption2, color: Colors.white, fontWeight: '700', fontSize: 10 },
});

export default function TabLayout() {
  const t = useT();
  const orders = useStore((s) => s.orders);
  const newOrderCount = orders.filter((o) => o.status === 'received').length;
  const insets = useSafeAreaInsets();

  // Ensure tab bar sits above the device's system navigation area
  const bottomInset = Math.max(insets.bottom, Platform.OS === 'android' ? 8 : 0);

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: Colors.white },
        headerTintColor: Colors.accent,
        headerTitleStyle: { ...Typography.title3, color: Colors.black },
        headerRight: () => <NotificationBell />,
        tabBarActiveTintColor: Colors.accent,
        tabBarInactiveTintColor: Colors.gray400,
        tabBarStyle: {
          backgroundColor: Colors.white,
          borderTopColor: Colors.gray200,
          borderTopWidth: 1,
          paddingBottom: bottomInset,
          height: 56 + bottomInset,
        },
        tabBarLabelStyle: {
          ...Typography.caption2,
          fontWeight: '500',
        },
        tabBarItemStyle: {
          paddingTop: 6,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.orders'),
          tabBarIcon: ({ color, size }) => <Ionicons name="receipt-outline" size={size} color={color} />,
          tabBarBadge: newOrderCount > 0 ? newOrderCount : undefined,
          tabBarBadgeStyle: { backgroundColor: Colors.accent, color: Colors.white },
        }}
      />
      <Tabs.Screen
        name="menu"
        options={{
          title: t('tabs.menu'),
          tabBarIcon: ({ color, size }) => <Ionicons name="restaurant-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: t('tabs.reports'),
          tabBarIcon: ({ color, size }) => <Ionicons name="bar-chart-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="reviews"
        options={{
          title: t('tabs.reviews'),
          tabBarIcon: ({ color, size }) => <Ionicons name="star-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: t('tabs.more'),
          tabBarIcon: ({ color, size }) => <Ionicons name="ellipsis-horizontal" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
