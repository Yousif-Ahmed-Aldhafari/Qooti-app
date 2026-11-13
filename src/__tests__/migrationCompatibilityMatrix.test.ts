import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabaseAsync } from './mocks/expo-sqlite';
import {
  runMigrations,
  MIGRATIONS,
  reconcilePreMigrationConflicts,
} from '../db/migrations';
import { SQLiteWorkoutRepository } from '../db/repositories/workoutRepository';
import { SQLiteMealRepository } from '../db/repositories/mealRepository';
import { SQLiteProfileRepository } from '../db/repositories/profileRepository';
import { SQLiteSettingsRepository } from '../db/repositories/settingsRepository';
import { SQLiteWorkoutSessionRepository } from '../db/repositories/workoutSessionRepository';
import { IDatabase } from '../db/types';
import { MigrationSessionConflictError } from '../models/workoutSession';

async function setupDbUpToVersion(targetVersion: number): Promise<IDatabase> {
  const db = await openDatabaseAsync(':memory:');
  await db.execAsync('PRAGMA foreign_keys = ON;');
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  for (let v = 1; v <= targetVersion; v++) {
    const migration = MIGRATIONS.find((m) => m.version === v);
    if (!migration) throw new Error(`Migration version ${v} not found`);
    await db.withTransactionAsync(async () => {
      await migration.up(db);
      await db.runAsync(
        'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?);',
        migration.version,
        migration.name,
        new Date().toISOString()
      );
    });
  }
  return db;
}

test('Matrix - Test 1: Fresh installation V0 -> latest (V8) runs cleanly', async () => {
  const db = await openDatabaseAsync(':memory:');
  await db.execAsync('PRAGMA foreign_keys = ON;');
  await runMigrations(db);

  const migrations = await db.getAllAsync<{ version: number; name: string }>(
    'SELECT version, name FROM schema_migrations ORDER BY version ASC;'
  );
  assert.equal(migrations.length, 8);
  assert.equal(migrations[7].version, 8);
  assert.equal(migrations[7].name, 'clarify_session_recovery_provenance_v8');
});

