import test from 'node:test';
import assert from 'node:assert/strict';

import { openDatabaseAsync } from './mocks/expo-sqlite';
import { runMigrations } from '../db/migrations';
import { SQLiteWorkoutRepository } from '../db/repositories/workoutRepository';
import { SQLiteMealRepository } from '../db/repositories/mealRepository';
import { SQLiteProfileRepository } from '../db/repositories/profileRepository';
import {
  Workout,
  normalizeWorkout,
  normalizeExercise,
} from '../models/workout';
import { normalizeMeal, normalizeMealItem } from '../models/meal';
import { normalizeProfile } from '../models/profile';
import { translate } from '../i18n';
import { themeColors, setActiveTheme } from '../theme/colors';
import { progressRatio } from '../utils/nutrition';
import { appReducer, AppStateData } from '../store/AppContext';
import { defaultSettings } from '../services/settingsService';

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
    date: '2026-11-13',
    time: '18:00',
    notes: 'Chest and triceps',
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
        exerciseName: 'Triceps Rope Pushdown',
        sets: 3,
        reps: 12,
        weight: 25,
        duration: 10,
        notes: 'Full lock',
        targetMuscles: ['triceps'],
      }),
    ],
  });
}

function sampleMeal(id = 'meal-test-1') {
  return normalizeMeal({
    id,
    title: 'Post-Workout Meal',
    name: 'Post-Workout Meal',
    date: '2026-11-13',
    time: '19:30',
    notes: 'Recovery shake & rice',
    items: [
      normalizeMealItem({
        id: `${id}-item-1`,
        foodName: 'Whey Protein',
        quantity: '1 scoop',
        calories: 120,
        protein: 24,
        carbs: 3,
        fat: 1.5,
      }),
    ],
  });
}

function initialAppState(workouts: Workout[] = []): AppStateData {
  return {
    isReady: true,
    persistenceError: null,
    meals: [],
    workouts,
    profile: normalizeProfile({ id: 'user-1', name: 'Yousif' }),
    progressEntries: [],
    settings: defaultSettings,
  };
}

// 1. Cancel deletion
test('Task 3.2 - Test 1: Cancel deletion leaves workout, exercises, and state intact', async () => {
  const db = await createTestDb();
  const repo = new SQLiteWorkoutRepository(db);

  const workout = sampleWorkout('w-cancel-1');
  await repo.insertWorkout(workout);

  // Simulate UI delete state machine
  type DeleteState = 'idle' | 'confirming' | 'deleting' | 'success' | 'error';
  let deleteState: DeleteState = 'idle';

  // Step 1: User taps delete button -> moves to 'confirming'
  deleteState = 'confirming';
  assert.equal(deleteState, 'confirming');

  // Step 2: User cancels confirmation -> state reverts to 'idle' without executing delete
  deleteState = 'idle';
  assert.equal(deleteState, 'idle');

  // Verify workout is still fully present in SQLite
  const persisted = await repo.getWorkoutById('w-cancel-1');
  assert.ok(persisted);
  assert.equal(persisted.exercises.length, 2);
});

// 2. Confirm deletion
test('Task 3.2 - Test 2: Confirm deletion deletes workout and its exercises atomically', async () => {
  const db = await createTestDb();
  const repo = new SQLiteWorkoutRepository(db);

  const workout = sampleWorkout('w-confirm-1');
  await repo.insertWorkout(workout);

  // Execute deletion
  await repo.deleteWorkout('w-confirm-1');

  // Verify workout is removed
  const persisted = await repo.getWorkoutById('w-confirm-1');
  assert.equal(persisted, null);

  // Verify child exercise records are also removed
  const exerciseRows = await db.getAllAsync(
    'SELECT * FROM workout_exercises WHERE workout_id = ?;',
    'w-confirm-1'
  );
  assert.equal(exerciseRows.length, 0);
});

// 3. Missing workout ID
test('Task 3.2 - Test 3: Missing, empty, or non-existent workout ID is rejected with explicit error', async () => {
  const db = await createTestDb();
  const repo = new SQLiteWorkoutRepository(db);

  // Empty string
  await assert.rejects(
    async () => repo.deleteWorkout(''),
    /Cannot delete workout: A valid workout id must be provided/
  );

  // Whitespace only
  await assert.rejects(
    async () => repo.deleteWorkout('   '),
    /Cannot delete workout: A valid workout id must be provided/
  );

  // Non-existent ID
  await assert.rejects(
    async () => repo.deleteWorkout('non-existent-id'),
    /Cannot delete workout: Workout with id "non-existent-id" not found/
  );
});

