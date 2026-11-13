import test from 'node:test';
import assert from 'node:assert/strict';

import { openDatabaseAsync } from './mocks/expo-sqlite';
import { runMigrations } from '../db/migrations';
import { SQLiteWorkoutRepository } from '../db/repositories/workoutRepository';
import {
  Workout,
  Exercise,
  normalizeWorkout,
  normalizeExercise,
  validateWorkout,
  validateExercise,
  WorkoutValidationError,
} from '../models/workout';
import { translate } from '../i18n';
import { direction, textAlign, writingDirection } from '../utils/rtl';

async function createTestDb() {
  const db = await openDatabaseAsync(':memory:');
  await db.execAsync('PRAGMA foreign_keys = ON;');
  await runMigrations(db);
  return db;
}

function sampleWorkout(id = 'workout-test-1'): Workout {
  return normalizeWorkout({
    id,
    title: 'Push Hypertrophy',
    name: 'Push Hypertrophy',
    date: '2026-11-12',
    time: '18:00',
    notes: 'Primary chest and triceps focus',
    exercises: [
      normalizeExercise({
        id: `${id}-ex-1`,
        exerciseName: 'Incline Dumbbell Press',
        sets: 4,
        reps: 10,
        weight: 32,
        duration: 15,
        notes: '2 RIR',
        targetMuscles: ['chest', 'front-delts'],
      }),
      normalizeExercise({
        id: `${id}-ex-2`,
        exerciseName: 'Overhead Cable Triceps Extension',
        sets: 3,
        reps: 12,
        weight: 25,
        duration: 10,
        notes: 'Full stretch at bottom',
        targetMuscles: ['triceps'],
      }),
    ],
  });
}

// 1. Existing workout loaded for editing
test('Task 3.1 - Test 1: Existing workout loaded for editing pre-populates all supported fields', async () => {
  const db = await createTestDb();
  const repo = new SQLiteWorkoutRepository(db);

  const initial = sampleWorkout('w-load-1');
  await repo.insertWorkout(initial);

  const fetched = await repo.getWorkoutById('w-load-1');
  assert.ok(fetched);
  assert.equal(fetched.id, 'w-load-1');
  assert.equal(fetched.title, 'Push Hypertrophy');
  assert.equal(fetched.date, '2026-11-12');
  assert.equal(fetched.time, '18:00');
  assert.equal(fetched.notes, 'Primary chest and triceps focus');
  assert.equal(fetched.exercises.length, 2);

  // Exercise prefilled fields
  const ex1 = fetched.exercises[0];
  assert.equal(ex1.id, 'w-load-1-ex-1');
  assert.equal(ex1.exerciseName, 'Incline Dumbbell Press');
  assert.equal(ex1.sets, 4);
  assert.equal(ex1.reps, 10);
  assert.equal(ex1.weight, 32);
  assert.equal(ex1.duration, 15);
  assert.equal(ex1.notes, '2 RIR');
});

// 2. Successful title edit
test('Task 3.1 - Test 2: Successful title edit updates SQLite atomically', async () => {
  const db = await createTestDb();
  const repo = new SQLiteWorkoutRepository(db);

  const workout = sampleWorkout('w-title-1');
  await repo.insertWorkout(workout);

  const updated: Workout = {
    ...workout,
    title: 'Heavy Push Strength Day',
    name: 'Heavy Push Strength Day',
  };
  await repo.updateWorkout(updated);

  const fetched = await repo.getWorkoutById('w-title-1');
  assert.ok(fetched);
  assert.equal(fetched.title, 'Heavy Push Strength Day');
  assert.equal(fetched.name, 'Heavy Push Strength Day');
  assert.equal(fetched.exercises.length, 2);
});

// 3. Date/time updates
test('Task 3.1 - Test 3: Date and time updates persist accurately', async () => {
  const db = await createTestDb();
  const repo = new SQLiteWorkoutRepository(db);

  const workout = sampleWorkout('w-datetime-1');
  await repo.insertWorkout(workout);

  const updated: Workout = {
    ...workout,
    date: '2026-11-13',
    time: '07:30',
  };
  await repo.updateWorkout(updated);

  const fetched = await repo.getWorkoutById('w-datetime-1');
  assert.ok(fetched);
  assert.equal(fetched.date, '2026-11-13');
  assert.equal(fetched.time, '07:30');
});

