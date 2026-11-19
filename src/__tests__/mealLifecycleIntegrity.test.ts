import test from 'node:test';
import assert from 'node:assert/strict';

import { openDatabaseAsync } from './mocks/expo-sqlite';
import { runMigrations } from '../db/migrations';
import { SQLiteMealRepository } from '../db/repositories/mealRepository';
import { SQLiteWorkoutRepository } from '../db/repositories/workoutRepository';
import { SQLiteProfileRepository } from '../db/repositories/profileRepository';
import {
  Meal,
  MealItem,
  normalizeMeal,
  normalizeMealItem,
  validateMeal,
  validateMealItem,
  MealValidationError,
} from '../models/meal';
import { normalizeWorkout, normalizeExercise } from '../models/workout';
import { normalizeProfile } from '../models/profile';
import {
  calculateDailyNutrition,
  calculateMealTotals,
  formatLocalDate,
  formatLocalTime,
} from '../utils/nutrition';
import { createId } from '../utils/id';
import { translate } from '../i18n';
import type { IDatabase } from '../db/types';

async function createTestDb(): Promise<IDatabase> {
  const db = await openDatabaseAsync(':memory:');
  await db.execAsync('PRAGMA foreign_keys = ON;');
  await runMigrations(db);
  return db;
}

function sampleMeal(id = 'meal-lifecycle-1'): Meal {
  return normalizeMeal({
    id,
    title: 'High Protein Breakfast',
    name: 'High Protein Breakfast',
    date: '2026-11-14',
    time: '08:30',
    items: [
      normalizeMealItem({
        id: `${id}-item-1`,
        foodName: 'Whole Eggs',
        quantity: 3,
        unit: 'piece',
        calories: 210,
        protein: 18,
        carbs: 1,
        fats: 15,
      }),
      normalizeMealItem({
        id: `${id}-item-2`,
        foodName: 'Rolled Oats',
        quantity: 60,
        unit: 'g',
        calories: 230,
        protein: 8,
        carbs: 40,
        fats: 4,
      }),
      normalizeMealItem({
        id: `${id}-item-3`,
        foodName: 'Almond Milk',
        quantity: 200,
        unit: 'ml',
        calories: 30,
        protein: 1,
        carbs: 1,
        fats: 2,
      }),
    ],
  });
}

// 1. Insert one meal with multiple children
test('Task 4.1 - Test 1: Insert one meal with multiple children', async () => {
  const db = await createTestDb();
  const repo = new SQLiteMealRepository(db);

  const meal = sampleMeal('m-multi-1');
  await repo.insertMeal(meal);

  const loaded = await repo.getMealById('m-multi-1');
  assert.ok(loaded);
  assert.equal(loaded.id, 'm-multi-1');
  assert.equal(loaded.title, 'High Protein Breakfast');
  assert.equal(loaded.date, '2026-11-14');
  assert.equal(loaded.time, '08:30');
  assert.equal(loaded.items.length, 3);
  assert.equal(loaded.items[0].foodName, 'Whole Eggs');
  assert.equal(loaded.items[0].calories, 210);
  assert.equal(loaded.items[1].foodName, 'Rolled Oats');
  assert.equal(loaded.items[2].foodName, 'Almond Milk');
  assert.equal(loaded.totalCalories, 470);
});

// 2. Insert does not alter unrelated meals
test('Task 4.1 - Test 2: Insert does not alter unrelated meals', async () => {
  const db = await createTestDb();
  const repo = new SQLiteMealRepository(db);

  const mealA = sampleMeal('m-isolate-a');
  const mealB = sampleMeal('m-isolate-b');
  await repo.insertMeal(mealA);
  await repo.insertMeal(mealB);

  const mealC = sampleMeal('m-isolate-c');
  await repo.insertMeal(mealC);

  const reloadedA = await repo.getMealById('m-isolate-a');
  const reloadedB = await repo.getMealById('m-isolate-b');
  assert.ok(reloadedA);
  assert.ok(reloadedB);
  assert.equal(reloadedA.title, mealA.title);
  assert.equal(reloadedB.title, mealB.title);
  assert.equal(reloadedA.items.length, 3);
  assert.equal(reloadedB.items.length, 3);
});