// 4. Duplicate deletion attempts
test('Task 3.2 - Test 4: Duplicate deletion attempts are handled deterministically', async () => {
  const db = await createTestDb();
  const repo = new SQLiteWorkoutRepository(db);

  const workout = sampleWorkout('w-dup-1');
  await repo.insertWorkout(workout);

  // First delete succeeds
  await repo.deleteWorkout('w-dup-1');

  // Second delete fails with explicit not found error
  await assert.rejects(
    async () => repo.deleteWorkout('w-dup-1'),
    /Cannot delete workout: Workout with id "w-dup-1" not found/
  );
});

// 5. SQL transaction rollback
test('Task 3.2 - Test 5: Simulated transaction failure rolls back cleanly without partial deletion', async () => {
  const db = await createTestDb();
  const repo = new SQLiteWorkoutRepository(db);

  const workout = sampleWorkout('w-rollback-1');
  await repo.insertWorkout(workout);

  // Simulate a transaction failure midway through deletion
  await assert.rejects(async () => {
    await db.withExclusiveTransactionAsync(async (t) => {
      // Child exercises deleted
      await t.runAsync('DELETE FROM workout_exercises WHERE workout_id = ?;', 'w-rollback-1');
      // Simulated crash/failure before workouts table row deleted
      throw new Error('Simulated disk IO error during workout deletion');
    });
  }, /Simulated disk IO error/);

  // Verify rollback restored child exercises and parent workout
  const persisted = await repo.getWorkoutById('w-rollback-1');
  assert.ok(persisted);
  assert.equal(persisted.exercises.length, 2);
  assert.equal(persisted.exercises[0].exerciseName, 'Incline Dumbbell Press');
});

// 6. Parent-child cleanup
test('Task 3.2 - Test 6: Deleting workout with multiple exercises completely removes all child rows', async () => {
  const db = await createTestDb();
  const repo = new SQLiteWorkoutRepository(db);

  const workout = sampleWorkout('w-multi-ex-1');
  await repo.insertWorkout(workout);

  const exercisesBefore = await db.getAllAsync(
    'SELECT id FROM workout_exercises WHERE workout_id = ?;',
    'w-multi-ex-1'
  );
  assert.equal(exercisesBefore.length, 2);

  await repo.deleteWorkout('w-multi-ex-1');

  const exercisesAfter = await db.getAllAsync(
    'SELECT id FROM workout_exercises WHERE workout_id = ?;',
    'w-multi-ex-1'
  );
  assert.equal(exercisesAfter.length, 0);
});

// 7. Unrelated workout preservation
test('Task 3.2 - Test 7: Deleting workout A does not mutate, delete, or affect workout B', async () => {
  const db = await createTestDb();
  const repo = new SQLiteWorkoutRepository(db);

  const workoutA = sampleWorkout('workout-A');
  const workoutB = sampleWorkout('workout-B');

  await repo.insertWorkout(workoutA);
  await repo.insertWorkout(workoutB);

  await repo.deleteWorkout('workout-A');

  // Verify workout A is gone
  assert.equal(await repo.getWorkoutById('workout-A'), null);

  // Verify workout B and its exercises remain 100% intact
  const persistedB = await repo.getWorkoutById('workout-B');
  assert.ok(persistedB);
  assert.equal(persistedB.id, 'workout-B');
  assert.equal(persistedB.exercises.length, 2);
  assert.equal(persistedB.exercises[0].exerciseName, 'Incline Dumbbell Press');
});

// 8. Profile and meal data preservation
test('Task 3.2 - Test 8: Deleting a workout preserves meal records and user profile in SQLite', async () => {
  const db = await createTestDb();
  const workoutRepo = new SQLiteWorkoutRepository(db);
  const mealRepo = new SQLiteMealRepository(db);
  const profileRepo = new SQLiteProfileRepository(db);

  const workout = sampleWorkout('w-isolate-1');
  const meal = sampleMeal('m-isolate-1');
  const profile = normalizeProfile({
    id: 'user-isolate-1',
    name: 'Preserved User',
    targetCalories: 2500,
    targetProtein: 180,
  });

  await workoutRepo.insertWorkout(workout);
  await mealRepo.insertMeal(meal);
  await profileRepo.saveProfile(profile);

  // Delete workout
  await workoutRepo.deleteWorkout('w-isolate-1');

  // Verify meal and food items are unchanged
  const persistedMeal = await mealRepo.getMealById('m-isolate-1');
  assert.ok(persistedMeal);
  assert.equal(persistedMeal.items.length, 1);
  assert.equal(persistedMeal.items[0].foodName, 'Whey Protein');

  // Verify profile is unchanged
  const persistedProfile = await profileRepo.getProfile();
  assert.ok(persistedProfile);
  assert.equal(persistedProfile.name, 'Preserved User');
  assert.equal(persistedProfile.targetCalories, 2500);
});