test('Matrix - Test 2: V1 populated database upgrades to V8 preserving profiles, meals, workouts, and settings', async () => {
  const db = await setupDbUpToVersion(1);

  // Populate realistic V1 data
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO user_profiles (id, name, email, goal, avatar_initials, height_cm, weight_kg, target_calories, target_protein, target_carbs, target_fats, sleep_goal_hours, water_goal_liters, updated_at)
     VALUES ('user-1', 'Salim', 'salim@example.com', 'maintain', 'S', 178, 75, 2200, 160, 220, 70, 8, 3, ?);`,
    now
  );
  await db.runAsync(
    `INSERT INTO meals (id, title, date, time, total_calories, total_protein, total_carbs, total_fat, created_at)
     VALUES ('meal-1', 'Breakfast Eggs', '2026-11-13', '08:00', 280, 24, 2, 20, ?);`,
    now
  );
  await db.runAsync(
    `INSERT INTO meal_items (id, meal_id, name, quantity, unit, calories, protein, carbs, fats, sort_order)
     VALUES ('item-1', 'meal-1', 'Whole Eggs', 3, 'eggs', 280, 24, 2, 20, 0);`
  );
  await db.runAsync(
    `INSERT INTO workouts (id, title, date, time, notes, created_at)
     VALUES ('wk-1', 'Chest & Arms', '2026-11-13', '09:00', 'Good session', ?);`,
    now
  );
  await db.runAsync(
    `INSERT INTO workout_exercises (id, workout_id, name, sets, reps, weight, target_muscles, sort_order)
     VALUES ('ex-1', 'wk-1', 'Bench Press', 4, 10, 80, '["chest"]', 0);`
  );
  await db.runAsync(
    `INSERT INTO app_settings (id, selected_language, theme_mode, measurement_units, has_completed_onboarding, is_authenticated, updated_at)
     VALUES ('settings', 'ar', 'dark', 'metric', 1, 1, ?);`,
    now
  );

  // Run forward migrations 2 through 8
  await runMigrations(db);

  // Verify all data is preserved and queryable
  const profileRepo = new SQLiteProfileRepository(db);
  const mealRepo = new SQLiteMealRepository(db);
  const workoutRepo = new SQLiteWorkoutRepository(db);
  const settingsRepo = new SQLiteSettingsRepository(db);

  const profile = await profileRepo.getProfile();
  assert.equal(profile?.name, 'Salim');
  assert.equal(profile?.targetCalories, 2200);

  const meals = await mealRepo.getAllMeals();
  assert.equal(meals.length, 1);
  assert.equal(meals[0].items.length, 1);
  assert.equal(meals[0].items[0].name, 'Whole Eggs');

  const workouts = await workoutRepo.getAllWorkouts();
  assert.equal(workouts.length, 1);
  assert.equal(workouts[0].exercises.length, 1);
  assert.equal(workouts[0].exercises[0].name, 'Bench Press');

  const settings = await settingsRepo.getSettings();
  assert.equal(settings?.selectedLanguage, 'ar');
  assert.equal(settings?.themeMode, 'dark');
});

test('Matrix - Test 3: V2 populated database upgrades to V8 preserving personalization and target overrides', async () => {
  const db = await setupDbUpToVersion(2);
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO user_profiles (id, name, email, goal, avatar_initials, height_cm, weight_kg, target_calories, target_protein, target_carbs, target_fats, sleep_goal_hours, water_goal_liters, age, gender, activity_level, primary_goal, calculation_overridden, updated_at)
     VALUES ('user-v2', 'Noura', 'noura@example.com', 'lose_weight', 'N', 165, 60, 1850, 140, 170, 55, 7.5, 2.5, 29, 'female', 'very_active', 'fat_loss', 1, ?);`,
    now
  );

  await runMigrations(db);

  const profileRepo = new SQLiteProfileRepository(db);
  const profile = await profileRepo.getProfile();
  assert.equal(profile?.age, 29);
  assert.equal(profile?.gender, 'female');
  assert.equal(profile?.primaryGoal, 'fat_loss');
  assert.equal(profile?.calculationOverridden, true);
  assert.equal(profile?.targetCalories, 1850);
});

test('Matrix - Test 4: V3 populated database upgrades to V8 preserving confirmation and BMR reference', async () => {
  const db = await setupDbUpToVersion(3);
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO user_profiles (id, name, email, goal, avatar_initials, height_cm, weight_kg, target_calories, target_protein, target_carbs, target_fats, sleep_goal_hours, water_goal_liters, attributes_confirmed, bmr_biological_reference, updated_at)
     VALUES ('user-v3', 'Ahmed', 'ahmed@test.com', 'muscle_gain', 'A', 180, 80, 2500, 180, 250, 80, 8, 3, 1, 'male', ?);`,
    now
  );

  await runMigrations(db);

  const profileRepo = new SQLiteProfileRepository(db);
  const profile = await profileRepo.getProfile();
  assert.equal(profile?.attributesConfirmed, true);
  assert.equal(profile?.bmrBiologicalReference, 'male');
});

test('Matrix - Test 5: V4 populated database upgrades to V8 preserving catalog_id', async () => {
  const db = await setupDbUpToVersion(4);
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO workouts (id, title, date, time, notes, created_at)
     VALUES ('wk-v4', 'Leg Day', '2026-11-13', '10:00', 'Heavy', ?);`,
    now
  );
  await db.runAsync(
    `INSERT INTO workout_exercises (id, workout_id, name, sets, reps, weight, target_muscles, sort_order, catalog_id)
     VALUES ('ex-v4-1', 'wk-v4', 'Barbell Back Squat', 3, 8, 100, '["legs"]', 0, 'barbell-back-squat');`
  );

  await runMigrations(db);

  const workoutRepo = new SQLiteWorkoutRepository(db);
  const wk = await workoutRepo.getWorkoutById('wk-v4');
  assert.equal(wk?.exercises[0].catalogId, 'barbell-back-squat');
});

