export type Language = 'en' | 'ar';

export type ThemeMode = 'system' | 'light' | 'dark';

export type MeasurementUnits = 'metric' | 'imperial';

export type Settings = {
  selectedLanguage: Language;
  themeMode: ThemeMode;
  measurementUnits: MeasurementUnits;
  hasCompletedOnboarding: boolean;
};
