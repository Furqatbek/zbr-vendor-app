import { create } from 'zustand';
import type { Order, Review, RevenueData, OrderStatus, CourierRating, StaffMember, FinancialReportData } from '../types';
import { fetchRatings, fetchRestaurantReviews, fetchRestaurantOrders, fetchActiveOrders, updateOrderStatus as apiUpdateOrderStatus, cancelOrder as apiCancelOrder, fetchFinancialReport } from '../services/api';
import { useAuthStore } from './authStore';

interface AppStore {
  // Restaurant
  isOpen: boolean;
  setOpen: (isOpen: boolean) => void;

  // Orders
  orders: Order[];
  ordersLoading: boolean;
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
  loadReviews: () => Promise<void>;
  replyToReview: (reviewId: string, text: string) => void;

  // Revenue / Financial Report
  revenueData: RevenueData;
  financialReport: FinancialReportData | null;
  financialReportLoading: boolean;
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
  staffMembers: StaffMember[];
  toggleStaffActive: (staffId: string) => void;

  // New Order Alert
  incomingOrder: Order | null;
  showOrderAlert: boolean;
  triggerOrderAlert: (order: Order) => void;
  dismissOrderAlert: () => void;

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
  loadOrders: async () => {
    const restaurant = useAuthStore.getState().restaurant;
    if (!restaurant) return;
    set({ ordersLoading: true });
    try {
      const res = await fetchRestaurantOrders(restaurant.id, { page: 0, size: 100 });
      set({ orders: res.content });
    } catch {
      // Non-fatal – keep existing data
    } finally {
      set({ ordersLoading: false });
    }
  },
  loadActiveOrders: async () => {
    const restaurant = useAuthStore.getState().restaurant;
    if (!restaurant) return;
    set({ ordersLoading: true });
    try {
      const res = await fetchActiveOrders(restaurant.id, { page: 0, size: 100 });
      set({ orders: res.content });
    } catch {
      // Non-fatal – keep existing data
    } finally {
      set({ ordersLoading: false });
    }
  },
  getOrdersByStatus: (statuses) => get().orders.filter((o) => statuses.includes(o.status)),
  acceptOrder: async (orderId, estimatedPrepTimeMinutes) => {
    // Optimistic update — move the card out of "new" immediately
    const prev = get().orders;
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
    }
  },
  declineOrder: async (orderId, reason) => {
    const prev = get().orders;
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
    }
  },
  updateOrderStatus: async (orderId, status) => {
    const prev = get().orders;
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
    }
  },

  reviews: [],
  averageRating: 0,
  totalRatings: 0,
  ratingDistribution: {},
  reviewsLoading: false,
  loadReviews: async () => {
    const restaurant = useAuthStore.getState().restaurant;
    if (!restaurant) return;
    set({ reviewsLoading: true });
    try {
      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth() - 6, 1).toISOString();
      const endDate = now.toISOString();
      const [ratingsRes, reviewsRes] = await Promise.all([
        fetchRatings(restaurant.id, startDate, endDate, { includeDistribution: true }).catch(() => null),
        fetchRestaurantReviews(restaurant.id, 0, 50).catch(() => null),
      ]);

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
    set({ financialReportLoading: true });
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
      // Non-fatal – keep existing data
    } finally {
      set({ financialReportLoading: false });
    }
  },

  courierRatings: [],
  submitCourierRating: (rating) =>
    set((s) => ({ courierRatings: [...s.courierRatings, rating] })),

  staffMembers: [],
  toggleStaffActive: (staffId) =>
    set((s) => ({
      staffMembers: s.staffMembers.map((m) =>
        m.id === staffId ? { ...m, isActive: !m.isActive } : m
      ),
    })),

  incomingOrder: null,
  showOrderAlert: false,
  triggerOrderAlert: (order) => set({ incomingOrder: order, showOrderAlert: true }),
  dismissOrderAlert: () => set({ showOrderAlert: false, incomingOrder: null }),

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
  setUnreadNotifCount: (count) => set({ unreadNotifCount: count }),
}));
