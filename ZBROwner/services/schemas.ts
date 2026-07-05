import { z } from 'zod';

/**
 * Runtime validation for the money/orders-critical response bodies.
 *
 * apiFetch returns `data as T` — a blind cast that trusts the backend's shape.
 * These schemas add a real boundary check for the two payloads whose malformed
 * data hurts most:
 *
 *  - Financial report: every numeric field falls back to 0 and the trend arrays
 *    to [], so a partial/null report can't feed `undefined` into `.toFixed` on
 *    the money screen (declarative version of the render-time guards).
 *  - Orders: a structural guard so a fundamentally-broken record is dropped at
 *    the boundary with a clear signal instead of silently corrupting the board.
 */

// A number that tolerates null/missing/NaN by falling back to 0.
const num = z.number().catch(0);
const str = z.string().catch('');

export const dailyRevenueTrendSchema = z.object({
  date: str,
  gmv: num,
  orderCount: num,
  averageOrderValue: num,
});

export const dailyPayoutTrendSchema = z.object({
  date: str,
  grossSales: num,
  netPayouts: num,
  restaurantCount: num,
  disputeCount: num,
});

export const financialReportSchema = z.object({
  restaurantId: num,
  periodStart: str,
  periodEnd: str,
  totalRevenue: num,
  totalOrders: num,
  averageOrderValue: num,
  foodRevenue: num,
  deliveryFeeRevenue: num,
  tipRevenue: num,
  growthRate: num,
  grossSales: num,
  commissionsDeducted: num,
  deliverySubsidies: num,
  promotionCosts: num,
  adjustments: num,
  fees: num,
  netPayout: num,
  pendingPayouts: num,
  completedPayouts: num,
  dailyRevenueTrend: z.array(dailyRevenueTrendSchema).catch([]),
  dailyPayoutTrend: z.array(dailyPayoutTrendSchema).catch([]),
});

/**
 * Structural guard for a raw order record. Passthrough keeps every extra field
 * so the downstream mapApiOrder still sees the full object; this only asserts
 * the essentials exist with a sane type. A record failing this is dropped.
 */
export const rawOrderGuardSchema = z
  .object({
    id: z.union([z.number(), z.string()]),
    status: z.string(),
    items: z.array(z.unknown()).nullish(),
  })
  .passthrough();

export function isStructurallyValidOrder(raw: unknown): boolean {
  try {
    // safeParse still throws if a property getter on `raw` throws mid-parse, so
    // guard the whole call.
    return rawOrderGuardSchema.safeParse(raw).success;
  } catch {
    return false;
  }
}
