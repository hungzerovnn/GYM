"use client";

import { Fragment, createContext, useContext, useEffect, useMemo, useState } from "react";
import { getLocaleBundle, localeLabels } from "./messages";
import {
  AppLocale,
  defaultLocale,
  getCurrentLocale,
  isSupportedLocale,
  localeCookieKey,
  localeStorageKey,
  resolveInitialLocale,
  setCurrentLocale,
} from "./runtime";

interface LocaleContextValue {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
  toggleLocale: (locale: AppLocale) => void;
  languageLabel: string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

const persistLocale = (locale: AppLocale) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(localeStorageKey, locale);
  document.cookie = `${localeCookieKey}=${locale}; path=/; max-age=31536000; samesite=lax`;
  document.documentElement.lang = locale;
};

export function LocaleProvider({ children, initialLocale = defaultLocale }: { children: React.ReactNode; initialLocale?: AppLocale }) {
  const [locale, setLocaleState] = useState<AppLocale>(() => {
    const resolvedLocale = resolveInitialLocale(initialLocale);
    setCurrentLocale(resolvedLocale);
    return resolvedLocale;
  });

  if (getCurrentLocale() !== locale) {
    setCurrentLocale(locale);
  }

  useEffect(() => {
    setCurrentLocale(locale);
    persistLocale(locale);
  }, [locale]);

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      setLocale: (nextLocale) => {
        if (!isSupportedLocale(nextLocale) || nextLocale === locale) return;
        setCurrentLocale(nextLocale);
        persistLocale(nextLocale);
        setLocaleState(nextLocale);
      },
      toggleLocale: (nextLocale) => {
        if (!isSupportedLocale(nextLocale) || nextLocale === locale) return;
        setCurrentLocale(nextLocale);
        persistLocale(nextLocale);
        setLocaleState(nextLocale);
      },
      languageLabel: localeLabels[locale],
    }),
    [locale],
  );

  return (
    <LocaleContext.Provider value={value}>
      <Fragment key={locale}>
        {children}
      </Fragment>
    </LocaleContext.Provider>
  );
}

export const useLocale = () => {
  const context = useContext(LocaleContext);
  if (!context) {
    return {
      locale: getCurrentLocale() || defaultLocale,
      setLocale: (_locale: AppLocale) => undefined,
      toggleLocale: (_locale: AppLocale) => undefined,
      languageLabel: getLocaleBundle(getCurrentLocale()).languageLabel,
    };
  }

  return context;
};
