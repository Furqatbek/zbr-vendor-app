// Auth types
export interface AuthUser {
  id: number;
  email: string;
  fullName: string;
  roles: string[];
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
}

export interface LoginRequest {
  emailOrPhone: string;
  password: string;
}

export interface LoginResponseData extends AuthTokens {
  userId: number;
  email: string;
  fullName: string;
  roles: string[];
}

export interface LoginResponse {
  success: boolean;
  message: string;
  data: LoginResponseData;
}

export interface RefreshResponse {
  success: boolean;
  message: string;
  data: AuthTokens;
}

export interface ApiResponse {
  success: boolean;
  message: string;
}

export interface Restaurant {
  id: number;
  ownerId: number;
  name: string;
  slug: string;
  description: string;
  phone: string;
  email: string;
  fullAddress: string;
  addressLine1: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  latitude: number;
  longitude: number;
  status: string;
  featured: boolean;
  acceptsDelivery: boolean;
  acceptsTakeaway: boolean;
  acceptsDineIn: boolean;
  minimumOrder: number;
  deliveryFee: number;
  deliveryRadiusKm: number;
  averagePrepTimeMinutes: number;
  isOpen: boolean;
  isCurrentlyOpen: boolean;
  opensAt?: string;
  closesAt?: string;
  averageRating: number;
  totalRatings: number;
  totalOrders: number;
  createdAt: string;
}

export interface MyRestaurantsResponse {
  success: boolean;
  data: Restaurant[];
}

export interface UpdateRestaurantRequest {
  name?: string;
  description?: string;
  phone?: string;
  email?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  acceptsDelivery?: boolean;
  acceptsTakeaway?: boolean;
  acceptsDineIn?: boolean;
  minimumOrder?: number;
  deliveryFee?: number;
  deliveryRadiusKm?: number;
  averagePrepTimeMinutes?: number;
  opensAt?: string;
  closesAt?: string;
}

export interface UpdateRestaurantResponse {
  success: boolean;
  data: Restaurant;
}

export type OrderStatus =
  | 'received'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'picked_up'
  | 'delivered'
  | 'cancelled';

export type DeclineReason =
  | 'out_of_stock'
  | 'too_busy'
  | 'closing_soon'
  | 'other';

export interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  modifiers?: string[];
  specialNotes?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  items: OrderItem[];
  totalPrice: number;
  customerName: string;
  customerPhone?: string;
  courierName?: string;
  courierPhone?: string;
  courierETA?: number;
  receivedAt: string;
  prepTimeMinutes: number;
  prepStartedAt?: string;
  readyAt?: string;
  pickedUpAt?: string;
  deliveredAt?: string;
  specialNotes?: string;
  declineReason?: DeclineReason;
}

export interface UpdateOrderStatusRequest {
  status: string;
  estimatedPrepTimeMinutes?: number;
  notes?: string;
}

export interface OrderResponse {
  success: boolean;
  message: string;
  data: Order;
}

export interface CancelOrderRequest {
  reason: string;
  requestRefund?: boolean;
}

export interface MenuCategory {
  id: number;
  restaurantId?: number;
  name: string;
  description?: string;
  imageUrl?: string;
  sortOrder: number;
  active: boolean;
  items: MenuItem[];
}

export interface MenuCategoriesResponse {
  success: boolean;
  data: MenuCategory[];
}

export interface MenuCategoryResponse {
  success: boolean;
  data: MenuCategory;
}

export interface CreateMenuCategoryRequest {
  name: string;
  description?: string;
  imageUrl?: string;
  sortOrder?: number;
}

export interface MenuItemVariant {
  id: number;
  name: string;
  priceDelta: number;
  totalPrice: number;
  inStock: boolean;
  sortOrder?: number;
}

export interface MenuItemOption {
  id: number;
  groupName: string;
  name: string;
  priceDelta: number;
  isDefault: boolean;
  maxSelections: number;
  required: boolean;
  inStock: boolean;
}

