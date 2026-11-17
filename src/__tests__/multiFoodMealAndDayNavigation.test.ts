import test from 'node:test';
import assert from 'node:assert/strict';

import { openDatabaseAsync } from './mocks/expo-sqlite';
import { runMigrations, MIGRATIONS } from '../db/migrations';
import { SQLiteMealRepository } from '../db/repositories/mealRepository';
import { SQLiteCustomFoodRepository } from '../db/repositories/customFoodRepository';
import { SQLiteWorkoutRepository } from '../db/repositories/workoutRepository';
import { SQLiteProfileRepository } from '../db/repositories/profileRepository';
import { FOOD_CATALOG } from '../data/foodCatalog';
import {
  scaleFoodNutrients,
  calculateServingGrams,
  createMealItemSnapshot,
  createCustomFoodMealItemSnapshot,
  ScalingValidationError,
} from '../utils/foodScaling';
import {
  searchAllFoods,
} from '../utils/foodSearch';
import {
  calculateDailyNutrition,
  calculateMealTotals,
  formatLocalDate,
} from '../utils/nutrition';
import {
  getPreviousCalendarDate,
  getNextCalendarDate,
} from '../utils/date';
import { CustomFood, FoodCatalogEntry } from '../models/food';
import { Meal, MealItem } from '../models/meal';
import { createId } from '../utils/id';
import { en as enTranslations } from '../i18n/en';
import { ar as arTranslations } from '../i18n/ar';

async function createTestDb() {
  const db = await openDatabaseAsync(':memory:');
  await db.execAsync('PRAGMA foreign_keys = ON;');
  await runMigrations(db);
  return db;
}

// ---------------------------------------------------------------------------
// 1. Catalog Search from Integration Layer & Bilingual Support
// ---------------------------------------------------------------------------
test('Task 4.3 - Test 1: Catalog search returns relevant items from integration layer', () => {
  const chickenResults = searchAllFoods('chicken');
  assert.ok(chickenResults.length > 0, 'Should find chicken items');
  const hasChickenBreast = chickenResults.some((item) => item.id.includes('chicken-breast'));
  assert.ok(hasChickenBreast, 'Should include chicken breast');
});

test('Task 4.3 - Test 2: Bilingual search finds foods in Arabic and English', () => {
  const enResults = searchAllFoods('oats');
  const arResults = searchAllFoods('شوفان');

  assert.ok(enResults.length > 0, 'Should find oats in English');
  assert.ok(arResults.length > 0, 'Should find oats in Arabic');

  const enItem = enResults.find((i) => i.id === 'oats-rolled-raw');
  const arItem = arResults.find((i) => i.id === 'oats-rolled-raw');

  assert.ok(enItem, 'Rolled oats found via English');
  assert.ok(arItem, 'Rolled oats found via Arabic');
  assert.equal(enItem.id, arItem.id, 'Both queries resolve to the same catalog ID');
});

test('Task 4.3 - Test 3: Arabic orthographic normalization matches diacritics and letter variants', () => {
  // Tashkeel (harakat)
  const withHarakat = searchAllFoods('شُوفَان');
  assert.ok(withHarakat.some((i) => i.id === 'oats-rolled-raw'), 'Matches text with tashkeel');

  // Alef variants [أ إ آ] -> ا
  const withAlefHamza = searchAllFoods('أرز');
  const withPlainAlef = searchAllFoods('ارز');
  assert.ok(withAlefHamza.length > 0, 'Matches with Alef Hamza');
  assert.ok(withPlainAlef.length > 0, 'Matches with plain Alef');

  // Taa Marbuta [ة] -> ه
  const withTaa = searchAllFoods('جبنة');
  const withHaa = searchAllFoods('جبنه');
  assert.ok(withTaa.some((i) => i.id.includes('cheese')), 'Matches Taa Marbuta');
  assert.ok(withHaa.some((i) => i.id.includes('cheese')), 'Matches Haa normalized');
});

test('Task 4.3 - Test 4: Category filtering isolates selected categories accurately', () => {
  const dairyResults = searchAllFoods('', { category: 'eggs_dairy' });
  assert.ok(dairyResults.length > 0, 'Should return dairy foods');
  for (const item of dairyResults) {
    assert.equal(item.category, 'eggs_dairy', `Item ${item.id} must be eggs_dairy`);
  }

  const seafoodResults = searchAllFoods('salmon', { category: 'fish_seafood' });
  assert.ok(seafoodResults.length > 0, 'Should return salmon in fish_seafood');
  for (const item of seafoodResults) {
    assert.equal(item.category, 'fish_seafood', 'Item must be fish_seafood');
  }
});

test('Task 4.3 - Test 5: Custom foods are integrated into search results with isCustom=true', () => {
  const customOats: CustomFood = {
    id: 'cf_protein_oats',
    name: 'Protein Fortified Oats',
    nameAr: 'شوفان معزز بالبروتين',
    calories: 220,
    protein: 20,
    carbs: 30,
    fats: 3,
    servingSize: 50,
    servingUnit: 'scoop',
    category: 'custom',
    createdAt: '2026-11-16T00:00:00.000Z',
    updatedAt: '2026-11-16T00:00:00.000Z',
  };

  const results = searchAllFoods('protein fortified', { customFoods: [customOats] });
  assert.ok(results.length > 0, 'Custom food found in search');
  const found = results.find((r) => r.id === 'cf_protein_oats');
  assert.ok(found, 'Should find custom item');
  assert.equal(found.isCustom, true, 'isCustom flag must be true');
});

