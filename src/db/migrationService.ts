import AsyncStorage from '@react-native-async-storage/async-storage';
import { IDatabase, MigrationSummary, KeyMigrationStatus } from './types';
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

export const ASYNC_KEYS = {
  MEALS: '@qooti/meals',
  WORKOUTS: '@qooti/workouts',
  PROFILE: '@qooti/profile',
  PROGRESS: '@qooti/progress',
  SETTINGS: '@qooti/settings',
};

// Mutex promise to prevent concurrent migration attempts
let migrationInFlight: Promise<MigrationSummary> | null = null;

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
 * Safely and idempotently migrates legacy records from AsyncStorage into SQLite.
 *
 * Safety guarantees:
 * 1. Concurrency safe: serialize concurrent migration calls with a shared in-flight promise.
 * 2. Idempotent: exits immediately with `status: 'skipped_already_migrated'` if already migrated.
 * 3. Non-destructive: legacy AsyncStorage records are preserved untouched as recovery backup.
 * 4. Preserves existing SQLite data: does not overwrite existing SQLite records with older AsyncStorage rows.
 * 5. Atomic: all writes and the completion flag commit in a single exclusive transaction.
 * 6. Explicit error distinction: distinguishes missing keys, empty datasets, malformed JSON,
 *    invalid records, read failures, and write failures. Does not mark complete if required data
 *    could not be safely parsed or read.
 */
