import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabaseAsync } from './mocks/expo-sqlite';
import {
  runMigrations,
  MIGRATIONS,
  detectPreMigrationSessionConflicts,
  reconcilePreMigrationConflicts,
} from '../db/migrations';
import { SQLiteWorkoutSessionRepository } from '../db/repositories/workoutSessionRepository';
import {
  MigrationSessionConflictError,
  SessionValidationError,
} from '../models/workoutSession';

async function setupV5Db() {
  const db = await openDatabaseAsync(':memory:');
  await db.execAsync('PRAGMA foreign_keys = ON;');
  // Run migrations 1 through 5 only
  for (let v = 1; v <= 5; v++) {
    const migration = MIGRATIONS.find((m) => m.version === v);
    if (!migration) throw new Error(`Migration ${v} not found`);
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

async function createFreshDb() {
  const db = await openDatabaseAsync(':memory:');
  await db.execAsync('PRAGMA foreign_keys = ON;');
  await runMigrations(db);
  return db;
}

test('Task 3.5C - Test 1: getDatabase / default runMigrations runs with strictConflictCheck: true by default and throws MigrationSessionConflictError when multiple open sessions exist prior to Migration 6', async () => {
  const db = await setupV5Db();

  // Insert two open sessions at V5
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO workout_sessions (id, title, status, started_at, accumulated_elapsed_ms, created_at, updated_at)
     VALUES ('s-1', 'Morning Push', 'active', ?, 0, ?, ?);`,
    '2026-11-13T08:00:00.000Z',
    now,
    now
  );
  await db.runAsync(
    `INSERT INTO workout_sessions (id, title, status, started_at, accumulated_elapsed_ms, created_at, updated_at)
     VALUES ('s-2', 'Evening Pull', 'paused', ?, 0, ?, ?);`,
    '2026-11-13T18:00:00.000Z',
    now,
    now
  );

  // Calling detectPreMigrationSessionConflicts verifies detection
  const detected = await detectPreMigrationSessionConflicts(db);
  assert.equal(detected.length, 2);

  // Calling runMigrations without options defaults to strictConflictCheck: true
  await assert.rejects(
    async () => {
      await runMigrations(db);
    },
    (err: any) => {
      assert.ok(err instanceof MigrationSessionConflictError);
      assert.equal(err.conflictingSessions.length, 2);
      return true;
    }
  );
});

test('Task 3.5C - Test 2: default runMigrations does not discard or alter sessions when pre-migration conflict is detected', async () => {
  const db = await setupV5Db();

  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO workout_sessions (id, title, status, started_at, accumulated_elapsed_ms, created_at, updated_at)
     VALUES ('s-1', 'Push Session', 'active', '2026-11-13T08:00:00.000Z', 0, ?, ?);`,
    now,
    now
  );
  await db.runAsync(
    `INSERT INTO workout_sessions (id, title, status, started_at, accumulated_elapsed_ms, created_at, updated_at)
     VALUES ('s-2', 'Pull Session', 'paused', '2026-11-13T18:00:00.000Z', 0, ?, ?);`,
    now,
    now
  );

  try {
    await runMigrations(db);
    assert.fail('Should have thrown MigrationSessionConflictError');
  } catch (err) {
    assert.ok(err instanceof MigrationSessionConflictError);
  }

  // Verify both sessions remain untouched and neither is discarded
  const rows = await db.getAllAsync<{ id: string; status: string }>(
    `SELECT id, status FROM workout_sessions ORDER BY id ASC;`
  );
  assert.equal(rows.length, 2);
  assert.equal(rows[0].status, 'active');
  assert.equal(rows[1].status, 'paused');
});

test('Task 3.5C - Test 3: reconcilePreMigrationConflicts safely keeps the designated session open and archives all other open sessions', async () => {
  const db = await setupV5Db();

  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO workout_sessions (id, title, status, started_at, accumulated_elapsed_ms, created_at, updated_at)
     VALUES ('s-1', 'First Workout', 'active', '2026-11-13T08:00:00.000Z', 5000, ?, ?);`,
    now,
    now
  );
  await db.runAsync(
    `INSERT INTO workout_sessions (id, title, status, started_at, accumulated_elapsed_ms, created_at, updated_at)
     VALUES ('s-2', 'Second Workout', 'paused', '2026-11-13T10:00:00.000Z', 12000, ?, ?);`,
    now,
    now
  );

  // User selects s-2 to resume, archives s-1
  await reconcilePreMigrationConflicts(db, {
    resumeSessionId: 's-2',
    actionForOthers: 'archive',
  });

  const session1 = await db.getFirstAsync<{ status: string; recovery_state: string }>(
    `SELECT status, recovery_state FROM workout_sessions WHERE id = 's-1';`
  );
  const session2 = await db.getFirstAsync<{ status: string; recovery_state: string }>(
    `SELECT status, recovery_state FROM workout_sessions WHERE id = 's-2';`
  );

  assert.equal(session1?.status, 'completed');
  assert.equal(session1?.recovery_state, 'archived');
  assert.equal(session2?.status, 'active');
  assert.equal(session2?.recovery_state, 'recovered');
});

test('Task 3.5C - Test 4: reconcilePreMigrationConflicts with actionForOthers: "discard" deletes non-chosen open sessions', async () => {
  const db = await setupV5Db();

  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO workout_sessions (id, title, status, started_at, accumulated_elapsed_ms, created_at, updated_at)
     VALUES ('s-a', 'Session A', 'active', '2026-11-13T08:00:00.000Z', 0, ?, ?);`,
    now,
    now
  );
  await db.runAsync(
    `INSERT INTO workout_sessions (id, title, status, started_at, accumulated_elapsed_ms, created_at, updated_at)
     VALUES ('s-b', 'Session B', 'paused', '2026-11-13T09:00:00.000Z', 0, ?, ?);`,
    now,
    now
  );

  await reconcilePreMigrationConflicts(db, {
    resumeSessionId: 's-a',
    actionForOthers: 'discard',
  });

  const remaining = await db.getAllAsync<{ id: string; status: string; recovery_state: string }>(
    `SELECT id, status, recovery_state FROM workout_sessions;`
  );
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].id, 's-a');
  assert.equal(remaining[0].status, 'active');
  assert.equal(remaining[0].recovery_state, 'recovered');
});

