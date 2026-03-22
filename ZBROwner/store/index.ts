import { create } from 'zustand';
import type { Order, Review, RevenueData, OrderStatus, CourierRating, StaffMember } from '../types';
import { fetchRatings, updateOrderStatus as apiUpdateOrderStatus, cancelOrder as apiCancelOrder } from '../services/api';
import { useAuthStore } from './authStore';

interface AppStore {
  // Restaurant
  isOpen: boolean;
  setOpen: (isOpen: boolean) => void;

  // Orders
  orders: Order[];
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

  // Revenue
  revenueData: RevenueData;
  selectedPeriod: 'day' | 'week' | 'month';
  setSelectedPeriod: (period: 'day' | 'week' | 'month') => void;

  // Courier Ratings
  courierRatings: CourierRating[];
  submitCourierRating: (rating: CourierRating) => void;

  // Staff
  staffMembers: StaffMember[];
  toggleStaffActive: (staffId: string) => void;

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
  getOrdersByStatus: (statuses) => get().orders.filter((o) => statuses.includes(o.status)),
  acceptOrder: async (orderId, estimatedPrepTimeMinutes) => {
    await apiUpdateOrderStatus(orderId, {
      status: 'ACCEPTED',
      estimatedPrepTimeMinutes,
    });
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
  },
  declineOrder: async (orderId, reason) => {
    await apiCancelOrder(orderId, { reason, requestRefund: true });
    set((s) => ({
      orders: s.orders.map((o) =>
        o.id === orderId ? { ...o, status: 'cancelled' as const, cancellationReason: reason, cancelledAt: new Date().toISOString() } : o
      ),
    }));
  },
  updateOrderStatus: async (orderId, status) => {
    await apiUpdateOrderStatus(orderId, { status: status.toUpperCase() });
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
      const res = await fetchRatings(restaurant.id, startDate, endDate, { includeDistribution: true });
      // Compute average from distribution
      const dist = res.distribution ?? {};
      let totalWeighted = 0;
      let totalCount = 0;
      for (const [star, count] of Object.entries(dist)) {
        totalWeighted += Number(star) * count;
        totalCount += count;
      }
      set({
        averageRating: totalCount > 0 ? totalWeighted / totalCount : 0,
        totalRatings: res.ratingCount,
        ratingDistribution: dist,
      });
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
  selectedPeriod: 'day',
  setSelectedPeriod: (period) => set({ selectedPeriod: period }),

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
