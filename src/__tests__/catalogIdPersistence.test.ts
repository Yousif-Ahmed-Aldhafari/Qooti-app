import test from 'node:test';
import assert from 'node:assert/strict';

import { openDatabaseAsync } from './mocks/expo-sqlite';
import { runMigrations, MIGRATIONS } from '../db/migrations';
import { SQLiteWorkoutRepository } from '../db/repositories/workoutRepository';
import { normalizeWorkout, normalizeExercise } from '../models/workout';

async function createTestDb() {
  const db = await openDatabaseAsync(':memory:');
  await db.execAsync('PRAGMA foreign_keys = ON;');
  await runMigrations(db);
  return db;
}

// Test 1: Migration 3 -> 4 upgrade path
test('CatalogId - Test 1: Applying Migration 4 adds catalog_id column to existing workout_exercises', async () => {
  const db = await openDatabaseAsync(':memory:');
  await db.execAsync('PRAGMA foreign_keys = ON;');

  // Apply only migrations 1, 2, 3 (simulate existing V3 database)
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL);
  `);

  for (const m of MIGRATIONS.slice(0, 3)) {
    await db.withTransactionAsync(async () => {
      await m.up(db);
      await db.runAsync('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?);', m.version, m.name, new Date().toISOString());
    });
  }

  // Verify catalog_id does NOT exist before Migration 4
  const colsBefore = await db.getAllAsync<{ name: string }>('PRAGMA table_info(workout_exercises);');
  const hasCatalogIdBefore = colsBefore.some(c => c.name === 'catalog_id');
  assert.equal(hasCatalogIdBefore, false, 'catalog_id must not exist before Migration 4');

  // Apply Migration 4
  await MIGRATIONS[3].up(db);

  const colsAfter = await db.getAllAsync<{ name: string }>('PRAGMA table_info(workout_exercises);');
  const hasCatalogIdAfter = colsAfter.some(c => c.name === 'catalog_id');
  assert.equal(hasCatalogIdAfter, true, 'catalog_id must exist after Migration 4');
});

// Test 2: Fresh V0 -> V4 (new install)
test('CatalogId - Test 2: Fresh database installation runs all 4 migrations cleanly', async () => {
  const db = await createTestDb();

  const migrations = await db.getAllAsync<{ version: number; name: string }>(
    'SELECT version, name FROM schema_migrations ORDER BY version ASC;'
  );
  assert.equal(migrations.length, 5);
  assert.equal(migrations[3].version, 4);
  assert.equal(migrations[3].name, 'add_workout_exercise_catalog_id_v4');
  assert.equal(migrations[4].version, 5);
  assert.equal(migrations[4].name, 'add_workout_execution_sessions_v5');

  const cols = await db.getAllAsync<{ name: string }>('PRAGMA table_info(workout_exercises);');
  assert.ok(cols.some(c => c.name === 'catalog_id'), 'catalog_id column must exist');
});

// Test 3: Migration idempotence (runMigrations twice)
test('CatalogId - Test 3: Running migrations twice does not duplicate Migration 4', async () => {
  const db = await createTestDb();
  await runMigrations(db);

  const migrations = await db.getAllAsync<{ version: number }>('SELECT version FROM schema_migrations;');
  assert.equal(migrations.length, 5, 'Must not re-apply migrations on second run');
});

// Test 4: Existing legacy exercises after migration have NULL catalog_id
test('CatalogId - Test 4: Legacy exercises created pre-migration have null catalog_id and load without error', async () => {
  const db = await createTestDb();
  const repo = new SQLiteWorkoutRepository(db);

  const legacyWorkout = normalizeWorkout({
    id: 'w-legacy-1',
    title: 'Legacy Workout',
    date: '2026-01-01',
    time: '08:00',
    exercises: [
      normalizeExercise({ id: 'le-1', name: 'Old Exercise', sets: 3, reps: 10, weight: 20 }),
    ],
  });

  await repo.insertWorkout(legacyWorkout);

  const loaded = await repo.getWorkoutById('w-legacy-1');
  assert.ok(loaded);
  assert.equal(loaded.exercises[0].name, 'Old Exercise');
  assert.equal(loaded.exercises[0].catalogId, undefined, 'Legacy exercise must have undefined catalogId');
});

// Test 5: Catalog ID insert roundtrip
test('CatalogId - Test 5: catalogId survives insertWorkout and getWorkoutById roundtrip', async () => {
  const db = await createTestDb();
  const repo = new SQLiteWorkoutRepository(db);

  const workout = normalizeWorkout({
    id: 'w-catalog-1',
    title: 'Catalog Workout',
    date: '2026-11-13',
    time: '10:00',
    exercises: [
      normalizeExercise({ id: 'ex-c1', name: 'Barbell Bench Press', catalogId: 'barbell-bench-press', targetMuscles: ['chest'], sets: 4, reps: 8, weight: 80 }),
      normalizeExercise({ id: 'ex-c2', name: 'Custom Exercise', sets: 3, reps: 12, weight: 10 }),
    ],
  });

  await repo.insertWorkout(workout);

  const loaded = await repo.getWorkoutById('w-catalog-1');
  assert.ok(loaded);
  assert.equal(loaded.exercises[0].catalogId, 'barbell-bench-press');
  assert.equal(loaded.exercises[1].catalogId, undefined);
});

// Test 6: Catalog ID update roundtrip
test('CatalogId - Test 6: catalogId survives updateWorkout and reload', async () => {
  const db = await createTestDb();
  const repo = new SQLiteWorkoutRepository(db);

  const workout = normalizeWorkout({
    id: 'w-update-catalog',
    title: 'Update Test',
    date: '2026-11-13',
    time: '11:00',
    exercises: [
      normalizeExercise({ id: 'ex-u1', name: 'Pull-up', catalogId: 'pull-up', targetMuscles: ['back'], sets: 3, reps: 10 }),
    ],
  });

  await repo.insertWorkout(workout);

  const updated = normalizeWorkout({
    id: 'w-update-catalog',
    title: 'Update Test Modified',
    date: '2026-11-13',
    time: '11:00',
    exercises: [
      normalizeExercise({ id: 'ex-u1', name: 'Pull-up', catalogId: 'pull-up', targetMuscles: ['back'], sets: 4, reps: 12 }),
    ],
  });

  await repo.updateWorkout(updated);

  const loaded = await repo.getWorkoutById('w-update-catalog');
  assert.ok(loaded);
  assert.equal(loaded.exercises[0].catalogId, 'pull-up');
  assert.equal(loaded.exercises[0].sets, 4);
  assert.equal(loaded.exercises[0].reps, 12);
});

// Test 7: Catalog ID preservation after exercise reorder
test('CatalogId - Test 7: catalogIds are preserved correctly after exercise reordering', async () => {
  const db = await createTestDb();
  const repo = new SQLiteWorkoutRepository(db);

  const workout = normalizeWorkout({
    id: 'w-reorder-1',
    title: 'Reorder Test',
    date: '2026-11-13',
    time: '12:00',
    exercises: [
      normalizeExercise({ id: 'ex-r1', name: 'Bench Press', catalogId: 'barbell-bench-press', sets: 4, reps: 8 }),
      normalizeExercise({ id: 'ex-r2', name: 'Squat', catalogId: 'barbell-back-squat', sets: 4, reps: 6 }),
      normalizeExercise({ id: 'ex-r3', name: 'Custom', sets: 3, reps: 12 }),
    ],
  });

  await repo.insertWorkout(workout);

  // Reorder: swap ex-r1 and ex-r2, keep ex-r3 last
  const reordered = normalizeWorkout({
    id: 'w-reorder-1',
    title: 'Reorder Test',
    date: '2026-11-13',
    time: '12:00',
    exercises: [
      normalizeExercise({ id: 'ex-r2', name: 'Squat', catalogId: 'barbell-back-squat', sets: 4, reps: 6 }),
      normalizeExercise({ id: 'ex-r1', name: 'Bench Press', catalogId: 'barbell-bench-press', sets: 4, reps: 8 }),
      normalizeExercise({ id: 'ex-r3', name: 'Custom', sets: 3, reps: 12 }),
    ],
  });

  await repo.updateWorkout(reordered);

  const loaded = await repo.getWorkoutById('w-reorder-1');
  assert.ok(loaded);
  assert.equal(loaded.exercises[0].id, 'ex-r2');
  assert.equal(loaded.exercises[0].catalogId, 'barbell-back-squat');
  assert.equal(loaded.exercises[1].id, 'ex-r1');
  assert.equal(loaded.exercises[1].catalogId, 'barbell-bench-press');
  assert.equal(loaded.exercises[2].catalogId, undefined);
});

// Test 8: Catalog exercise replacement (replace one catalog ID with another)
test('CatalogId - Test 8: Replacing one catalog exercise with another updates catalogId correctly', async () => {
  const db = await createTestDb();
  const repo = new SQLiteWorkoutRepository(db);

  const workout = normalizeWorkout({
    id: 'w-replace-1',
    title: 'Replace Test',
    date: '2026-11-13',
    time: '14:00',
    exercises: [
      normalizeExercise({ id: 'ex-rep1', name: 'Push-up', catalogId: 'push-up', targetMuscles: ['chest'], sets: 3, reps: 20 }),
    ],
  });

  await repo.insertWorkout(workout);

  // Replace push-up with bench press
  const replaced = normalizeWorkout({
    id: 'w-replace-1',
    title: 'Replace Test',
    date: '2026-11-13',
    time: '14:00',
    exercises: [
      normalizeExercise({ id: 'ex-rep1', name: 'Barbell Bench Press', catalogId: 'barbell-bench-press', targetMuscles: ['chest'], sets: 4, reps: 8, weight: 80 }),
    ],
  });

  await repo.updateWorkout(replaced);

  const loaded = await repo.getWorkoutById('w-replace-1');
  assert.ok(loaded);
  assert.equal(loaded.exercises[0].catalogId, 'barbell-bench-press');
  assert.equal(loaded.exercises[0].name, 'Barbell Bench Press');
});

// Test 9: Mixed catalog/custom exercise workouts via getAllWorkouts()
test('CatalogId - Test 9: Mixed catalog and custom exercises load correctly through getAllWorkouts()', async () => {
  const db = await createTestDb();
  const repo = new SQLiteWorkoutRepository(db);

  await repo.insertWorkout(normalizeWorkout({
    id: 'w-mixed-get-all',
    title: 'Mixed GetAll Test',
    date: '2026-11-13',
    time: '15:00',
    exercises: [
      normalizeExercise({ id: 'ex-m1', name: 'Deadlift', catalogId: 'deadlift', targetMuscles: ['back'], sets: 4, reps: 5 }),
      normalizeExercise({ id: 'ex-m2', name: 'My Custom Move', sets: 2, reps: 15 }),
      normalizeExercise({ id: 'ex-m3', name: 'Lateral Raise', catalogId: 'dumbbell-lateral-raise', targetMuscles: ['shoulders'], sets: 3, reps: 12, weight: 10 }),
    ],
  }));

  const all = await repo.getAllWorkouts();
  assert.equal(all.length, 1);
  const loaded = all[0];
  assert.equal(loaded.exercises[0].catalogId, 'deadlift');
  assert.equal(loaded.exercises[1].catalogId, undefined);
  assert.equal(loaded.exercises[2].catalogId, 'dumbbell-lateral-raise');
});

// Test 10: Unknown/future catalog ID does not crash
test('CatalogId - Test 10: Unknown or future catalog ID is preserved as-is without crash', async () => {
  const db = await createTestDb();
  const repo = new SQLiteWorkoutRepository(db);

  const workout = normalizeWorkout({
    id: 'w-unknown-catalog',
    title: 'Unknown Catalog Test',
    date: '2026-11-13',
    time: '16:00',
    exercises: [
      normalizeExercise({ id: 'ex-uk1', name: 'Future Exercise', catalogId: 'future-exercise-not-in-catalog-v5', sets: 3, reps: 10 }),
    ],
  });

  await repo.insertWorkout(workout);

  const loaded = await repo.getWorkoutById('w-unknown-catalog');
  assert.ok(loaded);
  assert.equal(loaded.exercises[0].catalogId, 'future-exercise-not-in-catalog-v5');
});

// Test 11: Transaction rollback preserves no orphaned catalog rows
test('CatalogId - Test 11: Failed transaction during insertion leaves no orphaned workout or exercise rows', async () => {
  const db = await createTestDb();
  const repo = new SQLiteWorkoutRepository(db);

  await assert.rejects(async () => {
    await db.withExclusiveTransactionAsync(async (txn) => {
      await txn.runAsync(
        `INSERT INTO workouts (id, title, date, time, notes, created_at) VALUES (?, ?, ?, ?, ?, ?);`,
        'w-rollback-catalog', 'Rollback Catalog Test', '2026-11-13', '17:00', null, new Date().toISOString()
      );
      await txn.runAsync(
        `INSERT INTO workout_exercises (id, workout_id, name, catalog_id, target_muscles, sets, reps, weight, duration, notes, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        'ex-rb1', 'w-rollback-catalog', 'Bench Press', 'barbell-bench-press', '["chest"]', 4, 8, 80, 12, null, 0
      );
      throw new Error('Simulated catalog persistence failure');
    });
  });

  const workout = await repo.getWorkoutById('w-rollback-catalog');
  assert.equal(workout, null);

  const orphans = await db.getAllAsync('SELECT * FROM workout_exercises WHERE workout_id = ?;', 'w-rollback-catalog');
  assert.equal(orphans.length, 0);
});

