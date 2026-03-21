import { create } from 'zustand';
import type { Order, MenuCategory, MenuItem, Review, RevenueData, OrderStatus, DeclineReason, CourierRating } from '../types';
import { mockOrders, mockCategories, mockMenuItems, mockReviews, mockRevenueData } from './mockData';

interface AppStore {
  // Restaurant
  restaurantName: string;
  isOpen: boolean;
  toggleOpen: () => void;

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
}

export const useStore = create<AppStore>((set, get) => ({
  restaurantName: 'Burger Palace',
  isOpen: true,
  toggleOpen: () => set((s) => ({ isOpen: !s.isOpen })),

  orders: mockOrders,
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

  categories: mockCategories,
  menuItems: mockMenuItems,
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

  reviews: mockReviews,
  replyToReview: (reviewId, text) =>
    set((s) => ({
      reviews: s.reviews.map((r) =>
        r.id === reviewId ? { ...r, replied: true, replyText: text } : r
      ),
    })),

  revenueData: mockRevenueData,
  selectedPeriod: 'day',
  setSelectedPeriod: (period) => set({ selectedPeriod: period }),

  courierRatings: [],
  submitCourierRating: (rating) =>
    set((s) => ({ courierRatings: [...s.courierRatings, rating] })),
}));
