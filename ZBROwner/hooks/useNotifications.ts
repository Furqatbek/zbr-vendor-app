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

    // Token getter: the client re-reads this before every (re)connect
    // attempt, so reconnects always carry the current JWT.
    stomp.connect(() => useAuthStore.getState().accessToken);

    const unsubscribe = stomp.onMessage(async (message) => {
      const store = useStore.getState();
      switch (message.type) {
        case 'new_order': {
          // The restaurant orders topic now also carries status changes
          // (accept/ready/cancelled/etc). Only treat status === 'created'
          // as an actual new order so we don't fire the alarm on a cancel.
          const payload = message.payload as Record<string, any> | undefined;
          const rawStatus: unknown = payload?.status ?? payload?.order?.status;
          const status = typeof rawStatus === 'string' ? rawStatus.toLowerCase() : undefined;
          await store.loadOrders();
          if (status && status !== 'created') break;

          const orderId = payload?.id ? String(payload.id) : payload?.orderId ? String(payload.orderId) : null;
          const newOrder = orderId
            ? useStore.getState().orders.find((o) => o.id === orderId)
            : useStore.getState().orders.find((o) => o.status === 'created');
          if (newOrder) {
            useStore.getState().triggerOrderAlert(newOrder);
          }
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
        case 'connected':
          // (Re)connected — status changes pushed during the gap (deploy
          // drain, network blip, server auto-cancel/complete/refund) were
          // never delivered, so re-sync the orders list.
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
    // accessToken intentionally omitted: the token getter reads fresh state on
    // every (re)connect, so a refresh no longer requires a socket teardown.
  }, [restaurant?.id, user?.id]);
}