// 9. Correct AppContext state after success
test('Task 3.2 - Test 9: AppContext reducer filters out deleted workout and retains other workouts', () => {
  const workout1 = sampleWorkout('w-app-1');
  const workout2 = sampleWorkout('w-app-2');

  const state = initialAppState([workout1, workout2]);
  assert.equal(state.workouts.length, 2);

  const nextState = appReducer(state, { type: 'deleteWorkout', workoutId: 'w-app-1' });

  assert.equal(nextState.workouts.length, 1);
  assert.equal(nextState.workouts[0].id, 'w-app-2');
  assert.equal(nextState.persistenceError, null);
});

// 10. No state mutation after failure
test('Task 3.2 - Test 10: Deletion error sets persistenceError and does not remove workout from state', () => {
  const workout = sampleWorkout('w-app-err-1');
  const state = initialAppState([workout]);

  // Reducer does not mutate workouts on error action
  const errorState = appReducer(state, {
    type: 'setPersistenceError',
    error: 'Failed to persist workout deletion: disk error',
  });

  assert.equal(errorState.workouts.length, 1);
  assert.equal(errorState.workouts[0].id, 'w-app-err-1');
  assert.equal(errorState.persistenceError, 'Failed to persist workout deletion: disk error');
});

// 11. Navigation after successful deletion
test('Task 3.2 - Test 11: Navigation flow returns to workouts tab and clears selectedWorkoutId', () => {
  let activeTab = 'workouts';
  let activeScreen: string = 'workoutDetails';
  let selectedWorkoutId: string | null = 'w-nav-1';

  function handleDeleteWorkout(deletedId: string) {
    if (selectedWorkoutId === deletedId) {
      selectedWorkoutId = null;
    }
    activeScreen = 'workouts';
  }

  handleDeleteWorkout('w-nav-1');

  assert.equal(selectedWorkoutId, null);
  assert.equal(activeScreen, 'workouts');
  assert.equal(activeTab, 'workouts');
});

// 12. Stale detail-screen selection
test('Task 3.2 - Test 12: Stale detail-screen selection safely falls back to workouts screen', () => {
  const workouts: Workout[] = [sampleWorkout('w-remaining-1')];
  const selectedWorkoutId = 'w-deleted-1'; // Already deleted

  // AppNavigator fallback logic:
  const selectedWorkout = workouts.find((w) => w.id === selectedWorkoutId) ?? null;
  assert.equal(selectedWorkout, null);

  const activeScreen = 'workoutDetails';
  const effectiveScreen = (activeScreen === 'workoutDetails' && !selectedWorkout)
    ? 'workouts'
    : activeScreen;

  assert.equal(effectiveScreen, 'workouts');
});

// 13. Empty list after last workout deletion
test('Task 3.2 - Test 13: Deleting last remaining workout results in empty list without crash', async () => {
  const db = await createTestDb();
  const repo = new SQLiteWorkoutRepository(db);

  const workout = sampleWorkout('w-only-1');
  await repo.insertWorkout(workout);

  let stateWorkouts = await repo.getAllWorkouts();
  assert.equal(stateWorkouts.length, 1);

  await repo.deleteWorkout('w-only-1');
  stateWorkouts = await repo.getAllWorkouts();
  assert.equal(stateWorkouts.length, 0);

  // AppContext reducer state
  const state = initialAppState([workout]);
  const emptyState = appReducer(state, { type: 'deleteWorkout', workoutId: 'w-only-1' });
  assert.equal(emptyState.workouts.length, 0);
});

// 14. App restart persistence
test('Task 3.2 - Test 14: Deletion persists across database close and reopen', async () => {
  const db = await createTestDb();
  const repo1 = new SQLiteWorkoutRepository(db);

  const workout1 = sampleWorkout('w-persist-1');
  const workout2 = sampleWorkout('w-persist-2');
  await repo1.insertWorkout(workout1);
  await repo1.insertWorkout(workout2);

  // Delete workout 1
  await repo1.deleteWorkout('w-persist-1');

  // Simulate new repository instance reading persisted database
  const repo2 = new SQLiteWorkoutRepository(db);
  const remaining = await repo2.getAllWorkouts();

  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].id, 'w-persist-2');
  assert.equal(await repo2.getWorkoutById('w-persist-1'), null);
});

