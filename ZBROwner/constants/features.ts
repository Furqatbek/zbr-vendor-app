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
  // Report/flag an abusive review — needs a moderation endpoint. The button
  // showed "Review flagged for review." while doing nothing at all.
  reviewReports: false,
} as const;

/**
 * How the app learns about order events.
 *
 *   'push'      — FCM/APNs only. No socket is opened.
 *   'websocket' — STOMP only. The original behaviour.
 *   'both'      — run together; the shared handler in utils/orderEvents.ts
 *                 dedupes, so this is safe and is how to migrate.
 *
 * Default is 'both' until the backend is actually sending push. Flipping to
 * 'push' before then would leave vendors with no alarm at all: the socket would
 * be gone and nothing would be arriving in its place, with only the foreground
 * poll noticing, up to 45 seconds late and never while backgrounded.
 *
 * Switch to 'push' once §8 of docs/PUSH_ORDER_EVENTS.md has been verified on a
 * real device. That is the whole point of the exercise, because a STOMP
 * subscription is a connection the backend
 * holds open per signed-in vendor: a thousand vendors is a thousand sockets,
 * plus the heartbeats, reconnect storms after a deploy, and the memory behind
 * each one. FCM and APNs already run that fan-out infrastructure, and the app
 * keeps no connection at all between orders.
 *
 * The tradeoff is real and worth stating: push delivery is best-effort, not
 * guaranteed. Neither Google nor Apple promises delivery or ordering, and iOS
 * throttles by priority. That is why the app also polls while it is in the
 * foreground (see hooks/useNotifications.ts) — the poll is the safety net, the
 * push is what makes the alarm instant.
 */
export const REALTIME_TRANSPORT: 'push' | 'websocket' | 'both' = 'both';

/**
 * How often to re-check orders while the app is open and in the foreground.
 *
 * Only a backstop for a push that never arrived, so it can be slow. At one
 * request per vendor per 45s, a thousand vendors is roughly 22 requests a
 * second — far cheaper than a thousand held-open sockets, and it stops
 * entirely when the app is backgrounded.
 */
export const FOREGROUND_POLL_MS = 45_000;
