import test from 'node:test';
import assert from 'node:assert/strict';

import { openDatabaseAsync, deleteDatabaseAsync } from './mocks/expo-sqlite';
import AsyncStorage from './mocks/async-storage';
import { runMigrations } from '../db/migrations';
import { isAsyncStorageMigrated, migrateFromAsyncStorage, MIGRATION_FLAG_KEY } from '../db/migrationService';
import { SQLiteMealRepository } from '../db/repositories/mealRepository';
import { SQLiteWorkoutRepository } from '../db/repositories/workoutRepository';
import { SQLiteProfileRepository } from '../db/repositories/profileRepository';
import { SQLiteProgressRepository } from '../db/repositories/progressRepository';
import { SQLiteSettingsRepository } from '../db/repositories/settingsRepository';
import { normalizeMeal, normalizeMealItem } from '../models/meal';
import { normalizeWorkout, normalizeExercise } from '../models/workout';
import { normalizeProfile } from '../models/profile';
import { normalizeProgressEntry } from '../models/progress';
import { defaultSettings } from '../services/settingsService';

// Explicit environment note:
// These tests execute against Node.js's built-in SQLite C engine (`node:sqlite`),
// providing realistic SQL constraint checking, foreign key cascade enforcement,
// transactions, and index behavior identical to SQLite on Android and iOS devices.

test('SQLite: Empty database initialization', async () => {
  const db = await openDatabaseAsync(':memory:');
  await db.execAsync('PRAGMA foreign_keys = ON;');
  await runMigrations(db);

  // Verify schema_migrations table
  const migrations = await db.getAllAsync<{ version: number; name: string }>(
    'SELECT version, name FROM schema_migrations;'
  );
  assert.equal(migrations.length, 1);
  assert.equal(migrations[0].version, 1);
  assert.equal(migrations[0].name, 'initial_schema_v1');

  // Verify core tables exist
  const tables = await db.getAllAsync<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name ASC;"
  );
  const tableNames = tables.map((t) => t.name);

  assert.ok(tableNames.includes('meals'), 'meals table should exist');
  assert.ok(tableNames.includes('meal_items'), 'meal_items table should exist');
  assert.ok(tableNames.includes('workouts'), 'workouts table should exist');
  assert.ok(tableNames.includes('workout_exercises'), 'workout_exercises table should exist');
  assert.ok(tableNames.includes('user_profiles'), 'user_profiles table should exist');
  assert.ok(tableNames.includes('progress_entries'), 'progress_entries table should exist');
  assert.ok(tableNames.includes('app_settings'), 'app_settings table should exist');
  assert.ok(tableNames.includes('migration_meta'), 'migration_meta table should exist');
});

test('SQLite: Schema migration idempotency and repeat initialization', async () => {
  const db = await openDatabaseAsync(':memory:');
  await runMigrations(db);

  // Run migrations a second time
  await runMigrations(db);

  const migrations = await db.getAllAsync<{ version: number }>(
    'SELECT version FROM schema_migrations;'
  );
  assert.equal(migrations.length, 1, 'Migration version 1 should not be re-applied or duplicated');
});

test('SQLite: CRUD operations for Meals and parent/child relationship integrity', async () => {
  const db = await openDatabaseAsync(':memory:');
  await db.execAsync('PRAGMA foreign_keys = ON;');
  await runMigrations(db);

  const repo = new SQLiteMealRepository(db);

  const testMeal = normalizeMeal({
    id: 'meal-crud-1',
    title: 'Post-Workout Fuel',
    date: '2026-10-30',
    time: '14:30',
    items: [
      normalizeMealItem({
        id: 'item-1',
        name: 'Oats with Milk',
        quantity: 100,
        unit: 'g',
        calories: 380,
        protein: 15,
        carbs: 65,
        fats: 6,
      }),
      normalizeMealItem({
        id: 'item-2',
        name: 'Whey Protein',
        quantity: 30,
        unit: 'g',
        calories: 120,
        protein: 24,
        carbs: 2,
        fats: 1,
      }),
    ],
  });

  // 1. Insert meal
  await repo.insertMeal(testMeal);

  // 2. Read back
  const fetched = await repo.getMealById('meal-crud-1');
  assert.ok(fetched);
  assert.equal(fetched.id, 'meal-crud-1');
  assert.equal(fetched.title, 'Post-Workout Fuel');
  assert.equal(fetched.items.length, 2);
  assert.equal(fetched.totalCalories, 500);
  assert.equal(fetched.totalProtein, 39);

  // 3. Update meal
  const updatedMeal = normalizeMeal({
    ...fetched,
    title: 'Updated Post-Workout Fuel',
    items: [
      normalizeMealItem({
        id: 'item-1',
        name: 'Oats with Almond Milk',
        quantity: 120,
        unit: 'g',
        calories: 420,
        protein: 16,
        carbs: 70,
        fats: 7,
      }),
    ],
  });
  await repo.updateMeal(updatedMeal);

  const fetchedAfterUpdate = await repo.getMealById('meal-crud-1');
  assert.ok(fetchedAfterUpdate);
  assert.equal(fetchedAfterUpdate.title, 'Updated Post-Workout Fuel');
  assert.equal(fetchedAfterUpdate.items.length, 1);
  assert.equal(fetchedAfterUpdate.items[0].name, 'Oats with Almond Milk');

  // 4. Delete meal and verify cascading deletion of items
  await repo.deleteMeal('meal-crud-1');
  const fetchedAfterDelete = await repo.getMealById('meal-crud-1');
  assert.equal(fetchedAfterDelete, null);

  const remainingItems = await db.getAllAsync(
    'SELECT * FROM meal_items WHERE meal_id = ?;',
    'meal-crud-1'
  );
  assert.equal(remainingItems.length, 0, 'Meal items must be cascade-deleted');
});