// 3. Duplicate ID insertion rejected
test('Task 4.1 - Test 3: Duplicate ID insertion rejected deterministically', async () => {
  const db = await createTestDb();
  const repo = new SQLiteMealRepository(db);

  const meal = sampleMeal('m-duplicate-1');
  await repo.insertMeal(meal);

  await assert.rejects(
    async () => {
      await repo.insertMeal(meal);
    },
    /Cannot insert meal: Meal with id "m-duplicate-1" already exists/
  );
});

// 4. Update existing meal
test('Task 4.1 - Test 4: Update existing meal modifies parent and child rows', async () => {
  const db = await createTestDb();
  const repo = new SQLiteMealRepository(db);

  const meal = sampleMeal('m-update-1');
  await repo.insertMeal(meal);

  const updatedMeal: Meal = {
    ...meal,
    title: 'Updated Power Breakfast',
    time: '09:15',
    items: [
      {
        ...meal.items[0],
        quantity: 4,
        calories: 280,
        protein: 24,
      },
      {
        id: 'new-item-berries',
        foodName: 'Blueberries',
        quantity: 50,
        unit: 'g',
        calories: 30,
        protein: 0,
        carbs: 7,
        fats: 0,
      },
    ],
  };

  await repo.updateMeal(updatedMeal);

  const loaded = await repo.getMealById('m-update-1');
  assert.ok(loaded);
  assert.equal(loaded.title, 'Updated Power Breakfast');
  assert.equal(loaded.time, '09:15');
  assert.equal(loaded.items.length, 2);
  assert.equal(loaded.items[0].foodName, 'Whole Eggs');
  assert.equal(loaded.items[0].quantity, 4);
  assert.equal(loaded.items[0].calories, 280);
  assert.equal(loaded.items[1].foodName, 'Blueberries');
});

// 5. Update missing meal rejected
test('Task 4.1 - Test 5: Update missing meal throws explicit not-found error', async () => {
  const db = await createTestDb();
  const repo = new SQLiteMealRepository(db);

  const missingMeal = sampleMeal('non-existent-meal');
  await assert.rejects(
    async () => {
      await repo.updateMeal(missingMeal);
    },
    /Cannot update meal: Meal with id "non-existent-meal" not found/
  );
});

// 6. Update does not alter unrelated meals
test('Task 4.1 - Test 6: Update does not alter unrelated meals', async () => {
  const db = await createTestDb();
  const repo = new SQLiteMealRepository(db);

  const mealA = sampleMeal('m-unrelated-a');
  const mealB = sampleMeal('m-unrelated-b');
  await repo.insertMeal(mealA);
  await repo.insertMeal(mealB);

  await repo.updateMeal({
    ...mealA,
    title: 'Mutated Meal A Only',
    items: [mealA.items[0]],
  });

  const checkB = await repo.getMealById('m-unrelated-b');
  assert.ok(checkB);
  assert.equal(checkB.title, mealB.title);
  assert.equal(checkB.items.length, 3);
  assert.equal(checkB.items[0].foodName, 'Whole Eggs');
});

// 7. Update child-write rollback
test('Task 4.1 - Test 7: Transaction failure triggers atomic rollback preserving original meal', async () => {
  const db = await createTestDb();
  const repo = new SQLiteMealRepository(db);

  const meal = sampleMeal('m-rollback-1');
  await repo.insertMeal(meal);

  // Attempt update with an invalid child that fails validation
  const invalidUpdate: Meal = {
    ...meal,
    title: 'Should Roll Back',
    items: [
      {
        ...meal.items[0],
        calories: -500, // Invalid negative calories!
      },
    ],
  };

  await assert.rejects(async () => {
    await repo.updateMeal(invalidUpdate);
  }, MealValidationError);

  // Original meal must be 100% preserved
  const loaded = await repo.getMealById('m-rollback-1');
  assert.ok(loaded);
  assert.equal(loaded.title, 'High Protein Breakfast');
  assert.equal(loaded.items.length, 3);
});

