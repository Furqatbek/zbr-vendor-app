import type { Order } from '../types';

import { useStore } from '../store';
import * as api from '../services/api';
import { handleOrderEvent, isOrderEvent } from '../utils/orderEvents';

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

/** Seed a previous state, since first load never alarms. */
const seed = async (orders: Order[]) => {
  serverHas(orders);
  await useStore.getState().loadOrders();
};

const reset = () =>
  useStore.setState({ orders: [], cancelledAlerts: [], showOrderAlert: false, incomingOrder: null });

/**
 * The push payload is a "something changed" nudge: the handler only reloads,
 * and the store's diff of the result raises both alerts. That is what lets the
 * foreground poll act as a real safety net — it takes the identical path.
 *
 * Order ids are unique per test because the store's "already alarmed" set is
 * module state, exactly as it is in the running app.
 */
describe('order events', () => {
  beforeEach(() => {
    reset();
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

  it('raises the new-order alarm for an order that just appeared', async () => {
    await seed([order('100', 'delivered')]);

    serverHas([order('100', 'delivered'), order('101', 'created')]);
    await handleOrderEvent('NEW_ORDER_RECEIVED', 101);

    expect(useStore.getState().showOrderAlert).toBe(true);
    expect(useStore.getState().incomingOrder?.id).toBe('101');
  });

  it('does not re-alarm when the same event is delivered twice', async () => {
    await seed([order('200', 'delivered')]);
    serverHas([order('200', 'delivered'), order('201', 'created')]);
    await handleOrderEvent('NEW_ORDER_RECEIVED', 201);
    useStore.getState().dismissOrderAlert();

    await handleOrderEvent('NEW_ORDER_RECEIVED', 201);
    expect(useStore.getState().showOrderAlert).toBe(false);
  });

  it('stays quiet for an order already accepted elsewhere', async () => {
    // A second device took it, or the event arrived late.
    await seed([order('300', 'delivered')]);
    serverHas([order('300', 'delivered'), order('301', 'preparing')]);
    await handleOrderEvent('NEW_ORDER_RECEIVED', 301);
    expect(useStore.getState().showOrderAlert).toBe(false);
  });

  it('surfaces a cancellation without the payload describing it', async () => {
    await seed([order('400', 'preparing')]);

    // The backend need only say the order changed; the diff does the rest.
    serverHas([order('400', 'cancelled')]);
    await handleOrderEvent('ORDER_UPDATED', 400);
    expect(useStore.getState().cancelledAlerts.map((o) => o.id)).toEqual(['400']);
  });

  it('alarms from a plain refresh, which is how the poll covers a lost push', async () => {
    await seed([order('500', 'delivered')]);

    // No event at all — just the foreground poll calling loadOrders.
    serverHas([order('500', 'delivered'), order('501', 'created')]);
    await useStore.getState().loadOrders();

    expect(useStore.getState().showOrderAlert).toBe(true);
    expect(useStore.getState().incomingOrder?.id).toBe('501');
  });

  it('does not alarm on first load, which would fire every time the app opens', async () => {
    reset();
    serverHas([order('600', 'created'), order('601', 'created')]);
    await useStore.getState().loadOrders();
    expect(useStore.getState().showOrderAlert).toBe(false);
  });

  it('does not replace an alert already on screen', async () => {
    await seed([order('700', 'delivered')]);
    serverHas([order('700', 'delivered'), order('701', 'created')]);
    await useStore.getState().loadOrders();
    expect(useStore.getState().incomingOrder?.id).toBe('701');

    // A second order arrives while the vendor is still deciding on the first.
    serverHas([order('700', 'delivered'), order('701', 'created'), order('702', 'created')]);
    await useStore.getState().loadOrders();
    expect(useStore.getState().incomingOrder?.id).toBe('701');
  });
});
