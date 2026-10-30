import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Settings } from '../models/settings';
import { getDatabase } from '../db/database';
import { SQLiteSettingsRepository } from '../db/repositories/settingsRepository';

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

export async function getSettingsRepository(): Promise<SQLiteSettingsRepository> {
  const db = await getDatabase();
  return new SQLiteSettingsRepository(db);
}

export async function loadSettings(): Promise<Settings | null> {
  const repo = await getSettingsRepository();
  const settings = await repo.getSettings();

  if (settings !== null) {
    return settings;
  }

  // Migrate legacy individual storage keys if they exist in AsyncStorage
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
    // Ignore migration read error
  }

  return null;
}

export async function saveSettings(settings: Settings): Promise<void> {
  const repo = await getSettingsRepository();
  await repo.saveSettings(settings);

  // Sync native bridge keys for instant restart/RTL reload handling
  try {
    await Promise.all([
      AsyncStorage.setItem(LEGACY_KEYS.language, settings.selectedLanguage),
      AsyncStorage.setItem(LEGACY_KEYS.onboarding, String(settings.hasCompletedOnboarding)),
      AsyncStorage.setItem(LEGACY_KEYS.themePreference, settings.themeMode),
    ]);
  } catch {
    // Ignore bridge sync error
  }
}