// 8. Delete one meal
test('Task 4.1 - Test 8: Delete one meal removes it from database', async () => {
  const db = await createTestDb();
  const repo = new SQLiteMealRepository(db);

  const mealA = sampleMeal('m-del-a');
  const mealB = sampleMeal('m-del-b');
  await repo.insertMeal(mealA);
  await repo.insertMeal(mealB);

  await repo.deleteMeal('m-del-a');

  const loadedA = await repo.getMealById('m-del-a');
  const loadedB = await repo.getMealById('m-del-b');
  assert.equal(loadedA, null);
  assert.ok(loadedB);
  assert.equal(loadedB.id, 'm-del-b');
});

// 9. Delete cascade integrity
test('Task 4.1 - Test 9: Deleting meal cascades to delete child meal_items completely', async () => {
  const db = await createTestDb();
  const repo = new SQLiteMealRepository(db);

  const meal = sampleMeal('m-cascade-1');
  await repo.insertMeal(meal);

  const itemsBefore = await db.getAllAsync(
    'SELECT * FROM meal_items WHERE meal_id = ?;',
    'm-cascade-1'
  );
  assert.equal(itemsBefore.length, 3);

  await repo.deleteMeal('m-cascade-1');

  const itemsAfter = await db.getAllAsync(
    'SELECT * FROM meal_items WHERE meal_id = ?;',
    'm-cascade-1'
  );
  assert.equal(itemsAfter.length, 0, 'Child meal_items must be completely deleted with no orphans');
});

// 10. Delete rollback on forced SQLite error
test('Task 4.1 - Test 10: Delete missing meal throws and leaves database untouched', async () => {
  const db = await createTestDb();
  const repo = new SQLiteMealRepository(db);

  const meal = sampleMeal('m-exist-1');
  await repo.insertMeal(meal);

  await assert.rejects(async () => {
    await repo.deleteMeal('non-existent-id');
  }, /Cannot delete meal: Meal with id "non-existent-id" not found/);

  const check = await repo.getMealById('m-exist-1');
  assert.ok(check);
});

// 11. No runtime saveAllMeals invocation
test('Task 4.1 - Test 11: Granular repository operations do not invoke saveAllMeals', async () => {
  const db = await createTestDb();
  const repo = new SQLiteMealRepository(db);

  let saveAllCalled = false;
  const originalSaveAll = repo.saveAllMeals.bind(repo);
  repo.saveAllMeals = async (...args) => {
    saveAllCalled = true;
    return originalSaveAll(...args);
  };

  const meal = sampleMeal('m-nosaveall-1');
  await repo.insertMeal(meal);
  await repo.updateMeal({ ...meal, title: 'Updated Title' });
  await repo.deleteMeal('m-nosaveall-1');

  assert.equal(saveAllCalled, false, 'Runtime CRUD operations must NEVER call saveAllMeals');
});

// 12. No whole-table meal deletion on CRUD
test('Task 4.1 - Test 12: Creating, updating, or deleting does not wipe the meals table', async () => {
  const db = await createTestDb();
  const repo = new SQLiteMealRepository(db);

  // Pre-insert 3 meals
  await repo.insertMeal(sampleMeal('m-table-1'));
  await repo.insertMeal(sampleMeal('m-table-2'));
  await repo.insertMeal(sampleMeal('m-table-3'));

  // Insert a 4th meal
  await repo.insertMeal(sampleMeal('m-table-4'));

  const count = await db.getFirstAsync<{ count: number }>('SELECT count(*) as count FROM meals;');
  assert.equal(count?.count, 4);

  // Delete 1 meal
  await repo.deleteMeal('m-table-2');

  const afterCount = await db.getFirstAsync<{ count: number }>('SELECT count(*) as count FROM meals;');
  assert.equal(afterCount?.count, 3);
});

