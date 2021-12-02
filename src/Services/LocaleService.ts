import localesJSON from '../Locales/index.json';

import { ILocales, IAvailableLocales } from '../Typings/Store/locales';

export const fetchLocales = async (): Promise<{ locales: ILocales, availableLocales: IAvailableLocales }> => {
  const availableLocales: IAvailableLocales = localesJSON.availableLanguages;
  const locales = {};

  for (const localeName of Object.values(availableLocales)) {
    const localeJSON = await import(`../Locales/${localeName === 'en-US' ? 'base' : localeName}.json`);
    locales[localeName] = localeJSON;
  }

  return ({ locales, availableLocales });
};
