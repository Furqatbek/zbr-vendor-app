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

  // WebSocket
  ws: `${WS_BASE_URL}/ws/vendor`,
} as const;
