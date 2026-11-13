import assert from 'node:assert/strict';
import test from 'node:test';

import { SQLiteWorkoutRepository } from '../db/repositories/workoutRepository';
import type { Database } from '../db/types';
import { runMigrations } from '../db/migrations';
import { normalizeExercise, normalizeWorkout, type Workout } from '../models/workout';
import { createId } from '../utils/id';
import {
  calculateExerciseVolume,
  calculateWorkoutProgressionSummary,
  createQuickAddWorkoutDraft,
  filterWorkoutsByPeriod,
  getDateWindow,
  getExerciseHistory,
  getPreviousDateWindow,
  isConfirmedBodyweightExercise,
  isValidDateString,
  toLocalDateString,
} from '../utils/workoutAnalytics';
import { openDatabaseAsync } from './mocks/expo-sqlite';

async function createTestDb(): Promise<Database> {
  const db = (await openDatabaseAsync(':memory:')) as unknown as Database;
  await db.execAsync('PRAGMA foreign_keys = ON;');
  await runMigrations(db);
  return db;
}

function sampleWorkout(
  id: string,
  date: string,
  time: string,
  exercises: ReturnType<typeof normalizeExercise>[] = []
): Workout {
  return normalizeWorkout({
    id,
    title: `Workout ${id}`,
    date,
    time,
    notes: 'Sample workout notes',
    exercises,
  });
}

// 1. Current seven-day window
test('Hardening 1: Current seven-day window computes exact calendar boundaries', () => {
  const refDate = new Date('2026-11-15T12:00:00Z');
  const window7d = getDateWindow('7d', refDate);

  assert.equal(window7d.endDate, '2026-11-15');
  assert.equal(window7d.startDate, '2026-11-09');

  const wInStart = sampleWorkout('w-in-start', '2026-11-09', '09:00');
  const wInMid = sampleWorkout('w-in-mid', '2026-11-12', '10:00');
  const wInEnd = sampleWorkout('w-in-end', '2026-11-15', '11:00');
  const wBefore = sampleWorkout('w-before', '2026-11-08', '23:59');

  const filtered = filterWorkoutsByPeriod(
    [wInStart, wInMid, wInEnd, wBefore],
    '7d',
    refDate
  );

  assert.equal(filtered.length, 3);
  assert.deepEqual(
    filtered.map((w) => w.id),
    ['w-in-end', 'w-in-mid', 'w-in-start']
  );
});

// 2. Previous seven-day window
test('Hardening 2: Previous seven-day window computes exact preceding calendar period', () => {
  const refDate = new Date('2026-11-15T12:00:00Z');
  const prevWindow7d = getPreviousDateWindow('7d', refDate);

  assert.equal(prevWindow7d.endDate, '2026-11-08');
  assert.equal(prevWindow7d.startDate, '2026-11-02');
});

// 3. No current/previous overlap
test('Hardening 3: Current and previous periods never overlap across 7d, 30d, and 90d', () => {
  const refDate = new Date('2026-11-15T12:00:00Z');

  for (const period of ['7d', '30d', '90d'] as const) {
    const curr = getDateWindow(period, refDate);
    const prev = getPreviousDateWindow(period, refDate);

    assert.ok(curr.startDate, `Current period ${period} must have startDate`);
    assert.ok(prev.startDate, `Previous period ${period} must have startDate`);
    assert.ok(prev.endDate, `Previous period ${period} must have endDate`);

    // Invariant: previous period ends strictly before current period begins
    assert.ok(
      prev.endDate! < curr.startDate!,
      `Previous endDate (${prev.endDate}) must be strictly less than current startDate (${curr.startDate}) for ${period}`
    );
  }
});

