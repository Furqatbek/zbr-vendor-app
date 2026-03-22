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

export interface MenuCategory {
  id: number;
  name: string;
  description?: string;
  imageUrl?: string;
  sortOrder: number;
  active: boolean;
  itemCount: number;
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

export interface MenuItem {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  price: number;
  imageUrl?: string;
  inStock: boolean;
  modifiers?: MenuModifier[];
}

export interface MenuModifier {
  id: string;
  name: string;
  options: { name: string; priceAdded: number }[];
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