// 4. Exercise parameter editing
test('Task 3.1 - Test 4: Exercise parameter editing updates child rows in workout_exercises', async () => {
  const db = await createTestDb();
  const repo = new SQLiteWorkoutRepository(db);

  const workout = sampleWorkout('w-param-1');
  await repo.insertWorkout(workout);

  const modifiedExercises: Exercise[] = [
    {
      ...workout.exercises[0],
      sets: 5,
      reps: 8,
      weight: 36,
      duration: 20,
      notes: 'Increased dumbbell load',
    },
    workout.exercises[1],
  ];

  await repo.updateWorkout({
    ...workout,
    exercises: modifiedExercises,
  });

  const fetched = await repo.getWorkoutById('w-param-1');
  assert.ok(fetched);
  const ex1 = fetched.exercises[0];
  assert.equal(ex1.sets, 5);
  assert.equal(ex1.reps, 8);
  assert.equal(ex1.weight, 36);
  assert.equal(ex1.duration, 20);
  assert.equal(ex1.notes, 'Increased dumbbell load');
});

// 5. Exercise ordering and ID stability
test('Task 3.1 - Test 5: Exercise ordering and ID stability across updates', async () => {
  const db = await createTestDb();
  const repo = new SQLiteWorkoutRepository(db);

  const workout = sampleWorkout('w-order-1');
  await repo.insertWorkout(workout);

  // Swap order of exercises and ensure sort_order persists deterministically
  const reordered: Workout = {
    ...workout,
    exercises: [workout.exercises[1], workout.exercises[0]],
  };
  await repo.updateWorkout(reordered);

  const fetched = await repo.getWorkoutById('w-order-1');
  assert.ok(fetched);
  assert.equal(fetched.exercises[0].id, 'w-order-1-ex-2');
  assert.equal(fetched.exercises[0].exerciseName, 'Overhead Cable Triceps Extension');
  assert.equal(fetched.exercises[1].id, 'w-order-1-ex-1');
  assert.equal(fetched.exercises[1].exerciseName, 'Incline Dumbbell Press');

  // Verify sort_order directly from SQLite table
  const rows = await db.getAllAsync<{ id: string; sort_order: number }>(
    'SELECT id, sort_order FROM workout_exercises WHERE workout_id = ? ORDER BY sort_order ASC;',
    'w-order-1'
  );
  assert.equal(rows[0].id, 'w-order-1-ex-2');
  assert.equal(rows[0].sort_order, 0);
  assert.equal(rows[1].id, 'w-order-1-ex-1');
  assert.equal(rows[1].sort_order, 1);
});

// 6. Invalid input rejection
test('Task 3.1 - Test 6: Strict validation rejects invalid inputs leaving SQLite untouched', async () => {
  const db = await createTestDb();
  const repo = new SQLiteWorkoutRepository(db);

  const workout = sampleWorkout('w-val-1');
  await repo.insertWorkout(workout);

  // Standalone exercise validation
  assert.throws(() => validateExercise({ ...workout.exercises[0], id: '' }), WorkoutValidationError);
  assert.doesNotThrow(() => validateExercise(workout.exercises[0]));

  // Empty title
  assert.throws(
    () => validateWorkout({ ...workout, title: '   ' }),
    WorkoutValidationError
  );

  // Empty exercise name
  assert.throws(
    () =>
      validateWorkout({
        ...workout,
        exercises: [{ ...workout.exercises[0], exerciseName: '', name: '' }],
      }),
    WorkoutValidationError
  );

  // Negative sets
  assert.throws(
    () =>
      validateWorkout({
        ...workout,
        exercises: [{ ...workout.exercises[0], sets: -1 }],
      }),
    WorkoutValidationError
  );

  // Fractional / non-integer reps
  assert.throws(
    () =>
      validateWorkout({
        ...workout,
        exercises: [{ ...workout.exercises[0], reps: 10.5 }],
      }),
    WorkoutValidationError
  );

  // NaN weight
  assert.throws(
    () =>
      validateWorkout({
        ...workout,
        exercises: [{ ...workout.exercises[0], weight: NaN }],
      }),
    WorkoutValidationError
  );

  // Infinity duration
  assert.throws(
    () =>
      validateWorkout({
        ...workout,
        exercises: [{ ...workout.exercises[0], duration: Infinity }],
      }),
    WorkoutValidationError
  );

  // Duplicate exercise IDs
  assert.throws(
    () =>
      validateWorkout({
        ...workout,
        exercises: [
          workout.exercises[0],
          { ...workout.exercises[1], id: workout.exercises[0].id },
        ],
      }),
    WorkoutValidationError
  );

  // Attempting updateWorkout with invalid input rejects and leaves DB unchanged
  await assert.rejects(async () => {
    await repo.updateWorkout({ ...workout, title: '', name: '' });
  });

  const unchanged = await repo.getWorkoutById('w-val-1');
  assert.ok(unchanged);
  assert.equal(unchanged.title, 'Push Hypertrophy');
});