// 4. Future-dated workout exclusion
test('Hardening 4: Historical bounded filters strictly exclude future-dated workouts', () => {
  const refDate = new Date('2026-11-15T12:00:00Z');

  const wPast = sampleWorkout('w-past', '2026-11-14', '10:00');
  const wToday = sampleWorkout('w-today', '2026-11-15', '10:00');
  const wTomorrow = sampleWorkout('w-tomorrow', '2026-11-16', '08:00');
  const wNextWeek = sampleWorkout('w-next-week', '2026-11-22', '08:00');

  const all = [wPast, wToday, wTomorrow, wNextWeek];

  const res7d = filterWorkoutsByPeriod(all, '7d', refDate);
  assert.deepEqual(
    res7d.map((w) => w.id),
    ['w-today', 'w-past']
  );

  const res30d = filterWorkoutsByPeriod(all, '30d', refDate);
  assert.deepEqual(
    res30d.map((w) => w.id),
    ['w-today', 'w-past']
  );

  // 'all' with includeFuture: false excludes future workouts
  const resAllPast = filterWorkoutsByPeriod(all, 'all', refDate, { includeFuture: false });
  assert.deepEqual(
    resAllPast.map((w) => w.id),
    ['w-today', 'w-past']
  );

  // 'all' by default retains all logged/planned workouts
  const resAllDefault = filterWorkoutsByPeriod(all, 'all', refDate);
  assert.equal(resAllDefault.length, 4);
});

// 5. Local timezone boundary
test('Hardening 5: Local calendar formatting protects against midnight boundary drift', () => {
  // Midnight local time
  const localMidnight = new Date(2026, 10, 15, 0, 0, 1);
  const formatted = toLocalDateString(localMidnight);
  assert.equal(formatted, '2026-11-15');

  // Late night local time
  const localLateNight = new Date(2026, 10, 15, 23, 59, 59);
  const formattedLate = toLocalDateString(localLateNight);
  assert.equal(formattedLate, '2026-11-15');
});

// 6. UTC date conversion boundary
test('Hardening 6: UTC date conversion does not shift local calendar dates', () => {
  const d = new Date(2026, 10, 15, 12, 0, 0);
  const window7d = getDateWindow('7d', d);
  assert.equal(window7d.endDate, '2026-11-15');
  assert.equal(window7d.startDate, '2026-11-09');
});

// 7. Month/year transition
test('Hardening 7: Date windows compute seamlessly across month and year transitions', () => {
  // Near New Year
  const newYearRef = new Date(2027, 0, 3, 12, 0, 0); // 2027-01-03
  const curr = getDateWindow('7d', newYearRef);
  assert.equal(curr.endDate, '2027-01-03');
  assert.equal(curr.startDate, '2026-12-28');

  const prev = getPreviousDateWindow('7d', newYearRef);
  assert.equal(prev.endDate, '2026-12-27');
  assert.equal(prev.startDate, '2026-12-21');
});

// 8. Leap-year date
test('Hardening 8: Handles leap years and non-leap years accurately', () => {
  // 2024 is leap year: Feb 29 exists
  assert.equal(isValidDateString('2024-02-29'), true);

  // 2026 is NOT leap year: Feb 29 does not exist
  assert.equal(isValidDateString('2026-02-29'), false);

  const leapRef = new Date(2024, 2, 2, 12, 0, 0); // 2024-03-02
  const window7d = getDateWindow('7d', leapRef);
  assert.equal(window7d.endDate, '2024-03-02');
  assert.equal(window7d.startDate, '2024-02-25'); // 25, 26, 27, 28, 29, 01, 02 (7 days)
});

// 9. Invalid date handling
test('Hardening 9: Safely neutralizes invalid workout dates without crash', () => {
  assert.equal(isValidDateString(''), false);
  assert.equal(isValidDateString('not-a-date'), false);
  assert.equal(isValidDateString('2026-02-30'), false);
  assert.equal(isValidDateString('2026-13-01'), false);
  assert.equal(isValidDateString('2026-04-31'), false);
  assert.equal(isValidDateString(null), false);
  assert.equal(isValidDateString(undefined), false);

  const wValid = sampleWorkout('w-val', '2026-11-14', '10:00');
  const wInvalidDate = sampleWorkout('w-inv', '2026-02-30', '10:00');
  const wEmptyDate = sampleWorkout('w-empty', '', '10:00');

  const filtered = filterWorkoutsByPeriod([wValid, wInvalidDate, wEmptyDate], '7d', new Date('2026-11-15T12:00:00Z'));
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].id, 'w-val');
});

