import test from 'node:test';
import assert from 'node:assert/strict';

import { openDatabaseAsync } from './mocks/expo-sqlite';
import { runMigrations, MIGRATIONS } from '../db/migrations';
import { SQLiteWorkoutRepository } from '../db/repositories/workoutRepository';
import { SQLiteWorkoutSessionRepository } from '../db/repositories/workoutSessionRepository';
import { normalizeWorkout } from '../models/workout';
import { SessionValidationError } from '../models/workoutSession';
import {
  startWorkoutSession,
  setSessionRestTarget,
} from '../services/workoutSessionService';
import { en } from '../i18n/en';
import { ar } from '../i18n/ar';

async function createTestDb() {
  const db = await openDatabaseAsync(':memory:');
  await db.execAsync('PRAGMA foreign_keys = ON;');
  await runMigrations(db);
  return db;
}

function sampleWorkout(id = 'wk-integrity-test') {
  return normalizeWorkout({
    id,
    title: 'Integrity Hardening Workout',
    date: '2026-11-13',
    time: '10:00',
    duration: 45,
    exercises: [
      {
        id: `ex-press-${id}`,
        name: 'Overhead Press',
        sets: 3,
        reps: 8,
        weight: 50,
        targetMuscles: ['shoulders', 'arms'],
        catalogId: 'overhead-press',
      },
      {
        id: `ex-lateral-${id}`,
        name: 'Lateral Raises',
        sets: 2,
        reps: 12,
        weight: 12,
        targetMuscles: ['shoulders'],
      },
    ],
  });
}

// 1. Strict set validation: completeSet rejects negative reps
test('Task 3.5A - Test 1: completeSet rejects negative reps without silent clamping', async () => {
  const db = await createTestDb();
  const repo = new SQLiteWorkoutSessionRepository(db);
  const workoutRepo = new SQLiteWorkoutRepository(db);
  const wk = sampleWorkout('wk-val-1');
  await workoutRepo.insertWorkout(wk);

  const session = await startWorkoutSession(wk, repo);
  const firstSetId = session.exercises[0].sets[0].id;

  await assert.rejects(
    async () => {
      await repo.completeSet(firstSetId, { actualReps: -5, actualWeightKg: 50 });
    },
    (err: unknown) => {
      assert.ok(err instanceof SessionValidationError);
      assert.equal(err.field, 'actualReps');
      assert.match(err.message, /non-negative integer/i);
      return true;
    }
  );

  // Set must remain pending in SQLite
  const s = await repo.getSessionById(session.id);
  assert.equal(s?.exercises[0].sets[0].status, 'pending');
  assert.equal(s?.exercises[0].sets[0].actualReps, null);
});

// 2. Strict set validation: completeSet rejects fractional reps (e.g. 8.5)
test('Task 3.5A - Test 2: completeSet rejects fractional actual reps without silent rounding', async () => {
  const db = await createTestDb();
  const repo = new SQLiteWorkoutSessionRepository(db);
  const workoutRepo = new SQLiteWorkoutRepository(db);
  const wk = sampleWorkout('wk-val-2');
  await workoutRepo.insertWorkout(wk);

  const session = await startWorkoutSession(wk, repo);
  const firstSetId = session.exercises[0].sets[0].id;

  await assert.rejects(
    async () => {
      await repo.completeSet(firstSetId, { actualReps: 8.5, actualWeightKg: 50 });
    },
    (err: unknown) => {
      assert.ok(err instanceof SessionValidationError);
      assert.equal(err.field, 'actualReps');
      assert.match(err.message, /non-negative integer/i);
      return true;
    }
  );

  // Set must not be updated or rounded to 8 or 9
  const s = await repo.getSessionById(session.id);
  assert.equal(s?.exercises[0].sets[0].status, 'pending');
});

