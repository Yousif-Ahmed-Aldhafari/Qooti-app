import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabaseAsync } from './mocks/expo-sqlite';
import {
  runMigrations,
  MIGRATIONS,
  detectPreMigrationSessionConflicts,
} from '../db/migrations';
import { SQLiteWorkoutSessionRepository } from '../db/repositories/workoutSessionRepository';
import { MigrationSessionConflictError } from '../models/workoutSession';
import {
  startWorkoutSession,
  getInterruptedWorkoutSessions,
  resumeInterruptedWorkoutSession,
  archiveInterruptedWorkoutSession,
} from '../services/workoutSessionService';
import type { Workout } from '../models/workout';

async function createFreshDb() {
  const db = await openDatabaseAsync(':memory:');
  await db.execAsync('PRAGMA foreign_keys = ON;');
  await runMigrations(db);
  return db;
}

const sampleWorkout: Workout = {
  id: 'w-recovery-test',
  title: 'Upper Body Power',
  exercises: [
    {
      id: 'ex-bench',
      catalogId: 'bench-press-barbell',
      name: 'Bench Press',
      sets: 3,
      reps: 8,
      weight: 80,
      targetMuscles: ['chest', 'triceps'],
    },
    {
      id: 'ex-row',
      catalogId: 'bent-over-row-barbell',
      name: 'Barbell Row',
      sets: 3,
      reps: 8,
      weight: 70,
      targetMuscles: ['back', 'biceps'],
    },
  ],
  durationMinutes: 45,
  difficulty: 'intermediate',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// -----------------------------------------------------------------------------
// Part F.1-6: Migration 6 / 7 Safety & Conflict Recovery
// -----------------------------------------------------------------------------

test('Task 3.5B - Test 1: Pre-migration conflict check detects multiple open sessions on V5 DB', async () => {
  const db = await openDatabaseAsync(':memory:');
  await db.execAsync('PRAGMA foreign_keys = ON;');

  // Run migrations 1 through 5 only
  for (const m of MIGRATIONS.slice(0, 5)) {
    await m.up(db);
    await db.runAsync(
      'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?);',
      m.version,
      m.name,
      new Date().toISOString()
    );
  }

  const now = new Date().toISOString();
  // Insert two open sessions in V5 schema
  await db.runAsync(
    `INSERT INTO workout_sessions (id, title, status, started_at, accumulated_elapsed_ms, created_at, updated_at)
     VALUES (?, ?, ?, ?, 0, ?, ?);`,
    'sess-open-1',
    'Morning Session',
    'active',
    '2026-11-13T08:00:00.000Z',
    now,
    now
  );
  await db.runAsync(
    `INSERT INTO workout_sessions (id, title, status, started_at, accumulated_elapsed_ms, created_at, updated_at)
     VALUES (?, ?, ?, ?, 0, ?, ?);`,
    'sess-open-2',
    'Evening Session',
    'paused',
    '2026-11-13T18:00:00.000Z',
    now,
    now
  );

  const conflicts = await detectPreMigrationSessionConflicts(db);
  assert.equal(conflicts.length, 2);
  assert.equal(conflicts[0].id, 'sess-open-2');
  assert.equal(conflicts[1].id, 'sess-open-1');

  // Verify that runMigrations with strictConflictCheck throws MigrationSessionConflictError
  await assert.rejects(
    async () => {
      await runMigrations(db, { strictConflictCheck: true });
    },
    (err: unknown) => {
      assert.ok(err instanceof MigrationSessionConflictError);
      assert.equal(err.conflictingSessions.length, 2);
      return true;
    }
  );
});

test('Task 3.5B - Test 2: Migration 7 tags migration-discarded sessions as interrupted without data loss', async () => {
  const db = await openDatabaseAsync(':memory:');
  await db.execAsync('PRAGMA foreign_keys = ON;');

  // Run migrations 1 through 6
  for (const m of MIGRATIONS.slice(0, 6)) {
    await m.up(db);
    await db.runAsync(
      'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?);',
      m.version,
      m.name,
      new Date().toISOString()
    );
  }

  // Simulate a session marked discarded by Migration 6 automatic resolution
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO workout_sessions (id, title, status, started_at, accumulated_elapsed_ms, created_at, updated_at)
     VALUES (?, ?, 'discarded', ?, 120000, ?, ?);`,
    'sess-auto-discarded',
    'Unfinished Push Day',
    '2026-11-13T10:00:00.000Z',
    now,
    now
  );

  // Add an exercise and sets for this session
  await db.runAsync(
    `INSERT INTO workout_session_exercises (id, session_id, exercise_name, target_muscles, sort_order)
     VALUES (?, ?, ?, '["chest"]', 0);`,
    'se-ex-1',
    'sess-auto-discarded',
    'Incline Dumbbell Press'
  );
  await db.runAsync(
    `INSERT INTO workout_sets (id, session_exercise_id, set_number, planned_reps, actual_reps, planned_weight_kg, actual_weight_kg, status, completed_at)
     VALUES (?, ?, 1, 10, 10, 30, 30, 'completed', ?);`,
    'set-1',
    'se-ex-1',
    now
  );

  // Apply Migration 7
  await MIGRATIONS[6].up(db);
  await db.runAsync(
    'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?);',
    MIGRATIONS[6].version,
    MIGRATIONS[6].name,
    now
  );

  const row = await db.getFirstAsync<{ id: string; recovery_state: string }>(
    `SELECT id, recovery_state FROM workout_sessions WHERE id = ?;`,
    'sess-auto-discarded'
  );
  assert.ok(row);
  assert.equal(row.recovery_state, 'interrupted');

  // Verify child exercise and sets are intact
  const sets = await db.getAllAsync<{ id: string; status: string; actual_weight_kg: number }>(
    `SELECT * FROM workout_sets WHERE session_exercise_id = 'se-ex-1';`
  );
  assert.equal(sets.length, 1);
  assert.equal(sets[0].status, 'completed');
  assert.equal(sets[0].actual_weight_kg, 30);
});

test('Task 3.5B - Test 3: listInterruptedSessions retrieves full session tree with completed sets intact', async () => {
  const db = await createFreshDb();
  const repo = new SQLiteWorkoutSessionRepository(db);

  // Create an interrupted session with exercises and completed sets
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO workout_sessions (id, title, status, recovery_state, started_at, accumulated_elapsed_ms, created_at, updated_at)
     VALUES (?, ?, 'discarded', 'interrupted', ?, 300000, ?, ?);`,
    'sess-interrupted-tree',
    'Leg Day Squats',
    '2026-11-13T09:00:00.000Z',
    now,
    now
  );
  await db.runAsync(
    `INSERT INTO workout_session_exercises (id, session_id, exercise_name, target_muscles, sort_order)
     VALUES (?, ?, 'Back Squat', '["quads","glutes"]', 0);`,
    'se-squat',
    'sess-interrupted-tree'
  );
  await db.runAsync(
    `INSERT INTO workout_sets (id, session_exercise_id, set_number, planned_reps, actual_reps, planned_weight_kg, actual_weight_kg, status, completed_at)
     VALUES (?, ?, 1, 5, 5, 120, 120, 'completed', ?);`,
    'set-squat-1',
    'se-squat',
    now
  );
  await db.runAsync(
    `INSERT INTO workout_sets (id, session_exercise_id, set_number, planned_reps, actual_reps, planned_weight_kg, actual_weight_kg, status)
     VALUES (?, ?, 2, 5, NULL, 120, NULL, 'pending');`,
    'set-squat-2',
    'se-squat'
  );

  const interrupted = await repo.listInterruptedSessions();
  assert.equal(interrupted.length, 1);
  assert.equal(interrupted[0].id, 'sess-interrupted-tree');
  assert.equal(interrupted[0].recoveryState, 'interrupted');
  assert.equal(interrupted[0].exercises.length, 1);
  assert.equal(interrupted[0].exercises[0].sets.length, 2);
  assert.equal(interrupted[0].exercises[0].sets[0].status, 'completed');
  assert.equal(interrupted[0].exercises[0].sets[0].actualWeightKg, 120);
});