test('Task 3.5C - Test 5: reconcilePreMigrationConflicts rejects an invalid resumeSessionId not in the open set', async () => {
  const db = await setupV5Db();

  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO workout_sessions (id, title, status, started_at, accumulated_elapsed_ms, created_at, updated_at)
     VALUES ('s-open', 'Open Session', 'active', '2026-11-13T08:00:00.000Z', 0, ?, ?);`,
    now,
    now
  );

  await assert.rejects(
    async () => {
      await reconcilePreMigrationConflicts(db, {
        resumeSessionId: 'non-existent-session-id',
      });
    },
    (err: any) => {
      assert.ok(err instanceof SessionValidationError);
      assert.equal(err.field, 'resumeSessionId');
      return true;
    }
  );
});

test('Task 3.5C - Test 6: After reconcilePreMigrationConflicts, subsequent runMigrations completes all migrations without throwing', async () => {
  const db = await setupV5Db();

  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO workout_sessions (id, title, status, started_at, accumulated_elapsed_ms, created_at, updated_at)
     VALUES ('s-1', 'Workout 1', 'active', '2026-11-13T08:00:00.000Z', 0, ?, ?);`,
    now,
    now
  );
  await db.runAsync(
    `INSERT INTO workout_sessions (id, title, status, started_at, accumulated_elapsed_ms, created_at, updated_at)
     VALUES ('s-2', 'Workout 2', 'paused', '2026-11-13T09:00:00.000Z', 0, ?, ?);`,
    now,
    now
  );

  // User reconciles
  await reconcilePreMigrationConflicts(db, {
    resumeSessionId: 's-1',
    actionForOthers: 'archive',
  });

  // Now run pending migrations (6, 7, 8)
  await runMigrations(db);

  const applied = await db.getAllAsync<{ version: number }>(
    `SELECT version FROM schema_migrations ORDER BY version ASC;`
  );
  assert.equal(applied.length, 8);
  assert.equal(applied[7].version, 8);
});

