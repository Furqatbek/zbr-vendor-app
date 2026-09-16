import type { Order } from '../types';

import { useStore } from '../store';
import * as api from '../services/api';
import { handleOrderEvent, isOrderEvent, __resetOrderEventDedupe } from '../utils/orderEvents';

jest.mock('../services/api', () => ({
  fetchRestaurantOrders: jest.fn(),
  fetchActiveOrders: jest.fn(),
  updateOrderStatus: jest.fn(),
  cancelOrder: jest.fn(),
  fetchRatings: jest.fn(),
  fetchRestaurantReviews: jest.fn(),
  fetchFinancialReport: jest.fn(),
}));

jest.mock('../store/authStore', () => ({
  useAuthStore: { getState: () => ({ restaurant: { id: 1, name: 'Test', isOpen: true } }) },
}));

jest.mock('../utils/notifications', () => ({ setAppBadgeCount: jest.fn() }));

const order = (id: string, status: Order['status']): Order =>
  ({
    id,
    orderNumber: `#${id}`,
    status,
    customerName: 'Customer',
    items: [{ name: 'Plov', quantity: 1, price: 30000 }],
    subtotal: 30000,
    totalPrice: 30000,
    createdAt: new Date().toISOString(),
  }) as unknown as Order;

const serverHas = (orders: Order[]) =>
  (api.fetchRestaurantOrders as jest.Mock).mockResolvedValue({ content: orders });

/**
 * The push payload is a "something changed" nudge, not a carrier of truth —
 * every alert is derived from a fresh fetch. These lock that contract in.
 */
describe('order events from a push payload', () => {
  beforeEach(() => {
    useStore.setState({ orders: [], cancelledAlerts: [], showOrderAlert: false, incomingOrder: null });
    __resetOrderEventDedupe();
    jest.clearAllMocks();
  });

  it('accepts only the documented event types', () => {
    expect(isOrderEvent('NEW_ORDER_RECEIVED')).toBe(true);
    expect(isOrderEvent('ORDER_CANCELLED')).toBe(true);
    expect(isOrderEvent('ORDER_UPDATED')).toBe(true);
    expect(isOrderEvent('new_order_received')).toBe(false);
    expect(isOrderEvent(undefined)).toBe(false);
  });

  it('ignores an unknown type without fetching', async () => {
    await handleOrderEvent('MARKETING_BLAST', 1);
    expect(api.fetchRestaurantOrders).not.toHaveBeenCalled();
  });

  it('raises the new-order alert for the order named in the payload', async () => {
    serverHas([order('7', 'created')]);
    await handleOrderEvent('NEW_ORDER_RECEIVED', 7);

    const s = useStore.getState();
    expect(s.showOrderAlert).toBe(true);
    expect(s.incomingOrder?.id).toBe('7');
  });

  it('accepts a numeric orderId, which is what JSON payloads carry', async () => {
    serverHas([order('7', 'created')]);
    await handleOrderEvent('NEW_ORDER_RECEIVED', 7);
    expect(useStore.getState().incomingOrder?.id).toBe('7');
  });

  it('does not re-alarm when the same push is delivered twice', async () => {
    serverHas([order('7', 'created')]);
    await handleOrderEvent('NEW_ORDER_RECEIVED', 7);
    useStore.getState().dismissOrderAlert();

    await handleOrderEvent('NEW_ORDER_RECEIVED', 7);
    expect(useStore.getState().showOrderAlert).toBe(false);
  });

  it('stays quiet if the order was already accepted elsewhere', async () => {
    // A second device, or a push that arrived late. Nothing is awaiting a
    // decision, so the alarm would be pure noise.
    serverHas([order('7', 'preparing')]);
    await handleOrderEvent('NEW_ORDER_RECEIVED', 7);
    expect(useStore.getState().showOrderAlert).toBe(false);
  });

  it('surfaces a cancellation without the payload describing it', async () => {
    serverHas([order('7', 'preparing')]);
    await handleOrderEvent('ORDER_UPDATED', 7);
    expect(useStore.getState().cancelledAlerts).toHaveLength(0);

    // The backend need only say the order changed; the status diff does the rest.
    serverHas([order('7', 'cancelled')]);
    await handleOrderEvent('ORDER_UPDATED', 7);
    expect(useStore.getState().cancelledAlerts.map((o) => o.id)).toEqual(['7']);
  });

  it('works when the payload omits orderId entirely', async () => {
    serverHas([order('9', 'created')]);
    await handleOrderEvent('NEW_ORDER_RECEIVED');
    expect(useStore.getState().incomingOrder?.id).toBe('9');
  });
});
