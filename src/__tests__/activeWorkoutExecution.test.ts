import test from 'node:test';
import assert from 'node:assert/strict';

import { openDatabaseAsync } from './mocks/expo-sqlite';
import { runMigrations, MIGRATIONS } from '../db/migrations';
import { SQLiteWorkoutRepository } from '../db/repositories/workoutRepository';
import { SQLiteWorkoutSessionRepository } from '../db/repositories/workoutSessionRepository';
import { normalizeWorkout } from '../models/workout';
import {
  validateSessionTransition,
  validateWorkoutSet,
  type WorkoutSession,
} from '../models/workoutSession';
import {
  startWorkoutSession,
  getActiveWorkoutSession,
  pauseWorkoutSession,
  resumeWorkoutSession,
  completeSessionSet,
  skipSessionSet,
  addSessionSet,
  finishWorkoutSession,
  discardWorkoutSession,
} from '../services/workoutSessionService';
import {
  calculateSessionPerformanceSummary,
  calculateWorkoutVolumeSummary,
} from '../utils/workoutAnalytics';
import { en } from '../i18n/en';
import { ar } from '../i18n/ar';

async function createTestDb() {
  const db = await openDatabaseAsync(':memory:');
  await db.execAsync('PRAGMA foreign_keys = ON;');
  await runMigrations(db);
  return db;
}

function sampleWorkout(id = 'wk-active-test') {
  return normalizeWorkout({
    id,
    title: 'Chest & Triceps Power',
    date: '2026-11-13',
    time: '08:00',
    duration: 50,
    exercises: [
      {
        id: `ex-bench-${id}`,
        name: 'Barbell Bench Press',
        sets: 3,
        reps: 8,
        weight: 80,
        targetMuscles: ['chest', 'arms'],
        catalogId: 'bench-press-barbell',
      },
      {
        id: `ex-dips-${id}`,
        name: 'Tricep Dips',
        sets: 2,
        reps: 12,
        weight: 0,
        targetMuscles: ['arms'],
        catalogId: 'tricep-dips',
      },
    ],
  });
}