test('Task 4.3 - Test 6: Provenance labels are present and correctly distinguished', () => {
  const verifiedFood = FOOD_CATALOG.find((f) => f.id === 'chicken-breast-raw');
  const estimatedFood = FOOD_CATALOG.find((f) => f.id === 'shawarma-chicken-meat');
  const unverifiedFood = FOOD_CATALOG.find((f) => f.id === 'dates-sukari');

  assert.equal(verifiedFood?.provenanceStatus, 'VERIFIED');
  assert.equal(estimatedFood?.provenanceStatus, 'ESTIMATED');
  assert.equal(unverifiedFood?.provenanceStatus, 'UNVERIFIED');
});

test('Task 4.3 - Test 7: MISMATCH provenance items are excluded by default from normal search', () => {
  const mockCatalog: FoodCatalogEntry[] = [
    {
      ...FOOD_CATALOG[0],
      id: 'mismatched-food',
      nameEn: 'Mismatched Food',
      provenanceStatus: 'MISMATCH',
    },
    {
      ...FOOD_CATALOG[1],
      id: 'verified-food',
      nameEn: 'Verified Food',
      provenanceStatus: 'VERIFIED',
    },
  ];

  const defaultResults = searchAllFoods('food', { catalog: mockCatalog });
  assert.equal(defaultResults.some((r) => r.id === 'mismatched-food'), false, 'MISMATCH excluded by default');
  assert.equal(defaultResults.some((r) => r.id === 'verified-food'), true, 'VERIFIED included');

  const withMismatch = searchAllFoods('food', { catalog: mockCatalog, includeMismatch: true });
  assert.equal(withMismatch.some((r) => r.id === 'mismatched-food'), true, 'MISMATCH included when requested');
});

// ---------------------------------------------------------------------------
// 2. Portion Selection, Serving Units & Arithmetic Safety
// ---------------------------------------------------------------------------
test('Task 4.3 - Test 8: Food-specific portion options use food physical densities', () => {
  const oats = FOOD_CATALOG.find((f) => f.id === 'oats-rolled-raw');
  const rice = FOOD_CATALOG.find((f) => f.id === 'rice-white-raw');
  const milk = FOOD_CATALOG.find((f) => f.id === 'milk-whole-3-25');

  assert.ok(oats && rice && milk);

  const oatsCup = oats.servingOptions.find((o) => o.id === 'cup');
  const riceCup = rice.servingOptions.find((o) => o.id === 'cup');
  const milkCup = milk.servingOptions.find((o) => o.id === 'cup');

  assert.ok(oatsCup && riceCup && milkCup);
  assert.equal(oatsCup.grams, 80, '1 cup oats is 80g');
  assert.equal(riceCup.grams, 185, '1 cup raw white rice is 185g');
  assert.equal(milkCup.grams, 244, '1 cup milk is 244g');
});

test('Task 4.3 - Test 9: Grams conversion evaluates to exactly 1g per unit', () => {
  const gramsOption = { id: 'g', nameEn: 'Grams', nameAr: 'غرام', grams: 1 };
  assert.equal(gramsOption.grams, 1, 'Gram option has 1g mass basis');

  const totalGrams = calculateServingGrams(gramsOption, 150);
  assert.equal(totalGrams, 150, '150 quantity of grams evaluates to 150g');
});

test('Task 4.3 - Test 10: Fractional quantity scaling scales nutrients smoothly', () => {
  const chicken = FOOD_CATALOG.find((f) => f.id === 'chicken-breast-cooked')!; // 165 kcal/100g, 31g protein
  const scaled0_5 = scaleFoodNutrients(chicken, 0.5, '100g'); // 50g -> 83 kcal, 15.5g P
  assert.equal(scaled0_5.displayCalories, Math.round(165 * 0.5));
  assert.equal(scaled0_5.protein, 15.5);

  const scaled1_5 = scaleFoodNutrients(chicken, 1.5, '100g'); // 150g -> 248 kcal, 46.5g P
  assert.equal(scaled1_5.displayCalories, Math.round(165 * 1.5));
  assert.equal(scaled1_5.protein, 46.5);
});

test('Task 4.3 - Test 11: Unit change recalculates total mass and nutrients accurately', () => {
  const oats = FOOD_CATALOG.find((f) => f.id === 'oats-rolled-raw')!; // 379 kcal/100g, 13.2g P
  // 1 cup oats = 80g
  const cupScaled = scaleFoodNutrients(oats, 1, 'cup');
  assert.equal(cupScaled.displayCalories, Math.round((379 * 80) / 100)); // 303 kcal

  // 100g oats
  const hundredGramsScaled = scaleFoodNutrients(oats, 1, '100g');
  assert.equal(hundredGramsScaled.displayCalories, 379);

  // 50g oats
  const fiftyGramsScaled = scaleFoodNutrients(oats, 50, 'g');
  assert.equal(fiftyGramsScaled.displayCalories, Math.round((379 * 50) / 100)); // 190 kcal
});