test('SQLite: CRUD operations for Workouts and parent/child relationship integrity', async () => {
  const db = await openDatabaseAsync(':memory:');
  await db.execAsync('PRAGMA foreign_keys = ON;');
  await runMigrations(db);

  const repo = new SQLiteWorkoutRepository(db);

  const testWorkout = normalizeWorkout({
    id: 'workout-crud-1',
    title: 'Chest & Triceps Hypertrophy',
    date: '2026-10-30',
    time: '08:00',
    notes: 'High intensity session',
    exercises: [
      normalizeExercise({
        id: 'ex-1',
        name: 'Incline Dumbbell Press',
        targetMuscles: ['Upper Chest', 'Triceps'],
        sets: 4,
        reps: 10,
        weight: 32,
        duration: 0,
        notes: 'Felt strong',
      }),
      normalizeExercise({
        id: 'ex-2',
        name: 'Cable Flyes',
        targetMuscles: ['Chest'],
        sets: 3,
        reps: 15,
        weight: 15,
        duration: 0,
        notes: 'Squeeze at peak',
      }),
    ],
  });

  // 1. Insert
  await repo.insertWorkout(testWorkout);

  // 2. Read
  const fetched = await repo.getWorkoutById('workout-crud-1');
  assert.ok(fetched);
  assert.equal(fetched.title, 'Chest & Triceps Hypertrophy');
  assert.equal(fetched.exercises.length, 2);
  assert.deepEqual(fetched.exercises[0].targetMuscles, ['Upper Chest', 'Triceps']);

  // 3. Update
  const updatedWorkout = normalizeWorkout({
    ...fetched,
    title: 'Chest & Arms',
    exercises: [fetched.exercises[0]],
  });
  await repo.updateWorkout(updatedWorkout);

  const fetchedUpdated = await repo.getWorkoutById('workout-crud-1');
  assert.ok(fetchedUpdated);
  assert.equal(fetchedUpdated.title, 'Chest & Arms');
  assert.equal(fetchedUpdated.exercises.length, 1);

  // 4. Delete & verify cascading deletion of exercises
  await repo.deleteWorkout('workout-crud-1');
  assert.equal(await repo.getWorkoutById('workout-crud-1'), null);

  const remainingExercises = await db.getAllAsync(
    'SELECT * FROM workout_exercises WHERE workout_id = ?;',
    'workout-crud-1'
  );
  assert.equal(remainingExercises.length, 0, 'Workout exercises must be cascade-deleted');
});

test('SQLite: CRUD operations for UserProfile, ProgressEntry, and Settings', async () => {
  const db = await openDatabaseAsync(':memory:');
  await runMigrations(db);

  const profileRepo = new SQLiteProfileRepository(db);
  const progressRepo = new SQLiteProgressRepository(db);
  const settingsRepo = new SQLiteSettingsRepository(db);

  // Profile CRUD
  const profile = normalizeProfile({
    id: 'user_profile',
    name: 'Ahmed Tariq',
    email: 'ahmed@example.com',
    goal: 'Build Muscle',
    heightCm: 180,
    weightKg: 78.5,
    targetCalories: 2600,
    targetProtein: 160,
    targetCarbs: 280,
    targetFats: 70,
    sleepGoalHours: 8,
    waterGoalLiters: 3.5,
  });
  await profileRepo.saveProfile(profile);

  const fetchedProfile = await profileRepo.getProfile();
  assert.ok(fetchedProfile);
  assert.equal(fetchedProfile.name, 'Ahmed Tariq');
  assert.equal(fetchedProfile.targetCalories, 2600);
  assert.equal(fetchedProfile.targetFats, 70);
  assert.equal(fetchedProfile.waterGoalLiters, 3.5);

  // Progress CRUD
  const entry = normalizeProgressEntry({
    id: 'prog-1',
    date: '2026-10-30',
    label: 'Fri',
    calories: 2500,
    workouts: 1,
    weightKg: 78.2,
    steps: 10500,
  });
  await progressRepo.addProgress(entry);

  const fetchedProgress = await progressRepo.getAllProgress();
  assert.equal(fetchedProgress.length, 1);
  assert.equal(fetchedProgress[0].id, 'prog-1');
  assert.equal(fetchedProgress[0].steps, 10500);

  // Settings CRUD
  await settingsRepo.saveSettings({
    ...defaultSettings,
    selectedLanguage: 'ar',
    themeMode: 'dark',
    hasCompletedOnboarding: true,
  });

  const fetchedSettings = await settingsRepo.getSettings();
  assert.ok(fetchedSettings);
  assert.equal(fetchedSettings.selectedLanguage, 'ar');
  assert.equal(fetchedSettings.themeMode, 'dark');
  assert.equal(fetchedSettings.hasCompletedOnboarding, true);
});