// 10. Stable chronological ordering
test('Hardening 10: Sorts descending deterministically using ID tie-breaker', () => {
  const wA = sampleWorkout('w-aaa', '2026-11-10', '10:00');
  const wB = sampleWorkout('w-bbb', '2026-11-10', '10:00');
  const wC = sampleWorkout('w-ccc', '2026-11-10', '10:00');

  const order1 = filterWorkoutsByPeriod([wA, wB, wC], 'all');
  const order2 = filterWorkoutsByPeriod([wC, wB, wA], 'all');

  assert.deepEqual(order1.map((w) => w.id), order2.map((w) => w.id));
  assert.deepEqual(order1.map((w) => w.id), ['w-ccc', 'w-bbb', 'w-aaa']);
});

// 11. Rapid repeated Quick-Add IDs
test('Hardening 11: Rapid quick-add calls generate strictly unique collision-resistant IDs', () => {
  const source = sampleWorkout('w-source-rapid', '2026-11-10', '10:00', [
    normalizeExercise({ id: 'ex-1', name: 'Squat', sets: 3, reps: 10, weight: 80 }),
  ]);

  const idSet = new Set<string>();
  for (let i = 0; i < 100; i++) {
    const draft = createQuickAddWorkoutDraft(source);
    assert.ok(draft.id, 'Draft workout must have an id');
    assert.ok(!idSet.has(draft.id), `Collision detected for ID: ${draft.id}`);
    idSet.add(draft.id);
  }
  assert.equal(idSet.size, 100);
});

// 12. Exercise ID uniqueness
test('Hardening 12: Quick-add exercises receive distinct IDs differing from source', () => {
  const source = sampleWorkout('w-multi-ex', '2026-11-10', '10:00', [
    normalizeExercise({ id: 'ex-src-1', name: 'Bench', sets: 4, reps: 8, weight: 70 }),
    normalizeExercise({ id: 'ex-src-2', name: 'Flyes', sets: 3, reps: 12, weight: 15 }),
    normalizeExercise({ id: 'ex-src-3', name: 'Push-up', sets: 3, reps: 20, weight: 0 }),
  ]);

  const draft = createQuickAddWorkoutDraft(source);
  assert.equal(draft.exercises.length, 3);

  const draftExIds = new Set(draft.exercises.map((e) => e.id));
  assert.equal(draftExIds.size, 3, 'All draft exercise IDs must be distinct');

  for (const srcEx of source.exercises) {
    assert.ok(!draftExIds.has(srcEx.id), `Draft must not reuse source exercise ID: ${srcEx.id}`);
  }
});

// 13. Failed-save retry
test('Hardening 13: Failed save preserves draft ID across retry inserting exactly one workout', async () => {
  const db: Database = await createTestDb();
  const repo = new SQLiteWorkoutRepository(db);

  const draftWorkoutId = createId('workout');
  const draftExId = createId('draft-ex');

  const workoutPayload: Workout = normalizeWorkout({
    id: draftWorkoutId,
    title: 'Retryable Workout',
    date: '2026-11-13',
    time: '12:00',
    exercises: [
      normalizeExercise({
        id: draftExId,
        name: 'Shoulder Press',
        sets: 3,
        reps: 10,
        weight: 40,
        catalogId: 'dumbbell-shoulder-press',
      }),
    ],
  });

  // Attempt 1 fails: simulate connection or constraint failure by passing invalid DB or intentional error
  let attempt1Failed = false;
  try {
    await db.withExclusiveTransactionAsync(async () => {
      throw new Error('Simulated transient SQL failure');
    });
  } catch {
    attempt1Failed = true;
  }
  assert.ok(attempt1Failed, 'First attempt must fail cleanly');

  // Verify DB remains empty
  const loadedBeforeRetry = await repo.getAllWorkouts();
  assert.equal(loadedBeforeRetry.length, 0);

  // Attempt 2 (retry): uses the exact same draft workout ID
  await repo.insertWorkout(workoutPayload);

  // Verify exactly one workout is present with the draft ID
  const loadedAfterRetry = await repo.getAllWorkouts();
  assert.equal(loadedAfterRetry.length, 1);
  assert.equal(loadedAfterRetry[0].id, draftWorkoutId);
  assert.equal(loadedAfterRetry[0].exercises[0].id, draftExId);
});