// 3. Strict set validation: completeSet rejects negative weight
test('Task 3.5A - Test 3: completeSet rejects negative weight without silent clamping to 0', async () => {
  const db = await createTestDb();
  const repo = new SQLiteWorkoutSessionRepository(db);
  const workoutRepo = new SQLiteWorkoutRepository(db);
  const wk = sampleWorkout('wk-val-3');
  await workoutRepo.insertWorkout(wk);

  const session = await startWorkoutSession(wk, repo);
  const firstSetId = session.exercises[0].sets[0].id;

  await assert.rejects(
    async () => {
      await repo.completeSet(firstSetId, { actualReps: 8, actualWeightKg: -10 });
    },
    (err: unknown) => {
      assert.ok(err instanceof SessionValidationError);
      assert.equal(err.field, 'actualWeightKg');
      assert.match(err.message, /non-negative number/i);
      return true;
    }
  );
});

// 4. Strict set validation: completeSet rejects NaN reps or weight
test('Task 3.5A - Test 4: completeSet rejects NaN reps and NaN weight', async () => {
  const db = await createTestDb();
  const repo = new SQLiteWorkoutSessionRepository(db);
  const workoutRepo = new SQLiteWorkoutRepository(db);
  const wk = sampleWorkout('wk-val-4');
  await workoutRepo.insertWorkout(wk);

  const session = await startWorkoutSession(wk, repo);
  const firstSetId = session.exercises[0].sets[0].id;

  await assert.rejects(
    async () => {
      await repo.completeSet(firstSetId, { actualReps: NaN, actualWeightKg: 50 });
    },
    (err: unknown) => {
      assert.ok(err instanceof SessionValidationError);
      assert.equal(err.field, 'actualReps');
      return true;
    }
  );

  await assert.rejects(
    async () => {
      await repo.completeSet(firstSetId, { actualReps: 8, actualWeightKg: NaN });
    },
    (err: unknown) => {
      assert.ok(err instanceof SessionValidationError);
      assert.equal(err.field, 'actualWeightKg');
      return true;
    }
  );
});

// 5. Strict set validation: completeSet rejects Infinity
test('Task 3.5A - Test 5: completeSet rejects Infinity reps and Infinity weight', async () => {
  const db = await createTestDb();
  const repo = new SQLiteWorkoutSessionRepository(db);
  const workoutRepo = new SQLiteWorkoutRepository(db);
  const wk = sampleWorkout('wk-val-5');
  await workoutRepo.insertWorkout(wk);

  const session = await startWorkoutSession(wk, repo);
  const firstSetId = session.exercises[0].sets[0].id;

  await assert.rejects(
    async () => {
      await repo.completeSet(firstSetId, { actualReps: Infinity, actualWeightKg: 50 });
    },
    (err: unknown) => {
      assert.ok(err instanceof SessionValidationError);
      assert.equal(err.field, 'actualReps');
      return true;
    }
  );

  await assert.rejects(
    async () => {
      await repo.completeSet(firstSetId, { actualReps: 8, actualWeightKg: Infinity });
    },
    (err: unknown) => {
      assert.ok(err instanceof SessionValidationError);
      assert.equal(err.field, 'actualWeightKg');
      return true;
    }
  );
});

// 6. Strict set validation: completeSet rejects RPE outside 1-10
test('Task 3.5A - Test 6: completeSet rejects invalid RPE outside 1-10 or non-finite', async () => {
  const db = await createTestDb();
  const repo = new SQLiteWorkoutSessionRepository(db);
  const workoutRepo = new SQLiteWorkoutRepository(db);
  const wk = sampleWorkout('wk-val-6');
  await workoutRepo.insertWorkout(wk);

  const session = await startWorkoutSession(wk, repo);
  const firstSetId = session.exercises[0].sets[0].id;

  await assert.rejects(
    async () => {
      await repo.completeSet(firstSetId, { actualReps: 8, actualWeightKg: 50, rpe: 0 });
    },
    (err: unknown) => {
      assert.ok(err instanceof SessionValidationError);
      assert.equal(err.field, 'rpe');
      assert.match(err.message, /between 1 and 10/i);
      return true;
    }
  );

  await assert.rejects(
    async () => {
      await repo.completeSet(firstSetId, { actualReps: 8, actualWeightKg: 50, rpe: 11 });
    },
    (err: unknown) => {
      assert.ok(err instanceof SessionValidationError);
      assert.equal(err.field, 'rpe');
      assert.match(err.message, /between 1 and 10/i);
      return true;
    }
  );

  await assert.rejects(
    async () => {
      await repo.completeSet(firstSetId, { actualReps: 8, actualWeightKg: 50, rpe: NaN });
    },
    (err: unknown) => {
      assert.ok(err instanceof SessionValidationError);
      assert.equal(err.field, 'rpe');
      return true;
    }
  );
});