test('Matrix - Test 6: V5 populated database with single open session upgrades to V8 cleanly', async () => {
  const db = await setupDbUpToVersion(5);
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO workout_sessions (id, title, status, started_at, accumulated_elapsed_ms, created_at, updated_at)
     VALUES ('sess-v5-1', 'Push A', 'active', ?, 120000, ?, ?);`,
    now,
    now,
    now
  );
  await db.runAsync(
    `INSERT INTO workout_session_exercises (id, session_id, exercise_name, sort_order)
     VALUES ('se-1', 'sess-v5-1', 'Bench Press', 0);`
  );
  await db.runAsync(
    `INSERT INTO workout_sets (id, session_exercise_id, set_number, planned_reps, actual_reps, planned_weight_kg, actual_weight_kg, status)
     VALUES ('st-1', 'se-1', 1, 10, 10, 80, 80, 'completed');`
  );

  await runMigrations(db);

  const sessionRepo = new SQLiteWorkoutSessionRepository(db);
  const session = await sessionRepo.getSessionById('sess-v5-1');
  assert.equal(session?.status, 'active');
  assert.equal(session?.accumulatedElapsedMs, 120000);
  assert.equal(session?.exercises[0].sets[0].status, 'completed');
});

test('Matrix - Test 7: V5 database with multiple open sessions blocks on getDatabase / default runMigrations and recovers via keep_interrupted', async () => {
  const db = await setupDbUpToVersion(5);
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO workout_sessions (id, title, status, started_at, accumulated_elapsed_ms, created_at, updated_at)
     VALUES ('s-c1', 'Morning Run', 'active', '2026-11-13T07:00:00.000Z', 600000, ?, ?);`,
    now,
    now
  );
  await db.runAsync(
    `INSERT INTO workout_sessions (id, title, status, started_at, accumulated_elapsed_ms, created_at, updated_at)
     VALUES ('s-c2', 'Evening Lift', 'paused', '2026-11-13T17:00:00.000Z', 1200000, ?, ?);`,
    now,
    now
  );
  await db.runAsync(
    `INSERT INTO workout_sessions (id, title, status, started_at, accumulated_elapsed_ms, created_at, updated_at)
     VALUES ('s-c3', 'Night Stretch', 'active', '2026-11-13T21:00:00.000Z', 300000, ?, ?);`,
    now,
    now
  );

  // 1. Calling default runMigrations must detect conflict and block
  await assert.rejects(
    async () => {
      await runMigrations(db);
    },
    (err: any) => {
      assert.ok(err instanceof MigrationSessionConflictError);
      assert.equal(err.conflictingSessions.length, 3);
      return true;
    }
  );

  // 2. Resolve conflict: resume s-c2, other sessions keep_interrupted (safe default!)
  await reconcilePreMigrationConflicts(db, {
    resumeSessionId: 's-c2',
    actionForOthers: 'keep_interrupted',
  });

  // 3. Now runMigrations completes cleanly
  await runMigrations(db);

  const sessionRepo = new SQLiteWorkoutSessionRepository(db);
  const s2 = await sessionRepo.getSessionById('s-c2');
  assert.equal(s2?.status, 'active');
  assert.equal(s2?.recoveryState, 'recovered');

  // Verify s-c1 and s-c3 are recoverable non-completed sessions
  // (Migration 8 tags historical pre-migration discarded sessions as 'ambiguous' for safe recovery review)
  const s1 = await sessionRepo.getSessionById('s-c1');
  const s3 = await sessionRepo.getSessionById('s-c3');
  assert.equal(s1?.status, 'discarded');
  assert.equal(s1?.recoveryState, 'ambiguous');
  assert.equal(s3?.status, 'discarded');
  assert.equal(s3?.recoveryState, 'ambiguous');

  // Verify listInterruptedSessions returns s1 and s3 but not s2
  const recoverable = await sessionRepo.listInterruptedSessions();
  const recIds = recoverable.map((s) => s.id);
  assert.ok(recIds.includes('s-c1'));
  assert.ok(recIds.includes('s-c3'));
  assert.ok(!recIds.includes('s-c2'));
});