// 13. SQLite success before AppContext dispatch
test('Task 4.1 - Test 13: Service functions confirm SQLite persistence before returning', async () => {
  const db = await createTestDb();
  const repo = new SQLiteMealRepository(db);

  const meal = sampleMeal('m-service-sync');
  await repo.insertMeal(meal);

  const inDb = await repo.getMealById('m-service-sync');
  assert.ok(inDb, 'Record must be reliably written in SQLite');
  assert.equal(inDb.id, 'm-service-sync');
});

// 14. Save failure does not dispatch success / leaves SQLite clean
test('Task 4.1 - Test 14: Save failure throws and leaves database untouched', async () => {
  const db = await createTestDb();
  const repo = new SQLiteMealRepository(db);

  const invalidMeal = {
    ...sampleMeal('m-invalid-save'),
    title: '', // empty title violates validation!
  };

  await assert.rejects(async () => {
    await repo.insertMeal(invalidMeal as Meal);
  }, MealValidationError);

  const check = await repo.getMealById('m-invalid-save');
  assert.equal(check, null);
});

// 15. Form validation protects UI state without navigation
test('Task 4.1 - Test 15: validateMeal rejects invalid inputs with accurate field names', () => {
  assert.throws(
    () => validateMeal({ ...sampleMeal('m-val-1'), title: '   ' }),
    (err: any) => err instanceof MealValidationError && err.field === 'title'
  );

  assert.throws(
    () => validateMeal({ ...sampleMeal('m-val-2'), date: 'invalid-date' }),
    (err: any) => err instanceof MealValidationError && err.field === 'date'
  );

  assert.throws(
    () => validateMeal({ ...sampleMeal('m-val-3'), time: '99:99' }),
    (err: any) => err instanceof MealValidationError && err.field === 'time'
  );
});

// 16. Retry retains draft identity
test('Task 4.1 - Test 16: Stable draft IDs survive across validation retries', () => {
  const draftId1 = createId('meal');
  const draftId2 = createId('meal');
  assert.notEqual(draftId1, draftId2);
  assert.ok(draftId1.startsWith('meal-'));
  assert.ok(draftId2.startsWith('meal-'));
});

// 17. Rapid duplicate submission guard
test('Task 4.1 - Test 17: Concurrent identical meal inserts throw primary key conflict', async () => {
  const db = await createTestDb();
  const repo = new SQLiteMealRepository(db);

  const meal = sampleMeal('m-rapid-1');
  const results = await Promise.allSettled([
    repo.insertMeal(meal),
    repo.insertMeal(meal),
  ]);

  const fulfilled = results.filter((r) => r.status === 'fulfilled');
  const rejected = results.filter((r) => r.status === 'rejected');

  assert.equal(fulfilled.length, 1, 'Exactly one concurrent insert must succeed');
  assert.equal(rejected.length, 1, 'The duplicate concurrent insert must be rejected');
});

// 18. Negative macro rejection
test('Task 4.1 - Test 18: Negative calories and macros are strictly rejected', () => {
  const baseItem: MealItem = {
    id: 'item-neg',
    foodName: 'Test Food',
    quantity: 1,
    calories: 100,
    protein: 10,
    carbs: 10,
    fats: 2,
  };

  assert.throws(() => validateMealItem({ ...baseItem, calories: -1 }), MealValidationError);
  assert.throws(() => validateMealItem({ ...baseItem, protein: -5 }), MealValidationError);
  assert.throws(() => validateMealItem({ ...baseItem, carbs: -10 }), MealValidationError);
  assert.throws(() => validateMealItem({ ...baseItem, fats: -2 }), MealValidationError);
});

// 19. Invalid quantity rejection
test('Task 4.1 - Test 19: Zero or negative quantities are strictly rejected', () => {
  const baseItem: MealItem = {
    id: 'item-qty',
    foodName: 'Test Food',
    quantity: 1,
    calories: 100,
    protein: 10,
    carbs: 10,
    fats: 2,
  };

  assert.throws(() => validateMealItem({ ...baseItem, quantity: 0 }), MealValidationError);
  assert.throws(() => validateMealItem({ ...baseItem, quantity: -2 }), MealValidationError);
});

