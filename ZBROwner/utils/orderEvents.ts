import { useStore } from '../store';

/**
 * One handler for order events, whatever transport delivered them.
 *
 * Push and the WebSocket used to each carry their own copy of this logic,
 * which is how they drifted: the socket handled cancellations (by reloading)
 * while push only understood new orders. Routing both through here means a
 * vendor gets the same behaviour regardless of which path the event took, and
 * the two can safely run at once during a migration.
 *
 * The payload deliberately carries almost nothing. Every alert the app raises
 * is derived from a fresh fetch of server state:
 *
 *   - the new-order alert needs the order, which is looked up after reloading
 *   - the cancelled-while-cooking alert falls out of the store's status diff
 *     without the event having to mention it at all
 *
 * So the backend never has to serialise an order into a notification, and a
 * push that arrives late or out of order still produces correct state — it is
 * a "something changed" nudge, not a carrier of truth. That also keeps order
 * contents out of the notification payload, which transits Google's and
 * Apple's servers.
 */

/** Event types the app acts on. Anything else is ignored, not an error. */
export const ORDER_EVENT_TYPES = [
  'NEW_ORDER_RECEIVED',
  'ORDER_CANCELLED',
  'ORDER_UPDATED',
] as const;

export type OrderEventType = (typeof ORDER_EVENT_TYPES)[number];

/** Ids we have already alerted for, so a duplicate delivery stays quiet. */
const alertedOrderIds = new Set<string>();

export function isOrderEvent(type: unknown): type is OrderEventType {
  return typeof type === 'string' && (ORDER_EVENT_TYPES as readonly string[]).includes(type);
}

/**
 * Act on an order event. Safe to call from any transport, and safe to call
 * twice for the same event.
 */
export async function handleOrderEvent(
  type: string,
  orderId?: string | number | null,
): Promise<void> {
  if (!isOrderEvent(type)) return;

  const store = useStore.getState();

  // Reloading is what surfaces a cancellation: the store compares each order's
  // previous status against the incoming one and queues an alert for anything
  // that was being cooked and is now cancelled.
  await store.loadOrders();

  if (type !== 'NEW_ORDER_RECEIVED') return;

  const latest = useStore.getState();
  const id = orderId != null ? String(orderId) : null;
  const order = id
    ? latest.orders.find((o) => o.id === id)
    : latest.orders.find((o) => o.status === 'created');

  if (!order) return;

  // Only alert for an order still awaiting a decision. A duplicate delivery, or
  // a push arriving after the vendor already accepted on another device, must
  // not restart the alarm.
  if (order.status !== 'created') return;
  if (alertedOrderIds.has(order.id)) return;
  if (latest.showOrderAlert && latest.incomingOrder?.id === order.id) return;

  alertedOrderIds.add(order.id);
  latest.triggerOrderAlert(order);
}

/** Test seam: the dedupe set is process-lifetime state. */
export function __resetOrderEventDedupe() {
  alertedOrderIds.clear();
}
