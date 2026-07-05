/**
 * Feature flags for capabilities whose backend endpoints don't exist yet.
 *
 * These UIs previously collected input or showed data that was never persisted
 * (a "fake success" the vendor couldn't tell from a real one). They're gated off
 * until the backend lands the corresponding endpoint — flip the flag to true
 * then, no other change needed. See docs/PRODUCTION_READINESS.md.
 */
export const FEATURES = {
  // Vendor reply to a customer review — needs POST /restaurants/{id}/reviews/{reviewId}/reply
  reviewReplies: false,
  // Rate the courier after pickup — needs a courier-rating endpoint
  courierRatings: false,
  // Per-category notification preferences — needs a persistence endpoint + server-side gating
  notificationPrefs: false,
  // Refunds / cancellations totals on the reports screen — not in the financial report payload yet
  reportsRefunds: false,
} as const;