export async function migrateFromAsyncStorage(db: IDatabase): Promise<MigrationSummary> {
  if (migrationInFlight) {
    return migrationInFlight;
  }

  migrationInFlight = (async () => {
    try {
      const alreadyMigrated = await isAsyncStorageMigrated(db);
      if (alreadyMigrated) {
        return {
          status: 'skipped_already_migrated',
          alreadyMigrated: true,
          migratedMeals: 0,
          migratedWorkouts: 0,
          migratedProfile: false,
          migratedProgressEntries: 0,
          migratedSettings: false,
          skippedCorruptedRecords: 0,
          details: {
            mealsStatus: 'empty',
            workoutsStatus: 'empty',
            profileStatus: 'empty',
            progressStatus: 'empty',
            settingsStatus: 'empty',
          },
        };
      }

      // Check existing SQLite records to avoid overwriting existing authoritative SQLite data
      const [existingMeals, existingWorkouts, existingProfile, existingProgress, existingSettings] =
        await Promise.all([
          db.getAllAsync<{ id: string }>('SELECT id FROM meals;'),
          db.getAllAsync<{ id: string }>('SELECT id FROM workouts;'),
          db.getFirstAsync('SELECT id FROM user_profiles LIMIT 1;'),
          db.getAllAsync<{ id: string }>('SELECT id FROM progress_entries;'),
          db.getFirstAsync('SELECT id FROM app_settings LIMIT 1;'),
        ]);

      const existingMealIds = new Set(existingMeals.map((m) => m.id));
      const existingWorkoutIds = new Set(existingWorkouts.map((w) => w.id));
      const existingProgressIds = new Set(existingProgress.map((p) => p.id));
      const sqliteHasProfile = existingProfile !== null;
      const sqliteHasSettings = existingSettings !== null;

      const details: MigrationSummary['details'] = {
        mealsStatus: 'missing',
        workoutsStatus: 'missing',
        profileStatus: 'missing',
        progressStatus: 'missing',
        settingsStatus: 'missing',
      };

      let skippedCorruptedRecords = 0;
      let hasMalformedJson = false;

      // 1. Read existing data from AsyncStorage safely
      let rawMealsJson: string | null = null;
      let rawWorkoutsJson: string | null = null;
      let rawProfileJson: string | null = null;
      let rawProgressJson: string | null = null;
      let rawSettingsJson: string | null = null;

      try {
        rawMealsJson = await AsyncStorage.getItem(ASYNC_KEYS.MEALS);
      } catch (err) {
        details.mealsStatus = 'read_error';
        throw new Error(`AsyncStorage read failure on meals: ${err instanceof Error ? err.message : String(err)}`);
      }

      try {
        rawWorkoutsJson = await AsyncStorage.getItem(ASYNC_KEYS.WORKOUTS);
      } catch (err) {
        details.workoutsStatus = 'read_error';
        throw new Error(`AsyncStorage read failure on workouts: ${err instanceof Error ? err.message : String(err)}`);
      }

      try {
        rawProfileJson = await AsyncStorage.getItem(ASYNC_KEYS.PROFILE);
      } catch (err) {
        details.profileStatus = 'read_error';
        throw new Error(`AsyncStorage read failure on profile: ${err instanceof Error ? err.message : String(err)}`);
      }

      try {
        rawProgressJson = await AsyncStorage.getItem(ASYNC_KEYS.PROGRESS);
      } catch (err) {
        details.progressStatus = 'read_error';
        throw new Error(`AsyncStorage read failure on progress: ${err instanceof Error ? err.message : String(err)}`);
      }

      try {
        rawSettingsJson = await AsyncStorage.getItem(ASYNC_KEYS.SETTINGS);
      } catch (err) {
        details.settingsStatus = 'read_error';
        throw new Error(`AsyncStorage read failure on settings: ${err instanceof Error ? err.message : String(err)}`);
      }

      // 2. Parse & validate meals
      const validMeals: Meal[] = [];
      if (rawMealsJson === null) {
        details.mealsStatus = 'missing';
      } else if (rawMealsJson.trim() === '' || rawMealsJson.trim() === '[]') {
        details.mealsStatus = 'empty';
      } else {
        try {
          const parsed = JSON.parse(rawMealsJson);
          if (Array.isArray(parsed)) {
            if (parsed.length === 0) {
              details.mealsStatus = 'empty';
            } else {
              for (const item of parsed) {
                if (item && typeof item === 'object' && item.id) {
                  try {
                    // Only migrate if not already in SQLite
                    if (!existingMealIds.has(item.id)) {
                      validMeals.push(normalizeMeal(item));
                    }
                  } catch {
                    skippedCorruptedRecords++;
                  }
                } else {
                  skippedCorruptedRecords++;
                }
              }
              details.mealsStatus = 'valid';
            }
          } else {
            hasMalformedJson = true;
            details.mealsStatus = 'malformed';
          }
        } catch (err) {
          hasMalformedJson = true;
          details.mealsStatus = 'malformed';
          console.warn('[migrationService] Malformed JSON in @qooti/meals:', err);
        }
      }

      // 3. Parse & validate workouts
      const validWorkouts: Workout[] = [];
      if (rawWorkoutsJson === null) {
        details.workoutsStatus = 'missing';
      } else if (rawWorkoutsJson.trim() === '' || rawWorkoutsJson.trim() === '[]') {
        details.workoutsStatus = 'empty';
      } else {
        try {
          const parsed = JSON.parse(rawWorkoutsJson);
          if (Array.isArray(parsed)) {
            if (parsed.length === 0) {
              details.workoutsStatus = 'empty';
            } else {
              for (const item of parsed) {
                if (item && typeof item === 'object' && item.id) {
                  try {
                    if (!existingWorkoutIds.has(item.id)) {
                      validWorkouts.push(normalizeWorkout(item));
                    }
                  } catch {
                    skippedCorruptedRecords++;
                  }
                } else {
                  skippedCorruptedRecords++;
                }
              }
              details.workoutsStatus = 'valid';
            }
          } else {
            hasMalformedJson = true;
            details.workoutsStatus = 'malformed';
          }
        } catch (err) {
          hasMalformedJson = true;
          details.workoutsStatus = 'malformed';
          console.warn('[migrationService] Malformed JSON in @qooti/workouts:', err);
        }
      }

      // 4. Parse & validate profile
      let validProfile: UserProfile | null = null;
      if (rawProfileJson === null) {
        details.profileStatus = 'missing';
      } else {
        try {
          const parsed = JSON.parse(rawProfileJson);
          if (parsed && typeof parsed === 'object') {
            if (!sqliteHasProfile) {
              validProfile = normalizeProfile(parsed);
            }
            details.profileStatus = 'valid';
          } else {
            hasMalformedJson = true;
            details.profileStatus = 'malformed';
          }
        } catch (err) {
          hasMalformedJson = true;
          details.profileStatus = 'malformed';
          console.warn('[migrationService] Malformed JSON in @qooti/profile:', err);
        }
      }

      // 5. Parse & validate progress
      const validProgress: ProgressEntry[] = [];
      if (rawProgressJson === null) {
        details.progressStatus = 'missing';
      } else if (rawProgressJson.trim() === '' || rawProgressJson.trim() === '[]') {
        details.progressStatus = 'empty';
      } else {
        try {
          const parsed = JSON.parse(rawProgressJson);
          if (Array.isArray(parsed)) {
            if (parsed.length === 0) {
              details.progressStatus = 'empty';
            } else {
              for (const item of parsed) {
                if (item && typeof item === 'object' && item.id) {
                  try {
                    if (!existingProgressIds.has(item.id)) {
                      validProgress.push(normalizeProgressEntry(item));
                    }
                  } catch {
                    skippedCorruptedRecords++;
                  }
                } else {
                  skippedCorruptedRecords++;
                }
              }
              details.progressStatus = 'valid';
            }
          } else {
            hasMalformedJson = true;
            details.progressStatus = 'malformed';
          }
        } catch (err) {
          hasMalformedJson = true;
          details.progressStatus = 'malformed';
          console.warn('[migrationService] Malformed JSON in @qooti/progress:', err);
        }
      }

      // 6. Parse & validate settings
      let validSettings: Settings | null = null;
      if (rawSettingsJson === null) {
        details.settingsStatus = 'missing';
      } else {
        try {
          const parsed = JSON.parse(rawSettingsJson);
          if (parsed && typeof parsed === 'object') {
            if (!sqliteHasSettings) {
              validSettings = parsed as Settings;
            }
            details.settingsStatus = 'valid';
          } else {
            hasMalformedJson = true;
            details.settingsStatus = 'malformed';
          }
        } catch (err) {
          hasMalformedJson = true;
          details.settingsStatus = 'malformed';
          console.warn('[migrationService] Malformed JSON in @qooti/settings:', err);
        }
      }

      // If any key had malformed unparseable JSON, do NOT silently mark migration complete!
      // This leaves migration un-flagged so corrupt data is not permanently lost and can be retried/repaired.
      if (hasMalformedJson) {
        return {
          status: 'failed_corrupt_data',
          alreadyMigrated: false,
          migratedMeals: 0,
          migratedWorkouts: 0,
          migratedProfile: false,
          migratedProgressEntries: 0,
          migratedSettings: false,
          skippedCorruptedRecords,
          details,
          error: 'Migration stopped: one or more AsyncStorage keys contain malformed JSON.',
        };
      }

      // 7. Write to SQLite in a single exclusive transaction
      const mealRepo = new SQLiteMealRepository(db);
      const workoutRepo = new SQLiteWorkoutRepository(db);
      const profileRepo = new SQLiteProfileRepository(db);
      const progressRepo = new SQLiteProgressRepository(db);
      const settingsRepo = new SQLiteSettingsRepository(db);

      try {
        await db.withExclusiveTransactionAsync(async (txn) => {
          // Migrate non-conflicting meals
          for (const meal of validMeals) {
            await mealRepo.insertMeal(meal, txn);
          }

          // Migrate non-conflicting workouts
          for (const workout of validWorkouts) {
            await workoutRepo.insertWorkout(workout, txn);
          }

          // Migrate profile if SQLite did not have one
          if (validProfile) {
            await profileRepo.saveProfile(validProfile, txn);
          }

          // Migrate progress entries
          for (const entry of validProgress) {
            await progressRepo.addProgress(entry, txn);
          }

          // Migrate settings if SQLite did not have them
          if (validSettings) {
            await settingsRepo.saveSettings(validSettings, txn);
          }

          // Set migration flags inside transaction
          const now = new Date().toISOString();
          if (skippedCorruptedRecords > 0) {
            // Unresolved corrupt records: do NOT set MIGRATION_FLAG_KEY to true.
            // Explicitly record partial needs_recovery status and the unresolved count so they remain visible & recoverable.
            await txn.runAsync(
              `INSERT INTO migration_meta (key, value, updated_at)
               VALUES ('migration_needs_recovery', 'true', ?)
               ON CONFLICT(key) DO UPDATE SET value = 'true', updated_at = excluded.updated_at;`,
              now
            );
            await txn.runAsync(
              `INSERT INTO migration_meta (key, value, updated_at)
               VALUES ('unresolved_corrupt_records', ?, ?)
               ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at;`,
              String(skippedCorruptedRecords),
              now
            );
          } else {
            await txn.runAsync(
              `INSERT INTO migration_meta (key, value, updated_at)
               VALUES (?, 'true', ?)
               ON CONFLICT(key) DO UPDATE SET value = 'true', updated_at = excluded.updated_at;`,
              MIGRATION_FLAG_KEY,
              now
            );
            await txn.runAsync(
              `INSERT INTO migration_meta (key, value, updated_at)
               VALUES ('migration_needs_recovery', 'false', ?)
               ON CONFLICT(key) DO UPDATE SET value = 'false', updated_at = excluded.updated_at;`,
              now
            );
            await txn.runAsync(
              `INSERT INTO migration_meta (key, value, updated_at)
               VALUES ('unresolved_corrupt_records', '0', ?)
               ON CONFLICT(key) DO UPDATE SET value = '0', updated_at = excluded.updated_at;`,
              now
            );
          }

          // If meals were present (even empty array), mark meals_saved so loadMeals preserves empty list
          if (details.mealsStatus === 'valid' || details.mealsStatus === 'empty') {
            await txn.runAsync(
              `INSERT INTO migration_meta (key, value, updated_at)
               VALUES ('meals_saved', 'true', ?)
               ON CONFLICT(key) DO UPDATE SET value = 'true', updated_at = excluded.updated_at;`,
              now
            );
          }

          if (details.workoutsStatus === 'valid' || details.workoutsStatus === 'empty') {
            await txn.runAsync(
              `INSERT INTO migration_meta (key, value, updated_at)
               VALUES ('workouts_saved', 'true', ?)
               ON CONFLICT(key) DO UPDATE SET value = 'true', updated_at = excluded.updated_at;`,
              now
            );
          }

          if (details.progressStatus === 'valid' || details.progressStatus === 'empty') {
            await txn.runAsync(
              `INSERT INTO migration_meta (key, value, updated_at)
               VALUES ('progress_saved', 'true', ?)
               ON CONFLICT(key) DO UPDATE SET value = 'true', updated_at = excluded.updated_at;`,
              now
            );
          }
        });
      } catch (writeErr) {
        console.error('[migrationService] Transactional SQLite write failure during migration:', writeErr);
        throw writeErr;
      }

      if (skippedCorruptedRecords > 0) {
        return {
          status: 'needs_recovery',
          alreadyMigrated: false,
          migratedMeals: validMeals.length,
          migratedWorkouts: validWorkouts.length,
          migratedProfile: validProfile !== null,
          migratedProgressEntries: validProgress.length,
          migratedSettings: validSettings !== null,
          skippedCorruptedRecords,
          details,
          error: `${skippedCorruptedRecords} invalid legacy record(s) could not be migrated due to invalid format and require recovery. Valid records were safely migrated. Original data is preserved in AsyncStorage.`,
        };
      }

      return {
        status: 'completed',
        alreadyMigrated: false,
        migratedMeals: validMeals.length,
        migratedWorkouts: validWorkouts.length,
        migratedProfile: validProfile !== null,
        migratedProgressEntries: validProgress.length,
        migratedSettings: validSettings !== null,
        skippedCorruptedRecords: 0,
        details,
      };
    } finally {
      migrationInFlight = null;
    }
  })();

  return migrationInFlight;
}

/**
 * Checks whether legacy data migration requires recovery and returns the count of unresolved records.
 */
export async function getMigrationRecoveryStatus(db: IDatabase): Promise<{
  needsRecovery: boolean;
  unresolvedRecordsCount: number;
}> {
  const [flagRow, countRow] = await Promise.all([
    db.getFirstAsync<{ value: string }>('SELECT value FROM migration_meta WHERE key = ?;', 'migration_needs_recovery'),
    db.getFirstAsync<{ value: string }>('SELECT value FROM migration_meta WHERE key = ?;', 'unresolved_corrupt_records'),
  ]);
  const needsRecovery = flagRow?.value === 'true';
  const unresolvedRecordsCount = countRow?.value ? parseInt(countRow.value, 10) || 0 : 0;
  return { needsRecovery, unresolvedRecordsCount };
}
