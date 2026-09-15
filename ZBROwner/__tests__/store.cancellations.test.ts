import type { Order } from '../types';

import { useStore } from '../store';
import * as api from '../services/api';

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
  useAuthStore: {
    getState: () => ({ restaurant: { id: 1, name: 'Test', isOpen: true } }),
  },
}));

jest.mock('../utils/notifications', () => ({ setAppBadgeCount: jest.fn() }));

const order = (id: string, status: Order['status']): Order =>
  ({
    id,
    orderNumber: `#${id}`,
    status,
    customerName: 'Customer',
    items: [{ name: 'Plov', quantity: 2, price: 30000 }],
    subtotal: 60000,
    totalPrice: 60000,
    createdAt: new Date().toISOString(),
  }) as unknown as Order;

const load = async (orders: Order[]) => {
  (api.fetchRestaurantOrders as jest.Mock).mockResolvedValue({ content: orders });
  await useStore.getState().loadOrders();
};

/**
 * A customer cancelling mid-cook is the one status change that has to interrupt
 * someone. Before this, the only signal was a push notification.
 */
describe('cancelled-while-cooking detection', () => {
  beforeEach(() => {
    useStore.setState({ orders: [], cancelledAlerts: [] });
    jest.clearAllMocks();
  });

  it('raises an alert when a cooking order becomes cancelled', async () => {
    await load([order('1', 'preparing')]);
    expect(useStore.getState().cancelledAlerts).toHaveLength(0);

    await load([order('1', 'cancelled')]);
    expect(useStore.getState().cancelledAlerts.map((o) => o.id)).toEqual(['1']);
  });

  it.each(['accepted', 'preparing', 'ready'] as const)(
    'covers the %s status, where food is already committed',
    async (status) => {
      await load([order('1', status)]);
      await load([order('1', 'cancelled')]);
      expect(useStore.getState().cancelledAlerts).toHaveLength(1);
    },
  );

  it('stays silent for an order cancelled before it was accepted', async () => {
    // Nothing was cooked, so interrupting the kitchen would be noise.
    await load([order('1', 'created')]);
    await load([order('1', 'cancelled')]);
    expect(useStore.getState().cancelledAlerts).toHaveLength(0);
  });

  it('stays silent on first load, which is not a transition', async () => {
    await load([order('1', 'cancelled')]);
    expect(useStore.getState().cancelledAlerts).toHaveLength(0);
  });

  it('treats a refund the same as a cancellation', async () => {
    await load([order('1', 'ready')]);
    await load([order('1', 'refunded')]);
    expect(useStore.getState().cancelledAlerts).toHaveLength(1);
  });

  it('does not re-queue an order already awaiting acknowledgement', async () => {
    await load([order('1', 'preparing')]);
    await load([order('1', 'cancelled')]);
    // A poll, a reconnect re-sync and a pull-to-refresh all re-deliver it.
    await load([order('1', 'cancelled')]);
    await load([order('1', 'cancelled')]);
    expect(useStore.getState().cancelledAlerts).toHaveLength(1);
  });

  it('queues several cancellations rather than losing all but the last', async () => {
    await load([order('1', 'preparing'), order('2', 'ready')]);
    await load([order('1', 'cancelled'), order('2', 'cancelled')]);
    expect(useStore.getState().cancelledAlerts.map((o) => o.id)).toEqual(['1', '2']);

    useStore.getState().acknowledgeCancellation('1');
    expect(useStore.getState().cancelledAlerts.map((o) => o.id)).toEqual(['2']);
  });

  it('stays silent when the vendor cancelled it themselves', async () => {
    // declineOrder writes 'cancelled' optimistically, so by the time the server
    // echoes it back the previous status already matches and no transition is
    // seen. Alarming the kitchen about its own decision would be absurd.
    await load([order('1', 'preparing')]);
    (api.cancelOrder as jest.Mock).mockResolvedValue({});
    await useStore.getState().declineOrder('1', 'Out of ingredients');

    await load([order('1', 'cancelled')]);
    expect(useStore.getState().cancelledAlerts).toHaveLength(0);
  });

  it('carries the items through, so the alert can say what to stop making', async () => {
    await load([order('1', 'preparing')]);
    await load([order('1', 'cancelled')]);
    expect(useStore.getState().cancelledAlerts[0]?.items?.[0]?.name).toBe('Plov');
  });
});
