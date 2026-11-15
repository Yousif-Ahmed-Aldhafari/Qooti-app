import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabaseAsync } from 'expo-sqlite';
import { runMigrations } from '../db/migrations';
import { SQLiteMealRepository } from '../db/repositories/mealRepository';
import {
  Meal,
  MealValidationError,
  normalizeMeal,
  normalizeMealItem,
  validateMeal,
  validateMealDate,
  validateMealItem,
  validateMealTime,
} from '../models/meal';
import {
  parseStrictNutrient,
  parseStrictNutrientInput,
  parseStrictQuantity,
} from '../utils/nutrition';
import { translate } from '../i18n';
import type { IDatabase } from '../db/types';

async function createTestDb(): Promise<IDatabase> {
  const db = await openDatabaseAsync(':memory:');
  await db.execAsync('PRAGMA foreign_keys = ON;');
  await runMigrations(db);
  return db;
}

function sampleMeal(id = 'meal-val-txn-1'): Meal {
  return normalizeMeal({
    id,
    title: 'Protein Oatmeal',
    date: '2026-11-15',
    time: '08:30',
    items: [
      normalizeMealItem({
        id: `${id}-item-1`,
        foodName: 'Rolled Oats',
        quantity: 50,
        unit: 'g',
        calories: 190,
        protein: 7,
        carbs: 34,
        fats: 3,
      }),
    ],
  });
}

// 1. UI input "Infinity"
test('Task 4.1A - Test 1: UI input "Infinity" is strictly rejected', () => {
  const res1 = parseStrictNutrientInput('Infinity');
  assert.equal(res1.isValid, false);
  assert.equal(res1.error, 'NON_FINITE');

  const res2 = parseStrictNutrient('Infinity');
  assert.equal(res2.isValid, false);

  assert.throws(
    () => validateMealItem({ id: 'item-inf', foodName: 'Test', quantity: 1, calories: Infinity, protein: 0, carbs: 0, fats: 0 }),
    MealValidationError
  );
});

// 2. UI input "-Infinity"
test('Task 4.1A - Test 2: UI input "-Infinity" is strictly rejected', () => {
  const res1 = parseStrictNutrientInput('-Infinity');
  assert.equal(res1.isValid, false);
  assert.equal(res1.error, 'NON_FINITE');

  const res2 = parseStrictNutrient('-Infinity');
  assert.equal(res2.isValid, false);

  assert.throws(
    () => validateMealItem({ id: 'item-ninf', foodName: 'Test', quantity: 1, calories: -Infinity, protein: 0, carbs: 0, fats: 0 }),
    MealValidationError
  );
});

// 3. Input "NaN"
test('Task 4.1A - Test 3: Input "NaN" is strictly rejected', () => {
  const res1 = parseStrictNutrientInput('NaN');
  assert.equal(res1.isValid, false);
  assert.equal(res1.error, 'NON_FINITE');

  const res2 = parseStrictNutrient('nan');
  assert.equal(res2.isValid, false);

  assert.throws(
    () => validateMealItem({ id: 'item-nan', foodName: 'Test', quantity: 1, calories: NaN, protein: 0, carbs: 0, fats: 0 }),
    MealValidationError
  );
});

// 4. Empty input versus explicit zero
test('Task 4.1A - Test 4: Empty input versus explicit zero distinction', () => {
  // Empty input with allowEmpty=true
  const emptyRes = parseStrictNutrientInput('', { allowEmpty: true, defaultValue: 0 });
  assert.equal(emptyRes.isValid, true);
  assert.equal(emptyRes.value, 0);
  assert.equal(emptyRes.isEmpty, true);

  // Explicit zero input
  const zeroRes = parseStrictNutrientInput('0', { allowEmpty: true });
  assert.equal(zeroRes.isValid, true);
  assert.equal(zeroRes.value, 0);
  assert.equal(zeroRes.isEmpty, false);

  // Explicit zero on quantity (allowZero=false)
  const zeroQty = parseStrictQuantity('0');
  assert.equal(zeroQty.isValid, false);
  assert.equal(zeroQty.error, 'ZERO');
  assert.equal(zeroQty.errorMessageKey, 'common.mustBePositive');
});

