import { create } from 'zustand';
import type { Order, Review, RevenueData, OrderStatus, CourierRating, FinancialReportData } from '../types';
import { fetchRatings, fetchRestaurantReviews, fetchRestaurantOrders, fetchActiveOrders, updateOrderStatus as apiUpdateOrderStatus, cancelOrder as apiCancelOrder, fetchFinancialReport } from '../services/api';
import { useAuthStore } from './authStore';
import { setAppBadgeCount } from '../utils/notifications';

// Order IDs with an in-flight optimistic mutation (accept/decline/status).
// A WS-driven loadOrders that lands mid-PATCH would otherwise overwrite the
// optimistic status with stale server state, making the card visibly revert
// (e.g. "Ready" -> "Preparing"). While an id is pending, loadOrders keeps the
// local copy; the next refresh after the PATCH resolves picks up the truth.
const pendingOrderIds = new Set<string>();

function mergePreservingPending(incoming: Order[], current: Order[]): Order[] {
  if (pendingOrderIds.size === 0) return incoming;
  const currentById = new Map(current.map((o) => [o.id, o]));
  return incoming.map((o) =>
    pendingOrderIds.has(o.id) ? (currentById.get(o.id) ?? o) : o,
  );
}

/**
 * Statuses in which food is already committed — the restaurant has accepted the
 * order and is spending time and ingredients on it. A cancellation from any of
 * these has to interrupt someone; a cancellation from 'created' costs nothing
 * and must not.
 */
const COOKING_STATUSES: OrderStatus[] = ['accepted', 'preparing', 'ready'];
const CANCELLED_STATUSES: OrderStatus[] = ['cancelled', 'refunded'];

/**
 * Orders that went from being cooked to cancelled since the last refresh.
 *
 * This runs on every refresh rather than only on the WebSocket message,
 * because the socket is the one delivery path that can silently fail: a
 * backgrounded app, a dropped connection, a deploy drain. Diffing server state
 * means a missed message still surfaces on the next poll or pull-to-refresh.
 *
 * A vendor cancelling from inside the app updates local state optimistically
 * first, so the previous status is already 'cancelled' and no alert fires — the
 * alert is only ever about someone else's decision.
 */
function detectCancellations(incoming: Order[], current: Order[]): Order[] {
  if (current.length === 0) return []; // first load is not a transition
  const previousStatus = new Map(current.map((o) => [o.id, o.status]));
  return incoming.filter((o) => {
    const before = previousStatus.get(o.id);
    return (
      before !== undefined &&
      COOKING_STATUSES.includes(before) &&
      CANCELLED_STATUSES.includes(o.status)
    );
  });
}

/** Append newly cancelled orders without duplicating one already queued. */
function queueCancellations(queued: Order[], detected: Order[]): Order[] {
  if (detected.length === 0) return queued;
  const known = new Set(queued.map((o) => o.id));
  const additions = detected.filter((o) => !known.has(o.id));
  return additions.length ? [...queued, ...additions] : queued;
}

/**
 * Orders that appeared since the last refresh and are still awaiting a
 * decision.
 *
 * Detected from the same diff as cancellations, so EVERY path that refreshes
 * raises the alarm: push, the socket, the foreground poll, pull-to-refresh.
 * That matters because the poll is the safety net for a push that never
 * arrived — a net that silently skipped the most important case would be no
 * net at all.
 *
 * First load is excluded deliberately. Opening the app would otherwise alarm
 * for every order already sitting in 'created', which is noise: the vendor is
 * looking at the screen, and the orders board already shows them.
 */
function detectNewOrders(incoming: Order[], current: Order[]): Order[] {
  if (current.length === 0) return [];
  const known = new Set(current.map((o) => o.id));
  return incoming.filter((o) => o.status === 'created' && !known.has(o.id));
}

/** Orders already alarmed for, so a re-delivery or a poll cannot repeat it. */
const alertedNewOrderIds = new Set<string>();

interface AppStore {
  // Restaurant
  isOpen: boolean;
  setOpen: (isOpen: boolean) => void;