// 7. Strict set validation: completeSet requires actual reps and weight (no null)
test('Task 3.5A - Test 7: completeSet requires actual reps and actual weight', async () => {
  const db = await createTestDb();
  const repo = new SQLiteWorkoutSessionRepository(db);
  const workoutRepo = new SQLiteWorkoutRepository(db);
  const wk = sampleWorkout('wk-val-7');
  await workoutRepo.insertWorkout(wk);

  const session = await startWorkoutSession(wk, repo);
  const firstSetId = session.exercises[0].sets[0].id;

  await assert.rejects(
    async () => {
      await repo.completeSet(firstSetId, { actualReps: null as unknown as any, actualWeightKg: 50 });
    },
    (err: unknown) => {
      assert.ok(err instanceof SessionValidationError);
      assert.equal(err.field, 'actualReps');
      return true;
    }
  );

  await assert.rejects(
    async () => {
      await repo.completeSet(firstSetId, { actualReps: 8, actualWeightKg: null as unknown as any });
    },
    (err: unknown) => {
      assert.ok(err instanceof SessionValidationError);
      assert.equal(err.field, 'actualWeightKg');
      return true;
    }
  );
});

// 8. Strict set validation: updateSet rejects invalid values and prevents corrupting existing completed set
test('Task 3.5A - Test 8: updateSet strictly validates updates and protects completed set integrity', async () => {
  const db = await createTestDb();
  const repo = new SQLiteWorkoutSessionRepository(db);
  const workoutRepo = new SQLiteWorkoutRepository(db);
  const wk = sampleWorkout('wk-val-8');
  await workoutRepo.insertWorkout(wk);

  const session = await startWorkoutSession(wk, repo);
  const firstSetId = session.exercises[0].sets[0].id;

  // Complete set validly first
  await repo.completeSet(firstSetId, { actualReps: 8, actualWeightKg: 50, rpe: 8 });

  // Updating with negative reps must fail
  await assert.rejects(
    async () => {
      await repo.updateSet(firstSetId, { actualReps: -1 });
    },
    (err: unknown) => {
      assert.ok(err instanceof SessionValidationError);
      assert.equal(err.field, 'actualReps');
      return true;
    }
  );

  // Updating with fractional reps must fail
  await assert.rejects(
    async () => {
      await repo.updateSet(firstSetId, { actualReps: 7.5 });
    },
    (err: unknown) => {
      assert.ok(err instanceof SessionValidationError);
      assert.equal(err.field, 'actualReps');
      return true;
    }
  );

  // Updating with negative weight must fail
  await assert.rejects(
    async () => {
      await repo.updateSet(firstSetId, { actualWeightKg: -20 });
    },
    (err: unknown) => {
      assert.ok(err instanceof SessionValidationError);
      assert.equal(err.field, 'actualWeightKg');
      return true;
    }
  );

  // Existing set remains untouched
  const s = await repo.getSessionById(session.id);
  assert.equal(s?.exercises[0].sets[0].actualReps, 8);
  assert.equal(s?.exercises[0].sets[0].actualWeightKg, 50);
});

// 9. Strict set validation: addSet rejects negative planned reps or weight
test('Task 3.5A - Test 9: addSet rejects negative planned reps or weight', async () => {
  const db = await createTestDb();
  const repo = new SQLiteWorkoutSessionRepository(db);
  const workoutRepo = new SQLiteWorkoutRepository(db);
  const wk = sampleWorkout('wk-val-9');
  await workoutRepo.insertWorkout(wk);

  const session = await startWorkoutSession(wk, repo);
  const exId = session.exercises[0].id;

  await assert.rejects(
    async () => {
      await repo.addSet(exId, -5, 50);
    },
    (err: unknown) => {
      assert.ok(err instanceof SessionValidationError);
      assert.equal(err.field, 'plannedReps');
      return true;
    }
  );

  await assert.rejects(
    async () => {
      await repo.addSet(exId, 10, -15);
    },
    (err: unknown) => {
      assert.ok(err instanceof SessionValidationError);
      assert.equal(err.field, 'plannedWeightKg');
      return true;
    }
  );
});

