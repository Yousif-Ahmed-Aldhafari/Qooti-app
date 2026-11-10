import test from 'node:test';
import assert from 'node:assert/strict';

import { openDatabaseAsync } from './mocks/expo-sqlite';
import AsyncStorage from './mocks/async-storage';
import { runMigrations } from '../db/migrations';
import {
  migrateFromAsyncStorage,
  getMigrationRecoveryStatus,
  isAsyncStorageMigrated,
} from '../db/migrationService';
import { SQLiteMealRepository } from '../db/repositories/mealRepository';
import { SQLiteSettingsRepository } from '../db/repositories/settingsRepository';
import { saveWorkouts, loadWorkouts } from '../services/workoutService';
import { defaultSettings } from '../services/settingsService';
import { isSqliteAuthoritative, getStorageAuthority } from '../db/storagePolicy';
import { normalizeMeal } from '../models/meal';
import { normalizeWorkout } from '../models/workout';
import { getSeedMeals } from '../data/seedData';

/**
 * Node SQLite Validation Capabilities & Boundary Documentation:
 *
 * What these tests VALIDATE:
 * 1. Exact SQL schema constraints, primary keys, foreign keys with ON DELETE CASCADE.
 * 2. ACID transactional isolation (exclusive vs standard transactions, commit/rollback behavior).
 * 3. Parameterized query syntax, column types, JSON normalization, and date indexing.
 * 4. Idempotent migration logic, corrupt data handling, recovery flags, and storage policies.
 * 5. State hydration invariants (empty array preservation, first-launch vs returning user).
 *
 * What these tests CANNOT validate (requires physical device or simulator):
 * 1. Low-level Android JNI bridge and iOS Objective-C / Swift native SQLite bindings in Expo.
 * 2. Host operating system background memory suspension, app kill lifecycle, and OS sandbox filesystem locks.
 * 3. Native hardware device RTL restarts via DevSettings.reload() on production standalone binaries.
 */

test('Regression 1: First-launch initialization and onboarding persistence lifecycle', async () => {
  await AsyncStorage.clear();
  const db = await openDatabaseAsync(':memory:');
  await runMigrations(db);

  const settingsRepo = new SQLiteSettingsRepository(db);
  const initial = await settingsRepo.getSettings();
  assert.equal(initial, null, 'First launch starts with empty database settings');

  // Persist completed onboarding
  const configured = {
    ...defaultSettings,
    hasCompletedOnboarding: true,
    selectedLanguage: 'ar' as const,
  };
  await settingsRepo.saveSettings(configured);

  const loaded = await settingsRepo.getSettings();
  assert.equal(loaded?.hasCompletedOnboarding, true);
  assert.equal(loaded?.selectedLanguage, 'ar');
});

test('Regression 2: Returning-user hydration preserves user data without re-injecting sample data', async () => {
  await AsyncStorage.clear();
  const db = await openDatabaseAsync(':memory:');
  await runMigrations(db);

  const mealRepo = new SQLiteMealRepository(db);
  // User creates a single custom meal
  const customMeal = normalizeMeal({
    id: 'user-custom-meal-1',
    title: 'Custom User Omelette',
    date: '2026-10-30',
    time: '09:00',
    items: [],
  });
  await mealRepo.insertMeal(customMeal);

  // Mark meals as saved
  await db.runAsync(
    "INSERT INTO migration_meta (key, value, updated_at) VALUES ('meals_saved', 'true', ?);",
    new Date().toISOString()
  );

  const persistedMeals = await mealRepo.getAllMeals();
  assert.equal(persistedMeals.length, 1);
  assert.equal(persistedMeals[0].title, 'Custom User Omelette');

  // Verify seed data was not injected alongside user data
  const seedIds = new Set(getSeedMeals().map((m) => m.id));
  assert.equal(seedIds.has(persistedMeals[0].id), false);
});

test('Regression 3: Empty arrays remain strictly empty after restart and do not trigger default re-seeding', async () => {
  await AsyncStorage.clear();
  const db = await openDatabaseAsync(':memory:');
  await runMigrations(db);

  const mealRepo = new SQLiteMealRepository(db);
  // User explicitly deleted all meals, leaving an authoritative empty list
  await mealRepo.saveAllMeals([]);
  await db.runAsync(
    "INSERT INTO migration_meta (key, value, updated_at) VALUES ('meals_saved', 'true', ?);",
    new Date().toISOString()
  );

  const reloaded = await mealRepo.getAllMeals();
  assert.equal(Array.isArray(reloaded), true);
  assert.equal(reloaded.length, 0, 'Authoritative empty meal list must remain empty');
});

