/**
 * STOMP-over-WebSocket client for real-time order & notification updates.
 *
 * The backend exposes:
 *   - Native WS: ws://host/ws
 *   - SockJS:    ws://host/ws-sockjs
 *
 * Topics the restaurant frontend subscribes to:
 *   /topic/restaurants/{id}/orders     – new orders AND every status change
 *                                        (incl. server-initiated auto-cancel,
 *                                        auto-complete, refunds)
 *   /topic/restaurants/{id}/kitchen    – kitchen display tickets
 *   /user/queue/notifications          – personal notifications
 *   /topic/users/{userId}/notifications – user notifications topic
 *   /topic/orders/{orderId}            – order-specific status updates
 *
 * Authentication: JWT token passed via Authorization header on CONNECT.
 * The token is re-read on every (re)connect attempt via the getToken
 * callback, so reconnects after a token refresh use the fresh JWT.
 */

import { Client, IMessage, StompSubscription } from '@stomp/stompjs';
import { WS_BASE_URL, ENDPOINTS } from '../constants/api';

export type WSMessageType = 'new_order' | 'order_update' | 'kitchen_ticket' | 'notification' | 'connected';

export interface WSMessage {
  type: WSMessageType;
  payload?: unknown;
}

type MessageHandler = (message: WSMessage) => void;
type TokenGetter = () => string | null;

// Fixed delay, unlimited retries: backend deploys drain gracefully and expect
// clients to simply keep retrying until the new instance accepts connections.
const RECONNECT_DELAY_MS = 2000;

export function createStompClient(restaurantId: number, userId?: number) {
  let client: Client | null = null;
  let handlers: MessageHandler[] = [];
  let subscriptions: StompSubscription[] = [];
  let intentionalClose = false;

  function connect(getToken: TokenGetter) {
    intentionalClose = false;

    const wsUrl = `${WS_BASE_URL}${ENDPOINTS.ws}`;

    client = new Client({
      webSocketFactory: () => new WebSocket(wsUrl),
      reconnectDelay: RECONNECT_DELAY_MS,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,

      // Runs before every (re)connect attempt — rebuild the CONNECT headers
      // with the current token so a refresh mid-session doesn't strand the
      // client in a reconnect loop with an expired JWT.
      beforeConnect: () => {
        const token = getToken();
        client!.connectHeaders = token ? { Authorization: `Bearer ${token}` } : {};
      },

      onConnect: () => {
        subscriptions = [];

        // Subscribe to new orders + all status changes for this restaurant
        const ordersSub = client!.subscribe(
          `/topic/restaurants/${restaurantId}/orders`,
          (msg: IMessage) => {
            dispatch({ type: 'new_order', payload: parseBody(msg.body) });
          },
        );
        subscriptions.push(ordersSub);

        // Subscribe to kitchen tickets
        const kitchenSub = client!.subscribe(
          `/topic/restaurants/${restaurantId}/kitchen`,
          (msg: IMessage) => {
            dispatch({ type: 'kitchen_ticket', payload: parseBody(msg.body) });
          },
        );
        subscriptions.push(kitchenSub);

        // Subscribe to personal notifications (user-specific queue)
        const notifSub = client!.subscribe(
          '/user/queue/notifications',
          (msg: IMessage) => {
            dispatch({ type: 'notification', payload: parseBody(msg.body) });
          },
        );
        subscriptions.push(notifSub);

        // Subscribe to user notifications topic
        if (userId) {
          const userNotifSub = client!.subscribe(
            `/topic/users/${userId}/notifications`,
            (msg: IMessage) => {
              dispatch({ type: 'notification', payload: parseBody(msg.body) });
            },
          );
          subscriptions.push(userNotifSub);
        }

        // Tell listeners the (re)connect completed. Status changes pushed
        // while the socket was down (deploy drain, network blip) were lost;
        // the handler re-fetches orders to close that gap.
        dispatch({ type: 'connected' });
      },

      onStompError: (frame) => {
        console.warn('[STOMP] Error:', frame.headers['message']);
      },

      onWebSocketClose: () => {
        if (intentionalClose) return;
      },
    });

    client.activate();
  }

  function subscribeToOrder(orderId: string, handler?: MessageHandler) {
    if (!client?.connected) return () => {};

    const sub = client.subscribe(
      `/topic/orders/${orderId}`,
      (msg: IMessage) => {
        const wsMsg: WSMessage = { type: 'order_update', payload: parseBody(msg.body) };
        if (handler) handler(wsMsg);
        dispatch(wsMsg);
      },
    );
    subscriptions.push(sub);

    return () => {
      sub.unsubscribe();
      subscriptions = subscriptions.filter((s) => s !== sub);
    };
  }

  function dispatch(message: WSMessage) {
    handlers.forEach((h) => h(message));
  }

  function parseBody(body: string): unknown {
    try {
      return JSON.parse(body);
    } catch {
      return body;
    }
  }

  function disconnect() {
    intentionalClose = true;
    subscriptions.forEach((s) => {
      try { s.unsubscribe(); } catch { /* already closed */ }
    });
    subscriptions = [];
    if (client) {
      client.deactivate();
      client = null;
    }
  }

  function onMessage(handler: MessageHandler) {
    handlers.push(handler);
    return () => {
      handlers = handlers.filter((h) => h !== handler);
    };
  }

  return { connect, disconnect, onMessage, subscribeToOrder };
}
