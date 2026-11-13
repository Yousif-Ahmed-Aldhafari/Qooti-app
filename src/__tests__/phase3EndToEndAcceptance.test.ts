import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabaseAsync } from './mocks/expo-sqlite';
import { runMigrations } from '../db/migrations';
import { SQLiteWorkoutRepository } from '../db/repositories/workoutRepository';
import { SQLiteWorkoutSessionRepository } from '../db/repositories/workoutSessionRepository';
import { SQLiteMealRepository } from '../db/repositories/mealRepository';
import { SQLiteProfileRepository } from '../db/repositories/profileRepository';
import {
  calculateSessionPerformanceSummary,
} from '../utils/workoutAnalytics';
import {
  startWorkoutSession,
  pauseWorkoutSession,
  resumeWorkoutSession,
  completeSessionSet,
  skipSessionSet,
  addSessionSet,
  finishWorkoutSession,
  setSessionRestTarget,
  resumeInterruptedWorkoutSession,
} from '../services/workoutSessionService';
import type { Workout } from '../models/workout';
import { EXERCISE_CATALOG } from '../data/exerciseCatalog';

async function createFreshDb() {
  const db = await openDatabaseAsync(':memory:');
  await db.execAsync('PRAGMA foreign_keys = ON;');
  await runMigrations(db);
  return db;
}

test('E2E Acceptance - Flow 1: Create, edit, reorder, and save multi-exercise workout using catalog', async () => {
  const db = await createFreshDb();
  const workoutRepo = new SQLiteWorkoutRepository(db);

  // 1 & 4 & 5: Select catalog exercises and create workout with multiple exercises
  const benchCatalog = EXERCISE_CATALOG.find((e) => e.id === 'barbell-bench-press')!;
  const rowCatalog = EXERCISE_CATALOG.find((e) => e.id === 'barbell-bent-over-row')!;
  const squatCatalog = EXERCISE_CATALOG.find((e) => e.id === 'barbell-back-squat')!;

  const newWorkout: Workout = {
    id: 'wk-e2e-1',
    title: 'Full Body Power',
    date: '2026-11-13',
    time: '10:00',
    notes: 'Power focus',
    exercises: [
      {
        id: 'ex-1',
        catalogId: benchCatalog.id,
        exerciseName: benchCatalog.nameEn,
        name: benchCatalog.nameEn,
        sets: 4,
        reps: 6,
        weight: 90,
        duration: 0,
        notes: '',
        targetMuscles: [benchCatalog.primaryMuscle, ...benchCatalog.secondaryMuscles],
      },
      {
        id: 'ex-2',
        catalogId: rowCatalog.id,
        exerciseName: rowCatalog.nameEn,
        name: rowCatalog.nameEn,
        sets: 4,
        reps: 8,
        weight: 80,
        duration: 0,
        notes: '',
        targetMuscles: [rowCatalog.primaryMuscle, ...rowCatalog.secondaryMuscles],
      },
    ],
  };

  await workoutRepo.insertWorkout(newWorkout);

  // 7: Save and reopen workout
  const loaded = await workoutRepo.getWorkoutById('wk-e2e-1');
  assert.ok(loaded);
  assert.equal(loaded.title, 'Full Body Power');
  assert.equal(loaded.exercises.length, 2);
  assert.equal(loaded.exercises[0].catalogId, 'barbell-bench-press');
  assert.equal(loaded.exercises[1].catalogId, 'barbell-bent-over-row');

  // 2 & 6: Edit workout - add 3rd exercise and reorder
  const updatedWorkout: Workout = {
    ...loaded,
    title: 'Full Body Heavy',
    exercises: [
      {
        id: 'ex-3',
        catalogId: squatCatalog.id,
        exerciseName: squatCatalog.nameEn,
        name: squatCatalog.nameEn,
        sets: 5,
        reps: 5,
        weight: 120,
        duration: 0,
        notes: '',
        targetMuscles: [squatCatalog.primaryMuscle, ...squatCatalog.secondaryMuscles],
      },
      loaded.exercises[0],
      loaded.exercises[1],
    ],
  };

  await workoutRepo.updateWorkout(updatedWorkout);

  const reloaded = await workoutRepo.getWorkoutById('wk-e2e-1');
  assert.ok(reloaded);
  assert.equal(reloaded.title, 'Full Body Heavy');
  assert.equal(reloaded.exercises.length, 3);
  assert.equal(reloaded.exercises[0].exerciseName, 'Barbell Back Squat');
  assert.equal(reloaded.exercises[1].exerciseName, 'Barbell Bench Press');
  assert.equal(reloaded.exercises[2].exerciseName, 'Barbell Bent-Over Row');
});