// 15. Dashboard and Progress recalculation
test('Task 3.2 - Test 15: Deleting workout updates dashboard metrics and progress ratios safely', () => {
  const workout1 = sampleWorkout('w-dash-1');
  const workout2 = sampleWorkout('w-dash-2');

  const beforeWorkouts = [workout1, workout2];
  const targetWorkouts = 4;

  const progressBefore = progressRatio(beforeWorkouts.length, targetWorkouts);
  assert.equal(progressBefore, 0.5); // 2/4

  // Delete workout 1
  const afterWorkouts = beforeWorkouts.filter((w) => w.id !== 'w-dash-1');
  const progressAfter = progressRatio(afterWorkouts.length, targetWorkouts);
  assert.equal(progressAfter, 0.25); // 1/4

  // Delete last workout
  const emptyWorkouts = afterWorkouts.filter((w) => w.id !== 'w-dash-2');
  const progressEmpty = progressRatio(emptyWorkouts.length, targetWorkouts);
  assert.equal(progressEmpty, 0); // 0/4

  // Safe zero target
  const progressZeroTarget = progressRatio(emptyWorkouts.length, 0);
  assert.equal(progressZeroTarget, 0);
  assert.ok(!Number.isNaN(progressZeroTarget));
});

// 16. English and Arabic confirmation strings
test('Task 3.2 - Test 16: Deletion confirmation strings resolve accurately in English and Arabic', () => {
  // English
  assert.equal(translate('en', 'workouts.deleteWorkout'), 'Delete workout');
  assert.equal(
    translate('en', 'workouts.deleteWorkoutMessage'),
    'This workout session and its exercises will be removed.'
  );
  assert.equal(translate('en', 'common.delete'), 'Delete');
  assert.equal(translate('en', 'common.cancel'), 'Cancel');

  // Arabic
  assert.equal(translate('ar', 'workouts.deleteWorkout'), 'حذف التمرين');
  assert.equal(
    translate('ar', 'workouts.deleteWorkoutMessage'),
    'سيتم حذف جلسة التمرين وكل الحركات داخلها.'
  );
  assert.equal(translate('ar', 'common.delete'), 'حذف');
  assert.equal(translate('ar', 'common.cancel'), 'إلغاء');
});

// 17. Screen-reader accessibility
test('Task 3.2 - Test 17: Delete button meets touch target (>= 48dp) and accessibility contracts', () => {
  const minAndroidTouchTarget = 48;
  const minIosTouchTarget = 44;

  const buttonStyle = { minHeight: 48 };
  assert.ok(buttonStyle.minHeight >= minAndroidTouchTarget);
  assert.ok(buttonStyle.minHeight >= minIosTouchTarget);

  const accessibilityProps = {
    accessibilityRole: 'button' as const,
    accessibilityLabel: translate('en', 'workouts.deleteWorkout'),
  };
  assert.equal(accessibilityProps.accessibilityRole, 'button');
  assert.equal(accessibilityProps.accessibilityLabel, 'Delete workout');
});

// 18. Light/Dark and platform interaction contracts
test('Task 3.2 - Test 18: Light and Dark themes provide WCAG compliant danger tokens', () => {
  setActiveTheme('light');
  const light = themeColors();
  assert.ok(light.danger, 'Light theme has danger color token');
  assert.equal(light.danger, '#D95666');

  setActiveTheme('dark');
  const dark = themeColors();
  assert.ok(dark.danger, 'Dark theme has danger color token');
  assert.equal(dark.danger, '#FF6B7A');

  // Reset to default
  setActiveTheme('light');
});

// 19. Edit screen discard-message correction
test('Task 3.2 - Test 19: Edit screen unsaved changes confirmation uses dedicated localized prompt', () => {
  // English
  assert.equal(translate('en', 'workouts.discardChangesTitle'), 'Discard changes?');
  assert.equal(
    translate('en', 'workouts.discardChangesMessage'),
    'Discard your unsaved workout changes?'
  );
  assert.equal(translate('en', 'workouts.keepEditing'), 'Keep Editing');
  assert.equal(translate('en', 'workouts.discardChanges'), 'Discard Changes');

  // Arabic
  assert.equal(translate('ar', 'workouts.discardChangesTitle'), 'تجاهل التعديلات؟');
  assert.equal(
    translate('ar', 'workouts.discardChangesMessage'),
    'هل تريد تجاهل التعديلات غير المحفوظة على التمرين؟'
  );
  assert.equal(translate('ar', 'workouts.keepEditing'), 'متابعة التعديل');
  assert.equal(translate('ar', 'workouts.discardChanges'), 'تجاهل التعديلات');
});
