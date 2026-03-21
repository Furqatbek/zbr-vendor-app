import React from 'react';
import { Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing } from '../../constants/theme';
import { useStore } from '../../store';
import { useT } from '../../i18n';

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
        headerStyle: {
          backgroundColor: Colors.white,
          shadowColor: 'transparent',
          elevation: 0,
          borderBottomWidth: 1,
          borderBottomColor: Colors.gray200,
        },
        headerTitleStyle: {
          ...Typography.headline,
          color: Colors.black,
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
