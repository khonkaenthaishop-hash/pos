'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { t as translate, type AppLang } from './translations';
import { settingsApi } from '@/lib/api';

type Ctx = {
  lang: AppLang;
  setLang: (lang: AppLang) => void;
  toggleLang: () => void;
  t: (key: string) => string;
};

const LanguageContext = createContext<Ctx | null>(null);

const STORAGE_KEY = 'pos_lang';

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<AppLang>('th');

  useEffect(() => {
    // 1) localStorage (user override)
    const stored =
      typeof window !== 'undefined' ? (localStorage.getItem(STORAGE_KEY) as AppLang | null) : null;
    if (stored === 'th' || stored === 'zh_TW') {
      setLangState(stored);
      return;
    }

    // 2) settings.general.language (store default)
    settingsApi
      .get('general')
      .then((res) => {
        const v = (res.data as { language?: unknown } | undefined)?.language;
        if (v === 'zh_TW') setLangState('zh_TW');
        else setLangState('th');
      })
      .catch(() => {
        // ignore
      });
  }, []);

  const setLang = useCallback((next: AppLang) => {
    setLangState(next);
    if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, next);
  }, []);

  const toggleLang = useCallback(() => {
    setLangState((prev) => {
      const next = prev === 'th' ? 'zh_TW' : 'th';
      if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  }, []);

  const t = useCallback((key: string) => translate(lang, key), [lang]);

  const value = useMemo<Ctx>(() => ({ lang, setLang, toggleLang, t }), [lang, setLang, toggleLang, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): Ctx {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}
