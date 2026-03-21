import React, { useState, useCallback, useMemo, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  I18nContext, Locale, translations, detectLocale,
  interpolate, getNestedValue, STORAGE_KEY,
} from './index';
import type { TranslationKey } from './index';

interface Props {
  children: React.ReactNode;
}

export default function I18nProvider({ children }: Props) {
  const [locale, setLocaleState] = useState<Locale>(detectLocale());
  const [loaded, setLoaded] = useState(false);

  // Load saved locale on mount
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (saved && saved in translations) {
        setLocaleState(saved as Locale);
      }
      setLoaded(true);
    });
  }, []);

  const setLocale = useCallback(async (newLocale: Locale) => {
    setLocaleState(newLocale);
    await AsyncStorage.setItem(STORAGE_KEY, newLocale);
  }, []);

  const t = useCallback(
    (key: TranslationKey, params?: Record<string, string | number>): string => {
      const dict = translations[locale] as Record<string, unknown>;
      const value = getNestedValue(dict, key);
      return interpolate(value, params);
    },
    [locale]
  );

  const ctx = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  // Don't render children until we've loaded the saved locale
  if (!loaded) return null;

  return (
    <I18nContext.Provider value={ctx}>
      {children}
    </I18nContext.Provider>
  );
}