export interface MenuItem {
  id: number;
  categoryId: number;
  categoryName?: string;
  name: string;
  description?: string;
  price: number;
  priceWithMargin?: number;
  originalPrice?: number;
  effectivePrice?: number;
  onSale?: boolean;
  discountPercentage?: number;
  imageUrl?: string;
  imagePath?: string;
  imageName?: string;
  imageSize?: number;
  imageContentType?: string;
  inStock: boolean;
  featured?: boolean;
  sortOrder?: number;
  prepTimeMinutes?: number;
  calories?: number;
  vegetarian?: boolean;
  vegan?: boolean;
  glutenFree?: boolean;
  spicy?: boolean;
  allergens?: string;
  active?: boolean;
  variants?: MenuItemVariant[];
  options?: MenuItemOption[];
}

export interface MenuItemsResponse {
  success: boolean;
  data: {
    content: MenuItem[];
    totalElements: number;
    totalPages: number;
    number: number;
    size: number;
  };
}

export interface MenuItemResponse {
  success: boolean;
  data: MenuItem;
}

export interface CreateMenuItemRequest {
  categoryId: number;
  name: string;
  description?: string;
  price: number;
  originalPrice?: number;
  imageUrl?: string;
  prepTimeMinutes?: number;
  calories?: number;
  vegetarian?: boolean;
  vegan?: boolean;
  glutenFree?: boolean;
  spicy?: boolean;
  allergens?: string;
  featured?: boolean;
  sortOrder?: number;
  variants?: { name: string; priceDelta: number; sortOrder?: number }[];
  options?: { groupName: string; name: string; priceDelta: number; isDefault?: boolean; maxSelections?: number; required?: boolean }[];
}

export interface Review {
  id: string;
  customerName: string;
  rating: number;
  date: string;
  comment: string;
  orderItems: string[];
  platform: string;
  replied: boolean;
  replyText?: string;
}

export interface RatingsResponse {
  ratingCount: number;
  reviewCount: number;
  distribution: Record<string, number>;
  distributionPercentage: Record<string, number>;
  restaurantId: number;
  periodStart: string;
  periodEnd: string;
}

// Notifications
export type NotificationRole = 'CUSTOMER' | 'COURIER' | 'RESTAURANT' | 'ADMIN' | 'SUPPORT' | 'FINANCE' | 'OPERATIONS' | 'ALL';
export type NotificationCategory = 'ORDER' | 'FINANCE' | 'SUPPORT' | 'SYSTEM' | 'PROMOTION' | 'ACCOUNT' | 'DELIVERY' | 'RESTAURANT_OPS' | 'ALERT';
export type NotificationRelatedEntityType = 'ORDER' | 'RESTAURANT' | 'COURIER' | 'CUSTOMER' | 'SUPPORT_TICKET' | 'PAYMENT' | 'PAYOUT';

export interface AppNotification {
  id: number;
  title: string;
  message: string;
  category: NotificationCategory;
  role: NotificationRole;
  isRead: boolean;
  readAt?: string;
  createdAt: string;
  relatedEntityId?: number;
  relatedEntityType?: NotificationRelatedEntityType;
}

export interface NotificationsPageResponse {
  content: AppNotification[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

export interface NotificationCounts {
  total: number;
  unread: number;
  byCategory: Record<string, number>;
}

export interface UnreadCountResponse {
  unreadCount: number;
}

export interface MarkAllReadResponse {
  status: string;
  markedCount: number;
}

export interface CourierRating {
  courierName: string;
  orderId: string;
  stars: number;
  criteria: string[];
  note?: string;
}

export interface RevenueData {
  totalRevenue: number;
  ordersCount: number;
  avgOrderValue: number;
  chartData: { label: string; value: number }[];
  soldItems: { name: string; unitsSold: number; revenue: number; category: string; soldAt: string }[];
  refunds: number;
  cancellations: number;
}

export interface WorkingHoursDay {
  day: string;
  isOpen: boolean;
  openTime: string;
  closeTime: string;
}

export interface StaffMember {
  id: string;
  name: string;
  role: 'owner' | 'manager' | 'staff';
  email: string;
  isActive: boolean;
}


export interface ContactCard {
  type: 'customer' | 'courier' | 'support';
  name: string;
  subtitle?: string;
  phone?: string;
  imageUrl?: string;
}
