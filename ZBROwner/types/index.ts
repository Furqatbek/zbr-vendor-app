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
  id: string;
  name: string;
  isActive: boolean;
  sortOrder: number;
  itemCount: number;
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
  soldItems: { name: string; unitsSold: number; revenue: number; category: string }[];
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

export interface RestaurantProfile {
  name: string;
  address: string;
  phone: string;
  email: string;
  description: string;
  cuisine: string;
  avgPrepTime: number;
  deliveryRadius: number;
}

export interface ContactCard {
  type: 'customer' | 'courier' | 'support';
  name: string;
  subtitle?: string;
  phone?: string;
  imageUrl?: string;
}