test('Task 3.5C - Test 7: Fresh database install runs migrations 1-8 cleanly without errors', async () => {
  const db = await createFreshDb();
  const applied = await db.getAllAsync<{ version: number; name: string }>(
    `SELECT version, name FROM schema_migrations ORDER BY version ASC;`
  );
  assert.equal(applied.length, 8);
  assert.equal(applied[0].name, 'initial_schema_v1');
  assert.equal(applied[7].name, 'clarify_session_recovery_provenance_v8');
});

test('Task 3.5C - Test 8: Database at V5 with 1 open session runs migrations 6, 7, 8 cleanly', async () => {
  const db = await setupV5Db();

  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO workout_sessions (id, title, status, started_at, accumulated_elapsed_ms, created_at, updated_at)
     VALUES ('s-single', 'Single Session', 'active', '2026-11-13T08:00:00.000Z', 0, ?, ?);`,
    now,
    now
  );

  await runMigrations(db);

  const session = await db.getFirstAsync<{ id: string; status: string }>(
    `SELECT id, status FROM workout_sessions WHERE id = 's-single';`
  );
  assert.equal(session?.status, 'active');
});

test('Task 3.5C - Test 9: Database at original V6 runs forward migrations 7 and 8 cleanly', async () => {
  const db = await setupV5Db();

  // Apply original Migration 6
  const migration6 = MIGRATIONS.find((m) => m.version === 6)!;
  await db.withTransactionAsync(async () => {
    await migration6.up(db);
    await db.runAsync(
      'INSERT INTO schema_migrations (version, name, applied_at) VALUES (6, ?, ?);',
      migration6.name,
      new Date().toISOString()
    );
  });

  // Insert a discarded session without recovery_state (simulating original V6)
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO workout_sessions (id, title, status, started_at, accumulated_elapsed_ms, created_at, updated_at)
     VALUES ('s-v6-discarded', 'Old Discarded', 'discarded', '2026-11-13T08:00:00.000Z', 0, ?, ?);`,
    now,
    now
  );

  // Run forward migrations (7 and 8)
  await runMigrations(db);

  const applied = await db.getAllAsync<{ version: number }>(
    `SELECT version FROM schema_migrations ORDER BY version ASC;`
  );
  assert.equal(applied.length, 8);

  const session = await db.getFirstAsync<{ recovery_state: string }>(
    `SELECT recovery_state FROM workout_sessions WHERE id = 's-v6-discarded';`
  );
  assert.equal(session?.recovery_state, 'ambiguous');
});

test('Task 3.5C - Test 10: Database at V7 runs forward migration 8 cleanly', async () => {
  const db = await setupV5Db();

  // Apply Migration 6 and Migration 7
  for (const v of [6, 7]) {
    const m = MIGRATIONS.find((mig) => mig.version === v)!;
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

  // Insert an interrupted discarded session
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO workout_sessions (id, title, status, started_at, accumulated_elapsed_ms, recovery_state, created_at, updated_at)
     VALUES ('s-v7-interrupted', 'V7 Conflicted', 'discarded', '2026-11-13T08:00:00.000Z', 0, 'interrupted', ?, ?);`,
    now,
    now
  );

  // Run forward migration 8
  await runMigrations(db);

  const applied = await db.getAllAsync<{ version: number }>(
    `SELECT version FROM schema_migrations ORDER BY version ASC;`
  );
  assert.equal(applied.length, 8);
  assert.equal(applied[7].version, 8);
});

test('Task 3.5C - Test 11: Migration 8 updates discarded sessions with recovery_state = "interrupted" or NULL to "ambiguous"', async () => {
  const db = await setupV5Db();

  // Apply through V7
  for (const v of [6, 7]) {
    const m = MIGRATIONS.find((mig) => mig.version === v)!;
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

  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO workout_sessions (id, title, status, started_at, accumulated_elapsed_ms, recovery_state, created_at, updated_at)
     VALUES ('s-disc-interrupted', 'Discarded Interrupted', 'discarded', '2026-11-13T08:00:00.000Z', 0, 'interrupted', ?, ?);`,
    now,
    now
  );
  await db.runAsync(
    `INSERT INTO workout_sessions (id, title, status, started_at, accumulated_elapsed_ms, recovery_state, created_at, updated_at)
     VALUES ('s-disc-null', 'Discarded Null', 'discarded', '2026-11-13T09:00:00.000Z', 0, NULL, ?, ?);`,
    now,
    now
  );

  // Apply Migration 8
  await runMigrations(db);

  const row1 = await db.getFirstAsync<{ recovery_state: string }>(
    `SELECT recovery_state FROM workout_sessions WHERE id = 's-disc-interrupted';`
  );
  const row2 = await db.getFirstAsync<{ recovery_state: string }>(
    `SELECT recovery_state FROM workout_sessions WHERE id = 's-disc-null';`
  );

  assert.equal(row1?.recovery_state, 'ambiguous');
  assert.equal(row2?.recovery_state, 'ambiguous');
});