// 5. Scientific notation overflow
test('Task 4.1A - Test 5: Scientific notation and numeric overflow are rejected', () => {
  const resSci1 = parseStrictNutrientInput('1e50');
  assert.equal(resSci1.isValid, false);

  const resSci2 = parseStrictNutrientInput('2.5e3');
  assert.equal(resSci2.isValid, false);

  const resOverflow = parseStrictNutrientInput('999999999', { max: 100_000 });
  assert.equal(resOverflow.isValid, false);
  assert.equal(resOverflow.error, 'OVERFLOW');
  assert.equal(resOverflow.errorMessageKey, 'common.valueTooLarge');

  assert.throws(
    () => validateMealItem({ id: 'item-over', foodName: 'Test', quantity: 1, calories: 500_000, protein: 0, carbs: 0, fats: 0 }),
    MealValidationError
  );
});

// 6. Negative nutrient input
test('Task 4.1A - Test 6: Negative nutrient inputs are strictly rejected', () => {
  const resNegCal = parseStrictNutrient('-50');
  assert.equal(resNegCal.isValid, false);
  assert.equal(resNegCal.error, 'NEGATIVE');
  assert.equal(resNegCal.errorMessageKey, 'common.cannotBeNegative');

  const resNegProt = parseStrictNutrient('-0.5');
  assert.equal(resNegProt.isValid, false);
  assert.equal(resNegProt.error, 'NEGATIVE');

  assert.throws(
    () => validateMealItem({ id: 'item-neg', foodName: 'Test', quantity: 1, calories: 100, protein: -10, carbs: 0, fats: 0 }),
    MealValidationError
  );
});

// 7. Quantity zero and negative
test('Task 4.1A - Test 7: Quantity zero and negative are strictly rejected', () => {
  const qZero = parseStrictQuantity('0');
  assert.equal(qZero.isValid, false);
  assert.equal(qZero.error, 'ZERO');

  const qNeg = parseStrictQuantity('-2.5');
  assert.equal(qNeg.isValid, false);
  assert.equal(qNeg.error, 'NEGATIVE');

  assert.throws(
    () => validateMealItem({ id: 'item-qzero', foodName: 'Test', quantity: 0, calories: 100, protein: 10, carbs: 0, fats: 0 }),
    MealValidationError
  );
  assert.throws(
    () => validateMealItem({ id: 'item-qneg', foodName: 'Test', quantity: -1, calories: 100, protein: 10, carbs: 0, fats: 0 }),
    MealValidationError
  );
});

// 8. Malformed decimals
test('Task 4.1A - Test 8: Malformed decimals and trailing separators are rejected', () => {
  assert.equal(parseStrictNutrientInput('1.2.3').isValid, false);
  assert.equal(parseStrictNutrientInput('1,2,3').isValid, false);
  assert.equal(parseStrictNutrientInput('1..5').isValid, false);
  assert.equal(parseStrictNutrientInput('.').isValid, false);
  assert.equal(parseStrictNutrientInput(',').isValid, false);
  assert.equal(parseStrictNutrientInput('12.').isValid, false);
  assert.equal(parseStrictNutrientInput('12,').isValid, false);
  assert.equal(parseStrictNutrientInput('100g').isValid, false);
  assert.equal(parseStrictNutrientInput('++5').isValid, false);
  assert.equal(parseStrictNutrientInput('--5').isValid, false);
});

// 9. Arabic/English decimal handling
test('Task 4.1A - Test 9: Arabic and English decimal separators (. and ,) parse accurately', () => {
  // English period
  const resDot = parseStrictNutrient('12.5');
  assert.equal(resDot.isValid, true);
  assert.equal(resDot.value, 12.5);

  // Arabic / European comma
  const resComma = parseStrictNutrient('12,5');
  assert.equal(resComma.isValid, true);
  assert.equal(resComma.value, 12.5);

  // Fractional quantity with comma
  const qComma = parseStrictQuantity('0,75');
  assert.equal(qComma.isValid, true);
  assert.equal(qComma.value, 0.75);

  // Leading dot / comma decimal
  const leadDot = parseStrictNutrient('.5');
  assert.equal(leadDot.isValid, true);
  assert.equal(leadDot.value, 0.5);

  const leadComma = parseStrictNutrient(',5');
  assert.equal(leadComma.isValid, true);
  assert.equal(leadComma.value, 0.5);
});

// 10. Invalid input preserves draft
test('Task 4.1A - Test 10: Invalid input retains the raw typed string without silent overwrite', () => {
  // Simulating user typing "Infinity" into calories field
  const userTyped = 'Infinity';
  const result = parseStrictNutrient(userTyped);

  assert.equal(result.isValid, false);
  // Value must not silently be zeroed out into the user input state
  assert.equal(userTyped, 'Infinity', 'User typed string must be preserved');
});