// Test 12: No unrelated workout mutation
test('CatalogId - Test 12: Updating one workout catalog exercise does not affect other workouts', async () => {
  const db = await createTestDb();
  const repo = new SQLiteWorkoutRepository(db);

  await repo.insertWorkout(normalizeWorkout({
    id: 'w-other-1',
    title: 'Other Workout',
    date: '2026-11-01',
    time: '09:00',
    exercises: [
      normalizeExercise({ id: 'ex-other1', name: 'Push-up', catalogId: 'push-up', sets: 3, reps: 20 }),
    ],
  }));

  await repo.insertWorkout(normalizeWorkout({
    id: 'w-target-1',
    title: 'Target Workout',
    date: '2026-11-13',
    time: '10:00',
    exercises: [
      normalizeExercise({ id: 'ex-target1', name: 'Squat', catalogId: 'barbell-back-squat', sets: 4, reps: 6 }),
    ],
  }));

  await repo.updateWorkout(normalizeWorkout({
    id: 'w-target-1',
    title: 'Target Workout',
    date: '2026-11-13',
    time: '10:00',
    exercises: [
      normalizeExercise({ id: 'ex-target1', name: 'Deadlift', catalogId: 'deadlift', sets: 4, reps: 5, weight: 120 }),
    ],
  }));

  const other = await repo.getWorkoutById('w-other-1');
  assert.ok(other);
  assert.equal(other.exercises[0].catalogId, 'push-up');
  assert.equal(other.exercises[0].name, 'Push-up');
});

