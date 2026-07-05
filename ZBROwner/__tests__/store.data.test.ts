import { useStore } from '../store';
import * as api from '../services/api';

jest.mock('../services/api', () => ({
  fetchRestaurantOrders: jest.fn(),
  fetchActiveOrders: jest.fn(),
  updateOrderStatus: jest.fn(),
  cancelOrder: jest.fn(),
  fetchRatings: jest.fn(),
  fetchRestaurantReviews: jest.fn(),
  fetchFinancialReport: jest.fn(),
}));

jest.mock('../store/authStore', () => ({
  useAuthStore: {
    getState: () => ({
      restaurant: { id: 1, isOpen: true, averageRating: 4.2, totalRatings: 37 },
    }),
  },
}));

const mockApi = api as jest.Mocked<typeof api>;

beforeEach(() => {
  jest.clearAllMocks();
  useStore.setState({
    reviews: [],
    averageRating: 0,
    totalRatings: 0,
    ratingDistribution: {},
    reviewsError: false,
    financialReport: null,
    financialReportError: false,
  });
});

describe('loadReviews', () => {
  it('maps ReviewDto fields and sources headline stats from the restaurant', async () => {
    mockApi.fetchRatings.mockResolvedValue({ distribution: { '5': 2 }, ratingCount: 2 } as any);
    mockApi.fetchRestaurantReviews.mockResolvedValue({
      content: [
        { id: 7, consumerName: 'Ann', restaurantRating: 5, foodRating: 4, comment: 'Great', createdAt: '2026-01-02T00:00:00Z' },
      ],
    } as any);

    await useStore.getState().loadReviews();

    const s = useStore.getState();
    // Headline comes from the restaurant object, not derived from reviews.
    expect(s.averageRating).toBe(4.2);
    expect(s.totalRatings).toBe(37);
    // Field remap: consumerName->customerName, restaurantRating->rating, createdAt->date.
    expect(s.reviews[0]).toMatchObject({
      id: '7',
      customerName: 'Ann',
      rating: 5,
      date: '2026-01-02T00:00:00Z',
      comment: 'Great',
    });
  });

  it('falls back to foodRating when restaurantRating is absent', async () => {
    mockApi.fetchRatings.mockResolvedValue({ distribution: {}, ratingCount: 0 } as any);
    mockApi.fetchRestaurantReviews.mockResolvedValue({
      content: [{ id: 1, consumerName: null, foodRating: 3, comment: '', createdAt: 'x' }],
    } as any);

    await useStore.getState().loadReviews();

    const r = useStore.getState().reviews[0];
    expect(r.rating).toBe(3);
    expect(r.customerName).toBe('Anonymous');
  });

  it('derives the distribution from reviews when analytics distribution is empty', async () => {
    mockApi.fetchRatings.mockResolvedValue({ distribution: {}, ratingCount: 0 } as any);
    mockApi.fetchRestaurantReviews.mockResolvedValue({
      content: [
        { id: 1, restaurantRating: 5, createdAt: 'a' },
        { id: 2, restaurantRating: 5, createdAt: 'b' },
        { id: 3, restaurantRating: 4, createdAt: 'c' },
      ],
    } as any);

    await useStore.getState().loadReviews();

    expect(useStore.getState().ratingDistribution).toEqual({ '5': 2, '4': 1 });
  });

  it('flags reviewsError only when both sub-fetches fail', async () => {
    mockApi.fetchRatings.mockRejectedValue(new Error('a'));
    mockApi.fetchRestaurantReviews.mockRejectedValue(new Error('b'));

    await useStore.getState().loadReviews();

    expect(useStore.getState().reviewsError).toBe(true);
  });

  it('does not flag reviewsError when only one sub-fetch fails', async () => {
    mockApi.fetchRatings.mockRejectedValue(new Error('a'));
    mockApi.fetchRestaurantReviews.mockResolvedValue({ content: [] } as any);

    await useStore.getState().loadReviews();

    expect(useStore.getState().reviewsError).toBe(false);
  });
});

describe('loadFinancialReport', () => {
  const report = {
    restaurantId: 1,
    totalRevenue: 1234.5,
    totalOrders: 42,
    averageOrderValue: 29.4,
    dailyRevenueTrend: [
      { date: '2026-01-01T00:00:00Z', gmv: 500, orderCount: 20, averageOrderValue: 25 },
      { date: '2026-01-02T00:00:00Z', gmv: 734.5, orderCount: 22, averageOrderValue: 33 },
    ],
    dailyPayoutTrend: [],
  };

  it('maps report totals into revenueData and stores the raw report', async () => {
    mockApi.fetchFinancialReport.mockResolvedValue({ data: report } as any);

    await useStore.getState().loadFinancialReport();

    const s = useStore.getState();
    expect(s.financialReport).toEqual(report);
    expect(s.revenueData.totalRevenue).toBe(1234.5);
    expect(s.revenueData.ordersCount).toBe(42);
    expect(s.revenueData.avgOrderValue).toBe(29.4);
    expect(s.revenueData.chartData).toHaveLength(2);
    expect(s.revenueData.chartData[0].value).toBe(500);
  });

  it('sets financialReportError on failure and clears loading', async () => {
    mockApi.fetchFinancialReport.mockRejectedValue(new Error('down'));

    await useStore.getState().loadFinancialReport();

    expect(useStore.getState().financialReportError).toBe(true);
    expect(useStore.getState().financialReportLoading).toBe(false);
  });
});