test('Task 3.5C - Test 12: Migration 8 does not alter sessions with recovery_state = "recovered" or "archived"', async () => {
  const db = await setupV5Db();

  for (const v of [6, 7]) {
    const m = MIGRATIONS.find((mig) => mig.version === v)!;
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

  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO workout_sessions (id, title, status, started_at, accumulated_elapsed_ms, recovery_state, created_at, updated_at)
     VALUES ('s-rec', 'Recovered Session', 'active', '2026-11-13T08:00:00.000Z', 0, 'recovered', ?, ?);`,
    now,
    now
  );
  await db.runAsync(
    `INSERT INTO workout_sessions (id, title, status, started_at, accumulated_elapsed_ms, recovery_state, created_at, updated_at)
     VALUES ('s-arch', 'Archived Session', 'completed', '2026-11-13T09:00:00.000Z', 0, 'archived', ?, ?);`,
    now,
    now
  );

  await runMigrations(db);

  const rowRec = await db.getFirstAsync<{ recovery_state: string }>(
    `SELECT recovery_state FROM workout_sessions WHERE id = 's-rec';`
  );
  const rowArch = await db.getFirstAsync<{ recovery_state: string }>(
    `SELECT recovery_state FROM workout_sessions WHERE id = 's-arch';`
  );

  assert.equal(rowRec?.recovery_state, 'recovered');
  assert.equal(rowArch?.recovery_state, 'archived');
});

test('Task 3.5C - Test 13: listInterruptedSessions returns sessions with recovery_state IN ("interrupted", "ambiguous") AND status != "completed"', async () => {
  const db = await createFreshDb();
  const repo = new SQLiteWorkoutSessionRepository(db);

  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO workout_sessions (id, title, status, started_at, accumulated_elapsed_ms, recovery_state, created_at, updated_at)
     VALUES ('s-inter', 'Interrupted Session', 'discarded', '2026-11-13T08:00:00.000Z', 0, 'interrupted', ?, ?);`,
    now,
    now
  );
  await db.runAsync(
    `INSERT INTO workout_sessions (id, title, status, started_at, accumulated_elapsed_ms, recovery_state, created_at, updated_at)
     VALUES ('s-ambig', 'Ambiguous Session', 'discarded', '2026-11-13T09:00:00.000Z', 0, 'ambiguous', ?, ?);`,
    now,
    now
  );

  const list = await repo.listInterruptedSessions();
  const ids = list.map((s) => s.id);
  assert.ok(ids.includes('s-inter'));
  assert.ok(ids.includes('s-ambig'));
});

