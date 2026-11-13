import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabaseAsync } from './mocks/expo-sqlite';
import {
  runMigrations,
  MIGRATIONS,
  reconcilePreMigrationConflicts,
  calculateConfirmedElapsedMs,
} from '../db/migrations';
import { SQLiteWorkoutSessionRepository } from '../db/repositories/workoutSessionRepository';
import { IDatabase } from '../db/types';
import { calculateSessionPerformanceSummary } from '../utils/workoutAnalytics';

async function setupV5Db(): Promise<IDatabase> {
  const db = await openDatabaseAsync(':memory:');
  await db.execAsync('PRAGMA foreign_keys = ON;');
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  for (let v = 1; v <= 5; v++) {
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

test('Reconciliation Integrity - Test 1: Active session selected for resume accounts for prior confirmed active interval without offline inflation', async () => {
  const db = await setupV5Db();

  const startedAt = '2026-11-13T10:00:00.000Z';
  const lastResumedAt = '2026-11-13T10:00:00.000Z';
  const updatedAt = '2026-11-13T10:10:00.000Z'; // 10 minutes (600,000 ms) confirmed active
  const baseElapsed = 300000; // 5 minutes previously accumulated

  // Insert active session
  await db.runAsync(
    `INSERT INTO workout_sessions (id, title, status, started_at, accumulated_elapsed_ms, last_resumed_at, created_at, updated_at)
     VALUES ('s-active-resume', 'Morning Cardio', 'active', ?, ?, ?, ?, ?);`,
    startedAt,
    baseElapsed,
    lastResumedAt,
    startedAt,
    updatedAt
  );

  // Insert a second open session to trigger conflict
  await db.runAsync(
    `INSERT INTO workout_sessions (id, title, status, started_at, accumulated_elapsed_ms, created_at, updated_at)
     VALUES ('s-other-1', 'Evening Lift', 'paused', '2026-11-13T17:00:00.000Z', 100000, ?, ?);`,
    updatedAt,
    updatedAt
  );

  // Reconcile: User chooses to resume 's-active-resume'
  await reconcilePreMigrationConflicts(db, {
    resumeSessionId: 's-active-resume',
    actionForOthers: 'keep_interrupted',
  });

  const row = await db.getFirstAsync<{
    status: string;
    recovery_state: string;
    accumulated_elapsed_ms: number;
    last_resumed_at: string;
    started_at: string;
  }>(
    `SELECT status, recovery_state, accumulated_elapsed_ms, last_resumed_at, started_at
     FROM workout_sessions WHERE id = 's-active-resume';`
  );

  assert.equal(row?.status, 'active');
  assert.equal(row?.recovery_state, 'recovered');
  assert.equal(row?.started_at, startedAt);
  // Prior active interval (10m) accounted into accumulated_elapsed_ms: 300k + 600k = 900k
  assert.equal(row?.accumulated_elapsed_ms, 900000);
  // last_resumed_at is set to now (not the old 10:00:00 timestamp)
  assert.notEqual(row?.last_resumed_at, lastResumedAt);
});

test('Reconciliation Integrity - Test 2: Active session kept interrupted preserves confirmed active time and recovery eligibility', async () => {
  const db = await setupV5Db();

  const startedAt = '2026-11-13T08:00:00.000Z';
  const lastResumedAt = '2026-11-13T08:00:00.000Z';
  const updatedAt = '2026-11-13T08:15:00.000Z'; // 15m (900,000 ms) confirmed active
  const baseElapsed = 120000; // 2m prior

  await db.runAsync(
    `INSERT INTO workout_sessions (id, title, status, started_at, accumulated_elapsed_ms, last_resumed_at, created_at, updated_at)
     VALUES ('s-keep-int', 'Bench Press Session', 'active', ?, ?, ?, ?, ?);`,
    startedAt,
    baseElapsed,
    lastResumedAt,
    startedAt,
    updatedAt
  );

  await db.runAsync(
    `INSERT INTO workout_sessions (id, title, status, started_at, accumulated_elapsed_ms, created_at, updated_at)
     VALUES ('s-resumed', 'Squat Session', 'paused', '2026-11-13T09:00:00.000Z', 500000, ?, ?);`,
    updatedAt,
    updatedAt
  );

  // Reconcile: resume 's-resumed', keep 's-keep-int' interrupted
  await reconcilePreMigrationConflicts(db, {
    resumeSessionId: 's-resumed',
    actionForOthers: 'keep_interrupted',
  });

  const row = await db.getFirstAsync<{
    status: string;
    recovery_state: string;
    accumulated_elapsed_ms: number;
    last_resumed_at: string | null;
  }>(
    `SELECT status, recovery_state, accumulated_elapsed_ms, last_resumed_at
     FROM workout_sessions WHERE id = 's-keep-int';`
  );

  assert.equal(row?.status, 'discarded');
  assert.equal(row?.recovery_state, 'interrupted');
  // Base elapsed (120k) + confirmed active delta (900k) = 1,020,000 ms
  assert.equal(row?.accumulated_elapsed_ms, 1020000);
  assert.equal(row?.last_resumed_at, null);

  // Complete forward migrations
  await runMigrations(db);

  // Verify listInterruptedSessions returns it as recoverable
  const repo = new SQLiteWorkoutSessionRepository(db);
  const interrupted = await repo.listInterruptedSessions();
  const ids = interrupted.map((s) => s.id);
  assert.ok(ids.includes('s-keep-int'));
});

test('Reconciliation Integrity - Test 3: Active session explicitly archived preserves completed sets, started_at, and accurate duration', async () => {
  const db = await setupV5Db();

  const startedAt = '2026-11-13T09:00:00.000Z';
  const lastResumedAt = '2026-11-13T09:00:00.000Z';
  const updatedAt = '2026-11-13T09:20:00.000Z'; // 20m (1,200,000 ms) confirmed active

  await db.runAsync(
    `INSERT INTO workout_sessions (id, title, status, started_at, accumulated_elapsed_ms, last_resumed_at, notes, created_at, updated_at)
     VALUES ('s-archive-act', 'Full Body Heavy', 'active', ?, 0, ?, 'Felt strong', ?, ?);`,
    startedAt,
    lastResumedAt,
    startedAt,
    updatedAt
  );

  await db.runAsync(
    `INSERT INTO workout_session_exercises (id, session_id, exercise_name, sort_order)
     VALUES ('ex-arch-1', 's-archive-act', 'Deadlift', 0);`
  );
  await db.runAsync(
    `INSERT INTO workout_sets (id, session_exercise_id, set_number, planned_reps, actual_reps, planned_weight_kg, actual_weight_kg, status)
     VALUES ('st-arch-1', 'ex-arch-1', 1, 5, 5, 140, 140, 'completed');`
  );

  await db.runAsync(
    `INSERT INTO workout_sessions (id, title, status, started_at, accumulated_elapsed_ms, created_at, updated_at)
     VALUES ('s-dummy-open', 'Dummy', 'paused', '2026-11-13T11:00:00.000Z', 0, ?, ?);`,
    updatedAt,
    updatedAt
  );

  // Reconcile: explicitly archive 's-archive-act'
  await reconcilePreMigrationConflicts(db, {
    sessionResolutions: {
      's-archive-act': 'archive',
      's-dummy-open': 'discard',
    },
  });

  const row = await db.getFirstAsync<{
    status: string;
    recovery_state: string;
    started_at: string;
    ended_at: string;
    accumulated_elapsed_ms: number;
    notes: string;
  }>(
    `SELECT status, recovery_state, started_at, ended_at, accumulated_elapsed_ms, notes
     FROM workout_sessions WHERE id = 's-archive-act';`
  );

  assert.equal(row?.status, 'completed');
  assert.equal(row?.recovery_state, 'archived');
  assert.equal(row?.started_at, startedAt);
  assert.equal(row?.ended_at, updatedAt);
  assert.equal(row?.accumulated_elapsed_ms, 1200000); // exactly 20 mins, zero offline drift
  assert.equal(row?.notes, 'Felt strong');

  // Verify child set remains completed
  const setRow = await db.getFirstAsync<{ status: string; actual_weight_kg: number }>(
    `SELECT status, actual_weight_kg FROM workout_sets WHERE id = 'st-arch-1';`
  );
  assert.equal(setRow?.status, 'completed');
  assert.equal(setRow?.actual_weight_kg, 140);
});

test('Reconciliation Integrity - Test 4: Paused session archived never accumulates paused time', async () => {
  const db = await setupV5Db();

  const startedAt = '2026-11-13T07:00:00.000Z';
  const updatedAt = '2026-11-13T07:25:00.000Z';
  const pausedElapsed = 1500000; // 25 minutes confirmed active before pause

  await db.runAsync(
    `INSERT INTO workout_sessions (id, title, status, started_at, accumulated_elapsed_ms, last_resumed_at, created_at, updated_at)
     VALUES ('s-paused-arch', 'Paused Workout', 'paused', ?, ?, NULL, ?, ?);`,
    startedAt,
    pausedElapsed,
    startedAt,
    updatedAt
  );

  await db.runAsync(
    `INSERT INTO workout_sessions (id, title, status, started_at, accumulated_elapsed_ms, created_at, updated_at)
     VALUES ('s-paused-other', 'Other Paused', 'paused', '2026-11-13T08:00:00.000Z', 100000, ?, ?);`,
    updatedAt,
    updatedAt
  );

  // Archive 's-paused-arch' hours/days later
  await reconcilePreMigrationConflicts(db, {
    sessionResolutions: {
      's-paused-arch': 'archive',
      's-paused-other': 'keep_interrupted',
    },
  });

  const row = await db.getFirstAsync<{
    status: string;
    recovery_state: string;
    accumulated_elapsed_ms: number;
    last_resumed_at: string | null;
  }>(
    `SELECT status, recovery_state, accumulated_elapsed_ms, last_resumed_at
     FROM workout_sessions WHERE id = 's-paused-arch';`
  );

  assert.equal(row?.status, 'completed');
  assert.equal(row?.recovery_state, 'archived');
  // Paused session did NOT accumulate paused time: strictly 1500000 ms
  assert.equal(row?.accumulated_elapsed_ms, pausedElapsed);
  assert.equal(row?.last_resumed_at, null);
});

test('Reconciliation Integrity - Test 5: Clock rollback immunity protects against backwards clock shifts', async () => {
  // Unit test calculateConfirmedElapsedMs directly
  const rolledBackSession = {
    status: 'active',
    accumulated_elapsed_ms: 600000,
    started_at: '2026-11-13T10:00:00.000Z',
    last_resumed_at: '2026-11-13T10:00:00.000Z',
    updated_at: '2026-11-13T09:30:00.000Z', // 30 minutes in the past!
  };

  const elapsed = calculateConfirmedElapsedMs(rolledBackSession);
  // Preserves base 600,000 ms, does NOT subtract or become negative
  assert.equal(elapsed, 600000);

  // Test inside SQLite reconciliation
  const db = await setupV5Db();
  await db.runAsync(
    `INSERT INTO workout_sessions (id, title, status, started_at, accumulated_elapsed_ms, last_resumed_at, created_at, updated_at)
     VALUES ('s-rollback', 'Rollback Test', 'active', '2026-11-13T10:00:00.000Z', 500000, '2026-11-13T10:00:00.000Z', '2026-11-13T10:00:00.000Z', '2026-11-13T09:00:00.000Z');`
  );
  await db.runAsync(
    `INSERT INTO workout_sessions (id, title, status, started_at, accumulated_elapsed_ms, created_at, updated_at)
     VALUES ('s-dummy', 'Dummy', 'paused', '2026-11-13T11:00:00.000Z', 0, '2026-11-13T11:00:00.000Z', '2026-11-13T11:00:00.000Z');`
  );

  await reconcilePreMigrationConflicts(db, {
    resumeSessionId: 's-rollback',
    actionForOthers: 'discard',
  });

  const row = await db.getFirstAsync<{ accumulated_elapsed_ms: number }>(
    `SELECT accumulated_elapsed_ms FROM workout_sessions WHERE id = 's-rollback';`
  );
  assert.equal(row?.accumulated_elapsed_ms, 500000);
});

test('Reconciliation Integrity - Test 6: App restart after reconciliation completes cleanly without conflict prompt', async () => {
  const db = await setupV5Db();

  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO workout_sessions (id, title, status, started_at, accumulated_elapsed_ms, created_at, updated_at)
     VALUES ('s-rst-1', 'Restart Test 1', 'active', '2026-11-13T08:00:00.000Z', 0, ?, ?);`,
    now,
    now
  );
  await db.runAsync(
    `INSERT INTO workout_sessions (id, title, status, started_at, accumulated_elapsed_ms, created_at, updated_at)
     VALUES ('s-rst-2', 'Restart Test 2', 'paused', '2026-11-13T09:00:00.000Z', 0, ?, ?);`,
    now,
    now
  );

  // Reconcile and run migrations
  await reconcilePreMigrationConflicts(db, {
    resumeSessionId: 's-rst-1',
    actionForOthers: 'keep_interrupted',
  });
  await runMigrations(db);

  // Simulate subsequent app launch with strict conflict checking enabled
  await runMigrations(db, { strictConflictCheck: true });

  const activeRows = await db.getAllAsync<{ id: string }>(
    `SELECT id FROM workout_sessions WHERE status IN ('active', 'paused');`
  );
  assert.equal(activeRows.length, 1);
  assert.equal(activeRows[0].id, 's-rst-1');
});

test('Reconciliation Integrity - Test 7: Repeated reconciliation is idempotent and safe', async () => {
  const db = await setupV5Db();

  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO workout_sessions (id, title, status, started_at, accumulated_elapsed_ms, created_at, updated_at)
     VALUES ('s-rep-1', 'Session 1', 'active', '2026-11-13T08:00:00.000Z', 200000, ?, ?);`,
    now,
    now
  );
  await db.runAsync(
    `INSERT INTO workout_sessions (id, title, status, started_at, accumulated_elapsed_ms, created_at, updated_at)
     VALUES ('s-rep-2', 'Session 2', 'paused', '2026-11-13T09:00:00.000Z', 300000, ?, ?);`,
    now,
    now
  );

  // First reconciliation
  await reconcilePreMigrationConflicts(db, {
    resumeSessionId: 's-rep-1',
    actionForOthers: 'keep_interrupted',
  });

  // Second reconciliation (idempotent call with no errors)
  await reconcilePreMigrationConflicts(db, {
    resumeSessionId: 's-rep-1',
    actionForOthers: 'keep_interrupted',
  });

  const s1 = await db.getFirstAsync<{ status: string; recovery_state: string }>(
    `SELECT status, recovery_state FROM workout_sessions WHERE id = 's-rep-1';`
  );
  assert.equal(s1?.status, 'active');
  assert.equal(s1?.recovery_state, 'recovered');

  const s2 = await db.getFirstAsync<{ status: string; recovery_state: string }>(
    `SELECT status, recovery_state FROM workout_sessions WHERE id = 's-rep-2';`
  );
  assert.equal(s2?.status, 'discarded');
  assert.equal(s2?.recovery_state, 'interrupted');
});

test('Reconciliation Integrity - Test 8: Non-selected sessions kept interrupted do not fabricate completed workout metrics', async () => {
  const db = await setupV5Db();

  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO workout_sessions (id, title, status, started_at, accumulated_elapsed_ms, created_at, updated_at)
     VALUES ('s-met-1', 'Running', 'active', '2026-11-13T08:00:00.000Z', 400000, ?, ?);`,
    now,
    now
  );
  await db.runAsync(
    `INSERT INTO workout_sessions (id, title, status, started_at, accumulated_elapsed_ms, created_at, updated_at)
     VALUES ('s-met-2', 'Weights', 'paused', '2026-11-13T09:00:00.000Z', 500000, ?, ?);`,
    now,
    now
  );
  await db.runAsync(
    `INSERT INTO workout_sessions (id, title, status, started_at, accumulated_elapsed_ms, created_at, updated_at)
     VALUES ('s-met-3', 'Yoga', 'active', '2026-11-13T10:00:00.000Z', 600000, ?, ?);`,
    now,
    now
  );

  // User only resumes s-met-1; s-met-2 and s-met-3 are kept interrupted
  await reconcilePreMigrationConflicts(db, {
    resumeSessionId: 's-met-1',
    actionForOthers: 'keep_interrupted',
  });
  await runMigrations(db);

  const sessionRepo = new SQLiteWorkoutSessionRepository(db);

  // Fetch all completed sessions
  const allSessions = await sessionRepo.listSessions(100);
  const completedSessions = allSessions.filter((s) => s.status === 'completed');

  // Exactly 0 completed sessions exist! (s-met-1 is active, s-met-2 and s-met-3 are discarded/interrupted)
  assert.equal(completedSessions.length, 0);

  // Performance summary on s-met-2 confirms it was not counted as completed
  const s2 = (await sessionRepo.getSessionById('s-met-2'))!;
  assert.notEqual(s2.status, 'completed');
  const summary = calculateSessionPerformanceSummary(s2);
  assert.equal(summary.totalCompletedSets, 0);
  assert.equal(summary.actualRecordedVolumeKg, 0);
});
