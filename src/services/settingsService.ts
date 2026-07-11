import { STORAGE_KEYS } from '../constants/storageKeys';
import { getOptionalJson, setJson } from './storageService';
import type { Settings } from '../models/settings';

export const defaultSettings: Settings = {
  selectedLanguage: 'en',
  themeMode: 'system',
  measurementUnits: 'metric',
  hasCompletedOnboarding: false,
};

export async function loadSettings(): Promise<Settings | null> {
  return getOptionalJson<Settings>(STORAGE_KEYS.settings);
}

export async function saveSettings(settings: Settings): Promise<void> {
  await setJson(STORAGE_KEYS.settings, settings);
}