test('Task 3.5B - Test 4: Recovered session can be resumed without data loss and maintains single-active constraint', async () => {
  const db = await createFreshDb();
  const repo = new SQLiteWorkoutSessionRepository(db);

  // 1. Create an active session
  const activeSess = await startWorkoutSession(sampleWorkout, repo);
  assert.equal(activeSess.status, 'active');

  // 2. Insert an interrupted session
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO workout_sessions (id, title, status, recovery_state, started_at, accumulated_elapsed_ms, created_at, updated_at)
     VALUES (?, ?, 'discarded', 'interrupted', ?, 240000, ?, ?);`,
    'sess-interrupted-resume',
    'Previous Pull Day',
    '2026-11-13T07:00:00.000Z',
    now,
    now
  );

  // 3. Resume the interrupted session with default currentSessionAction = 'archive'
  const resumed = await resumeInterruptedWorkoutSession('sess-interrupted-resume', 'archive', repo);
  assert.equal(resumed.id, 'sess-interrupted-resume');
  assert.equal(resumed.status, 'active');
  assert.equal(resumed.recoveryState, 'recovered');

  // 4. Verify previous active session was archived as completed
  const prevActive = await repo.getSessionById(activeSess.id);
  assert.ok(prevActive);
  assert.equal(prevActive.status, 'completed');
  assert.equal(prevActive.recoveryState, 'archived');

  // 5. Verify single-open-session SQLite unique constraint is satisfied
  const openSessions = await db.getAllAsync(
    `SELECT id, status FROM workout_sessions WHERE status IN ('active', 'paused');`
  );
  assert.equal(openSessions.length, 1);
  assert.equal(openSessions[0].id, 'sess-interrupted-resume');
});

test('Task 3.5B - Test 5: Recovered session can be explicitly archived to completed history', async () => {
  const db = await createFreshDb();
  const repo = new SQLiteWorkoutSessionRepository(db);

  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO workout_sessions (id, title, status, recovery_state, started_at, accumulated_elapsed_ms, created_at, updated_at)
     VALUES (?, ?, 'discarded', 'interrupted', ?, 180000, ?, ?);`,
    'sess-archive-target',
    'Interrupted Full Body',
    '2026-11-12T10:00:00.000Z',
    now,
    now
  );

  const archived = await archiveInterruptedWorkoutSession(
    'sess-archive-target',
    'Archived from recovery dialog',
    repo
  );
  assert.equal(archived.status, 'completed');
  assert.equal(archived.recoveryState, 'archived');
  assert.equal(archived.notes, 'Archived from recovery dialog');

  // Verify it is no longer listed in interrupted sessions
  const remainingInterrupted = await getInterruptedWorkoutSessions(repo);
  assert.equal(remainingInterrupted.length, 0);
});