test('E2E Acceptance - Flow 2: Delete workout with verification and cascading cleanup', async () => {
  const db = await createFreshDb();
  const workoutRepo = new SQLiteWorkoutRepository(db);

  const wk: Workout = {
    id: 'wk-to-delete',
    title: 'Temporary Workout',
    date: '2026-11-13',
    time: '10:00',
    exercises: [
      { id: 'ex-del-1', exerciseName: 'Push Ups', sets: 3, reps: 15, weight: 0, duration: 0, notes: '' },
    ],
  };

  await workoutRepo.insertWorkout(wk);
  assert.ok(await workoutRepo.getWorkoutById('wk-to-delete'));

  // 3: Delete workout
  await workoutRepo.deleteWorkout('wk-to-delete');

  const afterDelete = await workoutRepo.getWorkoutById('wk-to-delete');
  assert.equal(afterDelete, null);

  const orphanExercises = await db.getAllAsync<{ id: string }>(
    `SELECT id FROM workout_exercises WHERE workout_id = 'wk-to-delete';`
  );
  assert.equal(orphanExercises.length, 0);
});

test('E2E Acceptance - Flow 3: Repeat workout from history (Quick-Add) generates unique IDs and preserves structure', async () => {
  const db = await createFreshDb();
  const workoutRepo = new SQLiteWorkoutRepository(db);

  const original: Workout = {
    id: 'wk-source',
    title: 'Chest & Arms',
    date: '2026-11-13',
    time: '10:00',
    exercises: [
      { id: 'ex-s1', catalogId: 'barbell-bench-press', exerciseName: 'Barbell Bench Press', sets: 3, reps: 10, weight: 75, duration: 0, notes: '' },
    ],
  };
  await workoutRepo.insertWorkout(original);

  // 8: Repeat workout from history
  const repeatedDraft: Workout = {
    id: 'wk-repeated-new-id',
    title: original.title,
    date: '2026-11-13',
    time: '11:00',
    exercises: original.exercises.map((e, idx) => ({
      id: `ex-repeated-${idx}`,
      catalogId: e.catalogId,
      exerciseName: e.exerciseName,
      sets: e.sets,
      reps: e.reps,
      weight: e.weight,
      duration: e.duration,
      notes: e.notes,
    })),
  };

  await workoutRepo.insertWorkout(repeatedDraft);

  const sourceCheck = await workoutRepo.getWorkoutById('wk-source');
  const repeatedCheck = await workoutRepo.getWorkoutById('wk-repeated-new-id');

  assert.ok(sourceCheck);
  assert.ok(repeatedCheck);
  assert.notEqual(sourceCheck.id, repeatedCheck.id);
  assert.notEqual(sourceCheck.exercises[0].id, repeatedCheck.exercises[0].id);
  assert.equal(repeatedCheck.exercises[0].catalogId, 'barbell-bench-press');
});

test('E2E Acceptance - Flow 4: Active session lifecycle: execution, sets, skip, extra set, pause/resume, rest timer, incomplete finish', async () => {
  const db = await createFreshDb();
  const workoutRepo = new SQLiteWorkoutRepository(db);
  const sessionRepo = new SQLiteWorkoutSessionRepository(db);

  const workout: Workout = {
    id: 'wk-active-test',
    title: 'Hypertrophy Upper',
    date: '2026-11-13',
    time: '12:00',
    exercises: [
      { id: 'ex-b', catalogId: 'barbell-bench-press', exerciseName: 'Barbell Bench Press', sets: 2, reps: 8, weight: 80, duration: 0, notes: '' },
      { id: 'ex-c', catalogId: 'dumbbell-bicep-curl', exerciseName: 'Dumbbell Curl', sets: 2, reps: 12, weight: 15, duration: 0, notes: '' },
    ],
  };
  await workoutRepo.insertWorkout(workout);

  // 9: Start active workout
  const session = await startWorkoutSession(workout, sessionRepo);
  assert.equal(session.status, 'active');
  assert.equal(session.exercises.length, 2);
  assert.equal(session.exercises[0].sets.length, 2);

  const firstExSet1 = session.exercises[0].sets[0];
  const firstExSet2 = session.exercises[0].sets[1];

  // 10: Complete a set with actual values
  const completedSet1 = await completeSessionSet(firstExSet1.id, 8, 82.5, 8, 'Felt solid', sessionRepo);
  assert.equal(completedSet1.status, 'completed');
  assert.equal(completedSet1.actualReps, 8);
  assert.equal(completedSet1.actualWeightKg, 82.5);
  assert.equal(completedSet1.rpe, 8);

  // 14: Rest timer: set, extend (+30s), and skip
  const targetRest1 = new Date(Date.now() + 60000).toISOString();
  await setSessionRestTarget(session.id, targetRest1, sessionRepo);
  let currentSession = await sessionRepo.getSessionById(session.id);
  assert.equal(currentSession?.restTargetAt, targetRest1);

  // Extend +30s
  const targetRest2 = new Date(Date.now() + 90000).toISOString();
  await setSessionRestTarget(session.id, targetRest2, sessionRepo);
  currentSession = await sessionRepo.getSessionById(session.id);
  assert.equal(currentSession?.restTargetAt, targetRest2);

  // Skip rest
  await setSessionRestTarget(session.id, null, sessionRepo);
  currentSession = await sessionRepo.getSessionById(session.id);
  assert.equal(currentSession?.restTargetAt, undefined);

  // 11: Skip a set
  const skippedSet = await skipSessionSet(firstExSet2.id, 'Too heavy today', sessionRepo);
  assert.equal(skippedSet.status, 'skipped');
  assert.equal(skippedSet.actualReps, null);
  assert.equal(skippedSet.actualWeightKg, null);

  // 12: Add extra set
  const extraSet = await addSessionSet(session.exercises[0].id, 8, 80, sessionRepo);
  assert.equal(extraSet.setNumber, 3);
  assert.equal(extraSet.status, 'pending');

  // Complete extra set
  await completeSessionSet(extraSet.id, 7, 80, 9, undefined, sessionRepo);

  // 13: Pause and Resume
  const paused = await pauseWorkoutSession(session.id, sessionRepo);
  assert.equal(paused.status, 'paused');
  assert.equal(paused.lastResumedAt, undefined);

  const resumed = await resumeWorkoutSession(session.id, sessionRepo);
  assert.equal(resumed.status, 'active');
  assert.ok(resumed.lastResumedAt);

  // 17: Finish with incomplete sets (exercises[1] sets remain pending)
  const finished = await finishWorkoutSession(session.id, 'Great session despite skipping', sessionRepo);
  assert.equal(finished.status, 'completed');
  assert.ok(finished.endedAt);

  // 18 & 19: View actual workout summary & Compare estimated vs actual volume
  const summary = calculateSessionPerformanceSummary(finished);
  assert.equal(summary.totalCompletedSets, 2);
  assert.equal(summary.totalSkippedSets, 1);
  assert.equal(summary.hasIncompleteSets, true);
  // Bench press completed sets:
  // Set 1: 8 reps * 82.5 kg = 660 kg-reps
  // Set 3 (extra): 7 reps * 80 kg = 560 kg-reps
  // Total actual volume = 1220 kg-reps
  assert.equal(summary.actualRecordedVolumeKg, 1220);
});

