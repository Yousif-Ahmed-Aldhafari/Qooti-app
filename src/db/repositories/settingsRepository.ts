import { IDatabase, SettingsRepository } from '../types';
import { Settings, Language, ThemeMode, MeasurementUnits } from '../../models/settings';

interface SettingsRow {
  id: string;
  selected_language: Language;
  theme_mode: ThemeMode;
  measurement_units: MeasurementUnits;
  has_completed_onboarding: number;
  is_authenticated: number;
  updated_at: string;
}

export class SQLiteSettingsRepository implements SettingsRepository {
  constructor(private db: IDatabase) {}

  async getSettings(): Promise<Settings | null> {
    const row = await this.db.getFirstAsync<SettingsRow>(
      "SELECT * FROM app_settings WHERE id = 'settings';"
    );

    if (!row) {
      return null;
    }

    return {
      selectedLanguage: row.selected_language,
      themeMode: row.theme_mode,
      measurementUnits: row.measurement_units,
      hasCompletedOnboarding: row.has_completed_onboarding === 1,
      isAuthenticated: row.is_authenticated === 1,
    };
  }

  async saveSettings(settings: Settings, txn?: IDatabase): Promise<void> {
    const target = txn || this.db;
    const now = new Date().toISOString();

    await target.runAsync(
      `INSERT INTO app_settings (
         id, selected_language, theme_mode, measurement_units,
         has_completed_onboarding, is_authenticated, updated_at
       ) VALUES ('settings', ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         selected_language = excluded.selected_language,
         theme_mode = excluded.theme_mode,
         measurement_units = excluded.measurement_units,
         has_completed_onboarding = excluded.has_completed_onboarding,
         is_authenticated = excluded.is_authenticated,
         updated_at = excluded.updated_at;`,
      settings.selectedLanguage || 'en',
      settings.themeMode || 'system',
      settings.measurementUnits || 'metric',
      settings.hasCompletedOnboarding ? 1 : 0,
      settings.isAuthenticated ? 1 : 0,
      now
    );
  }
}
