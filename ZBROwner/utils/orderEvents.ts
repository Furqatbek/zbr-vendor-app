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

export function isOrderEvent(type: unknown): type is OrderEventType {
  return typeof type === 'string' && (ORDER_EVENT_TYPES as readonly string[]).includes(type);
}

/**
 * Act on an order event. Safe to call from any transport, and safe to call
 * twice for the same event.
 *
 * It only reloads. Both alerts are raised by the store's diff of the result:
 * a newly appeared order still in 'created' gets the new-order alarm, and an
 * order that was being cooked and is now cancelled gets the stop-cooking
 * alarm. Keeping the detection in one place is what makes the foreground poll
 * a real safety net rather than a partial one — it goes through exactly the
 * same path as a push.
 */
export async function handleOrderEvent(
  type: string,
  _orderId?: string | number | null,
): Promise<void> {
  if (!isOrderEvent(type)) return;
  await useStore.getState().loadOrders();
}