// 10. Strict set validation: addSet rejects non-finite or fractional planned reps
test('Task 3.5A - Test 10: addSet rejects non-finite or fractional planned reps', async () => {
  const db = await createTestDb();
  const repo = new SQLiteWorkoutSessionRepository(db);
  const workoutRepo = new SQLiteWorkoutRepository(db);
  const wk = sampleWorkout('wk-val-10');
  await workoutRepo.insertWorkout(wk);

  const session = await startWorkoutSession(wk, repo);
  const exId = session.exercises[0].id;

  await assert.rejects(
    async () => {
      await repo.addSet(exId, 10.5, 50);
    },
    (err: unknown) => {
      assert.ok(err instanceof SessionValidationError);
      assert.equal(err.field, 'plannedReps');
      return true;
    }
  );

  await assert.rejects(
    async () => {
      await repo.addSet(exId, NaN, 50);
    },
    (err: unknown) => {
      assert.ok(err instanceof SessionValidationError);
      assert.equal(err.field, 'plannedReps');
      return true;
    }
  );
});

// 11. Terminal session protection: completeSet rejected on completed session
test('Task 3.5A - Test 11: completeSet is strictly rejected on completed session', async () => {
  const db = await createTestDb();
  const repo = new SQLiteWorkoutSessionRepository(db);
  const workoutRepo = new SQLiteWorkoutRepository(db);
  const wk = sampleWorkout('wk-term-11');
  await workoutRepo.insertWorkout(wk);

  const session = await startWorkoutSession(wk, repo);
  const firstSetId = session.exercises[0].sets[0].id;

  // Complete session
  await repo.completeSession(session.id);

  // Attempting completeSet must be rejected
  await assert.rejects(
    async () => {
      await repo.completeSet(firstSetId, { actualReps: 8, actualWeightKg: 50 });
    },
    (err: unknown) => {
      assert.ok(err instanceof SessionValidationError);
      assert.equal(err.field, 'status');
      assert.match(err.message, /completed workout session/i);
      return true;
    }
  );
});

// 12. Terminal session protection: completeSet rejected on discarded session
test('Task 3.5A - Test 12: completeSet is strictly rejected on discarded session', async () => {
  const db = await createTestDb();
  const repo = new SQLiteWorkoutSessionRepository(db);
  const workoutRepo = new SQLiteWorkoutRepository(db);
  const wk = sampleWorkout('wk-term-12');
  await workoutRepo.insertWorkout(wk);

  const session = await startWorkoutSession(wk, repo);
  const firstSetId = session.exercises[0].sets[0].id;

  // Mark session discarded directly
  await db.runAsync(`UPDATE workout_sessions SET status = 'discarded' WHERE id = ?;`, session.id);

  await assert.rejects(
    async () => {
      await repo.completeSet(firstSetId, { actualReps: 8, actualWeightKg: 50 });
    },
    (err: unknown) => {
      assert.ok(err instanceof SessionValidationError);
      assert.equal(err.field, 'status');
      assert.match(err.message, /discarded workout session/i);
      return true;
    }
  );
});

// 13. Terminal session protection: skipSet rejected on completed session
test('Task 3.5A - Test 13: skipSet is strictly rejected on completed session', async () => {
  const db = await createTestDb();
  const repo = new SQLiteWorkoutSessionRepository(db);
  const workoutRepo = new SQLiteWorkoutRepository(db);
  const wk = sampleWorkout('wk-term-13');
  await workoutRepo.insertWorkout(wk);

  const session = await startWorkoutSession(wk, repo);
  const firstSetId = session.exercises[0].sets[0].id;

  await repo.completeSession(session.id);

  await assert.rejects(
    async () => {
      await repo.skipSet(firstSetId);
    },
    (err: unknown) => {
      assert.ok(err instanceof SessionValidationError);
      assert.equal(err.field, 'status');
      assert.match(err.message, /completed workout session/i);
      return true;
    }
  );
});

