/**
 * STOMP-over-WebSocket client for real-time order & notification updates.
 *
 * The backend exposes:
 *   - Native WS: ws://host/ws
 *   - SockJS:    ws://host/ws-sockjs
 *
 * Topics the restaurant frontend subscribes to:
 *   /topic/restaurants/{id}/orders  – new incoming orders
 *   /topic/restaurants/{id}/kitchen – kitchen display tickets
 *   /user/queue/notifications       – personal notifications
 *   /topic/orders/{orderId}         – order-specific status updates
 *
 * Authentication: JWT token passed via Authorization header on CONNECT.
 */

import { Client, IMessage, StompSubscription } from '@stomp/stompjs';
import { WS_BASE_URL, ENDPOINTS } from '../constants/api';

export type WSMessageType = 'new_order' | 'order_update' | 'kitchen_ticket' | 'notification';

export interface WSMessage {
  type: WSMessageType;
  payload?: unknown;
}

type MessageHandler = (message: WSMessage) => void;

const MAX_RETRIES = 5;
const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 16000];

export function createStompClient(restaurantId: number) {
  let client: Client | null = null;
  let handlers: MessageHandler[] = [];
  let subscriptions: StompSubscription[] = [];
  let intentionalClose = false;

  function connect(token: string | null) {
    intentionalClose = false;

    const wsUrl = `${WS_BASE_URL}${ENDPOINTS.ws}`;

    client = new Client({
      webSocketFactory: () => new WebSocket(wsUrl),
      connectHeaders: token ? { Authorization: `Bearer ${token}` } : {},
      reconnectDelay: RECONNECT_DELAYS[0],
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,

      onConnect: () => {
        subscriptions = [];

        // Subscribe to new orders for this restaurant
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
