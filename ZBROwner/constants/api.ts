/**
 * API configuration for backend integration.
 */

export const API_BASE_URL = 'http://localhost:8080';

export const WS_BASE_URL = 'ws://localhost:8080';

export const ENDPOINTS = {
  // Auth
  login: '/api/v1/auth/login',
  refresh: '/refresh',
  logout: '/logout',
  passwordReset: '/password-reset',
  passwordResetConfirm: '/password-reset/confirm',

  // WebSocket
  ws: `${WS_BASE_URL}/ws/vendor`,
} as const;
