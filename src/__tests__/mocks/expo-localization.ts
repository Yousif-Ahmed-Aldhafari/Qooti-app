export type MockLocale = {
  languageTag: string;
  languageCode: string | null;
  textDirection: 'ltr' | 'rtl';
  regionCode?: string | null;
  measurementSystem?: 'metric' | 'us' | 'uk' | null;
};

let currentLocales: MockLocale[] = [
  {
    languageTag: 'en-US',
    languageCode: 'en',
    textDirection: 'ltr',
    regionCode: 'US',
    measurementSystem: 'metric',
  },
];

export function setMockLocales(locales: MockLocale[]) {
  currentLocales = locales;
}

export function resetMockLocales() {
  currentLocales = [
    {
      languageTag: 'en-US',
      languageCode: 'en',
      textDirection: 'ltr',
      regionCode: 'US',
      measurementSystem: 'metric',
    },
  ];
}

export const getLocales = (): MockLocale[] => currentLocales;
export const useLocales = (): MockLocale[] => currentLocales;
export const getCalendars = () => [{ calendar: 'gregory', timeZone: 'UTC', uses24hourClock: true, firstWeekday: 1 }];
export const useCalendars = () => [{ calendar: 'gregory', timeZone: 'UTC', uses24hourClock: true, firstWeekday: 1 }];