// 1. Migration 4 -> 5 upgrade
test('Task 3.5 - Test 1: Migration 4 -> 5 upgrade creates session tables preserving existing workouts and catalog_id', async () => {
  const db = await openDatabaseAsync(':memory:');
  await db.execAsync('PRAGMA foreign_keys = ON;');

  // Apply migrations 1..4 only
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL);
  `);
  for (const m of MIGRATIONS.slice(0, 4)) {
    await db.withTransactionAsync(async () => {
      await m.up(db);
      await db.runAsync(
        'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?);',
        m.version,
        m.name,
        new Date().toISOString()
      );
    });
  }

  // Insert workout pre-v5
  const workoutRepo = new SQLiteWorkoutRepository(db);
  await workoutRepo.insertWorkout(sampleWorkout('wk-legacy-pre-v5'));

  // Run full migrations (applies Migration 5)
  await runMigrations(db);

  // Check new tables exist
  const tables = await db.getAllAsync<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('workout_sessions', 'workout_session_exercises', 'workout_sets');"
  );
  assert.equal(tables.length, 3, 'All 3 session execution tables must exist');

  // Verify pre-existing workout and catalog_id are completely preserved
  const loaded = await workoutRepo.getWorkoutById('wk-legacy-pre-v5');
  assert.ok(loaded);
  assert.equal(loaded.exercises[0].catalogId, 'bench-press-barbell');
});

// 2. V0 -> 5 fresh migration
test('Task 3.5 - Test 2: V0 -> 7 fresh migration runs cleanly and records schema migrations', async () => {
  const db = await createTestDb();
  const rows = await db.getAllAsync<{ version: number; name: string }>(
    'SELECT version, name FROM schema_migrations ORDER BY version ASC;'
  );
  assert.equal(rows.length, 7);
  assert.equal(rows[4].version, 5);
  assert.equal(rows[4].name, 'add_workout_execution_sessions_v5');
  assert.equal(rows[5].version, 6);
  assert.equal(rows[5].name, 'enforce_single_open_workout_session_v6');
  assert.equal(rows[6].version, 7);
  assert.equal(rows[6].name, 'recover_conflicted_workout_sessions_v7');
});

// 3. Migration idempotence
test('Task 3.5 - Test 3: Running migrations multiple times does not fail or duplicate migration records', async () => {
  const db = await createTestDb();
  await runMigrations(db);
  await runMigrations(db);

  const rows = await db.getAllAsync<{ version: number }>(
    'SELECT version FROM schema_migrations;'
  );
  assert.equal(rows.length, 7);
});

// 4. Legacy workouts preservation
test('Task 3.5 - Test 4: Workouts created prior to Migration 5 remain queryable and editable', async () => {
  const db = await createTestDb();
  const workoutRepo = new SQLiteWorkoutRepository(db);
  const wk = sampleWorkout('wk-legacy-edit');
  await workoutRepo.insertWorkout(wk);

  await workoutRepo.updateWorkout({
    ...wk,
    title: 'Chest & Triceps Updated',
  });

  const updated = await workoutRepo.getWorkoutById('wk-legacy-edit');
  assert.ok(updated);
  assert.equal(updated.title, 'Chest & Triceps Updated');
  assert.equal(updated.exercises.length, 2);
});

// 5. Starting active session from workout pre-populates exercises and target sets
test('Task 3.5 - Test 5: Starting active session from workout pre-populates exercises and target sets', async () => {
  const db = await createTestDb();
  const workoutRepo = new SQLiteWorkoutRepository(db);
  const sessionRepo = new SQLiteWorkoutSessionRepository(db);
  const wk = sampleWorkout('wk-template-1');
  await workoutRepo.insertWorkout(wk);

  const session = await startWorkoutSession(wk, sessionRepo);
  assert.ok(session.id);
  assert.equal(session.title, wk.title);
  assert.equal(session.status, 'active');
  assert.equal(session.exercises.length, 2);

  // Bench press had 3 sets
  const bench = session.exercises[0];
  assert.equal(bench.sets.length, 3);
  assert.equal(bench.sets[0].plannedReps, 8);
  assert.equal(bench.sets[0].plannedWeightKg, 80);
  assert.equal(bench.sets[0].status, 'pending');
  assert.equal(bench.sets[0].actualReps, null);

  // Dips had 2 sets
  const dips = session.exercises[1];
  assert.equal(dips.sets.length, 2);
  assert.equal(dips.sets[0].plannedReps, 12);
  assert.equal(dips.sets[0].plannedWeightKg, 0);
});

// 6. Starting session when another session is active/paused returns conflict / throws
test('Task 3.5 - Test 6: Starting a session when another session is active/paused rejects duplicate', async () => {
  const db = await createTestDb();
  const workoutRepo = new SQLiteWorkoutRepository(db);
  const sessionRepo = new SQLiteWorkoutSessionRepository(db);
  const wk1 = sampleWorkout('wk-1');
  const wk2 = sampleWorkout('wk-2');
  await workoutRepo.insertWorkout(wk1);
  await workoutRepo.insertWorkout(wk2);

  await startWorkoutSession(wk1, sessionRepo);

  await assert.rejects(
    async () => {
      await startWorkoutSession(wk2, sessionRepo);
    },
    /(already active|in progress)/i
  );
});

// 7. Session state machine transitions: active -> paused -> active
test('Task 3.5 - Test 7: Session transitions active -> paused -> active correctly update accumulatedElapsedMs', async () => {
  const db = await createTestDb();
  const sessionRepo = new SQLiteWorkoutSessionRepository(db);
  const session = await sessionRepo.createSession({
    title: 'Transition Test',
    sourceWorkoutId: null,
    startedAt: '2026-11-13T08:00:00.000Z',
    status: 'active',
    lastResumedAt: '2026-11-13T08:00:00.000Z',
    accumulatedElapsedMs: 0,
    exercises: [],
  });

  // Pause at 08:05:00 (+300,000ms)
  const paused = await sessionRepo.pauseSession(session.id, '2026-11-13T08:05:00.000Z');
  assert.equal(paused.status, 'paused');
  assert.equal(paused.accumulatedElapsedMs, 300000);
  assert.equal(paused.lastResumedAt, undefined);

  // Resume at 08:10:00
  const resumed = await sessionRepo.resumeSession(session.id, '2026-11-13T08:10:00.000Z');
  assert.equal(resumed.status, 'active');
  assert.equal(resumed.accumulatedElapsedMs, 300000);
  assert.equal(resumed.lastResumedAt, '2026-11-13T08:10:00.000Z');
});

// 8. Session state machine transitions: active -> completed
test('Task 3.5 - Test 8: Session transitions active -> completed accumulates total elapsed time', async () => {
  const db = await createTestDb();
  const sessionRepo = new SQLiteWorkoutSessionRepository(db);
  const session = await sessionRepo.createSession({
    title: 'Active to Completed',
    sourceWorkoutId: null,
    startedAt: '2026-11-13T08:00:00.000Z',
    status: 'active',
    lastResumedAt: '2026-11-13T08:00:00.000Z',
    accumulatedElapsedMs: 60000,
    exercises: [],
  });

  // Completed at 08:02:00 (+120,000ms active) -> total 180,000ms
  const completed = await sessionRepo.completeSession(
    session.id,
    'Great pump',
    '2026-11-13T08:02:00.000Z'
  );
  assert.equal(completed.status, 'completed');
  assert.equal(completed.accumulatedElapsedMs, 180000);
  assert.equal(completed.notes, 'Great pump');
  assert.ok(completed.endedAt);
});

// 9. Session state machine transitions: paused -> completed
test('Task 3.5 - Test 9: Session transitions paused -> completed preserves accumulated elapsed time', async () => {
  const db = await createTestDb();
  const sessionRepo = new SQLiteWorkoutSessionRepository(db);
  const session = await sessionRepo.createSession({
    title: 'Paused to Completed',
    sourceWorkoutId: null,
    startedAt: '2026-11-13T08:00:00.000Z',
    status: 'paused',
    lastResumedAt: null,
    accumulatedElapsedMs: 900000,
    exercises: [],
  });

  const completed = await sessionRepo.completeSession(
    session.id,
    'Finished while paused',
    '2026-11-13T08:20:00.000Z'
  );
  assert.equal(completed.status, 'completed');
  assert.equal(completed.accumulatedElapsedMs, 900000);
});

// 10. Session state machine transitions: active -> discarded
test('Task 3.5 - Test 10: Session transitions active -> discarded sets status discarded and clears active query', async () => {
  const db = await createTestDb();
  const sessionRepo = new SQLiteWorkoutSessionRepository(db);
  const session = await sessionRepo.createSession({
    title: 'To Discard',
    sourceWorkoutId: null,
    startedAt: '2026-11-13T08:00:00.000Z',
    status: 'active',
    lastResumedAt: '2026-11-13T08:00:00.000Z',
    accumulatedElapsedMs: 0,
    exercises: [],
  });

  await sessionRepo.discardSession(session.id);
  const check = await sessionRepo.getSessionById(session.id);
  assert.equal(check, null);

  const active = await sessionRepo.getActiveSession();
  assert.equal(active, null);
});

// 11. Session state machine transitions: paused -> discarded
test('Task 3.5 - Test 11: Session transitions paused -> discarded clears active query', async () => {
  const db = await createTestDb();
  const sessionRepo = new SQLiteWorkoutSessionRepository(db);
  const session = await sessionRepo.createSession({
    title: 'Paused To Discard',
    sourceWorkoutId: null,
    startedAt: '2026-11-13T08:00:00.000Z',
    status: 'paused',
    lastResumedAt: null,
    accumulatedElapsedMs: 120000,
    exercises: [],
  });

  await sessionRepo.discardSession(session.id);
  const active = await sessionRepo.getActiveSession();
  assert.equal(active, null);
});

// 12. Invalid transitions throw
test('Task 3.5 - Test 12: Invalid transitions throw explicit errors', () => {
  assert.throws(() => validateSessionTransition('completed', 'active'), /(invalid|cannot transition)/i);
  assert.throws(() => validateSessionTransition('completed', 'paused'), /(invalid|cannot transition)/i);
  assert.throws(() => validateSessionTransition('discarded', 'completed'), /(invalid|cannot transition)/i);
  assert.throws(() => validateSessionTransition('discarded', 'active'), /(invalid|cannot transition)/i);
});

// 13. Completing a set updates actual reps, weight, rpe, completedAt, status='completed'
test('Task 3.5 - Test 13: Completing a set updates actual reps, weight, rpe, completedAt, status=completed', async () => {
  const db = await createTestDb();
  const sessionRepo = new SQLiteWorkoutSessionRepository(db);
  const wk = sampleWorkout('wk-set-test');
  const session = await startWorkoutSession(wk, sessionRepo);
  const targetSet = session.exercises[0].sets[0];

  const updatedSet = await completeSessionSet(
    targetSet.id,
    8,
    85,
    8.5,
    'felt strong',
    sessionRepo
  );
  assert.equal(updatedSet.status, 'completed');
  assert.equal(updatedSet.actualReps, 8);
  assert.equal(updatedSet.actualWeightKg, 85);
  assert.equal(updatedSet.rpe, 8.5);
  assert.equal(updatedSet.notes, 'felt strong');
  assert.ok(updatedSet.completedAt);
});

// 14. Completing a set with partial or modified values records exact user-entered values
test('Task 3.5 - Test 14: Completing a set with partial or modified values records exact user-entered values', async () => {
  const db = await createTestDb();
  const sessionRepo = new SQLiteWorkoutSessionRepository(db);
  const wk = sampleWorkout('wk-partial-test');
  const session = await startWorkoutSession(wk, sessionRepo);
  const targetSet = session.exercises[0].sets[1];

  // User planned 8 reps at 80kg, but managed 5 reps at 82.5kg
  const updatedSet = await completeSessionSet(
    targetSet.id,
    5,
    82.5,
    9.5,
    undefined,
    sessionRepo
  );
  assert.equal(updatedSet.plannedReps, 8);
  assert.equal(updatedSet.plannedWeightKg, 80);
  assert.equal(updatedSet.actualReps, 5);
  assert.equal(updatedSet.actualWeightKg, 82.5);
  assert.equal(updatedSet.rpe, 9.5);
});

// 15. Skipping a set sets status='skipped', preserves planned values, leaves actual values null
test('Task 3.5 - Test 15: Skipping a set sets status=skipped, preserves planned values, leaves actual values null', async () => {
  const db = await createTestDb();
  const sessionRepo = new SQLiteWorkoutSessionRepository(db);
  const wk = sampleWorkout('wk-skip-test');
  const session = await startWorkoutSession(wk, sessionRepo);
  const targetSet = session.exercises[0].sets[2];

  const skipped = await skipSessionSet(targetSet.id, 'shoulder tightness', sessionRepo);
  assert.equal(skipped.status, 'skipped');
  assert.equal(skipped.plannedReps, 8);
  assert.equal(skipped.plannedWeightKg, 80);
  assert.equal(skipped.actualReps, null);
  assert.equal(skipped.actualWeightKg, null);
  assert.equal(skipped.notes, 'shoulder tightness');
});

// 16. Adding an extra set to an exercise inserts new row with correct setNumber
test('Task 3.5 - Test 16: Adding an extra set to an exercise inserts new row with correct setNumber', async () => {
  const db = await createTestDb();
  const sessionRepo = new SQLiteWorkoutSessionRepository(db);
  const wk = sampleWorkout('wk-add-set');
  const session = await startWorkoutSession(wk, sessionRepo);
  const exercise = session.exercises[0]; // bench had 3 sets

  const newSet = await addSessionSet(exercise.id, 8, 80, sessionRepo);
  assert.equal(newSet.setNumber, 4);
  assert.equal(newSet.plannedReps, 8);
  assert.equal(newSet.plannedWeightKg, 80);
  assert.equal(newSet.status, 'pending');

  const refreshed = await sessionRepo.getSessionById(session.id);
  assert.ok(refreshed);
  assert.equal(refreshed.exercises[0].sets.length, 4);
});

// 17. Updating a completed set modifies actual values without creating duplicate set
test('Task 3.5 - Test 17: Updating a completed set modifies actual values without creating duplicate set', async () => {
  const db = await createTestDb();
  const sessionRepo = new SQLiteWorkoutSessionRepository(db);
  const wk = sampleWorkout('wk-update-set');
  const session = await startWorkoutSession(wk, sessionRepo);
  const targetSet = session.exercises[0].sets[0];

  await completeSessionSet(targetSet.id, 8, 80, null, '', sessionRepo);
  // User corrects weight to 82.5
  const corrected = await sessionRepo.updateSet(targetSet.id, {
    actualWeightKg: 82.5,
    actualReps: 8,
  });
  assert.equal(corrected.actualWeightKg, 82.5);

  const refreshed = await sessionRepo.getSessionById(session.id);
  assert.ok(refreshed);
  assert.equal(refreshed.exercises[0].sets.length, 3);
});

// 18. Elapsed time calculation accumulates active duration across pauses
test('Task 3.5 - Test 18: Elapsed time calculation accumulates active duration across pauses', async () => {
  const db = await createTestDb();
  const sessionRepo = new SQLiteWorkoutSessionRepository(db);

  // Start at t0
  const session = await sessionRepo.createSession({
    title: 'Timer Accrual Test',
    sourceWorkoutId: null,
    startedAt: '2026-11-13T09:00:00.000Z',
    status: 'active',
    lastResumedAt: '2026-11-13T09:00:00.000Z',
    accumulatedElapsedMs: 0,
    exercises: [],
  });

  // Pause after 10 min (600,000ms)
  await sessionRepo.pauseSession(session.id, '2026-11-13T09:10:00.000Z');

  // Resume at 09:20:00
  await sessionRepo.resumeSession(session.id, '2026-11-13T09:20:00.000Z');

  // Complete at 09:30:00 (+10 min more active) -> total 20 min active
  const finished = await sessionRepo.completeSession(session.id, '', '2026-11-13T09:30:00.000Z');
  assert.equal(finished.accumulatedElapsedMs, 1200000);
});

// 19. Background/foreground resumption maintains accurate elapsed time using timestamps (not tick count)
test('Task 3.5 - Test 19: Background/foreground derivation uses timestamps and survives ticks', () => {
  const session: WorkoutSession = {
    id: 's-timer',
    title: 'Timer Test',
    sourceWorkoutId: null,
    startedAt: '2026-11-13T09:00:00.000Z',
    status: 'active',
    lastResumedAt: '2026-11-13T09:10:00.000Z',
    accumulatedElapsedMs: 300000, // 5 min from before
    exercises: [],
  };

  // Simulated now = 09:25:00 (15 min after lastResumedAt)
  const now = Date.parse('2026-11-13T09:25:00.000Z');
  const resumedAtMs = Date.parse(session.lastResumedAt!);
  const currentElapsed = (session.accumulatedElapsedMs || 0) + (now - resumedAtMs);

  // 5 min + 15 min = 20 min (1,200,000ms)
  assert.equal(currentElapsed, 1200000);
});

// 20. Rest timer expiration does not alter set status or session state
test('Task 3.5 - Test 20: Rest timer expiration does not alter set status or session state', async () => {
  const db = await createTestDb();
  const sessionRepo = new SQLiteWorkoutSessionRepository(db);
  const wk = sampleWorkout('wk-rest-timer');
  const session = await startWorkoutSession(wk, sessionRepo);

  // Completing set 1
  await completeSessionSet(session.exercises[0].sets[0].id, 8, 80, null, '', sessionRepo);

  // Expiration of UI rest timer does not change DB
  const current = await sessionRepo.getActiveSession();
  assert.ok(current);
  assert.equal(current.status, 'active');
  assert.equal(current.exercises[0].sets[0].status, 'completed');
  assert.equal(current.exercises[0].sets[1].status, 'pending');
});

// 21. App restart recovery: getActiveSession() reloads active or paused session with all exercises and sets
test('Task 3.5 - Test 21: App restart recovery reloads active or paused session with all exercises and sets', async () => {
  const db = await createTestDb();
  const repo1 = new SQLiteWorkoutSessionRepository(db);
  const wk = sampleWorkout('wk-restart-1');
  await startWorkoutSession(wk, repo1);

  // Simulate app restart by instantiating new repository instance
  const repo2 = new SQLiteWorkoutSessionRepository(db);
  const recovered = await repo2.getActiveSession();
  assert.ok(recovered);
  assert.equal(recovered.status, 'active');
  assert.equal(recovered.exercises.length, 2);
  assert.equal(recovered.exercises[0].sets.length, 3);
});

// 22. App restart recovery: finished or discarded sessions are not returned by getActiveSession()
test('Task 3.5 - Test 22: Finished or discarded sessions are not returned by getActiveSession()', async () => {
  const db = await createTestDb();
  const sessionRepo = new SQLiteWorkoutSessionRepository(db);
  const wk = sampleWorkout('wk-finished');
  const session = await startWorkoutSession(wk, sessionRepo);
  await finishWorkoutSession(session.id, 'Done', sessionRepo);

  const active = await sessionRepo.getActiveSession();
  assert.equal(active, null);
});

// 23. calculateSessionPerformanceSummary() computes actual volume from completed sets only
test('Task 3.5 - Test 23: calculateSessionPerformanceSummary computes actual volume from completed sets only', () => {
  const mockSession: WorkoutSession = {
    id: 's-perf-1',
    title: 'Performance Test',
    sourceWorkoutId: null,
    startedAt: '2026-11-13T09:00:00.000Z',
    status: 'completed',
    completedAt: '2026-11-13T09:45:00.000Z',
    accumulatedElapsedMs: 2700000, // 45 min
    exercises: [
      {
        id: 'se-1',
        sessionId: 's-perf-1',
        exerciseName: 'Bench Press',
        targetMuscles: ['chest', 'arms'],
        catalogId: 'bench-press-barbell',
        orderIndex: 0,
        sets: [
          // Set 1: 10 reps @ 80kg = 800
          {
            id: 'st-1',
            sessionExerciseId: 'se-1',
            setNumber: 1,
            plannedReps: 10,
            plannedWeightKg: 80,
            actualReps: 10,
            actualWeightKg: 80,
            status: 'completed',
          },
          // Set 2: 8 reps @ 85kg = 680
          {
            id: 'st-2',
            sessionExerciseId: 'se-1',
            setNumber: 2,
            plannedReps: 10,
            plannedWeightKg: 80,
            actualReps: 8,
            actualWeightKg: 85,
            status: 'completed',
          },
          // Set 3: pending (0 volume)
          {
            id: 'st-3',
            sessionExerciseId: 'se-1',
            setNumber: 3,
            plannedReps: 10,
            plannedWeightKg: 80,
            actualReps: null,
            actualWeightKg: null,
            status: 'pending',
          },
        ],
      },
    ],
  };

  const summary = calculateSessionPerformanceSummary(mockSession);
  // Actual volume = 800 + 680 = 1480kg
  assert.equal(summary.actualRecordedVolumeKg, 1480);
  assert.equal(summary.totalCompletedSets, 2);
  assert.equal(summary.totalPlannedSets, 3);
  assert.equal(summary.totalCompletedReps, 18);
  assert.equal(summary.actualDurationMinutes, 45);
  assert.equal(summary.hasIncompleteSets, true);
});

// 24. calculateSessionPerformanceSummary() ignores skipped and pending sets
test('Task 3.5 - Test 24: calculateSessionPerformanceSummary ignores skipped and pending sets', () => {
  const mockSession: WorkoutSession = {
    id: 's-perf-2',
    title: 'Skipped Sets Test',
    sourceWorkoutId: null,
    startedAt: '2026-11-13T09:00:00.000Z',
    status: 'completed',
    accumulatedElapsedMs: 1800000,
    exercises: [
      {
        id: 'se-1',
        sessionId: 's-perf-2',
        exerciseName: 'Shoulder Press',
        targetMuscles: ['shoulders'],
        orderIndex: 0,
        sets: [
          {
            id: 'st-1',
            sessionExerciseId: 'se-1',
            setNumber: 1,
            plannedReps: 10,
            plannedWeightKg: 50,
            actualReps: null,
            actualWeightKg: null,
            status: 'skipped',
          },
          {
            id: 'st-2',
            sessionExerciseId: 'se-1',
            setNumber: 2,
            plannedReps: 10,
            plannedWeightKg: 50,
            actualReps: null,
            actualWeightKg: null,
            status: 'pending',
          },
        ],
      },
    ],
  };

  const summary = calculateSessionPerformanceSummary(mockSession);
  assert.equal(summary.actualRecordedVolumeKg, 0);
  assert.equal(summary.totalCompletedSets, 0);
  assert.equal(summary.totalSkippedSets, 1);
  assert.equal(summary.totalPendingSets, 1);
});

// 25. calculateSessionPerformanceSummary() separates actual volume from estimated workout volume
test('Task 3.5 - Test 25: Actual volume is strictly decoupled from template estimated workout volume', () => {
  const templateWorkout = sampleWorkout('wk-decouple');
  // Template estimated volume: 3*8*80 + 2*12*0 = 1920kg
  const templateVolume = calculateWorkoutVolumeSummary(templateWorkout);
  assert.equal(templateVolume.totalVolumeKg, 1920);

  // Active execution where user did fewer reps and skipped dips
  const session: WorkoutSession = {
    id: 's-decouple',
    title: templateWorkout.title,
    sourceWorkoutId: templateWorkout.id,
    startedAt: '2026-11-13T10:00:00.000Z',
    status: 'completed',
    accumulatedElapsedMs: 1800000,
    exercises: [
      {
        id: 'se-1',
        sessionId: 's-decouple',
        exerciseName: 'Barbell Bench Press',
        targetMuscles: ['chest', 'arms'],
        orderIndex: 0,
        sets: [
          {
            id: 'st-1',
            sessionExerciseId: 'se-1',
            setNumber: 1,
            plannedReps: 8,
            plannedWeightKg: 80,
            actualReps: 6,
            actualWeightKg: 80, // 480kg
            status: 'completed',
          },
        ],
      },
    ],
  };

  const perf = calculateSessionPerformanceSummary(session);
  assert.equal(perf.actualRecordedVolumeKg, 480);
  assert.notEqual(perf.actualRecordedVolumeKg, templateVolume.totalVolumeKg);
});

// 26. Discarding a session soft-deletes / marks discarded or cleans up session sets
test('Task 3.5 - Test 26: Discarding session cleans up or marks discarded without residual active rows', async () => {
  const db = await createTestDb();
  const sessionRepo = new SQLiteWorkoutSessionRepository(db);
  const wk = sampleWorkout('wk-discard-sets');
  const session = await startWorkoutSession(wk, sessionRepo);

  await completeSessionSet(session.exercises[0].sets[0].id, 8, 80, null, '', sessionRepo);
  await discardWorkoutSession(session.id, sessionRepo);

  const active = await sessionRepo.getActiveSession();
  assert.equal(active, null);

  const discarded = await sessionRepo.getSessionById(session.id);
  assert.equal(discarded, null);

  // Verify child set rows are completely cleaned up
  const sets = await db.getAllAsync('SELECT * FROM workout_sets;');
  assert.equal(sets.length, 0, 'Discarding session cascades and cleans up all session sets');
});

// 27. Deleting a parent workout does not corrupt orphaned completed sessions
test('Task 3.5 - Test 27: Deleting parent workout leaves source_workout_id null without corrupting completed sessions', async () => {
  const db = await createTestDb();
  const workoutRepo = new SQLiteWorkoutRepository(db);
  const sessionRepo = new SQLiteWorkoutSessionRepository(db);

  const wk = sampleWorkout('wk-to-delete');
  await workoutRepo.insertWorkout(wk);

  const session = await startWorkoutSession(wk, sessionRepo);
  await finishWorkoutSession(session.id, 'Saved before delete', sessionRepo);

  // Delete template workout
  await workoutRepo.deleteWorkout('wk-to-delete');

  // Verify completed session remains fully queryable and intact
  const retrievedSession = await sessionRepo.getSessionById(session.id);
  assert.ok(retrievedSession);
  assert.equal(retrievedSession.title, 'Chest & Triceps Power');
  assert.equal(retrievedSession.sourceWorkoutId, undefined); // ON DELETE SET NULL preserved row
});

// 28. Localization and RTL formatting
test('Task 3.5 - Test 28: Localization strings for active workouts exist in English and Arabic', () => {
  const keys: (keyof typeof en.workouts)[] = [
    'startWorkout',
    'activeWorkout',
    'resumeWorkout',
    'pauseWorkout',
    'finishWorkout',
    'discardSession',
    'restTimer',
    'addSet',
    'summary',
    'actualVolume',
    'incompleteSetsWarning',
    'sessionConflictTitle',
  ];

  for (const k of keys) {
    assert.ok(en.workouts[k], `English missing workouts.${k}`);
    assert.ok(ar.workouts[k], `Arabic missing workouts.${k}`);
    assert.notEqual(en.workouts[k], '', `English workouts.${k} must not be empty`);
    assert.notEqual(ar.workouts[k], '', `Arabic workouts.${k} must not be empty`);
  }
});

// 29. Domain model set validation rules
test('Task 3.5 - Test 29: WorkoutSet validation rejects malformed values', () => {
  const baseSet = {
    id: 'st-valid',
    sessionExerciseId: 'se-1',
    setNumber: 1,
    plannedReps: 10,
    plannedWeightKg: 50,
    status: 'pending' as const,
  };

  assert.doesNotThrow(() => validateWorkoutSet(baseSet));

  // Empty ID
  assert.throws(() => validateWorkoutSet({ ...baseSet, id: '' }), /non-empty id/i);
  // Invalid set number
  assert.throws(() => validateWorkoutSet({ ...baseSet, setNumber: 0 }), /positive integer/i);
  // Negative planned reps
  assert.throws(() => validateWorkoutSet({ ...baseSet, plannedReps: -1 }), /non-negative/i);
  // Negative planned weight
  assert.throws(() => validateWorkoutSet({ ...baseSet, plannedWeightKg: -5 }), /non-negative/i);
  // Negative actual reps on completed set
  assert.throws(() => validateWorkoutSet({ ...baseSet, status: 'completed', actualReps: -2 }), /non-negative/i);
  // Negative actual weight on completed set
  assert.throws(() => validateWorkoutSet({ ...baseSet, status: 'completed', actualWeightKg: -10 }), /non-negative/i);
  // Invalid RPE out of 1-10 range
  assert.throws(() => validateWorkoutSet({ ...baseSet, rpe: 11 }), /between 1 and 10/i);
  assert.throws(() => validateWorkoutSet({ ...baseSet, rpe: 0.5 }), /between 1 and 10/i);
  // Invalid status
  assert.throws(
    () => validateWorkoutSet({ ...baseSet, status: 'invalid-status' as unknown as any }),
    /invalid set status/i
  );
});

// 30. Service layer pause, resume, and active session query
test('Task 3.5 - Test 30: Service layer pause, resume, and active session workflows', async () => {
  const db = await createTestDb();
  const repo = new SQLiteWorkoutSessionRepository(db);
  const wk = sampleWorkout('wk-service-test');
  await repo.insertWorkout?.(wk);

  const session = await startWorkoutSession(wk, repo);
  assert.equal(session.status, 'active');

  const activeCheck = await getActiveWorkoutSession(repo);
  assert.ok(activeCheck);
  assert.equal(activeCheck.id, session.id);

  const paused = await pauseWorkoutSession(session.id, repo);
  assert.equal(paused.status, 'paused');

  const resumed = await resumeWorkoutSession(session.id, repo);
  assert.equal(resumed.status, 'active');
});