test('SQLite: Existing AsyncStorage data migration (one-time, non-destructive)', async () => {
  await AsyncStorage.clear();

  const legacyMeals = [
    normalizeMeal({
      id: 'legacy-meal-1',
      title: 'وجبة الإفطار',
      date: '2026-10-29',
      time: '08:00',
      items: [
        normalizeMealItem({
          id: 'li-1',
          name: 'بيض مسلوق',
          quantity: 3,
          unit: 'pcs',
          calories: 210,
          protein: 18,
          carbs: 1,
          fats: 15,
        }),
      ],
    }),
  ];

  const legacyWorkouts = [
    normalizeWorkout({
      id: 'legacy-workout-1',
      title: 'تمرين الظهر',
      date: '2026-10-29',
      time: '18:00',
      exercises: [
        normalizeExercise({
          id: 'le-1',
          name: 'سحب أرضي',
          targetMuscles: ['Back'],
          sets: 4,
          reps: 12,
          weight: 60,
          duration: 0,
          notes: '',
        }),
      ],
    }),
  ];

  const legacyProfile = normalizeProfile({
    id: 'user_profile',
    name: 'سارة خالد',
    email: 'sara@example.com',
    goal: 'Weight Loss',
    heightCm: 165,
    weightKg: 62,
    targetCalories: 1800,
    targetProtein: 120,
    targetCarbs: 180,
    targetFats: 45,
    sleepGoalHours: 7.5,
    waterGoalLiters: 2.5,
  });

  await AsyncStorage.setItem('@qooti/meals', JSON.stringify(legacyMeals));
  await AsyncStorage.setItem('@qooti/workouts', JSON.stringify(legacyWorkouts));
  await AsyncStorage.setItem('@qooti/profile', JSON.stringify(legacyProfile));

  const db = await openDatabaseAsync(':memory:');
  await db.execAsync('PRAGMA foreign_keys = ON;');
  await runMigrations(db);

  // Execute migration
  const summary = await migrateFromAsyncStorage(db);

  assert.equal(summary.alreadyMigrated, false);
  assert.equal(summary.migratedMeals, 1);
  assert.equal(summary.migratedWorkouts, 1);
  assert.equal(summary.migratedProfile, true);

  // Verify migrated rows in SQLite
  const mealRepo = new SQLiteMealRepository(db);
  const migratedMeals = await mealRepo.getAllMeals();
  assert.equal(migratedMeals.length, 1);
  assert.equal(migratedMeals[0].title, 'وجبة الإفطار');
  assert.equal(migratedMeals[0].items[0].name, 'بيض مسلوق');

  const profileRepo = new SQLiteProfileRepository(db);
  const migratedProfile = await profileRepo.getProfile();
  assert.ok(migratedProfile);
  assert.equal(migratedProfile.name, 'سارة خالد');

  // Verify non-destructive behavior: original AsyncStorage records remain intact
  assert.ok(await AsyncStorage.getItem('@qooti/meals'), 'AsyncStorage meals should not be cleared');
  assert.ok(await AsyncStorage.getItem('@qooti/workouts'), 'AsyncStorage workouts should not be cleared');
  assert.ok(await AsyncStorage.getItem('@qooti/profile'), 'AsyncStorage profile should not be cleared');
});

test('SQLite: Duplicate migration prevention (idempotency)', async () => {
  const db = await openDatabaseAsync(':memory:');
  await db.execAsync('PRAGMA foreign_keys = ON;');
  await runMigrations(db);

  // First migration run
  const firstSummary = await migrateFromAsyncStorage(db);
  assert.equal(firstSummary.alreadyMigrated, false);

  // Second migration run
  const secondSummary = await migrateFromAsyncStorage(db);
  assert.equal(secondSummary.alreadyMigrated, true);
  assert.equal(secondSummary.migratedMeals, 0);
  assert.equal(secondSummary.migratedWorkouts, 0);

  // Confirm flag is set in migration_meta table
  assert.equal(await isAsyncStorageMigrated(db), true);
});