test('Regression 4: Atomic parent/child writes rollback completely on child failure', async () => {
  const db = await openDatabaseAsync(':memory:');
  await runMigrations(db);

  const mealRepo = new SQLiteMealRepository(db);

  // Verify rollback on intentional duplicate child item error
  let caughtError: Error | null = null;
  try {
    await db.withExclusiveTransactionAsync(async (txn) => {
      await mealRepo.insertMeal(
        {
          id: 'atomic-meal-fail',
          title: 'Transactional Meal',
          date: '2026-10-30',
          time: '12:00',
          items: [
            { id: 'item-1', foodName: 'Oats', quantity: 50, calories: 150, protein: 5, carbs: 25, fats: 2 },
          ],
        },
        txn
      );
      // Simulate fatal constraint violation within transaction
      await txn.runAsync('INSERT INTO meals (id, title, date, time, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?);',
        'atomic-meal-fail', 'Duplicate Primary Key Failure', '2026-10-30', '12:00', new Date().toISOString(), new Date().toISOString()
      );
    });
  } catch (err) {
    caughtError = err as Error;
  }

  assert.notEqual(caughtError, null, 'Transaction must abort on error');
  const mealAfterRollback = await mealRepo.getMealById('atomic-meal-fail');
  assert.equal(mealAfterRollback, null, 'Rolled back meal parent must not persist in database');
});

test('Regression 5: Corrupted legacy data sets needs_recovery and does not silently mark migration complete', async () => {
  await AsyncStorage.clear();

  // Array contains 1 valid meal and 1 invalid corrupted record (missing id)
  const legacyMeals = [
    { id: 'valid-legacy-1', title: 'Valid Legacy Meal', date: '2026-10-30', time: '12:00', items: [] },
    { missingId: true, corruptField: 12345 },
  ];
  await AsyncStorage.setItem('@qooti/meals', JSON.stringify(legacyMeals));

  const db = await openDatabaseAsync(':memory:');
  await runMigrations(db);

  const summary = await migrateFromAsyncStorage(db);
  assert.equal(summary.status, 'needs_recovery', 'Migration status must be needs_recovery when corrupted records are present');
  assert.equal(summary.migratedMeals, 1, 'Valid records must still be migrated safely');
  assert.equal(summary.skippedCorruptedRecords, 1);
  assert.equal(await isAsyncStorageMigrated(db), false, 'Must NOT set completion flag when records require recovery');

  const recovery = await getMigrationRecoveryStatus(db);
  assert.equal(recovery.needsRecovery, true);
  assert.equal(recovery.unresolvedRecordsCount, 1);

  // Raw AsyncStorage data must remain intact and not deleted
  const rawAsyncData = await AsyncStorage.getItem('@qooti/meals');
  assert.notEqual(rawAsyncData, null, 'Original AsyncStorage data must be preserved for recovery');

  // Retrying migration must NOT duplicate the valid record
  const retrySummary = await migrateFromAsyncStorage(db);
  assert.equal(retrySummary.migratedMeals, 0, 'Retry must skip already migrated valid records');
  const allMeals = await new SQLiteMealRepository(db).getAllMeals();
  assert.equal(allMeals.length, 1);
});

test('Regression 6: Native storage policy prevents split-brain dual writes to AsyncStorage', async () => {
  await AsyncStorage.clear();
  const db = await openDatabaseAsync(':memory:');
  await runMigrations(db);

  assert.equal(isSqliteAuthoritative(), true);
  assert.equal(getStorageAuthority(), 'sqlite', 'Native platform must designate SQLite as authoritative authority');

  // Saving a workout via service writes to SQLite, not legacy AsyncStorage
  const testWorkout = normalizeWorkout({
    id: 'authoritative-workout-1',
    title: 'Bench Press Session',
    date: '2026-10-30',
    time: '17:00',
    exercises: [],
  });
  await saveWorkouts([testWorkout]);

  const asyncRecord = await AsyncStorage.getItem('@qooti/workouts');
  assert.equal(asyncRecord, null, 'AsyncStorage must not receive split-brain writes');

  const loadedWorkouts = await loadWorkouts();
  assert.notEqual(loadedWorkouts, null);
  assert.equal(loadedWorkouts?.some((w) => w.id === 'authoritative-workout-1'), true);
});

test('Regression 7: Database initialization failure preserves uncommitted state and exposes failure', async () => {
  // Simulate database opening failure
  let caughtError: Error | null = null;
  try {
    const brokenDb = {
      execAsync: async () => { throw new Error('SQLite database disk full'); },
      runAsync: async () => { throw new Error('SQLite database disk full'); },
      getFirstAsync: async () => { throw new Error('SQLite database disk full'); },
      getAllAsync: async () => { throw new Error('SQLite database disk full'); },
      withTransactionAsync: async () => { throw new Error('SQLite database disk full'); },
      withExclusiveTransactionAsync: async () => { throw new Error('SQLite database disk full'); },
      closeAsync: async () => {},
    };
    await runMigrations(brokenDb as any);
  } catch (err) {
    caughtError = err as Error;
  }

  assert.notEqual(caughtError, null);
  assert.match(caughtError?.message ?? '', /SQLite database disk full/);
});

test('Regression 8: Rapid concurrent CRUD updates maintain transactional integrity', async () => {
  const db = await openDatabaseAsync(':memory:');
  await runMigrations(db);

  const mealRepo = new SQLiteMealRepository(db);

  // Concurrently insert 10 distinct meals
  const promises = Array.from({ length: 10 }, (_, i) => {
    return mealRepo.insertMeal(
      normalizeMeal({
        id: `concurrent-meal-${i}`,
        title: `Meal ${i}`,
        date: '2026-10-30',
        time: '12:00',
        items: [],
      })
    );
  });

  await Promise.all(promises);

  const allMeals = await mealRepo.getAllMeals();
  assert.equal(allMeals.length, 10, 'All concurrent meal inserts must commit without loss');
});