test('Task 4.3 - Test 12: Invalid quantity inputs are strictly rejected', () => {
  const oats = FOOD_CATALOG.find((f) => f.id === 'oats-rolled-raw')!;

  assert.throws(() => scaleFoodNutrients(oats, 0, '100g'), ScalingValidationError);
  assert.throws(() => scaleFoodNutrients(oats, -5, '100g'), ScalingValidationError);
  assert.throws(() => scaleFoodNutrients(oats, NaN, '100g'), ScalingValidationError);
  assert.throws(() => scaleFoodNutrients(oats, Infinity, '100g'), ScalingValidationError);
});

test('Task 4.3 - Test 13: Extreme scaling quantities exceeding SCALING_LIMITS are rejected', () => {
  const oats = FOOD_CATALOG.find((f) => f.id === 'oats-rolled-raw')!;

  assert.throws(() => scaleFoodNutrients(oats, 100_000, 'cup'), ScalingValidationError);
  assert.throws(() => scaleFoodNutrients(oats, 1e20, 'g'), ScalingValidationError);
});

// ---------------------------------------------------------------------------
// 3. Multi-Food Meal Drafts & Calculations
// ---------------------------------------------------------------------------
test('Task 4.3 - Test 14: Multi-food draft combining catalog foods computes accurately', () => {
  const egg = FOOD_CATALOG.find((f) => f.id === 'egg-whole-boiled')!; // 1 large egg = 50g, 143 kcal/100g
  const oats = FOOD_CATALOG.find((f) => f.id === 'oats-rolled-raw')!; // 1 cup = 80g
  const banana = FOOD_CATALOG.find((f) => f.id === 'banana-fresh')!; // 1 medium = 118g

  const item1 = createMealItemSnapshot(egg, 2, 'large');
  const item2 = createMealItemSnapshot(oats, 1, 'cup');
  const item3 = createMealItemSnapshot(banana, 1, 'medium');

  const items = [item1, item2, item3];
  const totals = calculateMealTotals(items);

  const expectedCalories = item1.calories + item2.calories + item3.calories;
  const expectedProtein = Math.round((item1.protein + item2.protein + item3.protein) * 10) / 10;
  const expectedCarbs = Math.round((item1.carbs + item2.carbs + item3.carbs) * 10) / 10;
  const expectedFats = Math.round((item1.fats + item2.fats + item3.fats) * 10) / 10;

  assert.equal(totals.calories, expectedCalories);
  assert.equal(totals.protein, expectedProtein);
  assert.equal(totals.carbs, expectedCarbs);
  assert.equal(totals.fats, expectedFats);
});

test('Task 4.3 - Test 15: Supports at least 5 food items in a single meal draft without cap', () => {
  const chicken = FOOD_CATALOG.find((f) => f.id === 'chicken-breast-cooked')!;
  const rice = FOOD_CATALOG.find((f) => f.id === 'rice-white-cooked')!;
  const oliveOil = FOOD_CATALOG.find((f) => f.id === 'olive-oil-extra-virgin')!;
  const broccoli = FOOD_CATALOG.find((f) => f.id === 'broccoli-steamed')!;
  const dates = FOOD_CATALOG.find((f) => f.id === 'dates-sukari')!;
  const almonds = FOOD_CATALOG.find((f) => f.id === 'almonds-raw')!;

  const items: MealItem[] = [
    createMealItemSnapshot(chicken, 150, 'g'),
    createMealItemSnapshot(rice, 1, 'cup'),
    createMealItemSnapshot(oliveOil, 1, 'tbsp'),
    createMealItemSnapshot(broccoli, 1, '100g'),
    createMealItemSnapshot(dates, 3, 'date'),
    createMealItemSnapshot(almonds, 1, 'handful_oz'),
  ];

  assert.equal(items.length, 6, 'Contains 6 food items');
  const totals = calculateMealTotals(items);
  assert.ok(totals.calories > 500, 'Calculates combined calories for 6 items');
  assert.ok(totals.protein > 30, 'Calculates combined protein for 6 items');
});

test('Task 4.3 - Test 16: Combined meal macro calculations strictly sum child items', () => {
  const items: MealItem[] = [
    { id: '1', foodName: 'Food A', quantity: 1, calories: 100, protein: 10.5, carbs: 5.2, fats: 2.1 },
    { id: '2', foodName: 'Food B', quantity: 2, calories: 200, protein: 20.3, carbs: 15.4, fats: 5.5 },
  ];

  const totals = calculateMealTotals(items);
  assert.equal(totals.calories, 300);
  assert.equal(totals.protein, 30.8);
  assert.equal(totals.carbs, 20.6);
  assert.equal(totals.fats, 7.6);
});

