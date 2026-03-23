import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import * as Application from 'expo-application';
import {
  registerForPushNotifications,
  addNotificationReceivedListener,
  addNotificationResponseListener,
  sendLocalNotification,
} from '../utils/notifications';
import { createStompClient } from '../utils/websocket';
import { registerDeviceToken } from '../services/api';
import { useStore } from '../store';
import { useAuthStore } from '../store/authStore';

function getDeviceId(): string {
  if (Platform.OS === 'android') {
    return Application.getAndroidId() ?? 'android-unknown';
  }
  // iOS: applicationId is stable per install
  return Application.applicationId ?? 'ios-unknown';
}

/**
 * Call once in root layout. Handles:
 * 1. Push permission request + token registration with backend
 * 2. Foreground / tap notification listeners
 * 3. STOMP WebSocket connection for real-time order events
 */
export function useNotifications() {
  const router = useRouter();
  const setPushToken = useStore((s) => s.setPushToken);
  const pushToken = useStore((s) => s.pushToken);
  const restaurant = useAuthStore((s) => s.restaurant);
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const stompRef = useRef<ReturnType<typeof createStompClient> | null>(null);

  // 1. Request push permissions and save token (max 3 attempts)
  useEffect(() => {
    let attempt = 0;
    const maxAttempts = 3;

    function tryRegister() {
      attempt++;
      registerForPushNotifications()
        .then((token) => {
          if (token) {
            setPushToken(token);
          } else if (attempt < maxAttempts) {
            setTimeout(tryRegister, attempt * 2000);
          }
        })
        .catch(() => {
          if (attempt < maxAttempts) {
            setTimeout(tryRegister, attempt * 2000);
          }
        });
    }

    tryRegister();
  }, [setPushToken]);

  // 1b. Register push token with backend when token + auth are available
  useEffect(() => {
    if (!pushToken || !accessToken) return;

    const platform = Platform.OS === 'ios' ? 'IOS' : 'ANDROID';
    const deviceId = getDeviceId();

    registerDeviceToken({ token: pushToken, platform, deviceId }).catch(() => {
      // Non-fatal – backend won't send push but app still works
    });
  }, [pushToken, accessToken]);

  // 2. Notification listeners – handle push payload from backend
  useEffect(() => {
    const receivedSub = addNotificationReceivedListener(async (notification) => {
      const data = notification.request.content.data as Record<string, any> | undefined;
      if (data?.type === 'NEW_ORDER_RECEIVED') {
        const store = useStore.getState();
        await store.loadOrders();
        const orderId = data.orderId ? String(data.orderId) : null;
        const newOrder = orderId
          ? useStore.getState().orders.find((o) => o.id === orderId)
          : useStore.getState().orders.find((o) => o.status === 'created');
        if (newOrder && !store.showOrderAlert) {
          useStore.getState().triggerOrderAlert(newOrder);
        }
      }
    });

    const responseSub = addNotificationResponseListener((response) => {
      const data = response.notification.request.content.data as Record<string, any> | undefined;
      if (data?.orderId) {
        router.push(`/order/${data.orderId}`);
      }
    });

    return () => {
      receivedSub.remove();
      responseSub.remove();
    };
  }, [router]);

  // 3. STOMP WebSocket – connect when we have a restaurant and access token
  useEffect(() => {
    if (!restaurant?.id) return;

    // Clean up previous connection
    if (stompRef.current) {
      stompRef.current.disconnect();
    }

    const stomp = createStompClient(restaurant.id, user?.id);
    stompRef.current = stomp;

    stomp.connect(accessToken);

    const unsubscribe = stomp.onMessage(async (message) => {
      const store = useStore.getState();
      switch (message.type) {
        case 'new_order': {
          // Refresh the orders list first so we have the new order data
          await store.loadOrders();
          const payload = message.payload as Record<string, any> | undefined;
          const orderId = payload?.id ? String(payload.id) : payload?.orderId ? String(payload.orderId) : null;
          // Find the new order in the refreshed list, or use the payload
          const newOrder = orderId
            ? useStore.getState().orders.find((o) => o.id === orderId)
            : useStore.getState().orders.find((o) => o.status === 'created');
          if (newOrder) {
            // Full-screen alert with alarm sound
            useStore.getState().triggerOrderAlert(newOrder);
          }
          // Also fire a local notification for when app is backgrounded/locked
          sendLocalNotification(
            'New Order',
            newOrder
              ? `${newOrder.orderNumber} – ${newOrder.customerName}`
              : 'You have a new order waiting.',
            'orders',
          );
          break;
        }
        case 'order_update':
          store.loadOrders();
          break;
        case 'kitchen_ticket':
          store.loadOrders();
          break;
        case 'notification':
          store.setUnreadNotifCount(store.unreadNotifCount + 1);
          break;
      }
    });

    return () => {
      unsubscribe();
      stomp.disconnect();
    };
  }, [restaurant?.id, user?.id, accessToken]);
}