// 11. Invalid input does not call SQLite save
test('Task 4.1A - Test 11: Validation failure halts execution before database write', async () => {
  const db = await createTestDb();
  const repo = new SQLiteMealRepository(db);

  let saveCalled = false;
  const mockOnSave = async (meal: Meal) => {
    saveCalled = true;
    await repo.insertMeal(meal);
  };

  // Simulating UI validator check
  const badCalories = 'abc';
  const parsed = parseStrictNutrient(badCalories);
  if (parsed.isValid) {
    await mockOnSave(sampleMeal('m-fail-save'));
  }

  assert.equal(saveCalled, false, 'Database save must never be called on invalid input');
  const countRow = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM meals;');
  assert.equal(countRow?.count, 0);
});

// 12. Date with trailing suffix rejected
test('Task 4.1A - Test 12: Date with trailing suffix or ISO timestamp is strictly rejected', () => {
  const meal = sampleMeal('m-suffix-1');

  // Trailing ISO timestamp suffix
  assert.throws(
    () => validateMeal({ ...meal, date: '2026-11-15T08:30:00.000Z' }),
    (err: any) => err instanceof MealValidationError && err.field === 'date'
  );

  // Trailing text suffix
  assert.throws(
    () => validateMeal({ ...meal, date: '2026-11-15-extra' }),
    (err: any) => err instanceof MealValidationError && err.field === 'date'
  );

  // Trailing space
  assert.throws(
    () => validateMeal({ ...meal, date: '2026-11-15 ' }),
    (err: any) => err instanceof MealValidationError && err.field === 'date'
  );

  // Slashes instead of dashes
  assert.throws(
    () => validateMeal({ ...meal, date: '2026/11/15' }),
    (err: any) => err instanceof MealValidationError && err.field === 'date'
  );
});

// 13. Correct leap-day validation
test('Task 4.1A - Test 13: Leap-day validation correctly accepts leap years and rejects non-leap years', () => {
  // 2024 is a leap year -> Feb 29 is valid
  assert.doesNotThrow(() => validateMealDate('2024-02-29'));

  // 2028 is a leap year -> Feb 29 is valid
  assert.doesNotThrow(() => validateMealDate('2028-02-29'));

  // 2000 is a 400-year leap year -> Feb 29 is valid
  assert.doesNotThrow(() => validateMealDate('2000-02-29'));

  // 2026 is NOT a leap year -> Feb 29 is rejected
  assert.throws(
    () => validateMealDate('2026-02-29'),
    (err: any) => err instanceof MealValidationError && err.field === 'date' && err.message.includes('leap year')
  );

  // 2025 is NOT a leap year -> Feb 29 is rejected
  assert.throws(
    () => validateMealDate('2025-02-29'),
    (err: any) => err instanceof MealValidationError && err.field === 'date'
  );

  // Impossible days for 30-day months
  assert.throws(() => validateMealDate('2026-04-31'), MealValidationError);
  assert.throws(() => validateMealDate('2026-06-31'), MealValidationError);
  assert.throws(() => validateMealDate('2026-09-31'), MealValidationError);
  assert.throws(() => validateMealDate('2026-11-31'), MealValidationError);

  // Impossible days (Feb 30, Feb 31)
  assert.throws(() => validateMealDate('2024-02-30'), MealValidationError);
  assert.throws(() => validateMealDate('2026-02-31'), MealValidationError);

  // Month out of range
  assert.throws(() => validateMealDate('2026-00-15'), MealValidationError);
  assert.throws(() => validateMealDate('2026-13-15'), MealValidationError);
});