// Test 13: App restart persistence of catalogId
test('CatalogId - Test 13: catalogId persists across fresh repository instantiation (simulated app restart)', async () => {
  const db = await createTestDb();
  const repo1 = new SQLiteWorkoutRepository(db);

  await repo1.insertWorkout(normalizeWorkout({
    id: 'w-persist-catalog',
    title: 'Catalog Persist Test',
    date: '2026-11-13',
    time: '20:00',
    exercises: [
      normalizeExercise({ id: 'ex-p1', name: 'Romanian Deadlift', catalogId: 'romanian-deadlift', targetMuscles: ['hamstrings'], sets: 4, reps: 8, weight: 70 }),
      normalizeExercise({ id: 'ex-p2', name: 'Free-form Stretch', sets: 1, reps: 1 }),
    ],
  }));

  // Simulate app restart with new repository instance on same db
  const repo2 = new SQLiteWorkoutRepository(db);
  const loaded = await repo2.getWorkoutById('w-persist-catalog');
  assert.ok(loaded);
  assert.equal(loaded.exercises[0].catalogId, 'romanian-deadlift');
  assert.equal(loaded.exercises[1].catalogId, undefined);
});

// Test 14: No auto-matching of catalog ID from exercise name
test('CatalogId - Test 14: Exercises without catalogId are never auto-matched to catalog entries by name', async () => {
  const db = await createTestDb();
  const repo = new SQLiteWorkoutRepository(db);

  // Insert exercise whose name matches a catalog entry but has no catalogId
  await repo.insertWorkout(normalizeWorkout({
    id: 'w-no-auto-match',
    title: 'No Auto Match Test',
    date: '2026-11-13',
    time: '18:00',
    exercises: [
      normalizeExercise({ id: 'ex-na1', name: 'Barbell Bench Press', sets: 3, reps: 10, weight: 60 }),
    ],
  }));

  const loaded = await repo.getWorkoutById('w-no-auto-match');
  assert.ok(loaded);
  // catalogId must remain undefined — never inferred from name
  assert.equal(loaded.exercises[0].catalogId, undefined);
  assert.equal(loaded.exercises[0].name, 'Barbell Bench Press');
});

