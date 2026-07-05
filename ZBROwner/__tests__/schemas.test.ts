import { financialReportSchema, isStructurallyValidOrder } from '../services/schemas';

describe('financialReportSchema', () => {
  it('defaults every numeric field to 0 when null/missing', () => {
    // A partial report (new restaurant): most fields absent, one null.
    const parsed = financialReportSchema.parse({ totalRevenue: null, totalOrders: 5 });
    expect(parsed.totalRevenue).toBe(0); // null -> 0
    expect(parsed.totalOrders).toBe(5); // preserved
    expect(parsed.netPayout).toBe(0); // missing -> 0
    expect(parsed.averageOrderValue).toBe(0);
  });

  it('defaults the trend arrays to [] when missing or wrong-typed', () => {
    const parsed = financialReportSchema.parse({ dailyRevenueTrend: null, dailyPayoutTrend: 'oops' });
    expect(parsed.dailyRevenueTrend).toEqual([]);
    expect(parsed.dailyPayoutTrend).toEqual([]);
  });

  it('preserves valid data and coerces bad trend entries', () => {
    const parsed = financialReportSchema.parse({
      totalRevenue: 1200.5,
      dailyRevenueTrend: [{ date: '2026-01-01', gmv: 500, orderCount: 10, averageOrderValue: 50 }],
    });
    expect(parsed.totalRevenue).toBe(1200.5);
    expect(parsed.dailyRevenueTrend).toHaveLength(1);
    expect(parsed.dailyRevenueTrend[0]!.gmv).toBe(500);
  });

  it('never throws on a completely empty object (all defaults)', () => {
    const parsed = financialReportSchema.parse({});
    expect(parsed.totalRevenue).toBe(0);
    expect(parsed.dailyRevenueTrend).toEqual([]);
  });
});

describe('isStructurallyValidOrder', () => {
  it('accepts a record with id + status (+ optional items)', () => {
    expect(isStructurallyValidOrder({ id: 1, status: 'CREATED', items: [] })).toBe(true);
    expect(isStructurallyValidOrder({ id: 'x', status: 'READY' })).toBe(true);
    expect(isStructurallyValidOrder({ id: 1, status: 'CREATED', items: null })).toBe(true);
  });

  it('rejects records missing id or status, or with a non-array items', () => {
    expect(isStructurallyValidOrder({ status: 'CREATED' })).toBe(false); // no id
    expect(isStructurallyValidOrder({ id: 1 })).toBe(false); // no status
    expect(isStructurallyValidOrder({ id: 1, status: 'CREATED', items: 'nope' })).toBe(false);
    expect(isStructurallyValidOrder(null)).toBe(false);
    expect(isStructurallyValidOrder('not an object')).toBe(false);
  });
});