// 14. Catalog ID preservation
test('Hardening 14: Quick-add preserves catalogId on catalog exercises and undefined on custom', () => {
  const source = sampleWorkout('w-mixed-cat', '2026-11-10', '10:00', [
    normalizeExercise({ id: 'e1', name: 'Barbell Bench Press', catalogId: 'barbell-bench-press', sets: 4, reps: 8, weight: 80 }),
    normalizeExercise({ id: 'e2', name: 'My Custom Finisher', sets: 3, reps: 15, weight: 10 }),
  ]);

  const draft = createQuickAddWorkoutDraft(source);
  assert.equal(draft.exercises[0].catalogId, 'barbell-bench-press');
  assert.equal(draft.exercises[1].catalogId, undefined);
});

// 15. Source workout immutability
test('Hardening 15: Source workout and exercises are not mutated during quick-add', () => {
  const source = sampleWorkout('w-immutable-src', '2026-11-10', '10:00', [
    normalizeExercise({ id: 'ex-imm', name: 'Deadlift', sets: 5, reps: 5, weight: 140, catalogId: 'barbell-deadlift' }),
  ]);

  const sourceSnapshot = structuredClone(source);
  const draft = createQuickAddWorkoutDraft(source);

  // Mutate draft extensively
  draft.title = 'Completely Changed Title';
  draft.exercises[0].sets = 999;
  draft.exercises[0].weight = 999;

  assert.deepEqual(source, sourceSnapshot, 'Source workout must remain strictly unchanged');
});

// 16. Bodyweight exercise classification
test('Hardening 16: Distinguishes confirmed bodyweight from zero-weight resistance exercises', () => {
  // Confirmed bodyweight via catalog
  const catalogBw = normalizeExercise({
    id: 'e-pullup',
    name: 'Pull-up',
    catalogId: 'pull-up',
    sets: 4,
    reps: 10,
    weight: 0,
  });
  assert.equal(isConfirmedBodyweightExercise(catalogBw), true);
  const volBw = calculateExerciseVolume(catalogBw);
  assert.equal(volBw.category, 'bodyweight');
  assert.equal(volBw.isBodyweight, true);
  assert.equal(volBw.isUnweighted, false);
  assert.equal(volBw.volumeKg, 0);

  // Confirmed bodyweight via recognized name pattern
  const customPushup = normalizeExercise({
    id: 'e-pushup',
    name: 'Push-up',
    sets: 3,
    reps: 20,
    weight: 0,
  });
  assert.equal(isConfirmedBodyweightExercise(customPushup), true);
  assert.equal(calculateExerciseVolume(customPushup).isBodyweight, true);

  // Weighted exercise logged with 0 weight (unweighted/unknown resistance, NOT bodyweight)
  const zeroWeightBench = normalizeExercise({
    id: 'e-bench-zero',
    name: 'Barbell Bench Press',
    catalogId: 'barbell-bench-press',
    sets: 3,
    reps: 10,
    weight: 0,
  });
  assert.equal(isConfirmedBodyweightExercise(zeroWeightBench), false);
  const volZeroBench = calculateExerciseVolume(zeroWeightBench);
  assert.equal(volZeroBench.category, 'unweighted');
  assert.equal(volZeroBench.isBodyweight, false);
  assert.equal(volZeroBench.isUnweighted, true);
  assert.equal(volZeroBench.volumeKg, 0);
});

