import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AuthUser, AuthTokens, RefreshResponse, Restaurant } from '../types';
import { configureAuth, login as apiLogin, logout as apiLogout, fetchMyRestaurants } from '../services/api';
import { useStore } from './index';

const STORAGE_KEYS = {
  ACCESS_TOKEN: 'auth_access_token',
  REFRESH_TOKEN: 'auth_refresh_token',
  USER: 'auth_user',
  RESTAURANT: 'auth_restaurant',
} as const;

interface AuthStore {
  user: AuthUser | null;
  restaurant: Restaurant | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  isInitialized: boolean;

  initialize: () => Promise<void>;
  login: (emailOrPhone: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  clearSession: () => void;
  loadRestaurant: () => Promise<void>;
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
    restaurant: null,
    accessToken: null,
    refreshToken: null,
    isLoading: false,
    isInitialized: false,

    initialize: async () => {
      try {
        const [accessToken, refreshToken, userJson, restaurantJson] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN),
          AsyncStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN),
          AsyncStorage.getItem(STORAGE_KEYS.USER),
          AsyncStorage.getItem(STORAGE_KEYS.RESTAURANT),
        ]);

        const user = userJson ? JSON.parse(userJson) : null;
        const restaurant: Restaurant | null = restaurantJson ? JSON.parse(restaurantJson) : null;

        set({
          accessToken,
          refreshToken,
          user,
          restaurant,
          isInitialized: true,
        });

        if (restaurant) {
          useStore.getState().setOpen(restaurant.isOpen);
        }

        // Refresh restaurant data from API if logged in
        if (accessToken && user) {
          get().loadRestaurant();
        }
      } catch {
        set({ isInitialized: true });
      }
    },

    login: async (emailOrPhone: string, password: string) => {
      set({ isLoading: true });
      try {
        const response = await apiLogin({ emailOrPhone, password });

        const { accessToken, refreshToken, userId, email, fullName, roles } = response.data;
        const user: AuthUser = { id: userId, email, fullName, roles };

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

        // Fetch restaurant data after login
        await get().loadRestaurant();
      } catch (error) {
        set({ isLoading: false });
        throw error;
      }
    },

    loadRestaurant: async () => {
      try {
        const response = await fetchMyRestaurants();
        const restaurant = response.data?.[0] ?? null;

        set({ restaurant });

        if (restaurant) {
          await AsyncStorage.setItem(STORAGE_KEYS.RESTAURANT, JSON.stringify(restaurant));
          useStore.getState().setOpen(restaurant.isOpen);
        }
      } catch {
        // Non-fatal — restaurant data will be missing but app still works
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
        STORAGE_KEYS.RESTAURANT,
      ]);
      set({
        user: null,
        restaurant: null,
        accessToken: null,
        refreshToken: null,
      });
    },
  };
});
