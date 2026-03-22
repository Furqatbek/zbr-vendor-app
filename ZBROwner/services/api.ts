import { API_BASE_URL, ENDPOINTS } from '../constants/api';
import type { LoginRequest, LoginResponse, RefreshResponse, ApiResponse, MyRestaurantsResponse, UpdateRestaurantRequest, UpdateRestaurantResponse, MenuCategoriesResponse, MenuCategoryResponse, CreateMenuCategoryRequest } from '../types';

let getAccessToken: () => string | null = () => null;
let getRefreshToken: () => string | null = () => null;
let onTokenRefreshed: (data: RefreshResponse['data']) => void = () => {};
let onSessionExpired: () => void = () => {};

/**
 * Wire up token accessors from the auth store.
 * Called once during app initialization.
 */
export function configureAuth(config: {
  getAccessToken: () => string | null;
  getRefreshToken: () => string | null;
  onTokenRefreshed: (data: RefreshResponse['data']) => void;
  onSessionExpired: () => void;
}) {
  getAccessToken = config.getAccessToken;
  getRefreshToken = config.getRefreshToken;
  onTokenRefreshed = config.onTokenRefreshed;
  onSessionExpired = config.onSessionExpired;
}

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

async function tryRefreshToken(): Promise<boolean> {
  if (isRefreshing && refreshPromise) return refreshPromise;

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const token = getRefreshToken();
      if (!token) return false;

      const res = await fetch(`${API_BASE_URL}${ENDPOINTS.refresh}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: token }),
      });

      if (!res.ok) return false;

      const data: RefreshResponse = await res.json();
      if (data.success) {
        onTokenRefreshed(data.data);
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/**
 * Authenticated fetch wrapper with automatic token refresh.
 */
export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  const token = getAccessToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let res = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  // Auto-refresh on 401
  if (res.status === 401 && token) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      const newToken = getAccessToken();
      if (newToken) {
        headers['Authorization'] = `Bearer ${newToken}`;
      }
      res = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
      });
    } else {
      onSessionExpired();
      throw new Error('Session expired');
    }
  }

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.message || `Request failed with status ${res.status}`);
  }

  return data as T;
}

// ── Auth API ──

export function login(credentials: LoginRequest): Promise<LoginResponse> {
  return apiFetch<LoginResponse>(ENDPOINTS.login, {
    method: 'POST',
    body: JSON.stringify(credentials),
  });
}

export function logout(refreshToken: string): Promise<ApiResponse> {
  return apiFetch<ApiResponse>(ENDPOINTS.logout, {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  });
}

export function requestPasswordReset(email: string): Promise<ApiResponse> {
  return apiFetch<ApiResponse>(ENDPOINTS.passwordReset, {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export function confirmPasswordReset(token: string, newPassword: string): Promise<ApiResponse> {
  return apiFetch<ApiResponse>(ENDPOINTS.passwordResetConfirm, {
    method: 'POST',
    body: JSON.stringify({ token, newPassword }),
  });
}

// ── Restaurant API ──

export function fetchMyRestaurants(): Promise<MyRestaurantsResponse> {
  return apiFetch<MyRestaurantsResponse>(ENDPOINTS.myRestaurants);
}

export function updateRestaurant(restaurantId: number, data: UpdateRestaurantRequest): Promise<UpdateRestaurantResponse> {
  return apiFetch<UpdateRestaurantResponse>(ENDPOINTS.restaurant(restaurantId), {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function toggleRestaurantOpen(restaurantId: number, isOpen: boolean): Promise<ApiResponse> {
  return apiFetch<ApiResponse>(ENDPOINTS.restaurantToggleOpen(restaurantId) + `?isOpen=${isOpen}`, {
    method: 'PATCH',
  });
}

// ── Menu Categories API ──

export function fetchMenuCategories(restaurantId: number): Promise<MenuCategoriesResponse> {
  return apiFetch<MenuCategoriesResponse>(ENDPOINTS.menuCategories(restaurantId));
}

export function createMenuCategory(restaurantId: number, data: CreateMenuCategoryRequest): Promise<MenuCategoryResponse> {
  return apiFetch<MenuCategoryResponse>(ENDPOINTS.menuCategories(restaurantId), {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateMenuCategory(restaurantId: number, categoryId: number, data: CreateMenuCategoryRequest): Promise<MenuCategoryResponse> {
  return apiFetch<MenuCategoryResponse>(ENDPOINTS.menuCategory(restaurantId, categoryId), {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function deleteMenuCategory(restaurantId: number, categoryId: number): Promise<ApiResponse> {
  return apiFetch<ApiResponse>(ENDPOINTS.menuCategory(restaurantId, categoryId), {
    method: 'DELETE',
  });
}