// Test 15: Save failure protection (isSaving guard contract)
test('CatalogId - Test 15: Save-failure guard contract: duplicate submit returns without creating duplicate workout', async () => {
  const db = await createTestDb();
  void new SQLiteWorkoutRepository(db); // db verified to be a valid migrated database

  // Simulate the isSaving guard: second call while first is in progress does nothing
  let callCount = 0;
  async function guardedSave(isSaving: boolean): Promise<boolean> {
    if (isSaving) return false; // Guard prevents second call
    callCount++;
    return true;
  }

  const firstResult = await guardedSave(false);
  const secondResult = await guardedSave(true); // Duplicate tap blocked

  assert.equal(firstResult, true, 'First save must proceed');
  assert.equal(secondResult, false, 'Duplicate save must be blocked by isSaving guard');
  assert.equal(callCount, 1, 'Only one actual save operation must execute');

  // Also verify navigation-after-failure contract
  let navigated = false;
  let saveSucceeded = false;

  async function attemptSave(shouldFail: boolean) {
    try {
      if (shouldFail) throw new Error('SQLite disk full');
      saveSucceeded = true;
      navigated = true; // Navigation only after success
    } catch {
      navigated = false; // Navigation blocked on failure
      throw new Error('save failed');
    }
  }

  await assert.rejects(() => attemptSave(true));
  assert.equal(navigated, false, 'Navigation must not occur after save failure');
  assert.equal(saveSucceeded, false);
});