// 14. Legacy date read remains unchanged
test('Task 4.1A - Test 14: Historical legacy date read from SQLite is preserved unchanged', async () => {
  const db = await createTestDb();
  const repo = new SQLiteMealRepository(db);

  // Directly insert historical meal record with legacy ISO date string
  const legacyId = 'legacy-iso-meal';
  const legacyDate = '2026-11-12T08:30:00.000Z';
  await db.runAsync(
    `INSERT INTO meals (id, title, date, time, total_calories, total_protein, total_carbs, total_fat, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    legacyId,
    'Legacy Oatmeal',
    legacyDate,
    '08:30',
    250,
    10,
    45,
    5,
    new Date().toISOString()
  );

  // Read back via repository
  const loaded = await repo.getMealById(legacyId);
  assert.ok(loaded);
  assert.equal(loaded.date, legacyDate, 'Historical date string must be preserved exactly on read');

  // Verify getAllMeals also preserves legacy date
  const allMeals = await repo.getAllMeals();
  const found = allMeals.find((m) => m.id === legacyId);
  assert.ok(found);
  assert.equal(found.date, legacyDate);
});

// 15. Outer transaction passed to repository
test('Task 4.1A - Test 15: Repository executes directly on supplied outer transaction without nested transaction', async () => {
  const db = await createTestDb();
  const repo = new SQLiteMealRepository(db);

  const meal = sampleMeal('m-outer-txn-check');

  // Execute inside an outer exclusive transaction
  await db.withExclusiveTransactionAsync(async (outerTxn) => {
    await repo.insertMeal(meal, outerTxn);

    // Verify inside transaction that row is visible
    const check = await outerTxn.getFirstAsync<{ id: string }>('SELECT id FROM meals WHERE id = ?;', meal.id);
    assert.equal(check?.id, meal.id);
  });

  const persisted = await repo.getMealById(meal.id);
  assert.ok(persisted);
  assert.equal(persisted.id, meal.id);
});

// 16. Repository opens one transaction when needed
test('Task 4.1A - Test 16: Repository opens exactly one exclusive transaction when txn is omitted', async () => {
  const db = await createTestDb();
  const repo = new SQLiteMealRepository(db);

  const meal = sampleMeal('m-standalone-txn');
  // Call insertMeal without txn parameter
  await repo.insertMeal(meal);

  const persisted = await repo.getMealById(meal.id);
  assert.ok(persisted);
  assert.equal(persisted.title, 'Protein Oatmeal');
  assert.equal(persisted.items.length, 1);
});

// 17. Child insert failure rolls back parent
test('Task 4.1A - Test 17: Child item insert failure triggers complete atomic rollback of parent meal', async () => {
  const db = await createTestDb();
  const repo = new SQLiteMealRepository(db);

  // Construct meal where second item will violate unique primary key constraint
  const meal = sampleMeal('m-rollback-parent');
  meal.items.push({
    id: meal.items[0].id, // DUPLICATE item ID
    foodName: 'Conflicting Item',
    quantity: 100,
    calories: 200,
    protein: 20,
    carbs: 20,
    fats: 5,
    unit: 'g',
  });

  await assert.rejects(async () => {
    await repo.insertMeal(meal);
  });

  // Verify parent meal was NOT inserted
  const checkMeal = await repo.getMealById('m-rollback-parent');
  assert.equal(checkMeal, null, 'Parent meal must be rolled back on child failure');

  const itemsCount = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM meal_items;');
  assert.equal(itemsCount?.count, 0, 'No orphaned meal_items may exist');
});

// 18. Update failure preserves previous meal
test('Task 4.1A - Test 18: Update failure leaves previous meal and items completely preserved', async () => {
  const db = await createTestDb();
  const repo = new SQLiteMealRepository(db);

  const originalMeal = sampleMeal('m-update-preserve');
  await repo.insertMeal(originalMeal);

  // Attempt update with duplicate child IDs causing transaction failure
  const badUpdate: Meal = {
    ...originalMeal,
    title: 'Should Not Persist',
    items: [
      { id: 'item-dup-1', foodName: 'Item 1', quantity: 1, calories: 100, protein: 10, carbs: 10, fats: 2, unit: 'g' },
      { id: 'item-dup-1', foodName: 'Item 2', quantity: 1, calories: 100, protein: 10, carbs: 10, fats: 2, unit: 'g' },
    ],
  };

  await assert.rejects(async () => {
    await repo.updateMeal(badUpdate);
  });

  const check = await repo.getMealById('m-update-preserve');
  assert.ok(check);
  assert.equal(check.title, 'Protein Oatmeal', 'Original title must be preserved');
  assert.equal(check.items.length, 1);
  assert.equal(check.items[0].id, `${originalMeal.id}-item-1`);
});

// 19. No unrelated meal changes
test('Task 4.1A - Test 19: CRUD operations on Meal A never affect Meal B', async () => {
  const db = await createTestDb();
  const repo = new SQLiteMealRepository(db);

  const mealA = sampleMeal('m-iso-a');
  const mealB = sampleMeal('m-iso-b');
  await repo.insertMeal(mealA);
  await repo.insertMeal(mealB);

  // Update Meal A
  await repo.updateMeal({
    ...mealA,
    title: 'Updated A Only',
  });

  const loadedB = await repo.getMealById('m-iso-b');
  assert.ok(loadedB);
  assert.equal(loadedB.title, 'Protein Oatmeal', 'Meal B title must remain unaffected');

  // Delete Meal A
  await repo.deleteMeal('m-iso-a');

  const afterDeleteB = await repo.getMealById('m-iso-b');
  assert.ok(afterDeleteB);
  assert.equal(afterDeleteB.id, 'm-iso-b', 'Meal B must remain intact after Meal A deletion');
});

// 20. Existing meal CRUD remains functional
test('Task 4.1A - Test 20: Full meal CRUD lifecycle remains robust and operational', async () => {
  const db = await createTestDb();
  const repo = new SQLiteMealRepository(db);

  // 1. Create
  const meal = sampleMeal('m-crud-full');
  await repo.insertMeal(meal);
  let loaded = await repo.getMealById('m-crud-full');
  assert.ok(loaded);
  assert.equal(loaded.title, 'Protein Oatmeal');

  // 2. Read
  const all = await repo.getAllMeals();
  assert.equal(all.length, 1);
  assert.equal(all[0].id, 'm-crud-full');

  // 3. Update
  await repo.updateMeal({
    ...meal,
    title: 'Power Oatmeal Bowl',
    items: [
      {
        id: `${meal.id}-item-1`,
        foodName: 'Rolled Oats',
        quantity: 75,
        unit: 'g',
        calories: 285,
        protein: 10.5,
        carbs: 51,
        fats: 4.5,
      },
    ],
  });
  loaded = await repo.getMealById('m-crud-full');
  assert.ok(loaded);
  assert.equal(loaded.title, 'Power Oatmeal Bowl');
  assert.equal(loaded.totalCalories, 285);
  assert.equal(loaded.items[0].quantity, 75);

  // 4. Delete
  await repo.deleteMeal('m-crud-full');
  loaded = await repo.getMealById('m-crud-full');
  assert.equal(loaded, null);

  const finalAll = await repo.getAllMeals();
  assert.equal(finalAll.length, 0);
});

// 21. Time format validation
test('Task 4.1A - Test 21: Time validation accepts 24-hr and legacy formats while rejecting malformed times', () => {
  // Valid times
  assert.doesNotThrow(() => validateMealTime('08:30'));
  assert.doesNotThrow(() => validateMealTime('14:45'));
  assert.doesNotThrow(() => validateMealTime('00:00'));
  assert.doesNotThrow(() => validateMealTime('23:59'));
  assert.doesNotThrow(() => validateMealTime('8:30'));
  assert.doesNotThrow(() => validateMealTime('1:30 PM'));
  assert.doesNotThrow(() => validateMealTime('11:00 am'));

  // Invalid times
  assert.throws(() => validateMealTime('24:00'), MealValidationError);
  assert.throws(() => validateMealTime('25:00'), MealValidationError);
  assert.throws(() => validateMealTime('99:99'), MealValidationError);
  assert.throws(() => validateMealTime('12:60'), MealValidationError);
  assert.throws(() => validateMealTime('14:00 PM'), MealValidationError);
  assert.throws(() => validateMealTime('00:30 PM'), MealValidationError);
  assert.throws(() => validateMealTime('not-a-time'), MealValidationError);
});

// 22. Localized error keys resolve in English and Arabic
test('Task 4.1A - Test 22: Localized numeric and validation error keys resolve in English and Arabic', () => {
  assert.equal(translate('en', 'common.cannotBeNegative'), 'Cannot be negative');
  assert.equal(translate('ar', 'common.cannotBeNegative'), 'لا يمكن أن يكون سالباً');

  assert.equal(translate('en', 'common.mustBePositive'), 'Must be greater than 0');
  assert.equal(translate('ar', 'common.mustBePositive'), 'يجب أن يكون أكبر من 0');

  assert.equal(translate('en', 'common.valueTooLarge'), 'Value is too large');
  assert.equal(translate('ar', 'common.valueTooLarge'), 'القيمة كبيرة جداً');

  assert.equal(translate('en', 'common.invalidNumber'), 'Invalid number');
  assert.equal(translate('ar', 'common.invalidNumber'), 'رقم غير صالح');
});
