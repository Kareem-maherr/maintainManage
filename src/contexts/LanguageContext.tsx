import React, { createContext, useContext, useState, useCallback } from 'react';
import enTranslations from '../translations/en.json';
import arTranslations from '../translations/ar.json';

const translate = (translations: any, key: string) => {
  const keys = key.split('.');
  let value: any = translations;

  for (const k of keys) {
    value = value?.[k];
    if (!value) break;
  }

  return value || key;
};

interface LanguageContextType {
  isArabic: boolean;
  toggleLanguage: () => void;
  t: (key: string) => string;
  tEn: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isArabic, setIsArabic] = useState(false);

  const toggleLanguage = () => {
    setIsArabic((prev) => !prev);
    document.documentElement.dir = !isArabic ? 'rtl' : 'ltr';
    document.documentElement.lang = !isArabic ? 'ar' : 'en';
  };

  const t = useCallback((key: string) => {
    const translations = isArabic ? arTranslations : enTranslations;
    return translate(translations, key);
  }, [isArabic]);

  const tEn = useCallback((key: string) => {
    return translate(enTranslations, key);
  }, []);

  return (
    <LanguageContext.Provider value={{ isArabic, toggleLanguage, t, tEn }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