test('Task 3.5C - Test 14: listInterruptedSessions excludes completed and recovered sessions', async () => {
  const db = await createFreshDb();
  const repo = new SQLiteWorkoutSessionRepository(db);

  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO workout_sessions (id, title, status, started_at, accumulated_elapsed_ms, recovery_state, created_at, updated_at)
     VALUES ('s-comp', 'Completed Session', 'completed', '2026-11-13T08:00:00.000Z', 0, 'archived', ?, ?);`,
    now,
    now
  );
  await db.runAsync(
    `INSERT INTO workout_sessions (id, title, status, started_at, accumulated_elapsed_ms, recovery_state, created_at, updated_at)
     VALUES ('s-act', 'Active Recovered', 'active', '2026-11-13T09:00:00.000Z', 0, 'recovered', ?, ?);`,
    now,
    now
  );

  const list = await repo.listInterruptedSessions();
  const ids = list.map((s) => s.id);
  assert.ok(!ids.includes('s-comp'));
  assert.ok(!ids.includes('s-act'));
});

test('Task 3.5C - Test 15: resumeInterruptedSession preserves started_at and accumulated_elapsed_ms (does not inflate workout time with interruption duration)', async () => {
  const db = await createFreshDb();
  const repo = new SQLiteWorkoutSessionRepository(db);

  const originalStartedAt = '2026-11-13T07:00:00.000Z';
  const originalElapsed = 450000; // 7.5 minutes

  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO workout_sessions (id, title, status, started_at, accumulated_elapsed_ms, recovery_state, created_at, updated_at)
     VALUES ('s-preserve-time', 'Preserve Time Test', 'discarded', ?, ?, 'interrupted', ?, ?);`,
    originalStartedAt,
    originalElapsed,
    now,
    now
  );

  const resumed = await repo.resumeInterruptedSession('s-preserve-time');

  assert.equal(resumed.startedAt, originalStartedAt);
  assert.equal(resumed.accumulatedElapsedMs, originalElapsed);
});

test('Task 3.5C - Test 16: resumeInterruptedSession sets recovery_state = "recovered" and status = "active"', async () => {
  const db = await createFreshDb();
  const repo = new SQLiteWorkoutSessionRepository(db);

  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO workout_sessions (id, title, status, started_at, accumulated_elapsed_ms, recovery_state, created_at, updated_at)
     VALUES ('s-to-recover', 'Recoverable Session', 'discarded', ?, 0, 'ambiguous', ?, ?);`,
    now,
    now,
    now
  );

  const resumed = await repo.resumeInterruptedSession('s-to-recover');

  assert.equal(resumed.status, 'active');
  assert.equal(resumed.recoveryState, 'recovered');
});

test('Task 3.5C - Test 17: resumeInterruptedSession requires currentSessionAction if another active session exists, rejecting ambiguous concurrent resume', async () => {
  const db = await createFreshDb();
  const repo = new SQLiteWorkoutSessionRepository(db);

  const now = new Date().toISOString();
  // Active session
  await db.runAsync(
    `INSERT INTO workout_sessions (id, title, status, started_at, accumulated_elapsed_ms, recovery_state, created_at, updated_at)
     VALUES ('s-current-active', 'Currently Active', 'active', ?, 10000, NULL, ?, ?);`,
    now,
    now,
    now
  );
  // Interrupted session to resume
  await db.runAsync(
    `INSERT INTO workout_sessions (id, title, status, started_at, accumulated_elapsed_ms, recovery_state, created_at, updated_at)
     VALUES ('s-target-resume', 'Interrupted Old', 'discarded', '2026-11-13T06:00:00.000Z', 0, 'interrupted', ?, ?);`,
    now,
    now
  );

  // Calling without currentSessionAction must throw
  await assert.rejects(
    async () => {
      await repo.resumeInterruptedSession('s-target-resume');
    },
    (err: any) => {
      assert.ok(err instanceof SessionValidationError);
      assert.equal(err.field, 'currentSessionAction');
      return true;
    }
  );

  // Calling with explicit currentSessionAction: 'archive' succeeds
  const resumed = await repo.resumeInterruptedSession('s-target-resume', {
    currentSessionAction: 'archive',
  });
  assert.equal(resumed.id, 's-target-resume');
  assert.equal(resumed.status, 'active');

  const oldActive = await repo.getSessionById('s-current-active');
  assert.equal(oldActive?.status, 'completed');
  assert.equal(oldActive?.recoveryState, 'archived');
});

test('Task 3.5C - Test 18: resumeInterruptedSession rejects resumption of completed sessions', async () => {
  const db = await createFreshDb();
  const repo = new SQLiteWorkoutSessionRepository(db);

  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO workout_sessions (id, title, status, started_at, accumulated_elapsed_ms, recovery_state, created_at, updated_at)
     VALUES ('s-done', 'Done Workout', 'completed', ?, 0, 'archived', ?, ?);`,
    now,
    now,
    now
  );

  await assert.rejects(
    async () => {
      await repo.resumeInterruptedSession('s-done');
    },
    (err: any) => {
      assert.ok(err instanceof SessionValidationError);
      return true;
    }
  );
});

