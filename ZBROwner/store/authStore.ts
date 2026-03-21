import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AuthUser, AuthTokens, RefreshResponse } from '../types';
import { configureAuth, login as apiLogin, logout as apiLogout } from '../services/api';

const STORAGE_KEYS = {
  ACCESS_TOKEN: 'auth_access_token',
  REFRESH_TOKEN: 'auth_refresh_token',
  USER: 'auth_user',
} as const;

interface AuthStore {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  isInitialized: boolean;

  initialize: () => Promise<void>;
  login: (emailOrPhone: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  clearSession: () => void;
}

export const useAuthStore = create<AuthStore>((set, get) => {
  // Wire up the API client with token accessors
  configureAuth({
    getAccessToken: () => get().accessToken,
    getRefreshToken: () => get().refreshToken,
    onTokenRefreshed: (data: RefreshResponse['data']) => {
      set({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      });
      AsyncStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, data.accessToken);
      AsyncStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, data.refreshToken);
    },
    onSessionExpired: () => {
      get().clearSession();
    },
  });

  return {
    user: null,
    accessToken: null,
    refreshToken: null,
    isLoading: false,
    isInitialized: false,

    initialize: async () => {
      try {
        const [accessToken, refreshToken, userJson] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN),
          AsyncStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN),
          AsyncStorage.getItem(STORAGE_KEYS.USER),
        ]);

        const user = userJson ? JSON.parse(userJson) : null;

        set({
          accessToken,
          refreshToken,
          user,
          isInitialized: true,
        });
      } catch {
        set({ isInitialized: true });
      }
    },

    login: async (emailOrPhone: string, password: string) => {
      set({ isLoading: true });
      try {
        const response = await apiLogin({ emailOrPhone, password });

        const { accessToken, refreshToken, user } = response.data;

        await Promise.all([
          AsyncStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken),
          AsyncStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken),
          AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user)),
        ]);

        set({
          accessToken,
          refreshToken,
          user,
          isLoading: false,
        });
      } catch (error) {
        set({ isLoading: false });
        throw error;
      }
    },

    logout: async () => {
      const { refreshToken } = get();
      try {
        if (refreshToken) {
          await apiLogout(refreshToken);
        }
      } catch {
        // Proceed with local logout even if API call fails
      }
      get().clearSession();
    },

    clearSession: () => {
      AsyncStorage.multiRemove([
        STORAGE_KEYS.ACCESS_TOKEN,
        STORAGE_KEYS.REFRESH_TOKEN,
        STORAGE_KEYS.USER,
      ]);
      set({
        user: null,
        accessToken: null,
        refreshToken: null,
      });
    },
  };
});