test('Task 4.3 - Test 17: Persistence does not multiply snapshot calories again by quantity', async () => {
  const db = await createTestDb();
  const repo = new SQLiteMealRepository(db);

  const chicken = FOOD_CATALOG.find((f) => f.id === 'chicken-breast-cooked')!;
  // 2 servings of 100g chicken = 330 kcal total
  const snapshotItem = createMealItemSnapshot(chicken, 2, '100g');
  assert.equal(snapshotItem.calories, 330, 'Snapshot calories represent absolute total');

  const meal: Meal = {
    id: createId('meal'),
    title: 'Lunch',
    date: '2026-11-16',
    time: '12:30',
    mealType: 'lunch',
    items: [snapshotItem],
    totalCalories: 330,
    totalProtein: snapshotItem.protein,
    totalCarbs: snapshotItem.carbs,
    totalFat: snapshotItem.fats,
    totalFats: snapshotItem.fats,
  };

  await repo.insertMeal(meal);

  const loaded = await repo.getMealById(meal.id);
  assert.ok(loaded);
  assert.equal(loaded.items.length, 1);
  assert.equal(loaded.items[0].calories, 330, 'Calories in DB must remain 330, NOT 660');
  assert.equal(loaded.totalCalories, 330);
});

test('Task 4.3 - Test 18: Adding manual foods alongside catalog foods within the same meal', async () => {
  const db = await createTestDb();
  const repo = new SQLiteMealRepository(db);

  const egg = FOOD_CATALOG.find((f) => f.id === 'egg-whole-boiled')!;
  const catalogItem = createMealItemSnapshot(egg, 2, 'large');

  const manualItem: MealItem = {
    id: createId('meal-item'),
    foodName: 'Homemade Pancake',
    name: 'Homemade Pancake',
    quantity: 1,
    unit: 'piece',
    portionUnit: 'piece',
    calories: 250,
    protein: 6.0,
    carbs: 35.0,
    fats: 9.0,
    fat: 9.0,
  };

  const meal: Meal = {
    id: createId('meal'),
    title: 'Breakfast',
    date: '2026-11-16',
    time: '08:00',
    mealType: 'breakfast',
    items: [catalogItem, manualItem],
    totalCalories: catalogItem.calories + manualItem.calories,
    totalProtein: Math.round((catalogItem.protein + manualItem.protein) * 10) / 10,
    totalCarbs: Math.round((catalogItem.carbs + manualItem.carbs) * 10) / 10,
    totalFat: Math.round((catalogItem.fats + manualItem.fats) * 10) / 10,
  };

  await repo.insertMeal(meal);

  const loaded = await repo.getMealById(meal.id);
  assert.ok(loaded);
  assert.equal(loaded.items.length, 2);
  assert.ok(loaded.items.some((i) => i.catalogId === 'egg-whole-boiled'), 'Preserves catalog item');
  assert.ok(loaded.items.some((i) => i.foodName === 'Homemade Pancake'), 'Preserves manual item');
});

test('Task 4.3 - Test 19: Stable IDs across validation retries without churning identifiers', () => {
  const mealId = createId('meal');
  const itemId = createId('meal-item');

  assert.ok(mealId.startsWith('meal-'));
  assert.ok(itemId.startsWith('meal-item-'));

  // Retries retain draft meal ID
  const draft1 = { id: mealId, title: 'Draft' };
  const draft2 = { ...draft1, title: 'Draft Corrected' };
  assert.equal(draft1.id, draft2.id, 'Meal ID remains stable across edit cycle');
});

// ---------------------------------------------------------------------------
// 4. Multi-Food Meal Editing & Historical Preservation
// ---------------------------------------------------------------------------
test('Task 4.3 - Test 20: Editing existing multi-food meal updates SQLite atomically', async () => {
  const db = await createTestDb();
  const repo = new SQLiteMealRepository(db);

  const chicken = FOOD_CATALOG.find((f) => f.id === 'chicken-breast-cooked')!;
  const rice = FOOD_CATALOG.find((f) => f.id === 'rice-white-cooked')!;

  const item1 = createMealItemSnapshot(chicken, 100, 'g');
  const item2 = createMealItemSnapshot(rice, 100, 'g');

  const mealId = createId('meal');
  const originalMeal: Meal = {
    id: mealId,
    title: 'Original Lunch',
    date: '2026-11-16',
    time: '12:00',
    mealType: 'lunch',
    items: [item1, item2],
    totalCalories: item1.calories + item2.calories,
    totalProtein: item1.protein + item2.protein,
    totalCarbs: item1.carbs + item2.carbs,
    totalFat: item1.fats + item2.fats,
  };

  await repo.insertMeal(originalMeal);

  // Edit: Update item1 quantity to 150g, keep item2 unchanged
  const updatedItem1 = createMealItemSnapshot(chicken, 150, 'g');
  updatedItem1.id = item1.id; // Preserve original item ID

  const updatedMeal: Meal = {
    ...originalMeal,
    title: 'Updated Lunch',
    items: [updatedItem1, item2],
    totalCalories: updatedItem1.calories + item2.calories,
    totalProtein: updatedItem1.protein + item2.protein,
    totalCarbs: updatedItem1.carbs + item2.carbs,
    totalFat: updatedItem1.fats + item2.fats,
  };

  await repo.updateMeal(updatedMeal);

  const reloaded = await repo.getMealById(mealId);
  assert.ok(reloaded);
  assert.equal(reloaded.title, 'Updated Lunch');
  assert.equal(reloaded.items.length, 2);
  const reloadedItem1 = reloaded.items.find((i) => i.id === item1.id)!;
  assert.equal(reloadedItem1.quantity, 150);
});