  // Orders
  orders: Order[];
  ordersLoading: boolean;
  ordersError: boolean;
  loadOrders: () => Promise<void>;
  loadActiveOrders: () => Promise<void>;
  getOrdersByStatus: (statuses: OrderStatus[]) => Order[];
  acceptOrder: (orderId: string, estimatedPrepTimeMinutes?: number) => Promise<void>;
  declineOrder: (orderId: string, reason: string) => Promise<void>;
  updateOrderStatus: (orderId: string, status: OrderStatus) => Promise<void>;

  // Reviews
  reviews: Review[];
  averageRating: number;
  totalRatings: number;
  ratingDistribution: Record<string, number>;
  reviewsLoading: boolean;
  reviewsError: boolean;
  loadReviews: () => Promise<void>;
  replyToReview: (reviewId: string, text: string) => void;

  // Revenue / Financial Report
  revenueData: RevenueData;
  financialReport: FinancialReportData | null;
  financialReportLoading: boolean;
  financialReportError: boolean;
  selectedPeriod: 'day' | 'week' | 'month' | 'custom';
  customStartDate: Date | null;
  customEndDate: Date | null;
  setSelectedPeriod: (period: 'day' | 'week' | 'month' | 'custom') => void;
  setCustomDateRange: (start: Date, end: Date) => void;
  loadFinancialReport: () => Promise<void>;

  // Courier Ratings
  courierRatings: CourierRating[];
  submitCourierRating: (rating: CourierRating) => void;

  // Staff

  // New Order Alert
  incomingOrder: Order | null;
  showOrderAlert: boolean;
  triggerOrderAlert: (order: Order) => void;
  dismissOrderAlert: () => void;

  /** Orders cancelled while being cooked, awaiting explicit acknowledgement. */
  cancelledAlerts: Order[];
  acknowledgeCancellation: (orderId: string) => void;

  // Push Notifications
  pushToken: string | null;
  setPushToken: (token: string | null) => void;

  // Notification Preferences
  notificationPrefs: Record<string, boolean>;
  toggleNotificationPref: (key: string) => void;

  // Notification unread badge
  unreadNotifCount: number;
  setUnreadNotifCount: (count: number) => void;
}

const emptyRevenueData: RevenueData = {
  totalRevenue: 0,
  ordersCount: 0,
  avgOrderValue: 0,
  chartData: [],
  soldItems: [],
  refunds: 0,
  cancellations: 0,
};