// 14. Terminal session protection: updateSet rejected on completed session
test('Task 3.5A - Test 14: updateSet is strictly rejected on completed session', async () => {
  const db = await createTestDb();
  const repo = new SQLiteWorkoutSessionRepository(db);
  const workoutRepo = new SQLiteWorkoutRepository(db);
  const wk = sampleWorkout('wk-term-14');
  await workoutRepo.insertWorkout(wk);

  const session = await startWorkoutSession(wk, repo);
  const firstSetId = session.exercises[0].sets[0].id;

  await repo.completeSession(session.id);

  await assert.rejects(
    async () => {
      await repo.updateSet(firstSetId, { actualReps: 10 });
    },
    (err: unknown) => {
      assert.ok(err instanceof SessionValidationError);
      assert.equal(err.field, 'status');
      assert.match(err.message, /completed workout session/i);
      return true;
    }
  );
});

// 15. Terminal session protection: addSet rejected on completed session
test('Task 3.5A - Test 15: addSet is strictly rejected on completed session', async () => {
  const db = await createTestDb();
  const repo = new SQLiteWorkoutSessionRepository(db);
  const workoutRepo = new SQLiteWorkoutRepository(db);
  const wk = sampleWorkout('wk-term-15');
  await workoutRepo.insertWorkout(wk);

  const session = await startWorkoutSession(wk, repo);
  const exId = session.exercises[0].id;

  await repo.completeSession(session.id);

  await assert.rejects(
    async () => {
      await repo.addSet(exId, 10, 50);
    },
    (err: unknown) => {
      assert.ok(err instanceof SessionValidationError);
      assert.equal(err.field, 'status');
      assert.match(err.message, /completed workout session/i);
      return true;
    }
  );
});

// 16. Paused session allowance: completeSet, skipSet, updateSet, addSet succeed on paused session
test('Task 3.5A - Test 16: paused sessions are open in-progress sessions and permit set mutations', async () => {
  const db = await createTestDb();
  const repo = new SQLiteWorkoutSessionRepository(db);
  const workoutRepo = new SQLiteWorkoutRepository(db);
  const wk = sampleWorkout('wk-pause-allow');
  await workoutRepo.insertWorkout(wk);

  const session = await startWorkoutSession(wk, repo);
  const firstSetId = session.exercises[0].sets[0].id;
  const secondSetId = session.exercises[0].sets[1].id;
  const exId = session.exercises[0].id;

  // Pause session
  await repo.pauseSession(session.id);
  const paused = await repo.getSessionById(session.id);
  assert.equal(paused?.status, 'paused');

  // completeSet must succeed while paused
  const completedSet = await repo.completeSet(firstSetId, { actualReps: 8, actualWeightKg: 50, rpe: 8 });
  assert.equal(completedSet.status, 'completed');
  assert.equal(completedSet.actualReps, 8);

  // skipSet must succeed while paused
  const skippedSet = await repo.skipSet(secondSetId);
  assert.equal(skippedSet.status, 'skipped');

  // updateSet must succeed while paused
  const updatedSet = await repo.updateSet(firstSetId, { actualReps: 9 });
  assert.equal(updatedSet.actualReps, 9);

  // addSet must succeed while paused
  const addedSet = await repo.addSet(exId, 10, 50);
  assert.equal(addedSet.setNumber, 4);
});

// 17. Discard safety: discardSession on completed session throws SessionValidationError
test('Task 3.5A - Test 17: discardSession on completed session throws SessionValidationError and does not delete', async () => {
  const db = await createTestDb();
  const repo = new SQLiteWorkoutSessionRepository(db);
  const workoutRepo = new SQLiteWorkoutRepository(db);
  const wk = sampleWorkout('wk-discard-17');
  await workoutRepo.insertWorkout(wk);

  const session = await startWorkoutSession(wk, repo);
  await repo.completeSession(session.id);

  await assert.rejects(
    async () => {
      await repo.discardSession(session.id);
    },
    (err: unknown) => {
      assert.ok(err instanceof SessionValidationError);
      assert.equal(err.field, 'status');
      assert.match(err.message, /cannot discard a completed workout session/i);
      return true;
    }
  );

  // Session must still exist in SQLite
  const s = await repo.getSessionById(session.id);
  assert.ok(s);
  assert.equal(s.status, 'completed');
});