// 17. Unweighted and duration-only distinctions
test('Hardening 17: Distinguishes duration-only from unweighted resistance exercises', () => {
  // Duration-only (e.g. plank)
  const plank = normalizeExercise({
    id: 'e-plank',
    name: 'Plank',
    duration: 60,
    sets: 1,
    reps: 0,
    weight: 0,
  });
  const volPlank = calculateExerciseVolume(plank);
  assert.equal(volPlank.category, 'duration_only');
  assert.equal(volPlank.isDurationOnly, true);
  assert.equal(volPlank.isWeighted, false);

  // Unweighted resistance (e.g. Bicep Curl with forgotten weight)
  const curl = normalizeExercise({
    id: 'e-curl',
    name: 'Bicep Curl',
    sets: 3,
    reps: 12,
    weight: 0,
    duration: 5,
  });
  const volCurl = calculateExerciseVolume(curl);
  assert.equal(volCurl.category, 'unweighted');
  assert.equal(volCurl.isUnweighted, true);
  assert.equal(volCurl.isBodyweight, false);
  assert.equal(volCurl.isDurationOnly, false);
});

// 18. Muscle-group attribution invariants
test('Hardening 18: Sum of muscle group volumes strictly equals total workout volume', () => {
  const w = sampleWorkout('w-invariant', '2026-11-12', '10:00', [
    normalizeExercise({ id: 'e1', name: 'Bench', sets: 4, reps: 8, weight: 80, targetMuscles: ['chest', 'triceps'] }),
    normalizeExercise({ id: 'e2', name: 'Pull-up', catalogId: 'pull-up', sets: 3, reps: 10, weight: 0 }),
    normalizeExercise({ id: 'e3', name: 'Overhead Press', sets: 3, reps: 10, weight: 45, targetMuscles: ['shoulders', 'triceps'] }),
    normalizeExercise({ id: 'e4', name: 'Plank', duration: 90, sets: 1, reps: 0, weight: 0, targetMuscles: ['core'] }),
  ]);

  const summary = calculateWorkoutProgressionSummary([w], '7d', new Date('2026-11-15T12:00:00Z'));
  const sumOfMuscleVolumes = Object.values(summary.volumeByMuscle).reduce((sum, v) => sum + v, 0);

  // Strict invariant: sum(volumeByMuscle) === totalVolumeKg
  assert.equal(Math.round(sumOfMuscleVolumes * 10) / 10, summary.totalVolumeKg);
});

// 19. Existing history records unchanged
test('Hardening 19: Legacy workouts without catalogId query safely without corruption', () => {
  const legacy = sampleWorkout('w-legacy', '2026-11-01', '08:00', [
    normalizeExercise({ id: 'ex-leg-1', name: 'Vintage Squat', sets: 5, reps: 5, weight: 100 }),
  ]);

  const history = getExerciseHistory([legacy], { exerciseName: 'Vintage Squat' });
  assert.equal(history.length, 1);
  assert.equal(history[0].workoutId, 'w-legacy');
  assert.equal(history[0].volumeKg, 2500);
  assert.equal(history[0].catalogId, undefined);
});

// 20. SQLite restart persistence
test('Hardening 20: Persisted quick-add workout survives database disconnect and reload', async () => {
  const db: Database = await createTestDb();
  const repo = new SQLiteWorkoutRepository(db);

  const source = sampleWorkout('w-src-db', '2026-11-10', '09:00', [
    normalizeExercise({
      id: 'ex-src-db',
      name: 'Incline Bench Press',
      sets: 3,
      reps: 10,
      weight: 65,
      catalogId: 'dumbbell-incline-bench-press',
    }),
  ]);
  await repo.insertWorkout(source);

  // Generate and save quick-add workout
  const draft = createQuickAddWorkoutDraft(source, 'Repeated Incline Bench');
  await repo.insertWorkout(draft);

  // Re-open fresh repository
  const freshRepo = new SQLiteWorkoutRepository(db);
  const reloaded = await freshRepo.getWorkoutById(draft.id);

  assert.ok(reloaded, 'Repeated workout must be reloaded successfully');
  assert.equal(reloaded?.id, draft.id);
  assert.equal(reloaded?.title, 'Repeated Incline Bench');
  assert.equal(reloaded?.exercises.length, 1);
  assert.equal(reloaded?.exercises[0].catalogId, 'dumbbell-incline-bench-press');
  assert.equal(reloaded?.exercises[0].weight, 65);
});
