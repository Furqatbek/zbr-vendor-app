import { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import {
  registerForPushNotifications,
  addNotificationReceivedListener,
  addNotificationResponseListener,
  sendLocalNotification,
} from '../utils/notifications';
import { createStompClient } from '../utils/websocket';
import { useStore } from '../store';
import { useAuthStore } from '../store/authStore';

/**
 * Call once in root layout. Handles:
 * 1. Push permission request + token registration
 * 2. Foreground / tap notification listeners
 * 3. STOMP WebSocket connection for real-time order events
 */
export function useNotifications() {
  const router = useRouter();
  const setPushToken = useStore((s) => s.setPushToken);
  const pushToken = useStore((s) => s.pushToken);
  const restaurant = useAuthStore((s) => s.restaurant);
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

  // 2. Notification listeners
  useEffect(() => {
    const receivedSub = addNotificationReceivedListener((_notification) => {
      // notification received while app is in foreground – handled by the OS via setNotificationHandler
    });

    const responseSub = addNotificationResponseListener((response) => {
      const data = response.notification.request.content.data as Record<string, string> | undefined;
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

    const stomp = createStompClient(restaurant.id);
    stompRef.current = stomp;

    stomp.connect(accessToken);

    const unsubscribe = stomp.onMessage((message) => {
      switch (message.type) {
        case 'new_order':
          sendLocalNotification(
            'New Order',
            'You have a new order waiting to be accepted.',
            'orders',
          );
          useStore.getState().loadOrders();
          break;
        case 'order_update':
          useStore.getState().loadOrders();
          break;
        case 'kitchen_ticket':
          // Kitchen display update – refresh orders for ticket data
          useStore.getState().loadOrders();
          break;
        case 'notification':
          useStore.getState().setUnreadNotifCount(
            useStore.getState().unreadNotifCount + 1,
          );
          break;
      }
    });

    return () => {
      unsubscribe();
      stomp.disconnect();
    };
  }, [restaurant?.id, accessToken]);
}
