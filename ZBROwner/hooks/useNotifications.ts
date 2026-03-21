import { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import {
  registerForPushNotifications,
  addNotificationReceivedListener,
  addNotificationResponseListener,
  sendLocalNotification,
} from '../utils/notifications';
import { createWSClient } from '../utils/websocket';
import { useStore } from '../store';
import { ENDPOINTS } from '../constants/api';

/**
 * Call once in root layout. Handles:
 * 1. Push permission request + token registration
 * 2. Foreground / tap notification listeners
 * 3. WebSocket connection for real-time order events
 */
export function useNotifications() {
  const router = useRouter();
  const setPushToken = useStore((s) => s.setPushToken);
  const pushToken = useStore((s) => s.pushToken);
  const wsRef = useRef(createWSClient(ENDPOINTS.ws));

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

  // 3. WebSocket – connect when we have a push token, reconnect automatically
  useEffect(() => {
    const ws = wsRef.current;
    ws.connect(pushToken);

    const unsubscribe = ws.onMessage((message) => {
      switch (message.type) {
        case 'new_order':
          sendLocalNotification(
            'New Order',
            'You have a new order waiting to be accepted.',
            'orders',
          );
          break;
        case 'order_update':
          // store updates will come via a future REST sync or direct WS payload
          break;
      }
    });

    return () => {
      unsubscribe();
      ws.disconnect();
    };
  }, [pushToken]);
}
