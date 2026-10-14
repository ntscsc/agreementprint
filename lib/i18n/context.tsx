'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { en, TranslationDictionary } from './en';
import { ta } from './ta';

type Language = 'en' | 'ta';

interface I18nContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: TranslationDictionary;
}

const I18nContext = createContext<I18nContextType | null>(null);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Language>('en');

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const saved = localStorage.getItem('tn_stamp_lang') as Language;
        if (saved === 'ta' || saved === 'en') {
          setLangState(saved);
          document.documentElement.lang = saved;
        }
      } catch {
        // Fallback
      }
    }, 0);

    const handler = () => {
      try {
        const saved = localStorage.getItem('tn_stamp_lang') as Language;
        if (saved === 'ta' || saved === 'en') {
          setLangState(saved);
          document.documentElement.lang = saved;
        }
      } catch {
        // Fallback
      }
    };

    window.addEventListener('storage', handler);
    window.addEventListener('tn_lang_change', handler);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('storage', handler);
      window.removeEventListener('tn_lang_change', handler);
    };
  }, []);

  const setLang = (newLang: Language) => {
    setLangState(newLang);
    try {
      localStorage.setItem('tn_stamp_lang', newLang);
      document.documentElement.lang = newLang;
      window.dispatchEvent(new Event('tn_lang_change'));
    } catch {
      // Fallback
    }
  };

  const t = lang === 'ta' ? ta : en;

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = () => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
};