test('SQLite: Interrupted migration and retry safety', async () => {
  await AsyncStorage.clear();

  const meals = [
    normalizeMeal({
      id: 'retry-meal-1',
      title: 'Snack',
      date: '2026-10-30',
      time: '11:00',
      items: [],
    }),
  ];
  await AsyncStorage.setItem('@qooti/meals', JSON.stringify(meals));

  const db = await openDatabaseAsync(':memory:');
  await runMigrations(db);

  // Simulate an interrupted migration by breaking a constraint or injecting failure
  // Temporarily drop table so write throws error inside transaction
  await db.execAsync('DROP TABLE meals;');

  let migrationError: Error | null = null;
  try {
    await migrateFromAsyncStorage(db);
  } catch (err) {
    migrationError = err as Error;
  }

  assert.ok(migrationError, 'Migration should throw when table write fails');

  // Verify migration flag was NOT written due to rollback
  const row = await db.getFirstAsync(
    'SELECT value FROM migration_meta WHERE key = ?;',
    MIGRATION_FLAG_KEY
  );
  assert.equal(row, null, 'Migration flag must not be marked complete after failed write');

  // Recreate table and retry migration
  await db.execAsync('DELETE FROM schema_migrations;');
  await runMigrations(db);
  const retrySummary = await migrateFromAsyncStorage(db);
  assert.equal(retrySummary.alreadyMigrated, false);
  assert.equal(retrySummary.migratedMeals, 1);
  assert.equal(await isAsyncStorageMigrated(db), true);
});

test('SQLite: Corrupted legacy records handling', async () => {
  await AsyncStorage.clear();

  // Set malformed JSON
  await AsyncStorage.setItem('@qooti/meals', 'INVALID_JSON{broken');

  const db = await openDatabaseAsync(':memory:');
  await runMigrations(db);

  // Should handle gracefully without crashing or halting the entire migration
  const summary = await migrateFromAsyncStorage(db);
  assert.equal(summary.alreadyMigrated, false);
  assert.equal(summary.migratedMeals, 0);
  assert.equal(await isAsyncStorageMigrated(db), true);
});

test('SQLite: Storage read and write failures', async () => {
  await AsyncStorage.clear();

  // Monkey-patch AsyncStorage.getItem to simulate disk I/O failure
  const originalGetItem = AsyncStorage.getItem;
  AsyncStorage.getItem = async () => {
    throw new Error('AsyncStorage hardware disk I/O failure');
  };

  const db = await openDatabaseAsync(':memory:');
  await runMigrations(db);

  let failedError: Error | null = null;
  try {
    await migrateFromAsyncStorage(db);
  } catch (err) {
    failedError = err as Error;
  } finally {
    AsyncStorage.getItem = originalGetItem;
  }

  assert.ok(failedError, 'Should throw error when AsyncStorage read fails');
  assert.ok(failedError.message.includes('AsyncStorage read failure'));
  assert.equal(await isAsyncStorageMigrated(db), false, 'Must not mark migration complete on storage failure');
});

test('SQLite: Data persistence after database reopening', async () => {
  const dbName = 'persistence_verify.db';
  await deleteDatabaseAsync(dbName);

  // 1. Open database and insert data
  const db1 = await openDatabaseAsync(dbName);
  await db1.execAsync('PRAGMA foreign_keys = ON;');
  await runMigrations(db1);

  const mealRepo1 = new SQLiteMealRepository(db1);
  await mealRepo1.insertMeal(
    normalizeMeal({
      id: 'persisted-meal-1',
      title: 'Steak & Sweet Potato',
      date: '2026-10-30',
      time: '19:00',
      items: [
        normalizeMealItem({
          id: 'pi-1',
          name: 'Sirloin Steak',
          quantity: 250,
          unit: 'g',
          calories: 500,
          protein: 55,
          carbs: 0,
          fats: 25,
        }),
      ],
    })
  );

  // 2. Close database connection
  await db1.closeAsync();

  // 3. Reopen database using the same file name
  const db2 = await openDatabaseAsync(dbName);
  await db2.execAsync('PRAGMA foreign_keys = ON;');
  const mealRepo2 = new SQLiteMealRepository(db2);

  const fetched = await mealRepo2.getMealById('persisted-meal-1');
  assert.ok(fetched, 'Meal must persist after database connection is reopened');
  assert.equal(fetched.title, 'Steak & Sweet Potato');
  assert.equal(fetched.items.length, 1);
  assert.equal(fetched.items[0].name, 'Sirloin Steak');
  assert.equal(fetched.items[0].protein, 55);

  await db2.closeAsync();
  await deleteDatabaseAsync(dbName);
});