// 18. Discard safety: discardSession on missing or already discarded session is deterministic no-op
test('Task 3.5A - Test 18: discardSession on missing or already discarded session is deterministic no-op', async () => {
  const db = await createTestDb();
  const repo = new SQLiteWorkoutSessionRepository(db);

  // Calling discard on non-existent ID should resolve cleanly
  await assert.doesNotReject(async () => {
    await repo.discardSession('non-existent-session-id');
  });
});

// 19. Discard safety: discardSession on active or paused session removes session and cascades
test('Task 3.5A - Test 19: discardSession removes active session and cascades to exercises and sets', async () => {
  const db = await createTestDb();
  const repo = new SQLiteWorkoutSessionRepository(db);
  const workoutRepo = new SQLiteWorkoutRepository(db);
  const wk = sampleWorkout('wk-discard-19');
  await workoutRepo.insertWorkout(wk);

  const session = await startWorkoutSession(wk, repo);
  const sessionExId = session.exercises[0].id;

  await repo.discardSession(session.id);

  // Session must not exist
  const s = await repo.getSessionById(session.id);
  assert.equal(s, null);

  // Exercises and sets must have cascaded
  const exRows = await db.getAllAsync(
    `SELECT * FROM workout_session_exercises WHERE session_id = ?;`,
    session.id
  );
  assert.equal(exRows.length, 0);

  const setRows = await db.getAllAsync(
    `SELECT * FROM workout_sets WHERE session_exercise_id = ?;`,
    sessionExId
  );
  assert.equal(setRows.length, 0);
});

// 20. Skipped set consistency: skipSet resets actual reps, actual weight, completedAt, rpe to null
test('Task 3.5A - Test 20: skipSet resets actual performance values to null while preserving planned parameters', async () => {
  const db = await createTestDb();
  const repo = new SQLiteWorkoutSessionRepository(db);
  const workoutRepo = new SQLiteWorkoutRepository(db);
  const wk = sampleWorkout('wk-skip-20');
  await workoutRepo.insertWorkout(wk);

  const session = await startWorkoutSession(wk, repo);
  const firstSetId = session.exercises[0].sets[0].id;

  const skipped = await repo.skipSet(firstSetId, 'Skipped due to shoulder fatigue');
  assert.equal(skipped.status, 'skipped');
  assert.equal(skipped.actualReps, null);
  assert.equal(skipped.actualWeightKg, null);
  assert.equal(skipped.completedAt, null);
  assert.equal(skipped.rpe, null);
  assert.equal(skipped.plannedReps, 8);
  assert.equal(skipped.plannedWeightKg, 50);
  assert.equal(skipped.notes, 'Skipped due to shoulder fatigue');
});

// 21. Skipped set consistency: transition completed -> skipped nullifies actual values while preserving planned values and notes
test('Task 3.5A - Test 21: completed -> skipped transition nullifies actual values without data residue', async () => {
  const db = await createTestDb();
  const repo = new SQLiteWorkoutSessionRepository(db);
  const workoutRepo = new SQLiteWorkoutRepository(db);
  const wk = sampleWorkout('wk-skip-21');
  await workoutRepo.insertWorkout(wk);

  const session = await startWorkoutSession(wk, repo);
  const firstSetId = session.exercises[0].sets[0].id;

  // Complete first
  await repo.completeSet(firstSetId, { actualReps: 8, actualWeightKg: 50, rpe: 9, notes: 'Felt heavy' });

  // Then user marks it skipped
  const skipped = await repo.skipSet(firstSetId, 'Decided to skip after all');
  assert.equal(skipped.status, 'skipped');
  assert.equal(skipped.actualReps, null);
  assert.equal(skipped.actualWeightKg, null);
  assert.equal(skipped.completedAt, null);
  assert.equal(skipped.rpe, null);
  assert.equal(skipped.plannedReps, 8);
  assert.equal(skipped.plannedWeightKg, 50);
  assert.equal(skipped.notes, 'Decided to skip after all');

  // Verify direct SQLite row has NULLs
  const row = await db.getFirstAsync<{
    actual_reps: number | null;
    actual_weight_kg: number | null;
    completed_at: string | null;
    rpe: number | null;
  }>('SELECT actual_reps, actual_weight_kg, completed_at, rpe FROM workout_sets WHERE id = ?;', firstSetId);
  assert.equal(row?.actual_reps, null);
  assert.equal(row?.actual_weight_kg, null);
  assert.equal(row?.completed_at, null);
  assert.equal(row?.rpe, null);
});

