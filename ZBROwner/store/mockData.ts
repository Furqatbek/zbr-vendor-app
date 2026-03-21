import type { Order, MenuCategory, MenuItem, Review, RevenueData, WorkingHoursDay, StaffMember, RestaurantProfile } from '../types';

const now = new Date();
const minutesAgo = (min: number) => new Date(now.getTime() - min * 60000).toISOString();

export const mockOrders: Order[] = [
  {
    id: '1',
    orderNumber: '#1042',
    status: 'received',
    items: [
      { id: 'i1', name: 'Classic Burger', quantity: 2, price: 12.99 },
      { id: 'i2', name: 'Fries Large', quantity: 1, price: 4.99 },
      { id: 'i3', name: 'Cola', quantity: 2, price: 2.99 },
    ],
    totalPrice: 36.95,
    customerName: 'John Smith',
    customerPhone: '+1234567890',
    receivedAt: minutesAgo(2),
    prepTimeMinutes: 15,
    specialNotes: 'No onions on burgers please',
  },
  {
    id: '2',
    orderNumber: '#1043',
    status: 'received',
    items: [
      { id: 'i4', name: 'Chicken Wrap', quantity: 1, price: 10.99 },
      { id: 'i5', name: 'Salad Bowl', quantity: 1, price: 8.99 },
    ],
    totalPrice: 19.98,
    customerName: 'Sarah Johnson',
    receivedAt: minutesAgo(5),
    prepTimeMinutes: 12,
  },
  {
    id: '3',
    orderNumber: '#1041',
    status: 'preparing',
    items: [
      { id: 'i6', name: 'Double Cheeseburger', quantity: 1, price: 15.99 },
      { id: 'i7', name: 'Onion Rings', quantity: 1, price: 5.99 },
      { id: 'i8', name: 'Milkshake', quantity: 1, price: 6.99 },
    ],
    totalPrice: 28.97,
    customerName: 'Mike Davis',
    receivedAt: minutesAgo(10),
    prepTimeMinutes: 20,
    prepStartedAt: minutesAgo(8),
  },
  {
    id: '4',
    orderNumber: '#1040',
    status: 'preparing',
    items: [
      { id: 'i9', name: 'Veggie Burger', quantity: 3, price: 11.99 },
      { id: 'i10', name: 'Sweet Potato Fries', quantity: 2, price: 5.99 },
    ],
    totalPrice: 47.95,
    customerName: 'Emily Chen',
    receivedAt: minutesAgo(15),
    prepTimeMinutes: 18,
    prepStartedAt: minutesAgo(12),
    specialNotes: 'Extra sauce on the side',
  },
  {
    id: '5',
    orderNumber: '#1039',
    status: 'ready',
    items: [
      { id: 'i11', name: 'BBQ Bacon Burger', quantity: 1, price: 14.99 },
      { id: 'i12', name: 'Fries Regular', quantity: 1, price: 3.99 },
    ],
    totalPrice: 18.98,
    customerName: 'Alex Wilson',
    courierName: 'Carlos M.',
    courierPhone: '+1987654321',
    courierETA: 5,
    receivedAt: minutesAgo(25),
    prepTimeMinutes: 15,
    prepStartedAt: minutesAgo(22),
    readyAt: minutesAgo(7),
  },
  {
    id: '6',
    orderNumber: '#1038',
    status: 'ready',
    items: [
      { id: 'i13', name: 'Fish & Chips', quantity: 2, price: 13.99 },
    ],
    totalPrice: 27.98,
    customerName: 'Lisa Brown',
    courierName: 'David R.',
    courierPhone: '+1122334455',
    courierETA: 8,
    receivedAt: minutesAgo(30),
    prepTimeMinutes: 20,
    prepStartedAt: minutesAgo(27),
    readyAt: minutesAgo(10),
  },
  {
    id: '7',
    orderNumber: '#1035',
    status: 'delivered',
    items: [
      { id: 'i14', name: 'Chicken Tenders', quantity: 1, price: 9.99 },
    ],
    totalPrice: 9.99,
    customerName: 'Tom Lee',
    receivedAt: minutesAgo(60),
    prepTimeMinutes: 10,
    prepStartedAt: minutesAgo(58),
    readyAt: minutesAgo(48),
    pickedUpAt: minutesAgo(45),
    deliveredAt: minutesAgo(30),
  },
];

