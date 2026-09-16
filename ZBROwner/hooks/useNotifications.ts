import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import {
  registerForPushNotifications,
  addNotificationReceivedListener,
  addNotificationResponseListener,
  addPushTokenListener,
  getInitialNotificationResponse,
  sendLocalNotification,
  ORDERS_CHANNEL,
} from '../utils/notifications';
import { getDeviceId } from '../utils/deviceId';
import { createStompClient } from '../utils/websocket';
import { registerDeviceToken } from '../services/api';
import { useStore } from '../store';
import { useAuthStore } from '../store/authStore';
import { handleOrderEvent } from '../utils/orderEvents';
import { REALTIME_TRANSPORT, FOREGROUND_POLL_MS } from '../constants/features';

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

  // 1. Request push permissions and save the raw device token.
  //    A null result means push is unavailable on this device (web, simulator,
  //    or permission denied) — retrying can't fix that, so only genuine errors
  //    (transient token-service failures) are retried.
  useEffect(() => {
    let cancelled = false;
    let attempt = 0;
    const maxAttempts = 3;

    function tryRegister() {
      attempt++;
      registerForPushNotifications()
        .then((registration) => {
          if (cancelled || !registration) return;
          setPushToken(registration.token);
          // Dev-only: the token is otherwise invisible, and you need it to send
          // a test push before the backend's sender exists. Read it with:
          //   adb logcat -s ReactNativeJS | findstr "device token"
          // Stripped from release builds by transform-remove-console.
          if (__DEV__) {
            console.log(
              `[push] ${registration.service.toUpperCase()} device token: ${registration.token}`,
            );
          }
        })
        .catch(() => {
          if (!cancelled && attempt < maxAttempts) {
            setTimeout(tryRegister, attempt * 2000);
          }
        });
    }

    tryRegister();

    // The OS can rotate the token at any time; re-register when it does or the
    // backend keeps pushing to a dead token and orders stop arriving.
    const tokenSub = addPushTokenListener((registration) => {
      if (!cancelled) setPushToken(registration.token);
    });

    return () => {
      cancelled = true;
      tokenSub.remove();
    };
  }, [setPushToken]);

  // 1b. Register push token with backend when token + auth are available
  useEffect(() => {
    if (!pushToken || !accessToken) return;
    let cancelled = false;

    const platform = Platform.OS === 'ios' ? 'IOS' : 'ANDROID';

    (async () => {
      const deviceId = await getDeviceId();
      if (cancelled) return;
      try {
        await registerDeviceToken({ token: pushToken, platform, deviceId });
      } catch {
        // Non-fatal – backend won't send push but app still works
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pushToken, accessToken]);

  // 2. Notification listeners – handle push payload from backend
  useEffect(() => {
    const receivedSub = addNotificationReceivedListener(async (notification) => {
      const data = notification.request.content.data as Record<string, any> | undefined;
      // Same handler the socket uses, so both transports behave identically and
      // can run together during a migration. It also covers cancellations: the
      // reload it performs is what surfaces them.
      await handleOrderEvent(String(data?.type ?? ''), data?.orderId);
    });

    // Validate the id before interpolating it into a route path — a spoofed
    // local notification / crafted deep link shouldn't be able to steer
    // navigation with arbitrary path segments. Order ids are numeric strings.
    const openOrderFrom = (data: Record<string, any> | undefined) => {
      const orderId = data?.orderId != null ? String(data.orderId) : '';
      if (/^\d+$/.test(orderId)) {
        router.push(`/order/${orderId}`);
      }
    };

    const responseSub = addNotificationResponseListener((response) => {
      openOrderFrom(response.notification.request.content.data as Record<string, any> | undefined);
    });

    // A tap that cold-starts the app from a killed state may never reach the
    // listener above, so recover that one navigation explicitly.
    let cancelled = false;
    getInitialNotificationResponse()
      .then((response) => {
        if (cancelled || !response) return;
        openOrderFrom(response.notification.request.content.data as Record<string, any> | undefined);
      })
      .catch(() => {
        // No initial response available — nothing to recover.
      });

    return () => {
      cancelled = true;
      receivedSub.remove();
      responseSub.remove();
    };
  }, [router]);

  // 2b. Foreground poll — the backstop for a push that never arrived.
  //
  // Push is best-effort: neither FCM nor APNs guarantees delivery or ordering,
  // and iOS throttles by priority. Without a socket held open there is nothing
  // else watching, so a missed push would otherwise mean a missed order until
  // the vendor happened to pull-to-refresh.
  //
  // It runs only while the app is in the foreground, which is the only time a
  // vendor can act on what it finds, and stops on background so it costs
  // nothing when the app is idle. Reloading also re-runs the cancellation diff.
  useEffect(() => {
    if (!restaurant?.id) return;
    if (REALTIME_TRANSPORT === 'websocket') return;

    let timer: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (timer) return;
      timer = setInterval(() => {
        useStore.getState().loadOrders();
      }, FOREGROUND_POLL_MS);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };

    if (AppState.currentState === 'active') start();

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        // Catch up immediately: anything that happened while backgrounded is
        // already stale, and waiting a full interval to notice is too slow.
        useStore.getState().loadOrders();
        start();
      } else {
        stop();
      }
    });

    return () => {
      stop();
      sub.remove();
    };
  }, [restaurant?.id]);

  // 3. STOMP WebSocket – connect when we have a restaurant and access token
  useEffect(() => {
    if (!restaurant?.id) return;
    // A held-open socket per signed-in vendor is the cost this avoids. See
    // constants/features.ts for the reasoning and the tradeoff.
    if (REALTIME_TRANSPORT === 'push') return;

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
          // This topic also carries status changes, so the payload's status is
          // what distinguishes a genuinely new order from an accept or a
          // cancel. The shared handler does the rest, and dedupes against push
          // when both transports are enabled.
          const payload = message.payload as Record<string, any> | undefined;
          const rawStatus: unknown = payload?.status ?? payload?.order?.status;
          const status = typeof rawStatus === 'string' ? rawStatus.toLowerCase() : undefined;
          const orderId = payload?.id ?? payload?.orderId ?? null;
          const isNew = !status || status === 'created';

          await handleOrderEvent(isNew ? 'NEW_ORDER_RECEIVED' : 'ORDER_UPDATED', orderId);

          if (isNew) {
            const newOrder = useStore.getState().orders.find((o) => String(o.id) === String(orderId));
            sendLocalNotification(
              'New Order',
              newOrder
                ? `${newOrder.orderNumber} – ${newOrder.customerName}`
                : 'You have a new order waiting.',
              ORDERS_CHANNEL,
            );
          }
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