test('Matrix - Test 8: Multiple conflicting open sessions with per-session resolutions', async () => {
  const db = await setupDbUpToVersion(5);
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO workout_sessions (id, title, status, started_at, accumulated_elapsed_ms, created_at, updated_at)
     VALUES ('sess-a', 'Session A', 'active', '2026-11-13T07:00:00.000Z', 0, ?, ?);`,
    now,
    now
  );
  await db.runAsync(
    `INSERT INTO workout_sessions (id, title, status, started_at, accumulated_elapsed_ms, created_at, updated_at)
     VALUES ('sess-b', 'Session B', 'paused', '2026-11-13T08:00:00.000Z', 0, ?, ?);`,
    now,
    now
  );
  await db.runAsync(
    `INSERT INTO workout_sessions (id, title, status, started_at, accumulated_elapsed_ms, created_at, updated_at)
     VALUES ('sess-c', 'Session C', 'active', '2026-11-13T09:00:00.000Z', 0, ?, ?);`,
    now,
    now
  );

  // Per-session direction:
  // sess-a -> keep_interrupted
  // sess-b -> archive (user explicitly marks finished)
  // sess-c -> discard (user explicitly deletes)
  await reconcilePreMigrationConflicts(db, {
    sessionResolutions: {
      'sess-a': 'keep_interrupted',
      'sess-b': 'archive',
      'sess-c': 'discard',
    },
  });

  await runMigrations(db);

  const sessionRepo = new SQLiteWorkoutSessionRepository(db);
  const sa = await sessionRepo.getSessionById('sess-a');
  const sb = await sessionRepo.getSessionById('sess-b');
  const sc = await sessionRepo.getSessionById('sess-c');

  assert.equal(sa?.status, 'discarded');
  // Migration 8 maps pre-existing discarded to 'ambiguous' for safe user review
  assert.equal(sa?.recoveryState, 'ambiguous');
  assert.equal(sb?.status, 'completed');
  assert.equal(sb?.recoveryState, 'archived');
  assert.equal(sc, null); // physically deleted
});

test('Matrix - Test 9: Original V6 database upgrades forward to V8 cleanly', async () => {
  const db = await setupDbUpToVersion(6);
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO workout_sessions (id, title, status, started_at, accumulated_elapsed_ms, created_at, updated_at)
     VALUES ('s-v6-orig', 'V6 Session', 'discarded', '2026-11-13T07:00:00.000Z', 100000, ?, ?);`,
    now,
    now
  );

  await runMigrations(db);

  const row = await db.getFirstAsync<{ recovery_state: string; accumulated_elapsed_ms: number }>(
    `SELECT recovery_state, accumulated_elapsed_ms FROM workout_sessions WHERE id = 's-v6-orig';`
  );
  assert.equal(row?.recovery_state, 'ambiguous');
  assert.equal(row?.accumulated_elapsed_ms, 100000);
});

test('Matrix - Test 10: V7 database upgrades forward to V8 cleanly', async () => {
  const db = await setupDbUpToVersion(7);
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO workout_sessions (id, title, status, started_at, accumulated_elapsed_ms, recovery_state, created_at, updated_at)
     VALUES ('s-v7-rec', 'V7 Conflicted', 'discarded', '2026-11-13T07:00:00.000Z', 0, 'interrupted', ?, ?);`,
    now,
    now
  );

  await runMigrations(db);

  const row = await db.getFirstAsync<{ recovery_state: string }>(
    `SELECT recovery_state FROM workout_sessions WHERE id = 's-v7-rec';`
  );
  assert.equal(row?.recovery_state, 'ambiguous');
});

test('Matrix - Test 11: Idempotency of runMigrations across repeated executions', async () => {
  const db = await openDatabaseAsync(':memory:');
  await db.execAsync('PRAGMA foreign_keys = ON;');
  await runMigrations(db);
  await runMigrations(db);
  await runMigrations(db);

  const applied = await db.getAllAsync<{ version: number }>(
    `SELECT version FROM schema_migrations ORDER BY version ASC;`
  );
  assert.equal(applied.length, 8);
});