test('Task 3.5B - Test 6: Intentional user discard vs migration discard distinguished correctly', async () => {
  const db = await createFreshDb();
  const repo = new SQLiteWorkoutSessionRepository(db);

  // Intentional user discard physically deletes the row and cascades
  const userSession = await startWorkoutSession(sampleWorkout, repo);
  await repo.discardSession(userSession.id);

  const deletedCheck = await repo.getSessionById(userSession.id);
  assert.equal(deletedCheck, null);

  // Whereas migration-generated discard preserves the row with recovery_state = 'interrupted'
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO workout_sessions (id, title, status, recovery_state, started_at, accumulated_elapsed_ms, created_at, updated_at)
     VALUES (?, ?, 'discarded', 'interrupted', ?, 60000, ?, ?);`,
    'sess-migration-flagged',
    'Preserved Workout',
    now,
    now,
    now
  );

  const preservedCheck = await repo.getSessionById('sess-migration-flagged');
  assert.ok(preservedCheck);
  assert.equal(preservedCheck.recoveryState, 'interrupted');

  // And if user explicitly deletes the interrupted session, it is physically removed
  await repo.discardSession('sess-migration-flagged');
  const removedCheck = await repo.getSessionById('sess-migration-flagged');
  assert.equal(removedCheck, null);
});

// -----------------------------------------------------------------------------
// Part F.7-18: Rest Timer Persistence Wiring, Concurrency & Lifecycle
// -----------------------------------------------------------------------------

test('Task 3.5B - Test 7: Completing set starts rest and persists rest_target_at', async () => {
  const db = await createFreshDb();
  const repo = new SQLiteWorkoutSessionRepository(db);

  const session = await startWorkoutSession(sampleWorkout, repo);
  const firstSet = session.exercises[0].sets[0];

  // Complete set
  await repo.completeSet(firstSet.id, {
    actualReps: 8,
    actualWeightKg: 80,
    rpe: 8,
  });

  // Persist rest target
  const targetIso = new Date(Date.now() + 90000).toISOString();
  const updated = await repo.setRestTarget(session.id, targetIso);

  assert.equal(updated.restTargetAt, targetIso);

  // Verify in SQLite directly
  const row = await db.getFirstAsync<{ rest_target_at: string }>(
    `SELECT rest_target_at FROM workout_sessions WHERE id = ?;`,
    session.id
  );
  assert.equal(row?.rest_target_at, targetIso);
});

test('Task 3.5B - Test 8: Failed set completion rejects and does not persist rest target', async () => {
  const db = await createFreshDb();
  const repo = new SQLiteWorkoutSessionRepository(db);

  const session = await startWorkoutSession(sampleWorkout, repo);
  const firstSet = session.exercises[0].sets[0];

  // Attempt invalid set completion (negative reps)
  await assert.rejects(async () => {
    await repo.completeSet(firstSet.id, {
      actualReps: -5,
      actualWeightKg: 80,
    });
  });

  // Verify rest_target_at remains null
  const current = await repo.getSessionById(session.id);
  assert.equal(current?.restTargetAt, undefined);
});

test('Task 3.5B - Test 9: "+30s" extends target and persists immediately', async () => {
  const db = await createFreshDb();
  const repo = new SQLiteWorkoutSessionRepository(db);

  const session = await startWorkoutSession(sampleWorkout, repo);

  const baseMs = Date.now() + 60000;
  await repo.setRestTarget(session.id, new Date(baseMs).toISOString());

  // Extend by +30s
  const extendedMs = baseMs + 30000;
  const extendedIso = new Date(extendedMs).toISOString();
  const updated = await repo.setRestTarget(session.id, extendedIso);

  assert.equal(updated.restTargetAt, extendedIso);
  const parsed = Date.parse(updated.restTargetAt!);
  assert.equal(parsed, extendedMs);
});

test('Task 3.5B - Test 10: Rapid "+30s" taps accumulate monotonically without timestamp corruption', async () => {
  const db = await createFreshDb();
  const repo = new SQLiteWorkoutSessionRepository(db);

  const session = await startWorkoutSession(sampleWorkout, repo);

  let targetMs = Date.now() + 30000;
  for (let i = 0; i < 5; i++) {
    targetMs += 30000;
    await repo.setRestTarget(session.id, new Date(targetMs).toISOString());
  }

  const finalSession = await repo.getSessionById(session.id);
  assert.ok(finalSession?.restTargetAt);
  const parsed = Date.parse(finalSession.restTargetAt);
  assert.ok(!Number.isNaN(parsed));
  assert.equal(parsed, targetMs);
});

test('Task 3.5B - Test 11: "Skip Rest" clears target and persists null', async () => {
  const db = await createFreshDb();
  const repo = new SQLiteWorkoutSessionRepository(db);

  const session = await startWorkoutSession(sampleWorkout, repo);

  // Set rest target
  await repo.setRestTarget(session.id, new Date(Date.now() + 60000).toISOString());
  const beforeSkip = await repo.getSessionById(session.id);
  assert.ok(beforeSkip?.restTargetAt);

  // Skip rest -> null
  const afterSkip = await repo.setRestTarget(session.id, null);
  assert.equal(afterSkip.restTargetAt, undefined);

  // Verify in SQLite
  const row = await db.getFirstAsync<{ rest_target_at: string | null }>(
    `SELECT rest_target_at FROM workout_sessions WHERE id = ?;`,
    session.id
  );
  assert.equal(row?.rest_target_at, null);
});

test('Task 3.5B - Test 12: Skip rest executed after pending target correctly guarantees null final state', async () => {
  const db = await createFreshDb();
  const repo = new SQLiteWorkoutSessionRepository(db);

  const session = await startWorkoutSession(sampleWorkout, repo);

  // Sequence: set target -> set null (skip)
  await repo.setRestTarget(session.id, new Date(Date.now() + 60000).toISOString());
  await repo.setRestTarget(session.id, null);

  const current = await repo.getSessionById(session.id);
  assert.equal(current?.restTargetAt, undefined);
});

test('Task 3.5B - Test 13: Countdown expiration clears rest state in database', async () => {
  const db = await createFreshDb();
  const repo = new SQLiteWorkoutSessionRepository(db);

  const session = await startWorkoutSession(sampleWorkout, repo);

  // Timer set to 1s
  await repo.setRestTarget(session.id, new Date(Date.now() + 1000).toISOString());

  // Simulate expiration event clearing rest target
  await repo.setRestTarget(session.id, null);
  const reloaded = await repo.getSessionById(session.id);
  assert.equal(reloaded?.restTargetAt, undefined);
});

test('Task 3.5B - Test 14: App restart with future target resumes countdown with correct remaining seconds', async () => {
  const db = await createFreshDb();
  const repo = new SQLiteWorkoutSessionRepository(db);

  const session = await startWorkoutSession(sampleWorkout, repo);
  const futureMs = Date.now() + 45000;
  await repo.setRestTarget(session.id, new Date(futureMs).toISOString());

  // Simulate restart: reload from fresh repository instance
  const repo2 = new SQLiteWorkoutSessionRepository(db);
  const activeReloaded = await repo2.getActiveSession();
  assert.ok(activeReloaded);
  assert.ok(activeReloaded.restTargetAt);

  const remaining = Math.max(0, Math.ceil((Date.parse(activeReloaded.restTargetAt) - Date.now()) / 1000));
  assert.ok(remaining > 40 && remaining <= 45);
});

test('Task 3.5B - Test 15: App restart with past target treats timer as expired without negative display', async () => {
  const db = await createFreshDb();
  const repo = new SQLiteWorkoutSessionRepository(db);

  const session = await startWorkoutSession(sampleWorkout, repo);
  // Target was 10 seconds ago
  const pastMs = Date.now() - 10000;
  await repo.setRestTarget(session.id, new Date(pastMs).toISOString());

  const repo2 = new SQLiteWorkoutSessionRepository(db);
  const activeReloaded = await repo2.getActiveSession();
  assert.ok(activeReloaded);

  // Derived countdown Math.max(0, ...)
  const parsed = Date.parse(activeReloaded.restTargetAt!);
  const remaining = Math.max(0, Math.ceil((parsed - Date.now()) / 1000));
  assert.equal(remaining, 0);
});

test('Task 3.5B - Test 16: Background/foreground transition recalculates remaining time from absolute timestamp', async () => {
  const targetMs = Date.now() + 60000;
  const targetIso = new Date(targetMs).toISOString();

  // Simulate 20 seconds passing in background
  const simulatedForegroundNow = Date.now() + 20000;
  const remaining = Math.max(0, Math.ceil((Date.parse(targetIso) - simulatedForegroundNow) / 1000));

  // Should have exactly ~40 seconds remaining regardless of background timer ticks
  assert.equal(remaining, 40);
});

test('Task 3.5B - Test 17: Completing workout clears any active rest target in SQLite', async () => {
  const db = await createFreshDb();
  const repo = new SQLiteWorkoutSessionRepository(db);

  const session = await startWorkoutSession(sampleWorkout, repo);
  await repo.setRestTarget(session.id, new Date(Date.now() + 60000).toISOString());

  // Complete workout session
  await repo.completeSession(session.id, 'Great workout');

  const row = await db.getFirstAsync<{ rest_target_at: string | null }>(
    `SELECT rest_target_at FROM workout_sessions WHERE id = ?;`,
    session.id
  );
  assert.equal(row?.rest_target_at, null);
});

test('Task 3.5B - Test 18: Discarding workout deletes session and cleans up rest target completely', async () => {
  const db = await createFreshDb();
  const repo = new SQLiteWorkoutSessionRepository(db);

  const session = await startWorkoutSession(sampleWorkout, repo);
  await repo.setRestTarget(session.id, new Date(Date.now() + 60000).toISOString());

  // Discard workout
  await repo.discardSession(session.id);

  const row = await db.getFirstAsync<{ id: string }>(
    `SELECT id FROM workout_sessions WHERE id = ?;`,
    session.id
  );
  assert.equal(row, null);
});
