import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import dayjs from 'dayjs';
import 'dayjs/locale/es';
import 'dayjs/locale/en';
import esAntd from 'antd/locale/es_ES';
import enAntd from 'antd/locale/en_US';
import type { Locale } from 'antd/es/locale';
import { es } from './es';
import { en } from './en';

export const SUPPORTED_LANGUAGES = ['es', 'en'] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

export const LANGUAGE_LABELS: Record<Language, string> = {
  es: 'Español',
  en: 'English',
};

/** Ant Design's own strings (pagination, table filters, empty states, Popconfirm). */
export const ANTD_LOCALES: Record<Language, Locale> = {
  es: esAntd,
  en: enAntd,
};

const STORAGE_KEY = 'palomero_admin_lang';

function initialLanguage(): Language {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && (SUPPORTED_LANGUAGES as readonly string[]).includes(stored)) {
      return stored as Language;
    }
  } catch {
    // Private mode / blocked storage — fall through to the default.
  }
  // Spanish is the default: it's the product's primary language, not a browser guess.
  return 'es';
}

i18n.use(initReactI18next).init({
  resources: {
    es: { translation: es },
    en: { translation: en },
  },
  lng: initialLanguage(),
  fallbackLng: 'es',
  interpolation: { escapeValue: false },
});

dayjs.locale(i18n.language);

export function setLanguage(lang: Language) {
  i18n.changeLanguage(lang);
  dayjs.locale(lang);
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // Preference just won't persist; the app still switches for this session.
  }
}

export default i18n;