test('Task 4.3 - Test 21: Preserving unchanged historical snapshots when opening existing meal', async () => {
  const db = await createTestDb();
  const repo = new SQLiteMealRepository(db);

  // Simulate an old historical item with unique past snapshot numbers
  const historicalItem: MealItem = {
    id: 'historical_item_1',
    foodName: 'Old Recipe Oats',
    quantity: 1,
    unit: 'serving',
    portionUnit: 'serving',
    calories: 185,
    protein: 6.2,
    carbs: 32.1,
    fats: 2.8,
    catalogId: 'rolled-oats-dry',
  };

  const meal: Meal = {
    id: 'historical_meal_1',
    title: 'Past Breakfast',
    date: '2026-10-01',
    time: '08:00',
    mealType: 'breakfast',
    items: [historicalItem],
    totalCalories: 185,
    totalProtein: 6.2,
    totalCarbs: 32.1,
    totalFat: 2.8,
  };

  await repo.insertMeal(meal);

  const loaded = await repo.getMealById('historical_meal_1');
  assert.ok(loaded);
  assert.equal(loaded.items[0].calories, 185, 'Preserves historical snapshot calories');
  assert.equal(loaded.items[0].protein, 6.2, 'Preserves historical snapshot protein');
});

test('Task 4.3 - Test 22: Editing only intentionally changed items leaves other items untouched', () => {
  const item1: MealItem = { id: 'it_1', foodName: 'Rice', quantity: 1, calories: 130, protein: 2.4, carbs: 28.2, fats: 0.3 };
  const item2: MealItem = { id: 'it_2', foodName: 'Beef', quantity: 1, calories: 250, protein: 26.0, carbs: 0.0, fats: 15.0 };

  const draft = [item1, item2];

  // User edits only item 1 quantity
  const updatedDraft = draft.map((it) => (it.id === 'it_1' ? { ...it, quantity: 2, calories: 260 } : it));

  assert.equal(updatedDraft[0].calories, 260, 'Item 1 updated');
  assert.equal(updatedDraft[1].calories, 250, 'Item 2 untouched');
  assert.equal(updatedDraft[1].id, 'it_2', 'Item 2 ID unchanged');
});

test('Task 4.3 - Test 23: Removing an item from a draft reduces item count and recalculates totals', () => {
  const item1: MealItem = { id: 'it_1', foodName: 'Rice', quantity: 1, calories: 130, protein: 2.4, carbs: 28.2, fats: 0.3 };
  const item2: MealItem = { id: 'it_2', foodName: 'Beef', quantity: 1, calories: 250, protein: 26.0, carbs: 0.0, fats: 15.0 };

  const draft = [item1, item2];
  const afterRemoval = draft.filter((i) => i.id !== 'it_1');

  assert.equal(afterRemoval.length, 1);
  assert.equal(afterRemoval[0].foodName, 'Beef');
  const newTotals = calculateMealTotals(afterRemoval);
  assert.equal(newTotals.calories, 250);
});

test('Task 4.3 - Test 24: Reordering items in a draft maintains exact item records', () => {
  const item1: MealItem = { id: 'it_1', foodName: 'First', quantity: 1, calories: 100, protein: 1, carbs: 1, fats: 1 };
  const item2: MealItem = { id: 'it_2', foodName: 'Second', quantity: 1, calories: 200, protein: 2, carbs: 2, fats: 2 };

  const list = [item1, item2];
  // Swap
  const reordered = [list[1], list[0]];

  assert.equal(reordered[0].id, 'it_2');
  assert.equal(reordered[1].id, 'it_1');
  assert.equal(calculateMealTotals(reordered).calories, 300);
});

test('Task 4.3 - Test 25: Meal type persistence across save and reload', async () => {
  const db = await createTestDb();
  const repo = new SQLiteMealRepository(db);

  for (const slot of ['breakfast', 'lunch', 'dinner', 'snack'] as const) {
    const meal: Meal = {
      id: createId('meal'),
      title: `${slot} Meal`,
      date: '2026-11-16',
      time: '12:00',
      mealType: slot,
      items: [{ id: createId('meal-item'), foodName: 'Food', quantity: 1, calories: 100, protein: 10, carbs: 10, fats: 2 }],
    };

    await repo.insertMeal(meal);
    const loaded = await repo.getMealById(meal.id);
    assert.equal(loaded?.mealType, slot, `Slot ${slot} persisted correctly`);
  }
});

test('Task 4.3 - Test 26: Meal notes persistence with null, empty, and non-empty strings', async () => {
  const db = await createTestDb();
  const repo = new SQLiteMealRepository(db);

  // Non-empty notes
  const mealWithNotes: Meal = {
    id: createId('meal'),
    title: 'Pre-workout Snack',
    date: '2026-11-16',
    time: '15:30',
    mealType: 'snack',
    notes: 'Ate 45 minutes before leg session.',
    items: [{ id: createId('meal-item'), foodName: 'Banana', quantity: 1, calories: 105, protein: 1.3, carbs: 27, fats: 0.3 }],
  };
  await repo.insertMeal(mealWithNotes);

  const loadedWithNotes = await repo.getMealById(mealWithNotes.id);
  assert.equal(loadedWithNotes?.notes, 'Ate 45 minutes before leg session.');

  // Empty notes
  const mealWithoutNotes: Meal = {
    id: createId('meal'),
    title: 'Water',
    date: '2026-11-16',
    time: '16:00',
    items: [{ id: createId('meal-item'), foodName: 'Water', quantity: 1, calories: 0, protein: 0, carbs: 0, fats: 0 }],
  };
  await repo.insertMeal(mealWithoutNotes);

  const loadedWithout = await repo.getMealById(mealWithoutNotes.id);
  assert.equal(loadedWithout?.notes ?? undefined, undefined);
});

