import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
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

  // Load saved locale on mount.
  //
  // This gate renders null until the read finishes, so ANY failure here is a
  // permanent blank white screen — no spinner, no error, nothing, because this
  // provider sits above the auth splash. The original had no .catch(), so a
  // rejected read left `loaded` false forever.
  //
  // Two guards: reject and settle anyway, and a deadline in case the promise
  // never settles at all. Showing the device-detected locale for a moment is
  // always better than showing nothing for good.
  useEffect(() => {
    let done = false;
    const settle = () => {
      if (!done) {
        done = true;
        setLoaded(true);
      }
    };

    const deadline = setTimeout(settle, 1500);

    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (saved && saved in translations) {
          setLocaleState(saved as Locale);
        }
      })
      .catch((e) => {
        // console.error survives the release console strip (see babel.config.js).
        console.error('[i18n] could not read the saved locale', e);
      })
      .finally(() => {
        clearTimeout(deadline);
        settle();
      });

    return () => clearTimeout(deadline);
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

  // Don't render children until we've loaded the saved locale. Rendering a real
  // View in the app's own background colour, rather than null, means the tree is
  // never empty — and it now resolves within 1.5s in the worst case.
  if (!loaded) return <View style={styles.gate} />;

  return (
    <I18nContext.Provider value={ctx}>
      {children}
    </I18nContext.Provider>
  );
}

const styles = StyleSheet.create({
  gate: { flex: 1, backgroundColor: '#FFFFFF' },
});