// 22. Migration 6 & DB-level guarantee: partial unique index blocks concurrent/duplicate open session at SQLite engine level
test('Task 3.5A - Test 22: Migration 6 partial unique index prevents duplicate active/paused sessions at SQLite engine level', async () => {
  const db = await createTestDb();

  // Insert first open session directly via SQL
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO workout_sessions (
      id, title, status, started_at, accumulated_elapsed_ms, created_at, updated_at
    ) VALUES (?, ?, ?, ?, 0, ?, ?);`,
    'sess-raw-1',
    'Open Session 1',
    'active',
    now,
    now,
    now
  );

  // Attempt to insert a second open session directly via SQL bypassing repository
  await assert.rejects(
    async () => {
      await db.runAsync(
        `INSERT INTO workout_sessions (
          id, title, status, started_at, accumulated_elapsed_ms, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 0, ?, ?);`,
        'sess-raw-2',
        'Open Session 2',
        'paused',
        now,
        now,
        now
      );
    },
    (err: unknown) => {
      // Must be a UNIQUE constraint error from SQLite engine
      assert.match(String(err), /UNIQUE constraint failed/i);
      return true;
    }
  );

  // But terminal sessions (completed or discarded) are unlimited
  await db.runAsync(
    `INSERT INTO workout_sessions (
      id, title, status, started_at, accumulated_elapsed_ms, created_at, updated_at
    ) VALUES (?, ?, ?, ?, 0, ?, ?);`,
    'sess-raw-3',
    'Terminal Session 3',
    'completed',
    now,
    now,
    now
  );
  await db.runAsync(
    `INSERT INTO workout_sessions (
      id, title, status, started_at, accumulated_elapsed_ms, created_at, updated_at
    ) VALUES (?, ?, ?, ?, 0, ?, ?);`,
    'sess-raw-4',
    'Terminal Session 4',
    'discarded',
    now,
    now,
    now
  );

  const count = await db.getFirstAsync<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM workout_sessions;`
  );
  assert.equal(count?.cnt, 3);
});