export const mockCategories: MenuCategory[] = [
  { id: 'c1', name: 'Burgers', isActive: true, sortOrder: 0, itemCount: 4 },
  { id: 'c2', name: 'Sides', isActive: true, sortOrder: 1, itemCount: 3 },
  { id: 'c3', name: 'Drinks', isActive: true, sortOrder: 2, itemCount: 3 },
  { id: 'c4', name: 'Desserts', isActive: false, sortOrder: 3, itemCount: 2 },
];

export const mockMenuItems: MenuItem[] = [
  { id: 'm1', categoryId: 'c1', name: 'Classic Burger', description: 'Beef patty, lettuce, tomato, pickles', price: 12.99, inStock: true },
  { id: 'm2', categoryId: 'c1', name: 'Double Cheeseburger', description: 'Two beef patties, double cheese, special sauce', price: 15.99, inStock: true },
  { id: 'm3', categoryId: 'c1', name: 'Veggie Burger', description: 'Plant-based patty, avocado, sprouts', price: 11.99, inStock: true },
  { id: 'm4', categoryId: 'c1', name: 'BBQ Bacon Burger', description: 'Beef patty, crispy bacon, BBQ sauce, onion rings', price: 14.99, inStock: false },
  { id: 'm5', categoryId: 'c2', name: 'Fries Regular', description: 'Crispy golden fries', price: 3.99, inStock: true },
  { id: 'm6', categoryId: 'c2', name: 'Fries Large', description: 'Large portion of crispy fries', price: 4.99, inStock: true },
  { id: 'm7', categoryId: 'c2', name: 'Onion Rings', description: 'Beer-battered onion rings', price: 5.99, inStock: true },
  { id: 'm8', categoryId: 'c3', name: 'Cola', description: 'Classic cola, 330ml', price: 2.99, inStock: true },
  { id: 'm9', categoryId: 'c3', name: 'Lemonade', description: 'Fresh squeezed lemonade', price: 3.99, inStock: true },
  { id: 'm10', categoryId: 'c3', name: 'Milkshake', description: 'Chocolate, vanilla, or strawberry', price: 6.99, inStock: false },
  { id: 'm11', categoryId: 'c4', name: 'Brownie', description: 'Warm chocolate brownie', price: 4.99, inStock: true },
  { id: 'm12', categoryId: 'c4', name: 'Ice Cream', description: 'Two scoops, choice of flavor', price: 5.99, inStock: true },
];

export const mockReviews: Review[] = [
  { id: 'r1', customerName: 'John S.', rating: 5, date: '2026-03-20', comment: 'Amazing burgers! Best in town. Will order again for sure.', orderItems: ['Classic Burger', 'Fries'], platform: 'ZBR', replied: false },
  { id: 'r2', customerName: 'Maria L.', rating: 4, date: '2026-03-19', comment: 'Good food, delivery was a bit slow but everything was still hot.', orderItems: ['Veggie Burger', 'Lemonade'], platform: 'ZBR', replied: true, replyText: 'Thank you Maria! We are working on faster deliveries.' },
  { id: 'r3', customerName: 'Anonymous', rating: 2, date: '2026-03-19', comment: 'Order was missing the onion rings. Disappointed.', orderItems: ['Double Cheeseburger', 'Onion Rings'], platform: 'ZBR', replied: false },
  { id: 'r4', customerName: 'David K.', rating: 5, date: '2026-03-18', comment: 'Perfect every time. The BBQ Bacon Burger is incredible!', orderItems: ['BBQ Bacon Burger', 'Cola'], platform: 'ZBR', replied: false },
  { id: 'r5', customerName: 'Sophia R.', rating: 3, date: '2026-03-17', comment: 'Food was okay but portions could be bigger for the price.', orderItems: ['Chicken Wrap'], platform: 'ZBR', replied: false },
  { id: 'r6', customerName: 'James W.', rating: 4, date: '2026-03-16', comment: 'Great milkshakes and the fries are always crispy.', orderItems: ['Milkshake', 'Fries Large'], platform: 'ZBR', replied: true, replyText: 'Thanks James! Glad you enjoy our milkshakes!' },
];