test('Task 3.5C - Test 19: archiveInterruptedSession sets status = "completed" and recovery_state = "archived"', async () => {
  const db = await createFreshDb();
  const repo = new SQLiteWorkoutSessionRepository(db);

  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO workout_sessions (id, title, status, started_at, accumulated_elapsed_ms, recovery_state, created_at, updated_at)
     VALUES ('s-to-archive', 'Interrupted To Archive', 'discarded', ?, 120000, 'ambiguous', ?, ?);`,
    now,
    now,
    now
  );

  const archived = await repo.archiveInterruptedSession('s-to-archive', 'Archived notes');

  assert.equal(archived.status, 'completed');
  assert.equal(archived.recoveryState, 'archived');
  assert.equal(archived.notes, 'Archived notes');
  assert.equal(archived.accumulatedElapsedMs, 120000);
});

test('Task 3.5C - Test 20: archiveInterruptedSession rejects active or paused sessions', async () => {
  const db = await createFreshDb();
  const repo = new SQLiteWorkoutSessionRepository(db);

  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO workout_sessions (id, title, status, started_at, accumulated_elapsed_ms, created_at, updated_at)
     VALUES ('s-active-reject', 'Active Session', 'active', ?, 0, ?, ?);`,
    now,
    now,
    now
  );

  await assert.rejects(
    async () => {
      await repo.archiveInterruptedSession('s-active-reject');
    },
    (err: any) => {
      assert.ok(err instanceof SessionValidationError);
      assert.equal(err.field, 'status');
      return true;
    }
  );
});

test('Task 3.5C - Test 21: discardSession performs physical deletion of uncompleted session and cascades to sets', async () => {
  const db = await createFreshDb();
  const repo = new SQLiteWorkoutSessionRepository(db);

  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO workout_sessions (id, title, status, started_at, accumulated_elapsed_ms, created_at, updated_at)
     VALUES ('s-to-delete', 'To Delete', 'active', ?, 0, ?, ?);`,
    now,
    now,
    now
  );
  await db.runAsync(
    `INSERT INTO workout_session_exercises (id, session_id, exercise_name, sort_order)
     VALUES ('ex-del-1', 's-to-delete', 'Squat', 0);`
  );
  await db.runAsync(
    `INSERT INTO workout_sets (id, session_exercise_id, set_number, planned_reps, planned_weight_kg, status)
     VALUES ('set-del-1', 'ex-del-1', 1, 10, 100, 'pending');`
  );

  await repo.discardSession('s-to-delete');

  const sRow = await db.getFirstAsync(`SELECT id FROM workout_sessions WHERE id = 's-to-delete';`);
  const exRow = await db.getFirstAsync(`SELECT id FROM workout_session_exercises WHERE id = 'ex-del-1';`);
  const setRow = await db.getFirstAsync(`SELECT id FROM workout_sets WHERE id = 'set-del-1';`);

  assert.equal(sRow, null);
  assert.equal(exRow, null);
  assert.equal(setRow, null);
});

test('Task 3.5C - Test 22: discardSession rejects deletion of completed sessions', async () => {
  const db = await createFreshDb();
  const repo = new SQLiteWorkoutSessionRepository(db);

  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO workout_sessions (id, title, status, started_at, accumulated_elapsed_ms, created_at, updated_at)
     VALUES ('s-done-del', 'Done Workout', 'completed', ?, 0, ?, ?);`,
    now,
    now,
    now
  );

  await assert.rejects(
    async () => {
      await repo.discardSession('s-done-del');
    },
    (err: any) => {
      assert.ok(err instanceof SessionValidationError);
      assert.equal(err.field, 'status');
      return true;
    }
  );
});
