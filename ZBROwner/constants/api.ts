/**
 * API configuration for backend integration.
 */

export const API_BASE_URL = 'https://api.zbr.uz';

export const WS_BASE_URL = 'wss://api.zbr.uz';

export const ENDPOINTS = {
  ws: `${WS_BASE_URL}/ws/vendor`,
} as const;
