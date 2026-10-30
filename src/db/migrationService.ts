import AsyncStorage from '@react-native-async-storage/async-storage';
import { IDatabase, MigrationSummary } from './types';
import { SQLiteMealRepository } from './repositories/mealRepository';
import { SQLiteWorkoutRepository } from './repositories/workoutRepository';
import { SQLiteProfileRepository } from './repositories/profileRepository';
import { SQLiteProgressRepository } from './repositories/progressRepository';
import { SQLiteSettingsRepository } from './repositories/settingsRepository';
import { Meal, normalizeMeal } from '../models/meal';
import { Workout, normalizeWorkout } from '../models/workout';
import { UserProfile, normalizeProfile } from '../models/profile';
import { ProgressEntry, normalizeProgressEntry } from '../models/progress';
import { Settings } from '../models/settings';

export const MIGRATION_FLAG_KEY = 'async_storage_migrated_v1';

const ASYNC_KEYS = {
  MEALS: '@qooti/meals',
  WORKOUTS: '@qooti/workouts',
  PROFILE: '@qooti/profile',
  PROGRESS: '@qooti/progress',
  SETTINGS: '@qooti/settings',
};

/**
 * Checks whether the one-time migration from AsyncStorage has already occurred.
 */
export async function isAsyncStorageMigrated(db: IDatabase): Promise<boolean> {
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM migration_meta WHERE key = ?;',
    MIGRATION_FLAG_KEY
  );
  return row?.value === 'true';
}

/**
 * Safely migrates existing records from AsyncStorage to SQLite.
 *
 * Guarantees:
 * 1. Idempotent: checks migration flag; if already migrated, returns immediately.
 * 2. Non-destructive: preserves original AsyncStorage records intact for recovery.
 * 3. Transactional & retry-safe: writes occur inside a transaction. An interruption or failure
 *    rolls back completely, allowing a clean retry without data loss or duplication.
 * 4. Error distinction: distinguishes between missing data, malformed data, and storage read failures.
 *    Storage read failures abort without marking complete.
 */
export async function migrateFromAsyncStorage(db: IDatabase): Promise<MigrationSummary> {
  const alreadyMigrated = await isAsyncStorageMigrated(db);
  if (alreadyMigrated) {
    return {
      alreadyMigrated: true,
      migratedMeals: 0,
      migratedWorkouts: 0,
      migratedProfile: false,
      migratedProgressEntries: 0,
      migratedSettings: false,
    };
  }

  // 1. Read existing data from AsyncStorage safely
  // If an AsyncStorage read throws, we DO NOT swallow it as empty data.
  let rawMealsJson: string | null = null;
  let rawWorkoutsJson: string | null = null;
  let rawProfileJson: string | null = null;
  let rawProgressJson: string | null = null;
  let rawSettingsJson: string | null = null;

  try {
    rawMealsJson = await AsyncStorage.getItem(ASYNC_KEYS.MEALS);
    rawWorkoutsJson = await AsyncStorage.getItem(ASYNC_KEYS.WORKOUTS);
    rawProfileJson = await AsyncStorage.getItem(ASYNC_KEYS.PROFILE);
    rawProgressJson = await AsyncStorage.getItem(ASYNC_KEYS.PROGRESS);
    rawSettingsJson = await AsyncStorage.getItem(ASYNC_KEYS.SETTINGS);
  } catch (error) {
    console.error('[migrationService] AsyncStorage read failure, aborting migration:', error);
    throw new Error(`AsyncStorage read failure during migration: ${error instanceof Error ? error.message : String(error)}`);
  }

  // 2. Parse and normalize meals
  const validMeals: Meal[] = [];
  if (rawMealsJson) {
    try {
      const parsed = JSON.parse(rawMealsJson);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item && typeof item === 'object') {
            try {
              validMeals.push(normalizeMeal(item));
            } catch (err) {
              console.warn('[migrationService] Skipping corrupted meal record:', item, err);
            }
          }
        }
      }
    } catch (parseError) {
      console.warn('[migrationService] Malformed JSON in @qooti/meals, skipping invalid entries:', parseError);
    }
  }

  // 3. Parse and normalize workouts
  const validWorkouts: Workout[] = [];
  if (rawWorkoutsJson) {
    try {
      const parsed = JSON.parse(rawWorkoutsJson);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item && typeof item === 'object') {
            try {
              validWorkouts.push(normalizeWorkout(item));
            } catch (err) {
              console.warn('[migrationService] Skipping corrupted workout record:', item, err);
            }
          }
        }
      }
    } catch (parseError) {
      console.warn('[migrationService] Malformed JSON in @qooti/workouts, skipping invalid entries:', parseError);
    }
  }

  // 4. Parse and normalize profile
  let validProfile: UserProfile | null = null;
  if (rawProfileJson) {
    try {
      const parsed = JSON.parse(rawProfileJson);
      if (parsed && typeof parsed === 'object') {
        validProfile = normalizeProfile(parsed);
      }
    } catch (parseError) {
      console.warn('[migrationService] Malformed JSON in @qooti/profile:', parseError);
    }
  }

  // 5. Parse and normalize progress
  const validProgress: ProgressEntry[] = [];
  if (rawProgressJson) {
    try {
      const parsed = JSON.parse(rawProgressJson);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item && typeof item === 'object') {
            try {
              validProgress.push(normalizeProgressEntry(item));
            } catch (err) {
              console.warn('[migrationService] Skipping corrupted progress entry:', item, err);
            }
          }
        }
      }
    } catch (parseError) {
      console.warn('[migrationService] Malformed JSON in @qooti/progress:', parseError);
    }
  }

  // 6. Parse and normalize settings
  let validSettings: Settings | null = null;
  if (rawSettingsJson) {
    try {
      const parsed = JSON.parse(rawSettingsJson);
      if (parsed && typeof parsed === 'object') {
        validSettings = parsed as Settings;
      }
    } catch (parseError) {
      console.warn('[migrationService] Malformed JSON in @qooti/settings:', parseError);
    }
  }

  // 7. Write to SQLite in a single transaction
  const mealRepo = new SQLiteMealRepository(db);
  const workoutRepo = new SQLiteWorkoutRepository(db);
  const profileRepo = new SQLiteProfileRepository(db);
  const progressRepo = new SQLiteProgressRepository(db);
  const settingsRepo = new SQLiteSettingsRepository(db);

  await db.withTransactionAsync(async () => {
    // Migrate meals
    for (const meal of validMeals) {
      await mealRepo.insertMeal(meal);
    }

    // Migrate workouts
    for (const workout of validWorkouts) {
      await workoutRepo.insertWorkout(workout);
    }

    // Migrate profile
    if (validProfile) {
      await profileRepo.saveProfile(validProfile);
    }

    // Migrate progress
    if (validProgress.length > 0) {
      await progressRepo.saveAllProgress(validProgress);
    }

    // Migrate settings
    if (validSettings) {
      await settingsRepo.saveSettings(validSettings);
    }

    // Record migration completion inside the transaction
    const now = new Date().toISOString();
    await db.runAsync(
      `INSERT INTO migration_meta (key, value, updated_at)
       VALUES (?, 'true', ?)
       ON CONFLICT(key) DO UPDATE SET value = 'true', updated_at = excluded.updated_at;`,
      MIGRATION_FLAG_KEY,
      now
    );
  });

  return {
    alreadyMigrated: false,
    migratedMeals: validMeals.length,
    migratedWorkouts: validWorkouts.length,
    migratedProfile: validProfile !== null,
    migratedProgressEntries: validProgress.length,
    migratedSettings: validSettings !== null,
  };
}