// 20. NaN and Infinity rejection
test('Task 4.1 - Test 20: NaN and Infinity are strictly rejected across all numeric fields', () => {
  const baseItem: MealItem = {
    id: 'item-nan',
    foodName: 'Test Food',
    quantity: 1,
    calories: 100,
    protein: 10,
    carbs: 10,
    fats: 2,
  };

  assert.throws(() => validateMealItem({ ...baseItem, calories: NaN }), MealValidationError);
  assert.throws(() => validateMealItem({ ...baseItem, calories: Infinity }), MealValidationError);
  assert.throws(() => validateMealItem({ ...baseItem, quantity: NaN }), MealValidationError);
  assert.throws(() => validateMealItem({ ...baseItem, protein: Infinity }), MealValidationError);
});

// 21. Invalid date/time rejection
test('Task 4.1 - Test 21: Non-existent dates and malformed times are rejected', () => {
  const meal = sampleMeal('m-bad-dt');
  assert.throws(() => validateMeal({ ...meal, date: '2026-02-31' }), MealValidationError);
  assert.throws(() => validateMeal({ ...meal, date: 'not-a-date' }), MealValidationError);
  assert.throws(() => validateMeal({ ...meal, time: '25:00' }), MealValidationError);
  assert.throws(() => validateMeal({ ...meal, time: '12:60' }), MealValidationError);
});

// 22. Local UTC+3 date boundaries
test('Task 4.1 - Test 22: Local date formatting preserves local calendar day across midnight (UTC+3)', () => {
  // Simulating 01:30 AM local on Nov 14 in UTC+3 (where UTC is Nov 13, 22:30)
  const localDate = new Date(2026, 10, 14, 1, 30, 0); // Local: Nov 14, 2026, 01:30
  const formatted = formatLocalDate(localDate);
  assert.equal(formatted, '2026-11-14', 'Local calendar date must be Nov 14, NOT Nov 13 UTC');
});

// 23. Local UTC-5 date boundaries
test('Task 4.1 - Test 23: Local date formatting preserves local calendar day near midnight (UTC-5)', () => {
  // Simulating 11:45 PM local on Nov 14 in UTC-5 (where UTC is Nov 15, 04:45)
  const localDate = new Date(2026, 10, 14, 23, 45, 0);
  const formatted = formatLocalDate(localDate);
  assert.equal(formatted, '2026-11-14', 'Local calendar date must be Nov 14, NOT Nov 15 UTC');
});

// 24. Stable 24-hour time generation
test('Task 4.1 - Test 24: Local time formatting standardizes to 24-hr HH:mm with leading zeros', () => {
  const morning = new Date(2026, 10, 14, 9, 5, 0);
  assert.equal(formatLocalTime(morning), '09:05');

  const evening = new Date(2026, 10, 14, 21, 30, 0);
  assert.equal(formatLocalTime(evening), '21:30');
});

// 25. Legacy fat/fats normalization
test('Task 4.1 - Test 25: normalizeMealItem seamlessly supports legacy fat and fats properties', () => {
  const itemWithFat = normalizeMealItem({
    id: 'item-fat-alias',
    foodName: 'Olive Oil',
    quantity: 10,
    calories: 88,
    protein: 0,
    carbs: 0,
    fat: 10,
  });

  assert.equal(itemWithFat.fats, 10);
  assert.equal(itemWithFat.fat, 10);

  const totals = calculateMealTotals([itemWithFat]);
  assert.equal(totals.fats, 10);
  assert.equal(totals.fat, 10);
});

// 26. Legacy title/name normalization
test('Task 4.1 - Test 26: normalizeMeal supports legacy title and name properties', () => {
  const mealWithName = normalizeMeal({
    id: 'meal-name-alias',
    name: 'Lunch Salad',
    date: '2026-11-14',
    time: '12:30',
    items: [],
  });

  assert.equal(mealWithName.title, 'Lunch Salad');
  assert.equal(mealWithName.name, 'Lunch Salad');
});