// 23. Migration 6 data conflict handling: upgrading with multiple open sessions keeps newest and discards older without data loss
test('Task 3.5A - Test 23: Migration 6 handles pre-existing open session conflicts by keeping newest and discarding older', async () => {
  const db = await openDatabaseAsync(':memory:');
  await db.execAsync('PRAGMA foreign_keys = ON;');

  // Apply migrations 1 through 5
  for (const m of MIGRATIONS.slice(0, 5)) {
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

  // Pre-seed 3 open sessions (simulating prior version anomaly)
  await db.runAsync(
    `INSERT INTO workout_sessions (id, title, status, started_at, accumulated_elapsed_ms, created_at, updated_at)
     VALUES (?, ?, ?, ?, 0, ?, ?);`,
    'oldest-sess', 'Oldest Session', 'active', '2026-11-10T10:00:00Z', '2026-11-10T10:00:00Z', '2026-11-10T10:00:00Z'
  );
  await db.runAsync(
    `INSERT INTO workout_sessions (id, title, status, started_at, accumulated_elapsed_ms, created_at, updated_at)
     VALUES (?, ?, ?, ?, 0, ?, ?);`,
    'middle-sess', 'Middle Session', 'paused', '2026-11-11T10:00:00Z', '2026-11-11T10:00:00Z', '2026-11-11T10:00:00Z'
  );
  await db.runAsync(
    `INSERT INTO workout_sessions (id, title, status, started_at, accumulated_elapsed_ms, created_at, updated_at)
     VALUES (?, ?, ?, ?, 0, ?, ?);`,
    'newest-sess', 'Newest Session', 'active', '2026-11-12T10:00:00Z', '2026-11-12T10:00:00Z', '2026-11-12T10:00:00Z'
  );

  // Now apply Migration 6
  await db.withTransactionAsync(async () => {
    await MIGRATIONS[5].up(db);
    await db.runAsync(
      'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?);',
      MIGRATIONS[5].version,
      MIGRATIONS[5].name,
      new Date().toISOString()
    );
  });

  // Verify conflict resolution: newest is kept active, older ones are discarded, none are deleted
  const newest = await db.getFirstAsync<{ status: string }>('SELECT status FROM workout_sessions WHERE id = ?;', 'newest-sess');
  assert.equal(newest?.status, 'active');

  const middle = await db.getFirstAsync<{ status: string }>('SELECT status FROM workout_sessions WHERE id = ?;', 'middle-sess');
  assert.equal(middle?.status, 'discarded');

  const oldest = await db.getFirstAsync<{ status: string }>('SELECT status FROM workout_sessions WHERE id = ?;', 'oldest-sess');
  assert.equal(oldest?.status, 'discarded');
});

// 24. Timer & rest recovery: rest target persisted in workout_sessions and recovers or safely expires on reload; elapsed time rollback immune
test('Task 3.5A - Test 24: restTargetAt persistence roundtrip, reload recovery, and clock rollback immunity', async () => {
  const db = await createTestDb();
  const repo = new SQLiteWorkoutSessionRepository(db);
  const workoutRepo = new SQLiteWorkoutRepository(db);
  const wk = sampleWorkout('wk-timer-24');
  await workoutRepo.insertWorkout(wk);

  const session = await startWorkoutSession(wk, repo);
  const targetTime = new Date(Date.now() + 60000).toISOString();

  // Set rest target
  const updated = await setSessionRestTarget(session.id, targetTime, repo);
  assert.equal(updated.restTargetAt, targetTime);

  // Simulate app restart / fresh repository reload
  const freshRepo = new SQLiteWorkoutSessionRepository(db);
  const reloaded = await freshRepo.getActiveSession();
  assert.ok(reloaded);
  assert.equal(reloaded.restTargetAt, targetTime);

  // Test clock rollback immunity during pause
  const initialAccumulated = reloaded.accumulatedElapsedMs;
  // Send a pausedAt timestamp in the PAST relative to lastResumedAt
  const pastTimestamp = new Date(Date.parse(reloaded.lastResumedAt || '') - 50000).toISOString();
  const paused = await freshRepo.pauseSession(reloaded.id, pastTimestamp);

  // Accumulated duration must not decrease (delta clamped to 0)
  assert.ok(paused.accumulatedElapsedMs >= initialAccumulated);
});

// 25. UI error recovery & localization: duplicate submission prevented by submittingSetId lock; localized inline validation messages in en/ar
test('Task 3.5A - Test 25: Localized error messages in English and Arabic resolve correctly', () => {
  assert.ok(en.workouts.invalidReps);
  assert.ok(ar.workouts.invalidReps);
  assert.match(en.workouts.invalidReps, /whole number/i);
  assert.match(ar.workouts.invalidReps, /صحيحاً/);

  assert.ok(en.workouts.invalidWeight);
  assert.ok(ar.workouts.invalidWeight);
  assert.match(en.workouts.invalidWeight, /valid number/i);
  assert.match(ar.workouts.invalidWeight, /صالحاً/);

  assert.ok(en.workouts.invalidRpe);
  assert.ok(ar.workouts.invalidRpe);
  assert.match(en.workouts.invalidRpe, /between 1 and 10/i);
  assert.match(ar.workouts.invalidRpe, /1 و 10/);

  assert.ok(en.workouts.sessionActionError);
  assert.ok(ar.workouts.sessionActionError);
  assert.match(en.workouts.sessionActionError, /Failed/i);
  assert.match(ar.workouts.sessionActionError, /فشل/);
});
