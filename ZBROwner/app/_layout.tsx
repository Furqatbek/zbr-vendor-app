import React from 'react';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Colors } from '../constants/theme';
import I18nProvider from '../i18n/I18nProvider';
import { useI18n } from '../i18n';

function AppStack() {
  const { t } = useI18n();

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.white } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="order/[id]"
        options={{
          headerShown: true,
          title: t('screenTitles.orderDetail'),
          presentation: 'modal',
          headerTintColor: Colors.accent,
        }}
      />
      <Stack.Screen
        name="settings/profile"
        options={{ headerShown: true, title: t('screenTitles.restaurantProfile'), headerTintColor: Colors.accent }}
      />
      <Stack.Screen
        name="settings/working-hours"
        options={{ headerShown: true, title: t('screenTitles.workingHours'), headerTintColor: Colors.accent }}
      />
      <Stack.Screen
        name="settings/payments"
        options={{ headerShown: true, title: t('screenTitles.paymentSettings'), headerTintColor: Colors.accent }}
      />
      <Stack.Screen
        name="settings/notifications"
        options={{ headerShown: true, title: t('screenTitles.notifications'), headerTintColor: Colors.accent }}
      />
      <Stack.Screen
        name="settings/staff"
        options={{ headerShown: true, title: t('screenTitles.staffAccounts'), headerTintColor: Colors.accent }}
      />
      <Stack.Screen
        name="settings/order-history"
        options={{ headerShown: true, title: t('screenTitles.orderHistory'), headerTintColor: Colors.accent }}
      />
      <Stack.Screen
        name="settings/help"
        options={{ headerShown: true, title: t('screenTitles.helpCenter'), headerTintColor: Colors.accent }}
      />
      <Stack.Screen
        name="settings/about"
        options={{ headerShown: true, title: t('screenTitles.about'), headerTintColor: Colors.accent }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <I18nProvider>
          <StatusBar style="dark" />
          <AppStack />
        </I18nProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