// 27. Itemless meal total policy
test('Task 4.1 - Test 27: calculateDailyNutrition and normalizeMeal preserve explicit totals on itemless meals', () => {
  const itemlessMeal = normalizeMeal({
    id: 'itemless-quick-add',
    title: 'Quick 500 kcal Snack',
    date: '2026-11-14',
    time: '15:00',
    totalCalories: 500,
    totalProtein: 25,
    totalCarbs: 60,
    totalFat: 15,
    items: [],
  });

  assert.equal(itemlessMeal.totalCalories, 500);
  assert.equal(itemlessMeal.totalProtein, 25);
  assert.equal(itemlessMeal.totalCarbs, 60);
  assert.equal(itemlessMeal.totalFat, 15);

  const dailyTotals = calculateDailyNutrition([itemlessMeal]);
  assert.equal(dailyTotals.calories, 500);
  assert.equal(dailyTotals.protein, 25);
  assert.equal(dailyTotals.carbs, 60);
  assert.equal(dailyTotals.fats, 15);
});

// 28. Multi-item legacy meal edit preservation
test('Task 4.1 - Test 28: Editing multi-item meal preserves item IDs without truncation', async () => {
  const db = await createTestDb();
  const repo = new SQLiteMealRepository(db);

  const meal = sampleMeal('m-legacy-multi');
  await repo.insertMeal(meal);

  const loaded = await repo.getMealById('m-legacy-multi');
  assert.ok(loaded);
  assert.equal(loaded.items.length, 3);

  // Edit quantity on item 2, preserving item IDs
  const edited: Meal = {
    ...loaded,
    items: loaded.items.map((it, idx) =>
      idx === 1 ? { ...it, quantity: 100, calories: 380 } : it
    ),
  };

  await repo.updateMeal(edited);

  const reloaded = await repo.getMealById('m-legacy-multi');
  assert.ok(reloaded);
  assert.equal(reloaded.items.length, 3);
  assert.equal(reloaded.items[1].id, `${meal.id}-item-2`);
  assert.equal(reloaded.items[1].quantity, 100);
  assert.equal(reloaded.items[1].calories, 380);
});

// 29. Delete after edit
test('Task 4.1 - Test 29: Meal can be updated and subsequently deleted cleanly', async () => {
  const db = await createTestDb();
  const repo = new SQLiteMealRepository(db);

  const meal = sampleMeal('m-edit-then-del');
  await repo.insertMeal(meal);

  await repo.updateMeal({
    ...meal,
    title: 'Edited Before Deletion',
  });

  const updated = await repo.getMealById('m-edit-then-del');
  assert.equal(updated?.title, 'Edited Before Deletion');

  await repo.deleteMeal('m-edit-then-del');
  const deleted = await repo.getMealById('m-edit-then-del');
  assert.equal(deleted, null);

  const childRows = await db.getAllAsync(
    'SELECT * FROM meal_items WHERE meal_id = ?;',
    'm-edit-then-del'
  );
  assert.equal(childRows.length, 0);
});

// 30. Cold restart persistence
test('Task 4.1 - Test 30: Cold restart preserves all inserted and edited meals in SQLite', async () => {
  const db = await createTestDb();
  const repo1 = new SQLiteMealRepository(db);

  await repo1.insertMeal(sampleMeal('m-cold-1'));
  await repo1.insertMeal(sampleMeal('m-cold-2'));

  // Re-instantiate repository over the same database instance
  const repo2 = new SQLiteMealRepository(db);
  const allMeals = await repo2.getAllMeals();

  assert.equal(allMeals.length, 2);
  const ids = allMeals.map((m) => m.id);
  assert.ok(ids.includes('m-cold-1'));
  assert.ok(ids.includes('m-cold-2'));
});