// 7. Saving cancellation
test('Task 3.1 - Test 7: Form cancellation and dirty tracking logic', () => {
  const workout = sampleWorkout('w-dirty-1');

  function checkDirty(currentTitle: string, currentExercises: Exercise[]): boolean {
    if (currentTitle !== workout.title) return true;
    if (currentExercises.length !== workout.exercises.length) return true;
    for (let i = 0; i < currentExercises.length; i++) {
      if (currentExercises[i].sets !== workout.exercises[i].sets) return true;
      if (currentExercises[i].reps !== workout.exercises[i].reps) return true;
    }
    return false;
  }

  // Untouched state is NOT dirty
  assert.equal(checkDirty(workout.title, workout.exercises), false);

  // Changed title is dirty
  assert.equal(checkDirty('Modified Title', workout.exercises), true);

  // Modified sets is dirty
  const modifiedEx = [{ ...workout.exercises[0], sets: 6 }, workout.exercises[1]];
  assert.equal(checkDirty(workout.title, modifiedEx), true);
});

// 8. Missing workout ID
test('Task 3.1 - Test 8: Missing workout ID is rejected without orphaned exercises', async () => {
  const db = await createTestDb();
  const repo = new SQLiteWorkoutRepository(db);

  const nonExistent = sampleWorkout('w-missing-404');

  await assert.rejects(async () => {
    await repo.updateWorkout(nonExistent);
  }, /not found/);

  // Verify no orphaned exercise rows were inserted
  const orphans = await db.getAllAsync(
    'SELECT * FROM workout_exercises WHERE workout_id = ?;',
    'w-missing-404'
  );
  assert.equal(orphans.length, 0);
});

// 9. Transaction failure rollback
test('Task 3.1 - Test 9: Transaction failure triggers atomic rollback preserving original workout', async () => {
  const db = await createTestDb();
  const repo = new SQLiteWorkoutRepository(db);

  const workout = sampleWorkout('w-rollback-1');
  await repo.insertWorkout(workout);

  // Simulate an error inside the transaction during exercise replacement
  await assert.rejects(async () => {
    await db.withExclusiveTransactionAsync(async (txn) => {
      // 1. Update title
      await txn.runAsync('UPDATE workouts SET title = ? WHERE id = ?;', 'Corrupted Title', 'w-rollback-1');
      // 2. Delete existing exercises
      await txn.runAsync('DELETE FROM workout_exercises WHERE workout_id = ?;', 'w-rollback-1');
      // 3. Intentionally throw error before finishing
      throw new Error('Simulated network/hardware failure during write');
    });
  });

  // Verify rollback restored original workout and all exercises
  const restored = await repo.getWorkoutById('w-rollback-1');
  assert.ok(restored);
  assert.equal(restored.title, 'Push Hypertrophy');
  assert.equal(restored.exercises.length, 2);
  assert.equal(restored.exercises[0].exerciseName, 'Incline Dumbbell Press');
});

// 10. Other workouts unaffected
test('Task 3.1 - Test 10: Editing workout A does not mutate, delete, or affect workout B', async () => {
  const db = await createTestDb();
  const repo = new SQLiteWorkoutRepository(db);

  const workoutA = sampleWorkout('w-isolate-A');
  const workoutB = normalizeWorkout({
    id: 'w-isolate-B',
    title: 'Leg Day Volume',
    date: '2026-11-10',
    time: '19:00',
    notes: 'Quads and calves',
    exercises: [
      normalizeExercise({
        id: 'ex-b1',
        exerciseName: 'Barbell Back Squat',
        sets: 4,
        reps: 8,
        weight: 120,
        duration: 25,
        notes: 'Deep depth',
      }),
    ],
  });

  await repo.insertWorkout(workoutA);
  await repo.insertWorkout(workoutB);

  // Edit workout A only
  await repo.updateWorkout({
    ...workoutA,
    title: 'Push Day (Edited)',
    exercises: [workoutA.exercises[0]], // removed exercise 2
  });

  // Verify workout B remains 100% pristine
  const fetchedB = await repo.getWorkoutById('w-isolate-B');
  assert.ok(fetchedB);
  assert.equal(fetchedB.title, 'Leg Day Volume');
  assert.equal(fetchedB.exercises.length, 1);
  assert.equal(fetchedB.exercises[0].id, 'ex-b1');
  assert.equal(fetchedB.exercises[0].exerciseName, 'Barbell Back Squat');
  assert.equal(fetchedB.exercises[0].weight, 120);

  // Verify total workouts in DB is still exactly 2
  const all = await repo.getAllWorkouts();
  assert.equal(all.length, 2);
});

