import { normalizeStatus, minutesUntil, mapApiOrder, safeMapOrders } from '../services/api';
import type { RawApiOrder } from '../types';

// Minimal valid raw order; override per test.
function raw(overrides: Partial<RawApiOrder> = {}): RawApiOrder {
  return {
    id: 1,
    externalOrderNo: 'A-100',
    restaurantId: 1,
    orderType: 'DELIVERY',
    status: 'CREATED',
    items: [],
    subtotal: 10,
    total: 12,
    customerName: 'Jane',
    createdAt: '2026-01-01T10:00:00.000Z',
    ...overrides,
  } as RawApiOrder;
}

describe('normalizeStatus', () => {
  it('lowercases known statuses into the union', () => {
    expect(normalizeStatus(raw({ status: 'CREATED' }))).toBe('created');
    expect(normalizeStatus(raw({ status: 'READY' }))).toBe('ready');
    expect(normalizeStatus(raw({ status: 'REFUNDED' }))).toBe('refunded');
    expect(normalizeStatus(raw({ status: 'COMPLETED' }))).toBe('completed');
  });

  it('maps COURIER_ASSIGNED to the kitchen state implied by timestamps', () => {
    // Courier accepted but kitchen hasn't started → accepted
    expect(normalizeStatus(raw({ status: 'COURIER_ASSIGNED' }))).toBe('accepted');
    // Kitchen started (acceptedAt set) → preparing
    expect(
      normalizeStatus(raw({ status: 'COURIER_ASSIGNED', acceptedAt: '2026-01-01T10:05:00Z' })),
    ).toBe('preparing');
    // Food ready → ready
    expect(
      normalizeStatus(raw({ status: 'COURIER_ASSIGNED', acceptedAt: 'x', readyAt: 'y' })),
    ).toBe('ready');
    // Already picked up → picked_up
    expect(
      normalizeStatus(raw({ status: 'COURIER_ASSIGNED', pickedUpAt: 'z' })),
    ).toBe('picked_up');
  });

  it('defaults to created when status is missing or non-string', () => {
    expect(normalizeStatus(raw({ status: undefined as any }))).toBe('created');
    expect(normalizeStatus(raw({ status: null as any }))).toBe('created');
  });

  it('passes unknown statuses through (lowercased) rather than dropping the order', () => {
    expect(normalizeStatus(raw({ status: 'OUT_FOR_DELIVERY' }))).toBe('out_for_delivery');
  });
});

describe('minutesUntil', () => {
  it('returns undefined for missing input', () => {
    expect(minutesUntil(undefined)).toBeUndefined();
  });

  it('returns undefined for a past or now timestamp', () => {
    expect(minutesUntil('2000-01-01T00:00:00Z')).toBeUndefined();
  });

  it('returns whole minutes from now for a future timestamp', () => {
    const future = new Date(Date.now() + 25 * 60 * 1000).toISOString();
    const mins = minutesUntil(future);
    expect(mins).toBeGreaterThanOrEqual(24);
    expect(mins).toBeLessThanOrEqual(25);
  });
});

describe('mapApiOrder', () => {
  it('maps core fields and stringifies id', () => {
    const o = mapApiOrder(raw({ id: 42, externalOrderNo: 'B-9', total: 33.5 }));
    expect(o.id).toBe('42');
    expect(o.orderNumber).toBe('B-9');
    expect(o.totalPrice).toBe(33.5);
    expect(o.status).toBe('created');
  });

  it('carries courier fields and derives ETA from estimatedDeliveryTime', () => {
    const future = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const o = mapApiOrder(raw({ courierName: 'Bob', courierPhone: '+100', estimatedDeliveryTime: future }));
    expect(o.courierName).toBe('Bob');
    expect(o.courierPhone).toBe('+100');
    expect(o.courierETA).toBeGreaterThanOrEqual(14);
  });

  it('tolerates non-array items without throwing', () => {
    const o = mapApiOrder(raw({ items: undefined as any }));
    expect(o.items).toEqual([]);
  });
});

describe('safeMapOrders', () => {
  it('returns [] for null/undefined input', () => {
    expect(safeMapOrders(undefined)).toEqual([]);
    expect(safeMapOrders(null)).toEqual([]);
  });

  it('maps all valid records', () => {
    const out = safeMapOrders([raw({ id: 1 }), raw({ id: 2 })]);
    expect(out.map((o) => o.id)).toEqual(['1', '2']);
  });

  it('drops a single malformed record instead of rejecting the whole page', () => {
    // A record whose access throws inside mapApiOrder (getter that throws on items).
    const bad = {
      get items() { throw new Error('boom'); },
    } as unknown as RawApiOrder;
    const out = safeMapOrders([raw({ id: 1 }), bad, raw({ id: 3 })]);
    expect(out.map((o) => o.id)).toEqual(['1', '3']);
  });
});