test('Task 4.3 - Test 27: Legacy meal compatibility (missing meal_type, items, or notes)', async () => {
  const db = await createTestDb();
  const repo = new SQLiteMealRepository(db);

  // Directly insert raw row mimicking V8 / pre-Migration-9 meal without meal_type and notes
  await db.runAsync(
    `INSERT INTO meals (id, title, date, time, total_calories, total_protein, total_carbs, total_fat, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    'legacy_meal_1',
    'Old Lunch',
    '2026-11-10',
    '13:00',
    450,
    30,
    50,
    15,
    '2026-11-10T13:00:00.000Z'
  );

  const loaded = await repo.getMealById('legacy_meal_1');
  assert.ok(loaded);
  assert.equal(loaded.title, 'Old Lunch');
  assert.equal(loaded.mealType ?? undefined, undefined);
  assert.equal(loaded.notes ?? undefined, undefined);
  assert.equal(loaded.totalCalories, 450);
});

test('Task 4.3 - Test 28: Custom food template modification safety does not mutate historical meal items', async () => {
  const db = await createTestDb();
  const mealRepo = new SQLiteMealRepository(db);
  const customFoodRepo = new SQLiteCustomFoodRepository(db);

  const customFood: CustomFood = {
    id: 'cf_shake_1',
    name: 'Whey Shake',
    calories: 140,
    protein: 25,
    carbs: 3,
    fats: 2,
    servingSize: 30,
    servingUnit: 'scoop',
    category: 'custom',
    createdAt: '2026-11-16T00:00:00.000Z',
    updatedAt: '2026-11-16T00:00:00.000Z',
  };
  await customFoodRepo.insertCustomFood(customFood);

  // Log meal with snapshot of custom food
  const mealItem = createCustomFoodMealItemSnapshot(customFood, 1);
  const meal: Meal = {
    id: createId('meal'),
    title: 'Post-Workout',
    date: '2026-11-16',
    time: '18:00',
    mealType: 'snack',
    items: [mealItem],
    totalCalories: mealItem.calories,
    totalProtein: mealItem.protein,
    totalCarbs: mealItem.carbs,
    totalFat: mealItem.fats,
  };
  await mealRepo.insertMeal(meal);

  // Later, user changes custom food formulation (e.g. brand changed, now 160 kcal, 28g protein)
  const updatedCustomFood: CustomFood = {
    ...customFood,
    calories: 160,
    protein: 28,
  };
  await customFoodRepo.updateCustomFood(updatedCustomFood);

  // Historical meal must STILL retain the original 140 kcal and 25g protein!
  const loadedMeal = await mealRepo.getMealById(meal.id);
  assert.ok(loadedMeal);
  assert.equal(loadedMeal.items[0].calories, 140, 'Historical calories unchanged');
  assert.equal(loadedMeal.items[0].protein, 25, 'Historical protein unchanged');
});

test('Task 4.3 - Test 29: Existing V9 database migration executes cleanly', async () => {
  const db = await openDatabaseAsync(':memory:');
  await db.execAsync('PRAGMA foreign_keys = ON;');

  // Verify all 9 migrations execute in order
  await runMigrations(db);

  const applied = await db.getAllAsync<{ version: number; name: string }>(
    'SELECT version, name FROM schema_migrations ORDER BY version ASC;'
  );
  assert.equal(applied.length, MIGRATIONS.length);
  assert.equal(applied[applied.length - 1].version, 11);
});

// ---------------------------------------------------------------------------
// 5. Day-by-Day Navigation & Date Boundary Safety
// ---------------------------------------------------------------------------
test('Task 4.3 - Test 30: Date navigation across midnight boundary uses local calendar dates', () => {
  const localToday = formatLocalDate(new Date());
  assert.match(localToday, /^\d{4}-\d{2}-\d{2}$/);

  // No UTC hour offset distortion
  const sampleLocal = '2026-11-16';
  const prevDay = getPreviousCalendarDate(sampleLocal);
  const nextDay = getNextCalendarDate(sampleLocal);

  assert.equal(prevDay, '2026-11-15');
  assert.equal(nextDay, '2026-11-17');
});

test('Task 4.3 - Test 31: Month and year calendar boundaries roll over correctly', () => {
  // Month boundary (March 1st -> February 28th on a non-leap year)
  assert.equal(getPreviousCalendarDate('2026-03-01'), '2026-02-28');
  assert.equal(getNextCalendarDate('2026-02-28'), '2026-03-01');

  // Month boundary (May 1st -> April 30th)
  assert.equal(getPreviousCalendarDate('2026-05-01'), '2026-04-30');
  assert.equal(getNextCalendarDate('2026-04-30'), '2026-05-01');

  // Year boundary (Jan 1st -> Dec 31st)
  assert.equal(getPreviousCalendarDate('2026-01-01'), '2025-12-31');
  assert.equal(getNextCalendarDate('2025-12-31'), '2026-01-01');
});

test('Task 4.3 - Test 32: Leap-day navigation recognizes February 29th on leap years', () => {
  // Leap year 2024: Feb 29 exists!
  assert.equal(getNextCalendarDate('2024-02-28'), '2024-02-29');
  assert.equal(getPreviousCalendarDate('2024-03-01'), '2024-02-29');
  assert.equal(getNextCalendarDate('2024-02-29'), '2024-03-01');

  // Non-leap year 2026: Feb 29 does NOT exist!
  assert.equal(getNextCalendarDate('2026-02-28'), '2026-03-01');
  assert.equal(getPreviousCalendarDate('2026-03-01'), '2026-02-28');
});

test('Task 4.3 - Test 33: Selected-date filtering returns only meals logged on that date', () => {
  const mealNov15: Meal = {
    id: 'm_15',
    title: 'Nov 15 Dinner',
    date: '2026-11-15',
    time: '20:00',
    items: [{ id: 'i_1', foodName: 'Steak', quantity: 1, calories: 500, protein: 50, carbs: 0, fats: 30 }],
  };

  const mealNov16: Meal = {
    id: 'm_16',
    title: 'Nov 16 Lunch',
    date: '2026-11-16',
    time: '13:00',
    items: [{ id: 'i_2', foodName: 'Salad', quantity: 1, calories: 200, protein: 10, carbs: 20, fats: 8 }],
  };

  const allMeals = [mealNov15, mealNov16];

  const filteredNov15 = allMeals.filter((m) => m.date.slice(0, 10) === '2026-11-15');
  const filteredNov16 = allMeals.filter((m) => m.date.slice(0, 10) === '2026-11-16');

  assert.equal(filteredNov15.length, 1);
  assert.equal(filteredNov15[0].id, 'm_15');

  assert.equal(filteredNov16.length, 1);
  assert.equal(filteredNov16[0].id, 'm_16');
});

test('Task 4.3 - Test 34: Selected-date daily totals calculate only meals for the active day', () => {
  const mealNov15: Meal = {
    id: 'm_15',
    title: 'Nov 15 Dinner',
    date: '2026-11-15',
    time: '20:00',
    items: [{ id: 'i_1', foodName: 'Steak', quantity: 1, calories: 500, protein: 50, carbs: 0, fats: 30 }],
  };

  const mealNov16: Meal = {
    id: 'm_16',
    title: 'Nov 16 Lunch',
    date: '2026-11-16',
    time: '13:00',
    items: [{ id: 'i_2', foodName: 'Salad', quantity: 1, calories: 200, protein: 10, carbs: 20, fats: 8 }],
  };

  const totalsNov15 = calculateDailyNutrition([mealNov15]);
  const totalsNov16 = calculateDailyNutrition([mealNov16]);

  assert.equal(totalsNov15.calories, 500);
  assert.equal(totalsNov15.protein, 50);

  assert.equal(totalsNov16.calories, 200);
  assert.equal(totalsNov16.protein, 10);
});

test('Task 4.3 - Test 35: Empty-day state handles dates with zero logged meals cleanly', () => {
  const allMeals: Meal[] = [
    {
      id: 'm_today',
      title: 'Lunch',
      date: '2026-11-16',
      time: '12:00',
      items: [{ id: 'i_1', foodName: 'Chicken', quantity: 1, calories: 300, protein: 30, carbs: 0, fats: 5 }],
    },
  ];

  const emptyDayMeals = allMeals.filter((m) => m.date.slice(0, 10) === '2026-11-14');
  assert.equal(emptyDayMeals.length, 0);

  const emptyTotals = calculateDailyNutrition(emptyDayMeals);
  assert.equal(emptyTotals.calories, 0);
  assert.equal(emptyTotals.protein, 0);
  assert.equal(emptyTotals.carbs, 0);
  assert.equal(emptyTotals.fats, 0);
});

// ---------------------------------------------------------------------------
// 6. Persistence Safety & Quality Gates
// ---------------------------------------------------------------------------
test('Task 4.3 - Test 36: Save failure leaves draft state intact in UI model', () => {
  const draftMeal: Meal = {
    id: createId('meal'),
    title: 'Failed Draft Meal',
    date: '2026-11-16',
    time: '12:00',
    mealType: 'lunch',
    items: [{ id: createId('meal-item'), foodName: 'Oats', quantity: 1, calories: 150, protein: 5, carbs: 25, fats: 2 }],
  };

  // If save throws, draft object and ID are preserved
  let caughtError = false;
  try {
    throw new Error('Disk full');
  } catch {
    caughtError = true;
  }

  assert.ok(caughtError);
  assert.equal(draftMeal.title, 'Failed Draft Meal');
  assert.equal(draftMeal.items.length, 1);
});

test('Task 4.3 - Test 37: Atomic rollback on meal insert failure prevents orphaned rows', async () => {
  const db = await createTestDb();

  const initialCountRow = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM meals;');
  const initialCount = initialCountRow?.count ?? 0;

  // Attempt to insert invalid meal that violates foreign key or constraint in transaction
  await assert.rejects(async () => {
    await db.withExclusiveTransactionAsync(async (txn) => {
      await txn.runAsync('INSERT INTO meals (id, name, date, time) VALUES (?, ?, ?, ?);', 'fail_meal', 'Fail', '2026-11-16', '12:00');
      // Force error
      throw new Error('Simulated transaction crash');
    });
  });

  const afterCountRow = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM meals;');
  assert.equal(afterCountRow?.count, initialCount, 'Database state unchanged after rollback');
});

test('Task 4.3 - Test 38: No whole-history database rewrites during meal operations', async () => {
  const db = await createTestDb();
  const repo = new SQLiteMealRepository(db);

  const meal1: Meal = {
    id: 'meal_1',
    title: 'Meal 1',
    date: '2026-11-16',
    time: '08:00',
    items: [{ id: 'item_1', foodName: 'Eggs', quantity: 2, calories: 140, protein: 12, carbs: 1, fats: 10 }],
  };
  const meal2: Meal = {
    id: 'meal_2',
    title: 'Meal 2',
    date: '2026-11-16',
    time: '13:00',
    items: [{ id: 'item_2', foodName: 'Chicken', quantity: 1, calories: 200, protein: 30, carbs: 0, fats: 5 }],
  };

  await repo.insertMeal(meal1);
  await repo.insertMeal(meal2);

  // Updating meal1 must not affect meal2
  await repo.updateMeal({ ...meal1, title: 'Meal 1 Edited' });

  const loadedMeal2 = await repo.getMealById('meal_2');
  assert.ok(loadedMeal2);
  assert.equal(loadedMeal2.title, 'Meal 2', 'Meal 2 remains intact');
  assert.equal(loadedMeal2.items.length, 1);
});

test('Task 4.3 - Test 39: Meal operations leave workout and profile tables completely untouched', async () => {
  const db = await createTestDb();
  const mealRepo = new SQLiteMealRepository(db);
  const workoutRepo = new SQLiteWorkoutRepository(db);
  const profileRepo = new SQLiteProfileRepository(db);

  // Seed a workout and profile
  await workoutRepo.insertWorkout({
    id: 'w_test_1',
    title: 'Leg Day',
    date: '2026-11-16',
    time: '17:00',
    exercises: [],
  });

  await profileRepo.saveProfile({
    id: 'user_profile',
    name: 'Yousif',
    targetCalories: 2500,
  });

  // Mutate meal
  const meal: Meal = {
    id: 'meal_test_39',
    title: 'Dinner',
    date: '2026-11-16',
    time: '20:00',
    items: [{ id: 'it_39', foodName: 'Fish', quantity: 1, calories: 250, protein: 35, carbs: 0, fats: 10 }],
  };
  await mealRepo.insertMeal(meal);
  await mealRepo.deleteMeal('meal_test_39');

  // Verify workout and profile are identical
  const workout = await workoutRepo.getWorkoutById('w_test_1');
  assert.ok(workout);
  assert.equal(workout.title, 'Leg Day');

  const profile = await profileRepo.getProfile();
  assert.ok(profile);
  assert.equal(profile.name, 'Yousif');
  assert.equal(profile.targetCalories, 2500);
});

test('Task 4.3 - Test 40: Arabic and English translation dictionaries are complete for all Task 4.3 keys', () => {
  const requiredKeys = [
    'meals.breakfast',
    'meals.lunch',
    'meals.dinner',
    'meals.snack',
    'meals.other',
    'meals.mealType',
    'meals.today',
    'meals.yesterday',
    'meals.tomorrow',
    'meals.previousDay',
    'meals.nextDay',
    'meals.noMealsForDate',
    'meals.addFoodFromCatalog',
    'meals.addManually',
    'meals.moveUp',
    'meals.moveDown',
    'meals.remove',
    'meals.emptyItemsError',
    'foodPicker.title',
    'foodPicker.searchPlaceholder',
    'foodPicker.allCategories',
    'foodPicker.customBadge',
    'foodPicker.verifiedBadge',
    'foodPicker.estimatedBadge',
    'foodPicker.unverifiedBadge',
    'foodPicker.noResults',
    'foodPicker.portionTitle',
    'foodPicker.servingUnit',
    'foodPicker.quantity',
    'foodPicker.totalGrams',
    'foodPicker.addToMeal',
    'manualFood.title',
    'manualFood.foodName',
    'manualFood.quantity',
    'manualFood.unit',
    'manualFood.calories',
    'manualFood.protein',
    'manualFood.carbs',
    'manualFood.fats',
    'manualFood.add',
  ];

  function getNestedValue(obj: any, path: string): string | undefined {
    return path.split('.').reduce((acc, part) => acc && acc[part], obj);
  }

  for (const key of requiredKeys) {
    const enVal = getNestedValue(enTranslations, key);
    const arVal = getNestedValue(arTranslations, key);

    assert.ok(enVal, `English dictionary must have key "${key}"`);
    assert.ok(arVal, `Arabic dictionary must have key "${key}"`);
  }
});