export const useStore = create<AppStore>((set, get) => ({
  isOpen: false,
  setOpen: (isOpen) => set({ isOpen }),

  orders: [],
  ordersLoading: false,
  ordersError: false,
  loadOrders: async () => {
    const restaurant = useAuthStore.getState().restaurant;
    if (!restaurant) return;
    set({ ordersLoading: true, ordersError: false });
    try {
      const res = await fetchRestaurantOrders(restaurant.id, { page: 0, size: 100 });
      set((s) => {
        const newOrders = detectNewOrders(res.content, s.orders).filter(
          (o) => !alertedNewOrderIds.has(o.id),
        );
        const alertFor = s.showOrderAlert ? null : (newOrders[0] ?? null);
        if (alertFor) alertedNewOrderIds.add(alertFor.id);

        return {
          orders: mergePreservingPending(res.content, s.orders),
          cancelledAlerts: queueCancellations(
            s.cancelledAlerts,
            detectCancellations(res.content, s.orders),
          ),
          ...(alertFor ? { incomingOrder: alertFor, showOrderAlert: true } : {}),
        };
      });
    } catch {
      set({ ordersError: true });
    } finally {
      set({ ordersLoading: false });
    }
  },
  loadActiveOrders: async () => {
    const restaurant = useAuthStore.getState().restaurant;
    if (!restaurant) return;
    set({ ordersLoading: true, ordersError: false });
    try {
      const res = await fetchActiveOrders(restaurant.id, { page: 0, size: 100 });
      set((s) => {
        const newOrders = detectNewOrders(res.content, s.orders).filter(
          (o) => !alertedNewOrderIds.has(o.id),
        );
        const alertFor = s.showOrderAlert ? null : (newOrders[0] ?? null);
        if (alertFor) alertedNewOrderIds.add(alertFor.id);

        return {
          orders: mergePreservingPending(res.content, s.orders),
          cancelledAlerts: queueCancellations(
            s.cancelledAlerts,
            detectCancellations(res.content, s.orders),
          ),
          ...(alertFor ? { incomingOrder: alertFor, showOrderAlert: true } : {}),
        };
      });
    } catch {
      set({ ordersError: true });
    } finally {
      set({ ordersLoading: false });
    }
  },
  getOrdersByStatus: (statuses) => get().orders.filter((o) => statuses.includes(o.status)),
  acceptOrder: async (orderId, estimatedPrepTimeMinutes) => {
    // Optimistic update — move the card out of "new" immediately
    const prev = get().orders;
    pendingOrderIds.add(orderId);
    set((s) => ({
      orders: s.orders.map((o) =>
        o.id === orderId ? {
          ...o,
          status: 'accepted' as const,
          acceptedAt: new Date().toISOString(),
          estimatedPrepTimeMinutes: estimatedPrepTimeMinutes ?? o.estimatedPrepTimeMinutes,
        } : o
      ),
    }));
    try {
      await apiUpdateOrderStatus(orderId, {
        status: 'ACCEPTED',
        estimatedPrepTimeMinutes,
      });
    } catch (e) {
      // Rollback on failure
      set({ orders: prev });
      throw e;
    } finally {
      pendingOrderIds.delete(orderId);
    }
  },
  declineOrder: async (orderId, reason) => {
    const prev = get().orders;
    pendingOrderIds.add(orderId);
    set((s) => ({
      orders: s.orders.map((o) =>
        o.id === orderId ? { ...o, status: 'cancelled' as const, cancellationReason: reason, cancelledAt: new Date().toISOString() } : o
      ),
    }));
    try {
      await apiCancelOrder(orderId, { reason, requestRefund: true });
    } catch (e) {
      set({ orders: prev });
      throw e;
    } finally {
      pendingOrderIds.delete(orderId);
    }
  },
  updateOrderStatus: async (orderId, status) => {
    const prev = get().orders;
    pendingOrderIds.add(orderId);
    set((s) => ({
      orders: s.orders.map((o) => {
        if (o.id !== orderId) return o;
        const now = new Date().toISOString();
        const updates: Partial<Order> = { status };
        if (status === 'preparing') updates.prepStartedAt = now;
        if (status === 'ready') updates.readyAt = now;
        if (status === 'picked_up') updates.pickedUpAt = now;
        if (status === 'in_transit') updates.inTransitAt = now;
        if (status === 'delivered') updates.deliveredAt = now;
        if (status === 'completed') updates.completedAt = now;
        return { ...o, ...updates };
      }),
    }));
    try {
      await apiUpdateOrderStatus(orderId, { status: status.toUpperCase() });
    } catch (e) {
      set({ orders: prev });
      throw e;
    } finally {
      pendingOrderIds.delete(orderId);
    }
  },

  reviews: [],
  averageRating: 0,
  totalRatings: 0,
  ratingDistribution: {},
  reviewsLoading: false,
  reviewsError: false,
  loadReviews: async () => {
    const restaurant = useAuthStore.getState().restaurant;
    if (!restaurant) return;
    set({ reviewsLoading: true, reviewsError: false });
    try {
      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth() - 6, 1).toISOString();
      const endDate = now.toISOString();
      const [ratingsRes, reviewsRes] = await Promise.all([
        fetchRatings(restaurant.id, startDate, endDate, { includeDistribution: true }).catch(() => null),
        fetchRestaurantReviews(restaurant.id, 0, 50).catch(() => null),
      ]);

      // Both sub-fetches failed → surface a retryable error.
      if (ratingsRes === null && reviewsRes === null) {
        set({ reviewsError: true });
      }

      // The restaurant object (from /restaurants/my) is the source of truth
      // for the headline average + total rating count.
      set({
        averageRating: restaurant.averageRating ?? 0,
        totalRatings: restaurant.totalRatings ?? 0,
      });

      const reviews: Review[] = (reviewsRes?.content ?? []).map((dto) => ({
        id: String(dto.id),
        customerName: dto.consumerName ?? 'Anonymous',
        rating: dto.restaurantRating ?? dto.foodRating ?? 0,
        date: dto.createdAt,
        comment: dto.comment ?? '',
        orderItems: [],
        platform: 'ZBR',
        replied: false,
        replyText: undefined,
      }));
      set({ reviews });

      // Prefer the analytics distribution; if it's empty, derive the bars
      // from the fetched reviews so the chart isn't blank.
      let dist = ratingsRes?.distribution ?? {};
      const hasDist = Object.values(dist).some((c) => c > 0);
      if (!hasDist && reviews.length > 0) {
        const derived: Record<string, number> = {};
        for (const r of reviews) {
          const star = String(Math.round(r.rating));
          derived[star] = (derived[star] ?? 0) + 1;
        }
        dist = derived;
      }
      set({ ratingDistribution: dist });
    } catch {
      // Non-fatal – keep existing data
    } finally {
      set({ reviewsLoading: false });
    }
  },
  replyToReview: (reviewId, text) =>
    set((s) => ({
      reviews: s.reviews.map((r) =>
        r.id === reviewId ? { ...r, replied: true, replyText: text } : r
      ),
    })),

  revenueData: emptyRevenueData,
  financialReport: null,
  financialReportLoading: false,
  financialReportError: false,
  selectedPeriod: 'day',
  customStartDate: null,
  customEndDate: null,
  setSelectedPeriod: (period) => {
    set({ selectedPeriod: period });
    if (period !== 'custom') {
      get().loadFinancialReport();
    }
  },
  setCustomDateRange: (start, end) => {
    set({ selectedPeriod: 'custom', customStartDate: start, customEndDate: end });
    get().loadFinancialReport();
  },
  loadFinancialReport: async () => {
    const restaurant = useAuthStore.getState().restaurant;
    if (!restaurant) return;
    set({ financialReportLoading: true, financialReportError: false });
    try {
      const now = new Date();
      const period = get().selectedPeriod;
      let startDate: Date;
      let endDate: Date = now;
      if (period === 'custom') {
        startDate = get().customStartDate ?? new Date(now.getFullYear(), now.getMonth(), now.getDate());
        endDate = get().customEndDate ?? now;
      } else if (period === 'day') {
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      } else if (period === 'week') {
        // Monday of the current week
        const day = now.getDay(); // 0=Sun, 1=Mon, ...
        const diff = day === 0 ? 6 : day - 1; // days since Monday
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff);
      } else {
        // First day of current month
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      }
      const res = await fetchFinancialReport(
        restaurant.id,
        startDate.toISOString(),
        endDate.toISOString(),
      );
      const d = res.data;
      // Also populate revenueData for backward compatibility
      set({
        financialReport: d,
        revenueData: {
          ...get().revenueData,
          totalRevenue: d.totalRevenue,
          ordersCount: d.totalOrders,
          avgOrderValue: d.averageOrderValue,
          chartData: d.dailyRevenueTrend.map((t) => ({
            label: new Date(t.date).toLocaleDateString([], { month: 'short', day: 'numeric' }),
            value: t.gmv,
          })),
        },
      });
    } catch {
      set({ financialReportError: true });
    } finally {
      set({ financialReportLoading: false });
    }
  },

  courierRatings: [],
  submitCourierRating: (rating) =>
    set((s) => ({ courierRatings: [...s.courierRatings, rating] })),


  incomingOrder: null,
  showOrderAlert: false,
  triggerOrderAlert: (order) => set({ incomingOrder: order, showOrderAlert: true }),
  dismissOrderAlert: () => set({ showOrderAlert: false, incomingOrder: null }),

  cancelledAlerts: [],
  acknowledgeCancellation: (orderId) =>
    set((s) => ({ cancelledAlerts: s.cancelledAlerts.filter((o) => o.id !== orderId) })),

  pushToken: null,
  setPushToken: (token) => set({ pushToken: token }),

  notificationPrefs: {
    newOrder: true,
    orderTimeout: true,
    courierAssigned: true,
    reviewReceived: true,
    promotions: false,
    weeklyReport: true,
  },
  toggleNotificationPref: (key) =>
    set((s) => ({
      notificationPrefs: { ...s.notificationPrefs, [key]: !s.notificationPrefs[key] },
    })),

  unreadNotifCount: 0,
  // Every path that changes the unread count funnels through here — the
  // inbox screen, mark-all-read, and the increment on an incoming push — so
  // this is the one place that can keep the OS app-icon badge in step.
  setUnreadNotifCount: (count) => {
    set({ unreadNotifCount: count });
    setAppBadgeCount(count);
  },
}));
