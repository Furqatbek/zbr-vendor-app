import { create } from 'zustand';
import type { Order, MenuCategory, MenuItem, Review, RevenueData, OrderStatus, DeclineReason, CourierRating, WorkingHoursDay, StaffMember } from '../types';

interface AppStore {
  // Restaurant
  isOpen: boolean;
  setOpen: (isOpen: boolean) => void;

  // Orders
  orders: Order[];
  getOrdersByStatus: (statuses: OrderStatus[]) => Order[];
  acceptOrder: (orderId: string) => void;
  declineOrder: (orderId: string, reason: DeclineReason) => void;
  updateOrderStatus: (orderId: string, status: OrderStatus) => void;

  // Menu
  categories: MenuCategory[];
  menuItems: MenuItem[];
  toggleCategoryActive: (categoryId: string) => void;
  toggleItemStock: (itemId: string) => void;
  addCategory: (name: string) => void;
  deleteMenuItem: (itemId: string) => void;
  reorderCategories: (categories: MenuCategory[]) => void;

  // Reviews
  reviews: Review[];
  replyToReview: (reviewId: string, text: string) => void;

  // Revenue
  revenueData: RevenueData;
  selectedPeriod: 'day' | 'week' | 'month';
  setSelectedPeriod: (period: 'day' | 'week' | 'month') => void;

  // Courier Ratings
  courierRatings: CourierRating[];
  submitCourierRating: (rating: CourierRating) => void;

  // Working Hours & Staff
  workingHours: WorkingHoursDay[];
  staffMembers: StaffMember[];
  toggleWorkingDay: (day: string) => void;
  toggleStaffActive: (staffId: string) => void;

  // Push Notifications
  pushToken: string | null;
  setPushToken: (token: string | null) => void;

  // Notification Preferences
  notificationPrefs: Record<string, boolean>;
  toggleNotificationPref: (key: string) => void;
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
  acceptOrder: (orderId) =>
    set((s) => ({
      orders: s.orders.map((o) =>
        o.id === orderId ? { ...o, status: 'preparing' as const, prepStartedAt: new Date().toISOString() } : o
      ),
    })),
  declineOrder: (orderId, reason) =>
    set((s) => ({
      orders: s.orders.map((o) =>
        o.id === orderId ? { ...o, status: 'cancelled' as const, declineReason: reason } : o
      ),
    })),
  updateOrderStatus: (orderId, status) =>
    set((s) => ({
      orders: s.orders.map((o) => {
        if (o.id !== orderId) return o;
        const updates: Partial<Order> = { status };
        if (status === 'ready') updates.readyAt = new Date().toISOString();
        if (status === 'picked_up') updates.pickedUpAt = new Date().toISOString();
        if (status === 'delivered') updates.deliveredAt = new Date().toISOString();
        return { ...o, ...updates };
      }),
    })),

  categories: [],
  menuItems: [],
  toggleCategoryActive: (categoryId) =>
    set((s) => ({
      categories: s.categories.map((c) =>
        c.id === categoryId ? { ...c, isActive: !c.isActive } : c
      ),
    })),
  toggleItemStock: (itemId) =>
    set((s) => ({
      menuItems: s.menuItems.map((i) =>
        i.id === itemId ? { ...i, inStock: !i.inStock } : i
      ),
    })),
  addCategory: (name) =>
    set((s) => ({
      categories: [
        ...s.categories,
        { id: Date.now().toString(), name, isActive: true, sortOrder: s.categories.length, itemCount: 0 },
      ],
    })),
  deleteMenuItem: (itemId) =>
    set((s) => ({ menuItems: s.menuItems.filter((i) => i.id !== itemId) })),
  reorderCategories: (categories) => set({ categories }),

  reviews: [],
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

  workingHours: [],
  staffMembers: [],
  toggleWorkingDay: (day) =>
    set((s) => ({
      workingHours: s.workingHours.map((h) =>
        h.day === day ? { ...h, isOpen: !h.isOpen } : h
      ),
    })),
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
}));