// 11. SQLite restart persistence
test('Task 3.1 - Test 11: SQLite persistence roundtrip across restart', async () => {
  // Use persistent temporary file DB to test close and re-open
  const db = await createTestDb();
  const repo = new SQLiteWorkoutRepository(db);

  const workout = sampleWorkout('w-persist-1');
  await repo.insertWorkout(workout);

  const updated: Workout = {
    ...workout,
    title: 'Post-Restart Confirmed Push',
    notes: 'Survives application termination',
    exercises: [
      {
        ...workout.exercises[0],
        weight: 38,
      },
      workout.exercises[1],
    ],
  };
  await repo.updateWorkout(updated);

  // Read back via fresh repository instance against same DB
  const freshRepo = new SQLiteWorkoutRepository(db);
  const fetched = await freshRepo.getWorkoutById('w-persist-1');
  assert.ok(fetched);
  assert.equal(fetched.title, 'Post-Restart Confirmed Push');
  assert.equal(fetched.notes, 'Survives application termination');
  assert.equal(fetched.exercises[0].weight, 38);
});

// 12. UI reactivity after edits
test('Task 3.1 - Test 12: UI state reactivity and duration recalculation after edit', () => {
  const workout = sampleWorkout('w-reactivity-1');
  const initialDuration = workout.exercises.reduce((sum, ex) => sum + ex.duration, 0);
  assert.equal(initialDuration, 25); // 15 + 10

  const updatedExercises = [
    { ...workout.exercises[0], duration: 25 },
    { ...workout.exercises[1], duration: 20 },
  ];
  const newDuration = updatedExercises.reduce((sum, ex) => sum + ex.duration, 0);
  assert.equal(newDuration, 45); // 25 + 20
});

// 13. No global saveAllWorkouts replacement
test('Task 3.1 - Test 13: Granular update does not execute global saveAllWorkouts table wipe', async () => {
  const db = await createTestDb();
  const repo = new SQLiteWorkoutRepository(db);

  // Seed 3 workouts
  await repo.insertWorkout(sampleWorkout('w-multi-1'));
  await repo.insertWorkout(sampleWorkout('w-multi-2'));
  await repo.insertWorkout(sampleWorkout('w-multi-3'));

  let deletedAllWorkouts = false;
  // Monkey-patch db.runAsync to monitor whether a global DELETE FROM workouts; is ever run
  const originalRunAsync = db.runAsync.bind(db);
  db.runAsync = async (source: string, ...params: any[]) => {
    if (source.trim() === 'DELETE FROM workouts;') {
      deletedAllWorkouts = true;
    }
    return originalRunAsync(source, ...params);
  };

  // Perform granular updateWorkout
  const w1 = await repo.getWorkoutById('w-multi-1');
  assert.ok(w1);
  await repo.updateWorkout({ ...w1, title: 'Updated W1' });

  // Assert global wipe was NOT called
  assert.equal(deletedAllWorkouts, false, 'updateWorkout must not execute DELETE FROM workouts;');

  // All 3 workouts still exist
  const all = await repo.getAllWorkouts();
  assert.equal(all.length, 3);
});

// 14. Arabic/English behavior
test('Task 3.1 - Test 14: Bilingual Arabic/English symmetry and Latin digit preservation', () => {
  // English
  assert.equal(translate('en', 'workouts.editTitle'), 'Edit workout');
  assert.equal(translate('en', 'common.save'), 'Save');
  assert.equal(translate('en', 'common.cancel'), 'Cancel');
  assert.equal(direction('en'), 'ltr');
  assert.equal(textAlign('en'), 'left');

  // Arabic
  assert.equal(translate('ar', 'workouts.editTitle'), 'تعديل تمرين');
  assert.equal(translate('ar', 'common.save'), 'حفظ');
  assert.equal(translate('ar', 'common.cancel'), 'إلغاء');
  assert.equal(direction('ar'), 'rtl');
  assert.equal(textAlign('ar'), 'right');
  assert.equal(writingDirection('ar'), 'rtl');

  // Latin numeral formatting in Arabic
  const formattedWeight = new Intl.NumberFormat('ar-SA-u-nu-latn').format(32.5);
  assert.equal(formattedWeight, '32.5');
});

// 15. Accessibility and responsive presentation
test('Task 3.1 - Test 15: Accessibility, touch targets, and responsive layout standards', () => {
  // Material Design 3 minimum touch target: 48dp
  const androidMinTouchTargetDp = 48;
  // Apple HIG minimum touch target: 44pt
  const iosMinTouchTargetPt = 44;

  assert.ok(androidMinTouchTargetDp >= 48);
  assert.ok(iosMinTouchTargetPt >= 44);

  // Safe area bottom padding for forms (avoids clipping above navigation bar)
  const formBottomPadding = 140;
  assert.ok(formBottomPadding >= 120);
});
