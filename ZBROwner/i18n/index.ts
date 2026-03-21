import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';
import en from './en';
import ru from './ru';
import uzLatn from './uz-Latn';
import uzCyrl from './uz-Cyrl';

export type Locale = 'en' | 'ru' | 'uz-Latn' | 'uz-Cyrl';

export const LOCALE_NAMES: Record<Locale, string> = {
  en: 'English',
  ru: 'Русский',
  'uz-Latn': 'O\'zbekcha',
  'uz-Cyrl': 'Ўзбекча',
};

const translations: Record<Locale, typeof en> = {
  en,
  ru: ru as unknown as typeof en,
  'uz-Latn': uzLatn as unknown as typeof en,
  'uz-Cyrl': uzCyrl as unknown as typeof en,
};

const STORAGE_KEY = '@zbr_owner_locale';

// Detect the best matching locale from device settings
function detectLocale(): Locale {
  const locales = Localization.getLocales();
  if (!locales || locales.length === 0) return 'en';

  for (const loc of locales) {
    const tag = loc.languageTag;
    // Exact matches
    if (tag === 'uz-Cyrl' || tag === 'uz-Cyrl-UZ') return 'uz-Cyrl';
    if (tag === 'uz-Latn' || tag === 'uz-Latn-UZ' || tag.startsWith('uz')) return 'uz-Latn';
    if (tag.startsWith('ru')) return 'ru';
    if (tag.startsWith('en')) return 'en';
  }

  return 'en';
}

// Simple template interpolation: replaces {{key}} with values
function interpolate(text: string, params?: Record<string, string | number>): string {
  if (!params) return text;
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => String(params[key] ?? `{{${key}}}`));
}

// Deep get a nested key like "orders.revenue"
type DeepKeys<T, Prefix extends string = ''> = T extends Record<string, unknown>
  ? {
      [K in keyof T & string]: T[K] extends Record<string, unknown>
        ? DeepKeys<T[K], `${Prefix}${K}.`>
        : `${Prefix}${K}`;
    }[keyof T & string]
  : never;

type TranslationKey = DeepKeys<typeof en>;

function getNestedValue(obj: Record<string, unknown>, path: string): string {
  const keys = path.split('.');
  let current: unknown = obj;
  for (const key of keys) {
    if (current && typeof current === 'object' && key in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[key];
    } else {
      return path; // fallback to key
    }
  }
  return typeof current === 'string' ? current : path;
}

// --- Context & Hook ---

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => Promise<void>;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}

export const I18nContext = createContext<I18nContextType>({
  locale: 'en',
  setLocale: async () => {},
  t: (key) => key,
});

export function useI18n() {
  return useContext(I18nContext);
}

// Shorthand for just the t function
export function useT() {
  return useContext(I18nContext).t;
}

// --- Provider helpers ---

export { translations, detectLocale, interpolate, getNestedValue, STORAGE_KEY };
export type { TranslationKey };