export const mockRevenueData: RevenueData = {
  totalRevenue: 2847.50,
  ordersCount: 156,
  avgOrderValue: 18.25,
  chartData: [
    { label: '9AM', value: 120 },
    { label: '10AM', value: 250 },
    { label: '11AM', value: 480 },
    { label: '12PM', value: 620 },
    { label: '1PM', value: 530 },
    { label: '2PM', value: 340 },
    { label: '3PM', value: 180 },
    { label: '4PM', value: 210 },
    { label: '5PM', value: 390 },
    { label: '6PM', value: 550 },
    { label: '7PM', value: 470 },
    { label: '8PM', value: 320 },
  ],
  soldItems: [
    { name: 'Classic Burger', unitsSold: 45, revenue: 584.55, category: 'Burgers' },
    { name: 'Double Cheeseburger', unitsSold: 32, revenue: 511.68, category: 'Burgers' },
    { name: 'Fries Large', unitsSold: 38, revenue: 189.62, category: 'Sides' },
    { name: 'BBQ Bacon Burger', unitsSold: 28, revenue: 419.72, category: 'Burgers' },
    { name: 'Cola', unitsSold: 52, revenue: 155.48, category: 'Drinks' },
    { name: 'Chicken Wings (6pc)', unitsSold: 24, revenue: 287.76, category: 'Sides' },
    { name: 'Veggie Wrap', unitsSold: 18, revenue: 179.82, category: 'Wraps' },
    { name: 'Milkshake Vanilla', unitsSold: 22, revenue: 131.78, category: 'Drinks' },
    { name: 'Onion Rings', unitsSold: 30, revenue: 119.70, category: 'Sides' },
    { name: 'Spicy Chicken Burger', unitsSold: 20, revenue: 299.80, category: 'Burgers' },
    { name: 'Iced Tea', unitsSold: 35, revenue: 104.65, category: 'Drinks' },
    { name: 'Caesar Salad', unitsSold: 12, revenue: 107.88, category: 'Salads' },
    { name: 'Mozzarella Sticks', unitsSold: 16, revenue: 111.84, category: 'Sides' },
    { name: 'Fish Burger', unitsSold: 14, revenue: 195.86, category: 'Burgers' },
    { name: 'Water Bottle', unitsSold: 40, revenue: 79.60, category: 'Drinks' },
  ],
  refunds: 3,
  cancellations: 5,
};

export const mockRestaurantProfile: RestaurantProfile = {
  name: 'Burger Palace',
  address: '123 Main Street, Suite 4, New York, NY 10001',
  phone: '+1 (212) 555-0123',
  email: 'hello@burgerpalace.com',
  description: 'Premium handcrafted burgers made with locally sourced ingredients. Serving the community since 2019.',
  cuisine: 'American, Burgers, Fast Casual',
  avgPrepTime: 15,
  deliveryRadius: 5,
};

export const mockWorkingHours: WorkingHoursDay[] = [
  { day: 'Monday', isOpen: true, openTime: '10:00', closeTime: '22:00' },
  { day: 'Tuesday', isOpen: true, openTime: '10:00', closeTime: '22:00' },
  { day: 'Wednesday', isOpen: true, openTime: '10:00', closeTime: '22:00' },
  { day: 'Thursday', isOpen: true, openTime: '10:00', closeTime: '23:00' },
  { day: 'Friday', isOpen: true, openTime: '10:00', closeTime: '23:30' },
  { day: 'Saturday', isOpen: true, openTime: '11:00', closeTime: '23:30' },
  { day: 'Sunday', isOpen: false, openTime: '00:00', closeTime: '00:00' },
];

export const mockStaffMembers: StaffMember[] = [
  { id: 's1', name: 'Alex Johnson', role: 'owner', email: 'alex@burgerpalace.com', isActive: true },
  { id: 's2', name: 'Maria Garcia', role: 'manager', email: 'maria@burgerpalace.com', isActive: true },
  { id: 's3', name: 'James Lee', role: 'staff', email: 'james@burgerpalace.com', isActive: true },
  { id: 's4', name: 'Sophie Brown', role: 'staff', email: 'sophie@burgerpalace.com', isActive: false },
];
