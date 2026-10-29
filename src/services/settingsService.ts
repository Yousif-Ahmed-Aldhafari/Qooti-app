import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../constants/storageKeys';
import { getOptionalJson, setJson } from './storageService';
import type { Settings } from '../models/settings';

const LEGACY_KEYS = {
  language: '@qooti/language',
  onboarding: '@qooti/hasOnboarded',
  themePreference: '@qooti/themePreference',
  legacyTheme: '@qooti/themeMode',
};

export const defaultSettings: Settings = {
  selectedLanguage: 'en',
  themeMode: 'system',
  measurementUnits: 'metric',
  hasCompletedOnboarding: false,
  isAuthenticated: false,
};

export async function loadSettings(): Promise<Settings | null> {
  const settings = await getOptionalJson<Settings>(STORAGE_KEYS.settings);
  if (settings) {
    return settings;
  }

  // Migrate legacy individual storage keys if they exist
  try {
    const [savedLanguage, savedOnboarding, savedThemePreference, legacyThemeMode] = await Promise.all([
      AsyncStorage.getItem(LEGACY_KEYS.language),
      AsyncStorage.getItem(LEGACY_KEYS.onboarding),
      AsyncStorage.getItem(LEGACY_KEYS.themePreference),
      AsyncStorage.getItem(LEGACY_KEYS.legacyTheme),
    ]);

    if (savedLanguage || savedOnboarding || savedThemePreference || legacyThemeMode) {
      const language = savedLanguage === 'ar' ? 'ar' : 'en';
      const theme = savedThemePreference ?? legacyThemeMode;
      const themeMode = theme === 'light' || theme === 'dark' || theme === 'system' ? theme : 'system';
      return {
        ...defaultSettings,
        selectedLanguage: language,
        hasCompletedOnboarding: savedOnboarding === 'true',
        themeMode,
      };
    }
  } catch {
    // Ignore migration error
  }

  return null;
}

export async function saveSettings(settings: Settings): Promise<void> {
  await setJson(STORAGE_KEYS.settings, settings);
  // Also sync legacy keys for backwards compatibility
  try {
    await Promise.all([
      AsyncStorage.setItem(LEGACY_KEYS.language, settings.selectedLanguage),
      AsyncStorage.setItem(LEGACY_KEYS.onboarding, String(settings.hasCompletedOnboarding)),
      AsyncStorage.setItem(LEGACY_KEYS.themePreference, settings.themeMode),
    ]);
  } catch {
    // Ignore legacy sync error
  }
}