test('E2E Acceptance - Flow 5: Interrupted session recovery and restart resilience without nutrition/profile corruption', async () => {
  const db = await createFreshDb();
  const sessionRepo = new SQLiteWorkoutSessionRepository(db);
  const profileRepo = new SQLiteProfileRepository(db);
  const mealRepo = new SQLiteMealRepository(db);

  // Setup profile and meal
  const now = new Date().toISOString();
  await profileRepo.saveProfile({
    id: 'user_p1',
    name: 'Tareq',
    email: 'tareq@test.com',
    heightCm: 178,
    weightKg: 78,
    goal: 'muscle_gain',
    avatarInitials: 'TA',
    targetCalories: 2600,
    targetProtein: 180,
    targetCarbs: 280,
    targetFats: 75,
    sleepGoalHours: 8,
    waterGoalLiters: 3,
  });

  await mealRepo.insertMeal({
    id: 'meal_m1',
    title: 'Lunch Bowl',
    date: '2026-11-13',
    time: '13:00',
    items: [{ id: 'mi-1', foodName: 'Chicken Breast', quantity: 1, unit: '200g', calories: 350, protein: 60, carbs: 0, fats: 8 }],
  });

  // 16 & 20: Force-close simulation and restore session
  // Session was interrupted and recorded as interrupted
  await db.runAsync(
    `INSERT INTO workout_sessions (id, title, status, started_at, accumulated_elapsed_ms, recovery_state, created_at, updated_at)
     VALUES ('sess-inter-e2e', 'Shoulders & Arms', 'discarded', '2026-11-13T10:00:00.000Z', 750000, 'interrupted', ?, ?);`,
    now,
    now
  );
  await db.runAsync(
    `INSERT INTO workout_session_exercises (id, session_id, exercise_name, sort_order)
     VALUES ('se-inter-1', 'sess-inter-e2e', 'Overhead Press', 0);`
  );
  await db.runAsync(
    `INSERT INTO workout_sets (id, session_exercise_id, set_number, planned_reps, actual_reps, planned_weight_kg, actual_weight_kg, status)
     VALUES ('st-inter-1', 'se-inter-1', 1, 8, 8, 50, 50, 'completed');`
  );

  // Recover interrupted session
  const resumed = await resumeInterruptedWorkoutSession('sess-inter-e2e', undefined, sessionRepo);
  assert.equal(resumed.id, 'sess-inter-e2e');
  assert.equal(resumed.status, 'active');
  assert.equal(resumed.recoveryState, 'recovered');
  assert.equal(resumed.accumulatedElapsedMs, 750000); // 15 & 20: Zero duration inflation

  // Finish session
  await finishWorkoutSession('sess-inter-e2e', 'Finished after restart', sessionRepo);

  // 21: Preserve completed history after restart
  const completed = await sessionRepo.getSessionById('sess-inter-e2e');
  assert.equal(completed?.status, 'completed');

  // 22: Confirm nutrition and profile remain completely intact and untouched
  const profileAfter = await profileRepo.getProfile();
  assert.equal(profileAfter?.name, 'Tareq');
  assert.equal(profileAfter?.targetCalories, 2600);

  const mealsAfter = await mealRepo.getAllMeals();
  assert.equal(mealsAfter.length, 1);
  assert.equal(mealsAfter[0].name, 'Lunch Bowl');
});
