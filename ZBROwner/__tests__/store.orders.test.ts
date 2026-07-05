import type { Order } from '../types';

// Mock the API layer so no network happens and we control resolution timing.
jest.mock('../services/api', () => ({
  fetchRestaurantOrders: jest.fn(),
  fetchActiveOrders: jest.fn(),
  updateOrderStatus: jest.fn(),
  cancelOrder: jest.fn(),
  fetchRatings: jest.fn(),
  fetchRestaurantReviews: jest.fn(),
  fetchFinancialReport: jest.fn(),
}));

// Mock the auth store so the loaders have a restaurant and don't pull in
// AsyncStorage / SecureStore / expo-application.
jest.mock('../store/authStore', () => ({
  useAuthStore: {
    getState: () => ({ restaurant: { id: 1, isOpen: true } }),
  },
}));

import { useStore } from '../store';
import * as api from '../services/api';

const mockApi = api as jest.Mocked<typeof api>;

function order(id: string, status: Order['status'] = 'created'): Order {
  return {
    id,
    orderNumber: `A-${id}`,
    status,
    orderType: 'DELIVERY',
    items: [],
    subtotal: 10,
    totalPrice: 12,
    customerName: 'Jane',
    receivedAt: '2026-01-01T10:00:00.000Z',
    prepTimeMinutes: 0,
  } as Order;
}

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

beforeEach(() => {
  jest.clearAllMocks();
  useStore.setState({ orders: [], ordersLoading: false, ordersError: false });
});

describe('acceptOrder', () => {
  it('optimistically moves the order to accepted and persists on success', async () => {
    useStore.setState({ orders: [order('1', 'created')] });
    mockApi.updateOrderStatus.mockResolvedValue({} as any);

    await useStore.getState().acceptOrder('1', 20);

    expect(mockApi.updateOrderStatus).toHaveBeenCalledWith('1', {
      status: 'ACCEPTED',
      estimatedPrepTimeMinutes: 20,
    });
    expect(useStore.getState().orders[0].status).toBe('accepted');
  });

  it('rolls back to the previous state when the API rejects', async () => {
    useStore.setState({ orders: [order('1', 'created')] });
    mockApi.updateOrderStatus.mockRejectedValue(new Error('network'));

    await expect(useStore.getState().acceptOrder('1', 20)).rejects.toThrow('network');
    // Reverted, not left in the optimistic 'accepted' state.
    expect(useStore.getState().orders[0].status).toBe('created');
  });
});

describe('updateOrderStatus', () => {
  it('rolls back on failure', async () => {
    useStore.setState({ orders: [order('1', 'accepted')] });
    mockApi.updateOrderStatus.mockRejectedValue(new Error('boom'));

    await expect(useStore.getState().updateOrderStatus('1', 'ready')).rejects.toThrow('boom');
    expect(useStore.getState().orders[0].status).toBe('accepted');
  });

  it('stamps the matching timestamp on success', async () => {
    useStore.setState({ orders: [order('1', 'accepted')] });
    mockApi.updateOrderStatus.mockResolvedValue({} as any);

    await useStore.getState().updateOrderStatus('1', 'ready');

    expect(useStore.getState().orders[0].status).toBe('ready');
    expect(useStore.getState().orders[0].readyAt).toBeDefined();
  });
});

describe('declineOrder', () => {
  it('optimistically cancels then rolls back on failure', async () => {
    useStore.setState({ orders: [order('1', 'created')] });
    mockApi.cancelOrder.mockRejectedValue(new Error('nope'));

    await expect(useStore.getState().declineOrder('1', 'reason')).rejects.toThrow('nope');
    expect(useStore.getState().orders[0].status).toBe('created');
  });
});

describe('loadOrders race guard (pending merge)', () => {
  it('keeps the optimistic status for an order with an in-flight mutation', async () => {
    useStore.setState({ orders: [order('1', 'created')] });

    // Hold the accept PATCH open so order 1 stays "pending".
    const patch = deferred<any>();
    mockApi.updateOrderStatus.mockReturnValue(patch.promise);

    // Fire accept but don't await — optimistic 'accepted' is applied, id is pending.
    const acceptPromise = useStore.getState().acceptOrder('1', 15);
    expect(useStore.getState().orders[0].status).toBe('accepted');

    // A concurrent refresh returns STALE server data (still 'created').
    mockApi.fetchRestaurantOrders.mockResolvedValue({
      content: [order('1', 'created')],
      totalElements: 1,
      last: true,
    } as any);
    await useStore.getState().loadOrders();

    // The pending order must NOT revert to the stale server status.
    expect(useStore.getState().orders[0].status).toBe('accepted');

    // Resolve the PATCH; the id leaves the pending set.
    patch.resolve({});
    await acceptPromise;

    // A later refresh now reflects the true server state.
    mockApi.fetchRestaurantOrders.mockResolvedValue({
      content: [order('1', 'accepted')],
      totalElements: 1,
      last: true,
    } as any);
    await useStore.getState().loadOrders();
    expect(useStore.getState().orders[0].status).toBe('accepted');
  });

  it('sets ordersError when the fetch fails', async () => {
    mockApi.fetchRestaurantOrders.mockRejectedValue(new Error('down'));
    await useStore.getState().loadOrders();
    expect(useStore.getState().ordersError).toBe(true);
    expect(useStore.getState().ordersLoading).toBe(false);
  });
});
