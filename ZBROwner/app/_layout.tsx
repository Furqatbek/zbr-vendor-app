import React, { useEffect, useCallback } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { View, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { Colors } from '../constants/theme';
import I18nProvider from '../i18n/I18nProvider';
import { useI18n } from '../i18n';
import { useNotifications } from '../hooks/useNotifications';
import { useAuthStore } from '../store/authStore';
import { useStore } from '../store';
import NewOrderAlert from '../components/NewOrderAlert';

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isInitialized, initialize } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (!isInitialized) return;

    const inAuthGroup = segments[0] === 'login' || segments[0] === 'forgot-password';

    if (!user && !inAuthGroup) {
      router.replace('/login');
    } else if (user && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [user, isInitialized, segments, router]);

  if (!isInitialized) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color={Colors.accent} />
      </View>
    );
  }

  return <>{children}</>;
}

function OrderAlertOverlay() {
  const router = useRouter();
  const incomingOrder = useStore((s) => s.incomingOrder);
  const showOrderAlert = useStore((s) => s.showOrderAlert);
  const dismissOrderAlert = useStore((s) => s.dismissOrderAlert);
  const acceptOrder = useStore((s) => s.acceptOrder);
  const declineOrder = useStore((s) => s.declineOrder);

  const handleAccept = useCallback(async (orderId: string) => {
    dismissOrderAlert();
    try {
      await acceptOrder(orderId);
    } catch {
      // Already handled in store
    }
  }, [acceptOrder, dismissOrderAlert]);

  const handleDecline = useCallback(async (orderId: string) => {
    dismissOrderAlert();
    try {
      await declineOrder(orderId, 'Declined by vendor');
    } catch {
      // Already handled in store
    }
  }, [declineOrder, dismissOrderAlert]);

  const handleView = useCallback((orderId: string) => {
    dismissOrderAlert();
    router.push(`/order/${orderId}`);
  }, [dismissOrderAlert, router]);

  return (
    <NewOrderAlert
      order={incomingOrder}
      visible={showOrderAlert}
      onAccept={handleAccept}
      onDecline={handleDecline}
      onView={handleView}
    />
  );
}

function AppStack() {
  const { t } = useI18n();
  useNotifications();

  return (
    <>
    <OrderAlertOverlay />
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.white } }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="forgot-password" />
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
        name="notifications"
        options={{ headerShown: true, title: t('screenTitles.notificationInbox'), headerTintColor: Colors.accent }}
      />
      <Stack.Screen
        name="settings/profile"
        options={{ headerShown: true, title: t('screenTitles.restaurantProfile'), headerTintColor: Colors.accent }}
      />
      <Stack.Screen
        name="settings/integration"
        options={{ headerShown: true, title: t('screenTitles.integration'), headerTintColor: Colors.accent }}
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
        name="settings/sold-items"
        options={{ headerShown: true, title: t('screenTitles.soldItems'), headerTintColor: Colors.accent }}
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
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <I18nProvider>
          <StatusBar style="dark" />
          <AuthGuard>
            <AppStack />
          </AuthGuard>
        </I18nProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.white,
  },
});
