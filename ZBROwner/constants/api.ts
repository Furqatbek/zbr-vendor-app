/**
 * API configuration for backend integration.
 */

export const API_BASE_URL = 'http://localhost:8080';

export const WS_BASE_URL = 'ws://localhost:8080';

export const ENDPOINTS = {
  // Auth
  login: '/api/v1/auth/login',
  refresh: '/api/v1/auth/refresh',
  logout: '/api/v1/auth/logout',
  passwordReset: '/api/v1/auth/password-reset',
  passwordResetConfirm: '/api/v1/auth/password-reset/confirm',

  // Restaurant
  myRestaurants: '/api/v1/restaurants/my',
  restaurant: (id: number) => `/api/v1/restaurants/${id}`,
  restaurantToggleOpen: (id: number) => `/api/v1/restaurants/${id}/toggle-open`,
  menuCategories: (restaurantId: number) => `/api/v1/restaurants/${restaurantId}/menu/categories`,
  menuCategory: (restaurantId: number, categoryId: number) => `/api/v1/restaurants/${restaurantId}/menu/categories/${categoryId}`,
  menuItems: (restaurantId: number) => `/api/v1/restaurants/${restaurantId}/menu/items`,
  menuItem: (restaurantId: number, itemId: number) => `/api/v1/restaurants/${restaurantId}/menu/items/${itemId}`,
  menuItemStock: (restaurantId: number, itemId: number) => `/api/v1/restaurants/${restaurantId}/menu/items/${itemId}/stock`,
  menuItemImage: (restaurantId: number, itemId: number) => `/api/v1/restaurants/${restaurantId}/menu/items/${itemId}/image`,

  // Notifications
  notificationsMe: '/api/v1/notifications/me',
  notificationsUnread: (userId: number) => `/api/v1/notifications/user/${userId}/unread`,
  notificationCounts: (userId: number) => `/api/v1/notifications/user/${userId}/counts`,
  notificationUnreadCount: (userId: number) => `/api/v1/notifications/user/${userId}/unread-count`,
  notificationMarkRead: (id: number) => `/api/v1/notifications/${id}/read`,
  notificationMarkAllRead: '/api/v1/notifications/read-all',

  // Analytics
  ratings: (restaurantId: number) => `/api/v1/analytics/cx/ratings/restaurant/${restaurantId}`,

  // WebSocket
  ws: `${WS_BASE_URL}/ws/vendor`,
} as const;
