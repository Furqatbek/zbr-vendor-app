import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AuthUser, AuthTokens, RefreshResponse, Restaurant } from '../types';
import { Platform } from 'react-native';
import * as Application from 'expo-application';
import { configureAuth, login as apiLogin, logout as apiLogout, fetchMyRestaurants, unregisterDeviceToken } from '../services/api';
import { setSecureItem, deleteSecureItem, migrateFromAsyncStorage } from '../utils/secureStorage';
import { useStore } from './index';

// Sensitive credentials — kept in the OS keystore via secureStorage.
const SECURE_KEYS = {
  ACCESS_TOKEN: 'auth_access_token',
  REFRESH_TOKEN: 'auth_refresh_token',
} as const;

// Non-sensitive session data — plain AsyncStorage is fine.
const STORAGE_KEYS = {
  USER: 'auth_user',
  RESTAURANTS: 'auth_restaurants',
  SELECTED_RESTAURANT_ID: 'auth_selected_restaurant_id',
} as const;

interface AuthStore {
  user: AuthUser | null;
  restaurants: Restaurant[];
  restaurant: Restaurant | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  isInitialized: boolean;

  initialize: () => Promise<void>;
  login: (emailOrPhone: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  clearSession: () => void;
  loadRestaurants: () => Promise<void>;
  selectRestaurant: (id: number) => void;
}

export const useAuthStore = create<AuthStore>((set, get) => {
  configureAuth({
    getAccessToken: () => get().accessToken,
    getRefreshToken: () => get().refreshToken,
    onTokenRefreshed: async (data: RefreshResponse['data']) => {
      // The backend does NOT rotate the refresh token — /refresh returns a new
      // access token and the same (or omitted) refresh token. Keep the existing
      // one if the response doesn't carry a new value, so we never null it out.
      const nextRefresh = data.refreshToken ?? get().refreshToken;
      set({
        accessToken: data.accessToken,
        ...(nextRefresh ? { refreshToken: nextRefresh } : {}),
      });
      try {
        const writes = [setSecureItem(SECURE_KEYS.ACCESS_TOKEN, data.accessToken)];
        if (nextRefresh) writes.push(setSecureItem(SECURE_KEYS.REFRESH_TOKEN, nextRefresh));
        await Promise.all(writes);
      } catch {
        // Non-fatal: in-memory tokens remain valid for this session
      }
    },
    onSessionExpired: () => {
      get().clearSession();
    },
  });

  function applyRestaurant(restaurant: Restaurant | null) {
    set({ restaurant });
    if (restaurant) {
      useStore.getState().setOpen(restaurant.isOpen);
    }
  }

  return {
    user: null,
    restaurants: [],
    restaurant: null,
    accessToken: null,
    refreshToken: null,
    isLoading: false,
    isInitialized: false,

    initialize: async () => {
      try {
        const [accessToken, refreshToken, userJson, restaurantsJson, selectedIdStr] = await Promise.all([
          // migrateFromAsyncStorage moves any pre-existing plaintext token into
          // secure storage on first launch after upgrade, then reads it back.
          migrateFromAsyncStorage(SECURE_KEYS.ACCESS_TOKEN),
          migrateFromAsyncStorage(SECURE_KEYS.REFRESH_TOKEN),
          AsyncStorage.getItem(STORAGE_KEYS.USER),
          AsyncStorage.getItem(STORAGE_KEYS.RESTAURANTS),
          AsyncStorage.getItem(STORAGE_KEYS.SELECTED_RESTAURANT_ID),
        ]);

        const user = userJson ? JSON.parse(userJson) : null;
        const restaurants: Restaurant[] = restaurantsJson ? JSON.parse(restaurantsJson) : [];
        const selectedId = selectedIdStr ? Number(selectedIdStr) : null;
        const restaurant = restaurants.find((r) => r.id === selectedId) ?? restaurants[0] ?? null;

        set({ accessToken, refreshToken, user, restaurants, isInitialized: true });
        applyRestaurant(restaurant);

        if (accessToken && user) {
          get().loadRestaurants();
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
          setSecureItem(SECURE_KEYS.ACCESS_TOKEN, accessToken),
          setSecureItem(SECURE_KEYS.REFRESH_TOKEN, refreshToken),
          AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user)),
        ]);

        set({ accessToken, refreshToken, user, isLoading: false });

        await get().loadRestaurants();
      } catch (error) {
        set({ isLoading: false });
        throw error;
      }
    },

    loadRestaurants: async () => {
      try {
        const response = await fetchMyRestaurants();
        const restaurants = response.data ?? [];
        const { restaurant: current } = get();
        const selectedId = current?.id;
        const restaurant = restaurants.find((r) => r.id === selectedId) ?? restaurants[0] ?? null;

        set({ restaurants });
        applyRestaurant(restaurant);

        await AsyncStorage.setItem(STORAGE_KEYS.RESTAURANTS, JSON.stringify(restaurants));
        if (restaurant) {
          await AsyncStorage.setItem(STORAGE_KEYS.SELECTED_RESTAURANT_ID, String(restaurant.id));
        }
      } catch {
        // Non-fatal
      }
    },

    selectRestaurant: (id: number) => {
      const { restaurants } = get();
      const restaurant = restaurants.find((r) => r.id === id) ?? null;
      applyRestaurant(restaurant);
      if (restaurant) {
        AsyncStorage.setItem(STORAGE_KEYS.SELECTED_RESTAURANT_ID, String(restaurant.id));
      }
    },

    logout: async () => {
      const { refreshToken } = get();
      // Unregister device token so backend stops sending push notifications
      try {
        const deviceId = Platform.OS === 'android'
          ? (Application.getAndroidId() ?? 'android-unknown')
          : (Application.applicationId ?? 'ios-unknown');
        await unregisterDeviceToken(deviceId);
      } catch {
        // Non-fatal
      }
      try {
        if (refreshToken) {
          await apiLogout(refreshToken);
        }
      } catch {
        // Proceed with local logout even if API call fails
      }
      useStore.getState().setPushToken(null);
      get().clearSession();
    },

    clearSession: () => {
      // Fire-and-forget clears; in-memory state is nulled synchronously below.
      deleteSecureItem(SECURE_KEYS.ACCESS_TOKEN);
      deleteSecureItem(SECURE_KEYS.REFRESH_TOKEN);
      AsyncStorage.multiRemove([
        STORAGE_KEYS.USER,
        STORAGE_KEYS.RESTAURANTS,
        STORAGE_KEYS.SELECTED_RESTAURANT_ID,
      ]);
      set({
        user: null,
        restaurants: [],
        restaurant: null,
        accessToken: null,
        refreshToken: null,
      });
    },
  };
});
