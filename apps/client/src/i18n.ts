import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en.json';
import zh from './locales/zh.json';
import ja from './locales/ja.json';
import id from './locales/id.json';

const SETTINGS_KEY = 'xplorer:settings';

const xplorerSettingsDetector = {
  name: 'xplorerSettings',
  lookup(): string | undefined {
    try {
      const saved = localStorage.getItem(SETTINGS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.language) return parsed.language;
      }
    } catch {
      /* ignore */
    }
    return undefined;
  },
  cacheUserLanguage(lng: string): void {
    try {
      const saved = localStorage.getItem(SETTINGS_KEY);
      const settings = saved ? JSON.parse(saved) : {};
      settings.language = lng;
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      /* ignore */
    }
  },
};

const languageDetector = new LanguageDetector();
languageDetector.addDetector(xplorerSettingsDetector);

i18n
  .use(languageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      zh: { translation: zh },
      ja: { translation: ja },
      id: { translation: id },
    },
    fallbackLng: 'en',
    detection: {
      order: ['xplorerSettings', 'navigator'],
      caches: ['xplorerSettings'],
    },
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