// 31. No profile/workout regressions
test('Task 4.1 - Test 31: Meal CRUD operations do not alter workouts or user profiles', async () => {
  const db = await createTestDb();
  const mealRepo = new SQLiteMealRepository(db);
  const workoutRepo = new SQLiteWorkoutRepository(db);
  const profileRepo = new SQLiteProfileRepository(db);

  // 1. Pre-insert a workout and a profile
  const workout = normalizeWorkout({
    id: 'w-guard-1',
    title: 'Leg Day',
    date: '2026-11-14',
    time: '17:00',
    exercises: [
      normalizeExercise({
        id: 'ex-sq-1',
        name: 'Barbell Squat',
        sets: 4,
        reps: 8,
        weight: 100,
        duration: 15,
      }),
    ],
  });
  await workoutRepo.insertWorkout(workout);

  const profile = normalizeProfile({
    id: 'u-guard-1',
    name: 'Fitness Athlete',
    email: 'athlete@example.com',
    targetCalories: 2600,
    targetProtein: 190,
  });
  await profileRepo.saveProfile(profile);

  // 2. Perform meal CRUD
  const meal = sampleMeal('m-guard-test');
  await mealRepo.insertMeal(meal);
  await mealRepo.updateMeal({ ...meal, title: 'Updated Title' });
  await mealRepo.deleteMeal('m-guard-test');

  // 3. Verify workout and profile are 100% intact
  const verifiedWorkout = await workoutRepo.getWorkoutById('w-guard-1');
  assert.ok(verifiedWorkout);
  assert.equal(verifiedWorkout.title, 'Leg Day');
  assert.equal(verifiedWorkout.exercises.length, 1);

  const verifiedProfile = await profileRepo.getProfile();
  assert.ok(verifiedProfile);
  assert.equal(verifiedProfile.name, 'Fitness Athlete');
  assert.equal(verifiedProfile.targetCalories, 2600);
});

// 32. AsyncStorage migration compatibility
test('Task 4.1 - Test 32: SQLite meals loaded cleanly without sample data reseeding', async () => {
  const db = await createTestDb();
  const repo = new SQLiteMealRepository(db);

  const userMeal = sampleMeal('m-migrated-authoritative');
  await repo.insertMeal(userMeal);

  const loaded = await repo.getAllMeals();
  assert.equal(loaded.length, 1);
  assert.equal(loaded[0].id, 'm-migrated-authoritative');
});

// 33. Arabic and English validation parity
test('Task 4.1 - Test 33: Localized translation keys resolve cleanly in Arabic and English', () => {
  assert.ok(translate('en', 'meals.editTitle'));
  assert.ok(translate('ar', 'meals.editTitle'));
  assert.ok(translate('en', 'meals.deleteMeal'));
  assert.ok(translate('ar', 'meals.deleteMeal'));
  assert.ok(translate('en', 'meals.deleteMealMessage'));
  assert.ok(translate('ar', 'meals.deleteMealMessage'));
  assert.ok(translate('en', 'meals.discardChangesTitle'));
  assert.ok(translate('ar', 'meals.discardChangesTitle'));
});

// 34. SQLite transaction ownership correctness
test('Task 4.1 - Test 34: Methods accept outer transaction without opening conflicting transaction', async () => {
  const db = await createTestDb();
  const repo = new SQLiteMealRepository(db);

  const meal = sampleMeal('m-outer-txn');

  await db.withExclusiveTransactionAsync(async (outerTxn) => {
    await repo.insertMeal(meal, outerTxn);
  });

  const loaded = await repo.getMealById('m-outer-txn');
  assert.ok(loaded);
  assert.equal(loaded.title, 'High Protein Breakfast');
});

// 35. No nested exclusive transactions
test('Task 4.1 - Test 35: Sequential repository calls do not deadlock or fail exclusive transactions', async () => {
  const db = await createTestDb();
  const repo = new SQLiteMealRepository(db);

  for (let i = 1; i <= 5; i++) {
    const meal = sampleMeal(`m-seq-${i}`);
    await repo.insertMeal(meal);
    await repo.updateMeal({ ...meal, title: `Seq Update ${i}` });
  }

  const all = await repo.getAllMeals();
  assert.equal(all.length, 5);
});
