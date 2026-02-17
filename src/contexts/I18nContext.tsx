
import React, { createContext, useState, useContext, ReactNode, useCallback, useEffect } from 'react';

// Import JSON files directly. The bundler will handle including them.
import enUSTranslations from '../locales/en-US.json';
import ptBRTranslations from '../locales/pt-BR.json';
import frFRTranslations from '../locales/fr-FR.json';
import itITTranslations from '../locales/it-IT.json';
import zhCNTranslations from '../locales/zh-CN.json';
import jaJPTranslations from '../locales/ja-JP.json';
import ruRUTranslations from '../locales/ru-RU.json';
import ukUATranslations from '../locales/uk-UA.json';
import plPLTranslations from '../locales/pl-PL.json';
import esESTranslations from '../locales/es-ES.json';

export type Language = 'en-US' | 'pt-BR' | 'fr-FR' | 'it-IT' | 'zh-CN' | 'ja-JP' | 'ru-RU' | 'uk-UA' | 'pl-PL' | 'es-ES';

interface I18nContextType {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string, replacements?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

// A map to hold all our translations, keyed by language code.
const translationsMap = {
  'en-US': enUSTranslations,
  'pt-BR': ptBRTranslations,
  'fr-FR': frFRTranslations,
  'it-IT': itITTranslations,
  'zh-CN': zhCNTranslations,
  'ja-JP': jaJPTranslations,
  'ru-RU': ruRUTranslations,
  'uk-UA': ukUATranslations,
  'pl-PL': plPLTranslations,
  'es-ES': esESTranslations,
};

const getNestedTranslation = (translations: any, key: string): string | undefined => {
  return key.split('.').reduce((obj, k) => (obj && obj[k] !== undefined ? obj[k] : undefined), translations);
};

const getInitialLanguage = (): Language => {
  const savedLanguage = localStorage.getItem('app_language') as Language | null;
  if (savedLanguage && ['en-US', 'pt-BR', 'fr-FR', 'it-IT', 'zh-CN', 'ja-JP', 'ru-RU', 'uk-UA', 'pl-PL', 'es-ES'].includes(savedLanguage)) {
    return savedLanguage;
  }
  const browserLang = navigator.language;
  if (browserLang.startsWith('fr')) return 'fr-FR';
  if (browserLang.startsWith('pt')) return 'pt-BR';
  if (browserLang.startsWith('it')) return 'it-IT';
  if (browserLang.startsWith('zh')) return 'zh-CN';
  if (browserLang.startsWith('ja')) return 'ja-JP';
  if (browserLang.startsWith('ru')) return 'ru-RU';
  if (browserLang.startsWith('uk')) return 'uk-UA';
  if (browserLang.startsWith('pl')) return 'pl-PL';
  if (browserLang.startsWith('es')) return 'es-ES';
  return 'en-US';
}

export const I18nProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(getInitialLanguage());

  useEffect(() => {
    const loadSavedLanguage = async () => {
      try {
        if ((window as any).electronAPI) {
          const settings = await (window as any).electronAPI.loadSettings();
          if (settings.language && ['en-US', 'pt-BR', 'fr-FR', 'it-IT', 'zh-CN', 'ja-JP', 'ru-RU', 'uk-UA', 'pl-PL', 'es-ES'].includes(settings.language)) {
            setLanguageState(settings.language as Language);
          }
        }
      } catch (error) {
        console.error('Error loading language setting:', error);
      }
    };
    loadSavedLanguage();
  }, []);

  const setLanguage = (newLanguage: Language) => {
    localStorage.setItem('app_language', newLanguage);
    setLanguageState(newLanguage);
  };

  const t = useCallback((key: string, replacements?: Record<string, string | number>): string => {
    const currentTranslations = translationsMap[language];
    const fallbackTranslations = translationsMap['en-US'];

    let translation = getNestedTranslation(currentTranslations, key);

    // If translation is not found in the current language, try the English fallback
    if (translation === undefined) {
      translation = getNestedTranslation(fallbackTranslations, key);
    }

    if (translation === undefined) {
      console.warn(`Translation key not found in "${language}" or fallback "en-US": "${key}"`);
      return key;
    }

    if (replacements) {
      Object.keys(replacements).forEach(placeholder => {
        translation = translation!.replace(`{${placeholder}}`, String(replacements[placeholder]));
      });
    }

    return translation!;
  }, [language]);

  // Since we're importing JSON directly, there's no loading state. The app can render immediately.
  return (
    <I18nContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = (): I18nContextType => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
};
