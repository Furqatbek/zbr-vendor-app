import React from 'react';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Colors } from '../constants/theme';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.white } }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="order/[id]"
            options={{
              headerShown: true,
              title: 'Order Detail',
              presentation: 'modal',
              headerTintColor: Colors.accent,
            }}
          />
          <Stack.Screen
            name="settings/profile"
            options={{ headerShown: true, title: 'Restaurant Profile', headerTintColor: Colors.accent }}
          />
          <Stack.Screen
            name="settings/working-hours"
            options={{ headerShown: true, title: 'Working Hours', headerTintColor: Colors.accent }}
          />
          <Stack.Screen
            name="settings/payments"
            options={{ headerShown: true, title: 'Payment Settings', headerTintColor: Colors.accent }}
          />
          <Stack.Screen
            name="settings/notifications"
            options={{ headerShown: true, title: 'Notifications', headerTintColor: Colors.accent }}
          />
          <Stack.Screen
            name="settings/staff"
            options={{ headerShown: true, title: 'Staff Accounts', headerTintColor: Colors.accent }}
          />
          <Stack.Screen
            name="settings/order-history"
            options={{ headerShown: true, title: 'Order History', headerTintColor: Colors.accent }}
          />
          <Stack.Screen
            name="settings/help"
            options={{ headerShown: true, title: 'Help Center', headerTintColor: Colors.accent }}
          />
          <Stack.Screen
            name="settings/about"
            options={{ headerShown: true, title: 'About', headerTintColor: Colors.accent }}
          />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
