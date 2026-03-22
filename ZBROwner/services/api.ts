import { API_BASE_URL, ENDPOINTS } from '../constants/api';
import type { LoginRequest, LoginResponse, RefreshResponse, ApiResponse, MyRestaurantsResponse, UpdateRestaurantRequest, UpdateRestaurantResponse, MenuCategoriesResponse, MenuCategoryResponse, CreateMenuCategoryRequest, MenuItemsResponse, MenuItemResponse, CreateMenuItemRequest, RatingsResponse, NotificationsPageResponse, NotificationCounts, UnreadCountResponse, MarkAllReadResponse, AppNotification, NotificationRole, NotificationCategory, UpdateOrderStatusRequest, OrderResponse, RestaurantOrdersResponse, RawApiOrder, CancelOrderRequest, Order, OrderItem, OrderStatus } from '../types';

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

  // Auto-refresh on 401/403
  if (res.status === 401 || res.status === 403) {
    const refreshed = token ? await tryRefreshToken() : false;
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

// ── Orders API ──

export function updateOrderStatus(orderId: string, data: UpdateOrderStatusRequest): Promise<OrderResponse> {
  return apiFetch<OrderResponse>(ENDPOINTS.orderStatus(orderId), {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function cancelOrder(orderId: string, data: CancelOrderRequest): Promise<OrderResponse> {
  return apiFetch<OrderResponse>(ENDPOINTS.orderCancel(orderId), {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

function mapApiOrderItem(raw: RawApiOrder['items'][number]): OrderItem {
  return {
    id: String(raw.id),
    menuItemId: raw.menuItemId,
    name: raw.itemName,
    quantity: raw.quantity,
    price: raw.unitPrice,
    totalPrice: raw.totalPrice,
    variantName: raw.variantName,
    variantPriceDelta: raw.variantPriceDelta,
    modifiers: raw.modifiers?.map((m) => ({ id: String(m.id), name: m.name, price: m.price })),
    modifiersTotal: raw.modifiersTotal,
    specialNotes: raw.specialInstructions,
  };
}

function mapApiOrder(raw: RawApiOrder): Order {
  return {
    id: String(raw.id),
    orderNumber: raw.externalOrderNo,
    status: raw.status.toLowerCase() as OrderStatus,
    orderType: raw.orderType as Order['orderType'],
    paymentStatus: raw.paymentStatus as Order['paymentStatus'],
    items: raw.items.map(mapApiOrderItem),
    subtotal: raw.subtotal,
    tax: raw.tax,
    deliveryFee: raw.deliveryFee,
    discount: raw.discount,
    tipAmount: raw.tipAmount,
    totalPrice: raw.total,
    customerName: raw.customerName,
    customerPhone: raw.customerPhone,
    deliveryAddress: raw.deliveryAddress,
    deliveryInstructions: raw.deliveryInstructions,
    courierName: raw.courierName,
    receivedAt: raw.createdAt,
    prepTimeMinutes: raw.estimatedPrepTimeMinutes ?? 0,
    estimatedPrepTimeMinutes: raw.estimatedPrepTimeMinutes,
    estimatedDeliveryTime: raw.estimatedDeliveryTime,
    acceptedAt: raw.acceptedAt,
    readyAt: raw.readyAt,
    pickedUpAt: raw.pickedUpAt,
    inTransitAt: raw.inTransitAt,
    deliveredAt: raw.deliveredAt,
    completedAt: raw.completedAt,
    cancelledAt: raw.cancelledAt,
    cancellationReason: raw.cancellationReason,
  };
}

export async function fetchRestaurantOrders(
  restaurantId: number,
  params: { page?: number; size?: number } = {},
): Promise<{ content: Order[]; totalElements: number; last: boolean }> {
  const query = new URLSearchParams();
  if (params.page != null) query.set('page', String(params.page));
  if (params.size != null) query.set('size', String(params.size));
  const qs = query.toString();
  const res = await apiFetch<RestaurantOrdersResponse>(
    ENDPOINTS.restaurantOrders(restaurantId) + (qs ? `?${qs}` : ''),
  );
  return {
    content: res.data.content.map(mapApiOrder),
    totalElements: res.data.totalElements,
    last: res.data.last,
  };
}

export async function fetchActiveOrders(
  restaurantId: number,
  params: { page?: number; size?: number } = {},
): Promise<{ content: Order[]; totalElements: number; last: boolean }> {
  const query = new URLSearchParams();
  if (params.page != null) query.set('page', String(params.page));
  if (params.size != null) query.set('size', String(params.size));
  const qs = query.toString();
  const res = await apiFetch<RestaurantOrdersResponse>(
    ENDPOINTS.restaurantActiveOrders(restaurantId) + (qs ? `?${qs}` : ''),
  );
  return {
    content: res.data.content.map(mapApiOrder),
    totalElements: res.data.totalElements,
    last: res.data.last,
  };
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

// ── Menu Items API ──

export function fetchMenuItems(restaurantId: number, page = 0, size = 100): Promise<MenuItemsResponse> {
  return apiFetch<MenuItemsResponse>(ENDPOINTS.menuItems(restaurantId) + `?page=${page}&size=${size}`);
}

export function fetchMenuItem(restaurantId: number, itemId: number): Promise<MenuItemResponse> {
  return apiFetch<MenuItemResponse>(ENDPOINTS.menuItem(restaurantId, itemId));
}

export function createMenuItem(restaurantId: number, data: CreateMenuItemRequest): Promise<MenuItemResponse> {
  return apiFetch<MenuItemResponse>(ENDPOINTS.menuItems(restaurantId), {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateMenuItem(restaurantId: number, itemId: number, data: CreateMenuItemRequest): Promise<MenuItemResponse> {
  return apiFetch<MenuItemResponse>(ENDPOINTS.menuItem(restaurantId, itemId), {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function updateMenuItemStock(restaurantId: number, itemId: number, inStock: boolean): Promise<ApiResponse> {
  return apiFetch<ApiResponse>(ENDPOINTS.menuItemStock(restaurantId, itemId) + `?inStock=${inStock}`, {
    method: 'PATCH',
  });
}

export function deleteMenuItem(restaurantId: number, itemId: number): Promise<ApiResponse> {
  return apiFetch<ApiResponse>(ENDPOINTS.menuItem(restaurantId, itemId), {
    method: 'DELETE',
  });
}

export async function uploadMenuItemImage(restaurantId: number, itemId: number, imageUri: string, assetMimeType?: string): Promise<MenuItemResponse> {
  const token = getAccessToken();

  // Derive extension from the asset's actual MIME type (provided by ImagePicker)
  // rather than parsing the URI, which may contain no extension or a mangled one.
  const mimeToExt: Record<string, string> = {
    'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp',
  };
  const ext = (assetMimeType && mimeToExt[assetMimeType]) ?? 'jpg';
  const mimeType = assetMimeType ?? 'image/jpeg';
  const filename = `image.${ext}`;

  // Convert the local URI to an actual Blob/File so FormData sends real file
  // bytes instead of "[object Object]"
  const blobResponse = await fetch(imageUri);
  const blob = await blobResponse.blob();
  const file = new File([blob], filename, { type: mimeType });

  const formData = new FormData();
  formData.append('file', file);

  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let res = await fetch(`${API_BASE_URL}${ENDPOINTS.menuItemImage(restaurantId, itemId)}`, {
    method: 'POST',
    headers,
    body: formData,
  });

  // Handle 401/403 with token refresh, same as apiFetch
  if (res.status === 401 || res.status === 403) {
    const refreshed = token ? await tryRefreshToken() : false;
    if (refreshed) {
      const newToken = getAccessToken();
      if (newToken) headers['Authorization'] = `Bearer ${newToken}`;
      // Rebuild FormData since body may have been consumed
      const newFormData = new FormData();
      newFormData.append('file', file);
      res = await fetch(`${API_BASE_URL}${ENDPOINTS.menuItemImage(restaurantId, itemId)}`, {
        method: 'POST',
        headers,
        body: newFormData,
      });
    } else {
      onSessionExpired();
      throw new Error('Session expired');
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message ?? `Upload failed: ${res.status}`);
  }
  return res.json();
}

// ── Notifications API ──

export function fetchMyNotifications(
  options?: { role?: NotificationRole; isRead?: boolean; category?: NotificationCategory; page?: number; pageSize?: number },
): Promise<NotificationsPageResponse> {
  const params = new URLSearchParams();
  if (options?.role) params.set('role', options.role);
  if (options?.isRead !== undefined) params.set('isRead', String(options.isRead));
  if (options?.category) params.set('category', options.category);
  params.set('page', String(options?.page ?? 0));
  params.set('pageSize', String(options?.pageSize ?? 20));
  return apiFetch<NotificationsPageResponse>(ENDPOINTS.notificationsMe + `?${params}`);
}

export function fetchUnreadNotifications(
  userId: number,
  options?: { role?: NotificationRole; page?: number; pageSize?: number },
): Promise<NotificationsPageResponse> {
  const params = new URLSearchParams();
  if (options?.role) params.set('role', options.role);
  params.set('page', String(options?.page ?? 0));
  params.set('pageSize', String(options?.pageSize ?? 20));
  return apiFetch<NotificationsPageResponse>(ENDPOINTS.notificationsUnread(userId) + `?${params}`);
}

export function fetchNotificationCounts(userId: number): Promise<NotificationCounts> {
  return apiFetch<NotificationCounts>(ENDPOINTS.notificationCounts(userId));
}

export function fetchUnreadCount(userId: number, role?: NotificationRole): Promise<UnreadCountResponse> {
  const params = role ? `?role=${role}` : '';
  return apiFetch<UnreadCountResponse>(ENDPOINTS.notificationUnreadCount(userId) + params);
}

export function markNotificationRead(id: number): Promise<AppNotification> {
  return apiFetch<AppNotification>(ENDPOINTS.notificationMarkRead(id), { method: 'PATCH' });
}

export function markAllNotificationsRead(userId: number, role?: NotificationRole): Promise<MarkAllReadResponse> {
  const params = new URLSearchParams({ userId: String(userId) });
  if (role) params.set('role', role);
  return apiFetch<MarkAllReadResponse>(ENDPOINTS.notificationMarkAllRead + `?${params}`, { method: 'PATCH' });
}

// ── Ratings / Reviews API ──

export function fetchRatings(
  restaurantId: number,
  startDate: string,
  endDate: string,
  options?: { includeDistribution?: boolean; includeTrend?: boolean; includeTopRestaurants?: boolean },
): Promise<RatingsResponse> {
  const params = new URLSearchParams({
    startDate,
    endDate,
    includeDistribution: String(options?.includeDistribution ?? true),
    includeTrend: String(options?.includeTrend ?? false),
    includeTopRestaurants: String(options?.includeTopRestaurants ?? false),
  });
  return apiFetch<RatingsResponse>(ENDPOINTS.ratings(restaurantId) + `?${params}`);
}

export function deleteMenuItemImage(restaurantId: number, itemId: number): Promise<ApiResponse> {
  return apiFetch<ApiResponse>(ENDPOINTS.menuItemImage(restaurantId, itemId), {
    method: 'DELETE',
  });
}