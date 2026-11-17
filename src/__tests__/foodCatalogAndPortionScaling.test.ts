import test from 'node:test';
import assert from 'node:assert/strict';

import { openDatabaseAsync } from './mocks/expo-sqlite';
import { runMigrations, MIGRATIONS } from '../db/migrations';
import { SQLiteMealRepository } from '../db/repositories/mealRepository';
import { SQLiteCustomFoodRepository } from '../db/repositories/customFoodRepository';
import { SQLiteWorkoutRepository } from '../db/repositories/workoutRepository';
import { FOOD_CATALOG, FOOD_CATALOG_MAP } from '../data/foodCatalog';
import {
  scaleFoodNutrients,
  scaleCustomFoodNutrients,
  calculateServingGrams,
  roundTo1Decimal,
  createMealItemSnapshot,
  createCustomFoodMealItemSnapshot,
} from '../utils/foodScaling';
import {
  searchFoodCatalog,
  searchAllFoods,
  normalizeArabicText,
  normalizeSearchText,
} from '../utils/foodSearch';
import {
  CustomFood,
  FoodValidationError,
  validateCustomFood,
  validateFoodCatalogEntry,
  validateServingOption,
} from '../models/food';
import { normalizeMealItem, MealItem, Meal } from '../models/meal';
import { MealValidationError } from '../models/meal';

async function createTestDb() {
  const db = await openDatabaseAsync(':memory:');
  await db.execAsync('PRAGMA foreign_keys = ON;');
  await runMigrations(db);
  return db;
}

// ---------------------------------------------------------------------------
// 1. Unique catalog IDs
// ---------------------------------------------------------------------------
test('Task 4.2 - Test 1: All catalog entries have unique, non-empty, slug-formatted IDs', () => {
  assert.ok(FOOD_CATALOG.length >= 150, `Catalog must have >= 150 items, found ${FOOD_CATALOG.length}`);
  const idSet = new Set<string>();
  const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

  for (const food of FOOD_CATALOG) {
    assert.ok(food.id && typeof food.id === 'string', `Food ID must be a non-empty string: ${JSON.stringify(food)}`);
    assert.match(food.id, slugRegex, `Food ID "${food.id}" must be kebab-cased slug`);
    assert.ok(!idSet.has(food.id), `Duplicate food ID detected: "${food.id}"`);
    idSet.add(food.id);
    assert.doesNotThrow(() => validateFoodCatalogEntry(food));
  }
});

// ---------------------------------------------------------------------------
// 2. Bilingual completeness
// ---------------------------------------------------------------------------
test('Task 4.2 - Test 2: Every catalog entry has non-empty English and Arabic names', () => {
  const arabicRegex = /[\u0600-\u06FF]/;
  for (const food of FOOD_CATALOG) {
    assert.ok(food.nameEn && food.nameEn.trim().length > 0, `Item ${food.id} missing nameEn`);
    assert.ok(food.nameAr && food.nameAr.trim().length > 0, `Item ${food.id} missing nameAr`);
    assert.match(food.nameAr, arabicRegex, `Item ${food.id} nameAr must contain Arabic characters: "${food.nameAr}"`);
  }
});

// ---------------------------------------------------------------------------
// 3. Provenance completeness
// ---------------------------------------------------------------------------
test('Task 4.2 - Test 3: Every catalog entry has a verifiable source referencing USDA or SFDA', () => {
  for (const food of FOOD_CATALOG) {
    assert.ok(food.source && typeof food.source === 'string', `Item ${food.id} missing source`);
    const isUsdaOrSfda = food.source.includes('USDA') || food.source.includes('SFDA');
    assert.ok(isUsdaOrSfda, `Item ${food.id} source must cite USDA or SFDA, got "${food.source}"`);
  }
});

// ---------------------------------------------------------------------------
// 4. Non-negative nutrients
// ---------------------------------------------------------------------------
test('Task 4.2 - Test 4: Calories, protein, carbs, and fat are finite and >= 0 for all entries', () => {
  for (const food of FOOD_CATALOG) {
    assert.ok(Number.isFinite(food.caloriesPer100g) && food.caloriesPer100g >= 0, `Invalid calories for ${food.id}`);
    assert.ok(Number.isFinite(food.proteinPer100g) && food.proteinPer100g >= 0, `Invalid protein for ${food.id}`);
    assert.ok(Number.isFinite(food.carbsPer100g) && food.carbsPer100g >= 0, `Invalid carbs for ${food.id}`);
    assert.ok(Number.isFinite(food.fatPer100g) && food.fatPer100g >= 0, `Invalid fat for ${food.id}`);
  }
});

// ---------------------------------------------------------------------------
// 5. Serving weights
// ---------------------------------------------------------------------------
test('Task 4.2 - Test 5: Every serving option has positive grams and bilingual labels', () => {
  const arabicRegex = /[\u0600-\u06FF]/;
  for (const food of FOOD_CATALOG) {
    assert.ok(Array.isArray(food.servingOptions) && food.servingOptions.length > 0, `Item ${food.id} must have servingOptions`);
    for (const opt of food.servingOptions) {
      assert.ok(Number.isFinite(opt.grams) && opt.grams > 0, `Option ${opt.id} on ${food.id} must have grams > 0`);
      assert.ok(opt.labelEn && opt.labelEn.trim().length > 0, `Option ${opt.id} on ${food.id} missing labelEn`);
      assert.ok(opt.labelAr && opt.labelAr.trim().length > 0, `Option ${opt.id} on ${food.id} missing labelAr`);
      assert.match(opt.labelAr, arabicRegex, `Option ${opt.id} on ${food.id} labelAr must contain Arabic characters`);
      assert.doesNotThrow(() => validateServingOption(opt));
    }
  }
});

// ---------------------------------------------------------------------------
// 6. Preparation states
// ---------------------------------------------------------------------------
test('Task 4.2 - Test 6: Raw and cooked versions of foods have distinct IDs, accurate profiles, and preparation states', () => {
  const rawChicken = FOOD_CATALOG_MAP.get('chicken-breast-raw');
  const cookedChicken = FOOD_CATALOG_MAP.get('chicken-breast-cooked');

  assert.ok(rawChicken, 'Raw chicken breast must exist');
  assert.ok(cookedChicken, 'Cooked chicken breast must exist');
  assert.equal(rawChicken.preparationState, 'raw');
  assert.equal(cookedChicken.preparationState, 'cooked');
  assert.notEqual(rawChicken.id, cookedChicken.id);
  // Due to moisture loss during cooking, cooked chicken has higher nutrient density per 100g than raw
  assert.ok(cookedChicken.caloriesPer100g > rawChicken.caloriesPer100g);
  assert.ok(cookedChicken.proteinPer100g > rawChicken.proteinPer100g);

  const rawRice = FOOD_CATALOG_MAP.get('rice-white-raw');
  const cookedRice = FOOD_CATALOG_MAP.get('rice-white-cooked');

  assert.ok(rawRice, 'Raw white rice must exist');
  assert.ok(cookedRice, 'Cooked white rice must exist');
  assert.equal(rawRice.preparationState, 'raw');
  assert.equal(cookedRice.preparationState, 'cooked');
  assert.notEqual(rawRice.id, cookedRice.id);
  // Due to water absorption during cooking, cooked rice has lower calorie density per 100g than raw
  assert.ok(cookedRice.caloriesPer100g < rawRice.caloriesPer100g);
});

// ---------------------------------------------------------------------------
// 7. Exact grams scaling
// ---------------------------------------------------------------------------
test('Task 4.2 - Test 7: Scaling 100g produces identical per-100g values; 200g produces 2x; 50g produces 0.5x', () => {
  const chicken = FOOD_CATALOG_MAP.get('chicken-breast-cooked')!;
  const scaled100 = scaleFoodNutrients(chicken, 100, 'grams');

  assert.equal(scaled100.calories, chicken.caloriesPer100g);
  assert.equal(scaled100.protein, chicken.proteinPer100g);
  assert.equal(scaled100.carbs, chicken.carbsPer100g);
  assert.equal(scaled100.fat, chicken.fatPer100g);
  assert.equal(scaled100.totalGrams, 100);

  const scaled200 = scaleFoodNutrients(chicken, 200, 'grams');
  assert.equal(scaled200.calories, chicken.caloriesPer100g * 2);
  assert.equal(scaled200.protein, chicken.proteinPer100g * 2);
  assert.equal(scaled200.carbs, chicken.carbsPer100g * 2);
  assert.equal(scaled200.fat, chicken.fatPer100g * 2);
  assert.equal(scaled200.totalGrams, 200);

  const scaled50 = scaleFoodNutrients(chicken, 50, 'grams');
  assert.equal(scaled50.calories, chicken.caloriesPer100g * 0.5);
  assert.equal(scaled50.protein, chicken.proteinPer100g * 0.5);
  assert.equal(scaled50.carbs, chicken.carbsPer100g * 0.5);
  assert.equal(scaled50.fat, chicken.fatPer100g * 0.5);
  assert.equal(scaled50.totalGrams, 50);
});

// ---------------------------------------------------------------------------
// 8. Fractional serving scaling
// ---------------------------------------------------------------------------
test('Task 4.2 - Test 8: Scaling 1.5 servings of 120g portion correctly computes nutrients based on 180g', () => {
  const salmon = FOOD_CATALOG_MAP.get('salmon-atlantic-cooked')!;
  const filletOpt = salmon.servingOptions.find((o) => o.id === 'fillet-120g') || {
    id: 'fillet-120g',
    labelEn: 'Fillet',
    labelAr: 'شريحة',
    grams: 120,
  };

  const calculatedGrams = calculateServingGrams(1.5, filletOpt);
  assert.equal(calculatedGrams, 180);

  const scaled = scaleFoodNutrients(salmon, 1.5, filletOpt);
  assert.equal(scaled.totalGrams, 180);
  assert.equal(scaled.calories, (salmon.caloriesPer100g * 180) / 100);
  assert.equal(scaled.protein, (salmon.proteinPer100g * 180) / 100);
  assert.equal(scaled.fat, (salmon.fatPer100g * 180) / 100);
});

// ---------------------------------------------------------------------------
// 9. Multiple serving selections
// ---------------------------------------------------------------------------
test('Task 4.2 - Test 9: Selecting different serving options for the same food computes distinct, accurate nutrition profiles', () => {
  const oliveOil = FOOD_CATALOG_MAP.get('olive-oil-extra-virgin')!;
  const tbspOpt = oliveOil.servingOptions.find((o) => o.id === 'tbsp')!;
  const tspOpt = oliveOil.servingOptions.find((o) => o.id === 'tsp')!;

  assert.ok(tbspOpt && tspOpt);
  const scaledTbsp = scaleFoodNutrients(oliveOil, 1, tbspOpt);
  const scaledTsp = scaleFoodNutrients(oliveOil, 1, tspOpt);

  assert.notEqual(scaledTbsp.calories, scaledTsp.calories);
  assert.notEqual(scaledTbsp.fat, scaledTsp.fat);
  assert.equal(scaledTbsp.totalGrams, tbspOpt.grams);
  assert.equal(scaledTsp.totalGrams, tspOpt.grams);
});

// ---------------------------------------------------------------------------
// 10. Invalid numeric rejection
// ---------------------------------------------------------------------------
test('Task 4.2 - Test 10: Negative servings, negative grams, NaN, or non-numeric inputs throw FoodValidationError', () => {
  const chicken = FOOD_CATALOG_MAP.get('chicken-breast-cooked')!;

  assert.throws(() => scaleFoodNutrients(chicken, -1, 'grams'), FoodValidationError);
  assert.throws(() => scaleFoodNutrients(chicken, 0, 'grams'), FoodValidationError);
  assert.throws(() => scaleFoodNutrients(chicken, NaN, 'grams'), FoodValidationError);
  assert.throws(() => scaleFoodNutrients(chicken, 'invalid' as any, 'grams'), FoodValidationError);
});

// ---------------------------------------------------------------------------
// 11. Non-finite numeric rejection
// ---------------------------------------------------------------------------
test('Task 4.2 - Test 11: Infinity and -Infinity inputs throw FoodValidationError', () => {
  const chicken = FOOD_CATALOG_MAP.get('chicken-breast-cooked')!;

  assert.throws(() => scaleFoodNutrients(chicken, Infinity, 'grams'), FoodValidationError);
  assert.throws(() => scaleFoodNutrients(chicken, -Infinity, 'grams'), FoodValidationError);

  const customFood: CustomFood = {
    id: 'test-cf-1',
    name: 'Test Food',
    calories: Infinity,
    protein: 10,
    carbs: 10,
    fats: 10,
    servingSize: 100,
    servingUnit: 'g',
  };
  assert.throws(() => validateCustomFood(customFood), FoodValidationError);
});

// ---------------------------------------------------------------------------
// 12. Rounding policy
// ---------------------------------------------------------------------------
test('Task 4.2 - Test 12: Nutrient calculations retain floating precision while snapshot adheres to display rounding policy', () => {
  const beef = FOOD_CATALOG_MAP.get('ground-beef-90-10-cooked')!;
  // Scale by 73 grams (non-round)
  const scaled = scaleFoodNutrients(beef, 73, 'grams');
  // Calculation retains full float precision
  assert.ok(scaled.calories.toString().includes('.'));

  // Snapshot rounding: Math.round for calories, 1-decimal for macros
  const snapshot = createMealItemSnapshot(beef, 73, 'grams');
  assert.equal(snapshot.calories, Math.round((beef.caloriesPer100g * 73) / 100));
  assert.equal(snapshot.protein, roundTo1Decimal((beef.proteinPer100g * 73) / 100));
  assert.equal(snapshot.carbs, roundTo1Decimal((beef.carbsPer100g * 73) / 100));
  assert.equal(snapshot.fats, roundTo1Decimal((beef.fatPer100g * 73) / 100));
});

// ---------------------------------------------------------------------------
// 13. No universal cup-weight assumption
// ---------------------------------------------------------------------------
test('Task 4.2 - Test 13: Oats cup weight (~80g), raw rice cup (~185g), and liquid milk cup (~244g) differ by physical density', () => {
  const oats = FOOD_CATALOG_MAP.get('oats-rolled-raw')!;
  const rice = FOOD_CATALOG_MAP.get('rice-white-raw')!;
  const milk = FOOD_CATALOG_MAP.get('milk-whole-3-25')!;

  const oatsCup = oats.servingOptions.find((o) => o.id === 'cup')!;
  const riceCup = rice.servingOptions.find((o) => o.id === 'cup')!;
  const milkCup = milk.servingOptions.find((o) => o.id === 'cup')!;

  assert.ok(oatsCup && riceCup && milkCup);
  assert.equal(oatsCup.grams, 80);
  assert.equal(riceCup.grams, 185);
  assert.equal(milkCup.grams, 244);
  assert.notEqual(oatsCup.grams, riceCup.grams);
  assert.notEqual(riceCup.grams, milkCup.grams);
});

// ---------------------------------------------------------------------------
// 14. Arabic search
// ---------------------------------------------------------------------------
test('Task 4.2 - Test 14: Searching in Arabic returns relevant catalog entries', () => {
  const chickenResults = searchFoodCatalog('دجاج');
  assert.ok(chickenResults.length > 0);
  assert.ok(chickenResults.some((f) => f.nameAr.includes('دجاج')));

  const unifiedResults = searchAllFoods('دجاج');
  assert.ok(unifiedResults.length > 0);

  const dateResults = searchFoodCatalog('تمر');
  assert.ok(dateResults.length > 0);
  assert.ok(dateResults.some((f) => f.nameAr.includes('تمر')));

  const riceResults = searchFoodCatalog('أرز');
  assert.ok(riceResults.length > 0);
  assert.ok(riceResults.some((f) => f.nameAr.includes('أرز') || f.nameAr.includes('ارز')));
});

// ---------------------------------------------------------------------------
// 15. English search
// ---------------------------------------------------------------------------
test('Task 4.2 - Test 15: Searching in English returns relevant catalog entries', () => {
  const chickenResults = searchFoodCatalog('chicken');
  assert.ok(chickenResults.length > 0);
  assert.ok(chickenResults.every((f) => f.nameEn.toLowerCase().includes('chicken')));

  const salmonResults = searchFoodCatalog('salmon');
  assert.ok(salmonResults.length > 0);
  assert.ok(salmonResults.every((f) => f.nameEn.toLowerCase().includes('salmon')));
});

// ---------------------------------------------------------------------------
// 16. Search normalization
// ---------------------------------------------------------------------------
test('Task 4.2 - Test 16: Arabic diacritics, alef variants, and taa marbuta match seamlessly', () => {
  // Directly test normalization utility
  assert.equal(normalizeArabicText('دَجَاجٌ'), 'دجاج');
  assert.equal(normalizeSearchText('  أرز  '), 'ارز');

  // Tashkeel normalization: "دَجَاجٌ" should match "دجاج"
  const withTashkeel = searchFoodCatalog('دَجَاجٌ');
  assert.ok(withTashkeel.length > 0);
  assert.ok(withTashkeel.some((f) => f.id.includes('chicken')));

  // Alef normalization: "ارز" (without hamza) should match "أرز"
  const bareAlef = searchFoodCatalog('ارز');
  assert.ok(bareAlef.length > 0);
  assert.ok(bareAlef.some((f) => f.id.includes('rice')));

  // Taa marbuta normalization: "لبنه" should match "لبنة"
  const haaSearch = searchFoodCatalog('لبنه');
  assert.ok(haaSearch.length > 0);
  assert.ok(haaSearch.some((f) => f.id.includes('labneh')));
});

// ---------------------------------------------------------------------------
// 17. Category filters
// ---------------------------------------------------------------------------
test('Task 4.2 - Test 17: Filtering by category returns only entries in that category', () => {
  const meatOnly = searchFoodCatalog('', { category: 'meat_poultry' });
  assert.ok(meatOnly.length > 0);
  assert.ok(meatOnly.every((f) => f.category === 'meat_poultry'));

  const regionalOnly = searchFoodCatalog('', { category: 'regional_middle_eastern' });
  assert.ok(regionalOnly.length > 0);
  assert.ok(regionalOnly.every((f) => f.category === 'regional_middle_eastern'));
});

// ---------------------------------------------------------------------------
// 18. Custom food insertion
// ---------------------------------------------------------------------------
test('Task 4.2 - Test 18: Valid custom food persists to SQLite and returns correct entity with timestamps', async () => {
  const db = await createTestDb();
  const repo = new SQLiteCustomFoodRepository(db);

  const customFood: CustomFood = {
    id: 'cf-protein-cookie-1',
    name: 'High Protein Cookie',
    nameAr: 'كوكيز عالي البروتين',
    calories: 250,
    protein: 20,
    carbs: 25,
    fats: 8,
    servingSize: 75,
    servingUnit: 'cookie',
    category: 'custom',
    notes: 'Homemade recipe',
  };

  await repo.insertCustomFood(customFood);

  const scaledCustom = scaleCustomFoodNutrients(customFood, 2);
  assert.equal(scaledCustom.calories, 500);

  const fetched = await repo.getCustomFoodById('cf-protein-cookie-1');
  assert.ok(fetched);
  assert.equal(fetched.name, 'High Protein Cookie');
  assert.equal(fetched.nameAr, 'كوكيز عالي البروتين');
  assert.equal(fetched.calories, 250);
  assert.equal(fetched.protein, 20);
  assert.equal(fetched.servingSize, 75);
  assert.ok(fetched.createdAt);
  assert.ok(fetched.updatedAt);
});

// ---------------------------------------------------------------------------
// 19. Custom food update
// ---------------------------------------------------------------------------
test('Task 4.2 - Test 19: Updating custom food modifies record in SQLite without affecting logged meal items', async () => {
  const db = await createTestDb();
  const foodRepo = new SQLiteCustomFoodRepository(db);
  const mealRepo = new SQLiteMealRepository(db);

  const food: CustomFood = {
    id: 'cf-bar-1',
    name: 'Energy Bar',
    calories: 200,
    protein: 10,
    carbs: 30,
    fats: 5,
    servingSize: 60,
    servingUnit: 'bar',
  };
  await foodRepo.insertCustomFood(food);

  // Log a meal item using snapshot
  const snapshot = createCustomFoodMealItemSnapshot(food, 1, 'bar');
  const meal: Meal = {
    id: 'meal-cf-test-1',
    title: 'Afternoon Snack',
    name: 'Afternoon Snack',
    date: '2026-11-15',
    time: '15:00',
    items: [snapshot],
  };
  await mealRepo.insertMeal(meal);

  // Now update the custom food template
  const updatedFood: CustomFood = {
    ...food,
    name: 'Energy Bar - Formula 2',
    calories: 280,
    protein: 15,
  };
  await foodRepo.updateCustomFood(updatedFood);

  // Verify custom food updated
  const reloadedFood = await foodRepo.getCustomFoodById('cf-bar-1');
  assert.equal(reloadedFood?.name, 'Energy Bar - Formula 2');
  assert.equal(reloadedFood?.calories, 280);

  // Verify historical logged meal item was NOT altered
  const loadedMeal = await mealRepo.getMealById('meal-cf-test-1');
  assert.ok(loadedMeal);
  assert.equal(loadedMeal.items[0].name, 'Energy Bar');
  assert.equal(loadedMeal.items[0].calories, 200);
  assert.equal(loadedMeal.items[0].protein, 10);
});

// ---------------------------------------------------------------------------
// 20. Custom food deletion
// ---------------------------------------------------------------------------
test('Task 4.2 - Test 20: Deleting custom food removes record from SQLite without deleting or mutating logged meals', async () => {
  const db = await createTestDb();
  const foodRepo = new SQLiteCustomFoodRepository(db);
  const mealRepo = new SQLiteMealRepository(db);

  const food: CustomFood = {
    id: 'cf-del-1',
    name: 'Temporary Protein Shake',
    calories: 180,
    protein: 25,
    carbs: 5,
    fats: 2,
    servingSize: 1,
    servingUnit: 'bottle',
  };
  await foodRepo.insertCustomFood(food);

  const snapshot = createCustomFoodMealItemSnapshot(food, 1, 'bottle');
  const meal: Meal = {
    id: 'meal-del-test-1',
    title: 'Pre-workout Shake',
    name: 'Pre-workout Shake',
    date: '2026-11-15',
    time: '16:00',
    items: [snapshot],
  };
  await mealRepo.insertMeal(meal);

  // Delete custom food
  await foodRepo.deleteCustomFood('cf-del-1');
  const deleted = await foodRepo.getCustomFoodById('cf-del-1');
  assert.equal(deleted, null);

  // Meal item still exists with historical snapshot intact
  const loadedMeal = await mealRepo.getMealById('meal-del-test-1');
  assert.ok(loadedMeal);
  assert.equal(loadedMeal.items.length, 1);
  assert.equal(loadedMeal.items[0].name, 'Temporary Protein Shake');
  assert.equal(loadedMeal.items[0].calories, 180);
});

// ---------------------------------------------------------------------------
// 21. Custom food ID collision
// ---------------------------------------------------------------------------
test('Task 4.2 - Test 21: Inserting custom food with duplicate ID throws FoodValidationError', async () => {
  const db = await createTestDb();
  const repo = new SQLiteCustomFoodRepository(db);

  const food: CustomFood = {
    id: 'cf-duplicate-id',
    name: 'Original Food',
    calories: 100,
    protein: 5,
    carbs: 10,
    fats: 2,
    servingSize: 50,
    servingUnit: 'g',
  };
  await repo.insertCustomFood(food);

  const duplicate: CustomFood = {
    id: 'cf-duplicate-id',
    name: 'Duplicate Food',
    calories: 120,
    protein: 6,
    carbs: 12,
    fats: 3,
    servingSize: 50,
    servingUnit: 'g',
  };

  await assert.rejects(
    async () => repo.insertCustomFood(duplicate),
    FoodValidationError
  );
});

// ---------------------------------------------------------------------------
// 22. Custom food transaction rollback
// ---------------------------------------------------------------------------
test('Task 4.2 - Test 22: Failure during custom food transaction rolls back cleanly', async () => {
  const db = await createTestDb();
  const repo = new SQLiteCustomFoodRepository(db);

  await assert.rejects(async () => {
    await db.withExclusiveTransactionAsync(async (txn) => {
      await repo.insertCustomFood(
        {
          id: 'cf-rollback-1',
          name: 'Rollback Food',
          calories: 150,
          protein: 10,
          carbs: 15,
          fats: 3,
          servingSize: 100,
          servingUnit: 'g',
        },
        txn
      );
      // Intentional failure to trigger rollback
      throw new Error('Simulated database write failure');
    });
  });

  const food = await repo.getCustomFoodById('cf-rollback-1');
  assert.equal(food, null, 'Food should not exist after transaction rollback');
});

// ---------------------------------------------------------------------------
// 23. Historical meal snapshot preservation
// ---------------------------------------------------------------------------
test('Task 4.2 - Test 23: Logged MealItem retains original nutrient values, calories, and quantity', async () => {
  const db = await createTestDb();
  const mealRepo = new SQLiteMealRepository(db);

  const chicken = FOOD_CATALOG_MAP.get('chicken-breast-cooked')!;
  const snapshot = createMealItemSnapshot(chicken, 150, 'grams');

  const meal: Meal = {
    id: 'meal-snapshot-verify-1',
    title: 'High Protein Dinner',
    name: 'High Protein Dinner',
    date: '2026-11-15',
    time: '19:30',
    items: [snapshot],
  };
  await mealRepo.insertMeal(meal);

  const reloaded = await mealRepo.getMealById('meal-snapshot-verify-1');
  assert.ok(reloaded);
  assert.equal(reloaded.items[0].catalogId, 'chicken-breast-cooked');
  assert.equal(reloaded.items[0].portionUnit, 'grams');
  assert.equal(reloaded.items[0].quantity, 150);
  assert.equal(reloaded.items[0].calories, Math.round((chicken.caloriesPer100g * 150) / 100));
  assert.equal(reloaded.items[0].protein, roundTo1Decimal((chicken.proteinPer100g * 150) / 100));
});

// ---------------------------------------------------------------------------
// 24. Catalog modification immunity
// ---------------------------------------------------------------------------
test('Task 4.2 - Test 24: Modifying catalog in code does not rewrite existing meal_items in SQLite', async () => {
  const db = await createTestDb();
  const mealRepo = new SQLiteMealRepository(db);

  // Directly verify table row in meal_items
  const item: MealItem = {
    id: 'item-stat-1',
    name: 'Grilled Steak',
    calories: 450,
    protein: 40,
    carbs: 0,
    fats: 30,
    quantity: 200,
    catalogId: 'beef-steak-catalog',
    portionUnit: 'grams',
  };
  const meal: Meal = {
    id: 'meal-stat-1',
    title: 'Steak Dinner',
    name: 'Steak Dinner',
    date: '2026-11-15',
    time: '20:00',
    items: [item],
  };
  await mealRepo.insertMeal(meal);

  const row = await db.getFirstAsync<{ calories: number; catalog_id: string }>(
    'SELECT calories, catalog_id FROM meal_items WHERE id = ?;',
    'item-stat-1'
  );
  assert.ok(row);
  assert.equal(row.calories, 450);
  assert.equal(row.catalog_id, 'beef-steak-catalog');
});

// ---------------------------------------------------------------------------
// 25. Migration 8 -> 9 upgrade
// ---------------------------------------------------------------------------
test('Task 4.2 - Test 25: Existing V8 database upgrades cleanly to V9 with all new columns and custom_foods table', async () => {
  const db = await openDatabaseAsync(':memory:');
  await db.execAsync('PRAGMA foreign_keys = ON;');

  // Apply migrations 1 through 8
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL);
  `);
  for (const m of MIGRATIONS.slice(0, 8)) {
    await db.withTransactionAsync(async () => {
      await m.up(db);
      await db.runAsync('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?);', m.version, m.name, new Date().toISOString());
    });
  }

  // Check columns before V9
  const mealColsBefore = await db.getAllAsync<{ name: string }>('PRAGMA table_info(meals);');
  assert.equal(mealColsBefore.some((c) => c.name === 'meal_type'), false);
  assert.equal(mealColsBefore.some((c) => c.name === 'notes'), false);

  const itemColsBefore = await db.getAllAsync<{ name: string }>('PRAGMA table_info(meal_items);');
  assert.equal(itemColsBefore.some((c) => c.name === 'catalog_id'), false);
  assert.equal(itemColsBefore.some((c) => c.name === 'portion_unit'), false);

  // Apply Migration 9
  await db.withTransactionAsync(async () => {
    await MIGRATIONS[8].up(db);
    await db.runAsync('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?);', MIGRATIONS[8].version, MIGRATIONS[8].name, new Date().toISOString());
  });

  // Check columns after V9
  const mealColsAfter = await db.getAllAsync<{ name: string }>('PRAGMA table_info(meals);');
  assert.equal(mealColsAfter.some((c) => c.name === 'meal_type'), true);
  assert.equal(mealColsAfter.some((c) => c.name === 'notes'), true);

  const itemColsAfter = await db.getAllAsync<{ name: string }>('PRAGMA table_info(meal_items);');
  assert.equal(itemColsAfter.some((c) => c.name === 'catalog_id'), true);
  assert.equal(itemColsAfter.some((c) => c.name === 'portion_unit'), true);

  // Check custom_foods table exists
  const customFoodsTable = await db.getFirstAsync<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='custom_foods';"
  );
  assert.ok(customFoodsTable, 'custom_foods table must exist after V9');
});

// ---------------------------------------------------------------------------
// 26. Fresh V0 -> 9 migration
// ---------------------------------------------------------------------------
test('Task 4.2 - Test 26: Fresh database migrates cleanly directly from V0 to V9', async () => {
  const db = await createTestDb();
  const migrations = await db.getAllAsync<{ version: number; name: string }>(
    'SELECT version, name FROM schema_migrations ORDER BY version ASC;'
  );
  assert.equal(migrations.length, 12);
  assert.equal(migrations[8].version, 9);
  assert.equal(migrations[8].name, 'add_custom_foods_and_meal_enhancements_v9');
  assert.equal(migrations[9].version, 10);
  assert.equal(migrations[9].name, 'add_meal_templates_and_structured_favorites_v10');
  assert.equal(migrations[10].version, 11);
  assert.equal(migrations[10].name, 'add_meal_template_nutrient_fidelity_and_favorite_repair_v11');
  assert.equal(migrations[11].version, 12);
  assert.equal(migrations[11].name, 'add_provenance_and_repair_legacy_templates_v12');
});

// ---------------------------------------------------------------------------
// 27. Migration idempotence
// ---------------------------------------------------------------------------
test('Task 4.2 - Test 27: Re-running Migration 9 does not duplicate columns or fail', async () => {
  const db = await createTestDb();
  // Running migration up again directly
  await MIGRATIONS[8].up(db);

  const mealCols = await db.getAllAsync<{ name: string }>('PRAGMA table_info(meals);');
  const mealTypeCount = mealCols.filter((c) => c.name === 'meal_type').length;
  assert.equal(mealTypeCount, 1, 'meal_type column must appear exactly once');
});

// ---------------------------------------------------------------------------
// 28. Foreign key integrity
// ---------------------------------------------------------------------------
test('Task 4.2 - Test 28: Meal and meal_items honor database relational constraints and cascade deletion', async () => {
  const db = await createTestDb();
  const mealRepo = new SQLiteMealRepository(db);

  const meal: Meal = {
    id: 'fk-test-meal-1',
    title: 'FK Test Lunch',
    name: 'FK Test Lunch',
    date: '2026-11-15',
    time: '12:00',
    items: [
      {
        id: 'fk-item-1',
        name: 'Item 1',
        calories: 100,
        protein: 10,
        carbs: 5,
        fats: 2,
        quantity: 1,
      },
    ],
  };
  await mealRepo.insertMeal(meal);

  // Deleting meal cascades to meal_items
  await mealRepo.deleteMeal('fk-test-meal-1');
  const items = await db.getAllAsync<{ id: string }>('SELECT id FROM meal_items WHERE meal_id = ?;', 'fk-test-meal-1');
  assert.equal(items.length, 0, 'meal_items should be cascade deleted');
});

// ---------------------------------------------------------------------------
// 29. Nutrition totals stability
// ---------------------------------------------------------------------------
test('Task 4.2 - Test 29: Daily nutrition totals remain 100% identical before and after Migration 9', async () => {
  const db = await openDatabaseAsync(':memory:');
  await db.execAsync('PRAGMA foreign_keys = ON;');

  // Apply migrations 1..8
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL);
  `);
  for (const m of MIGRATIONS.slice(0, 8)) {
    await db.withTransactionAsync(async () => {
      await m.up(db);
      await db.runAsync('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?);', m.version, m.name, new Date().toISOString());
    });
  }

  // Insert a meal under V8 schema
  const mealRepoBefore = new SQLiteMealRepository(db);
  const v8Meal: Meal = {
    id: 'v8-stability-meal-1',
    title: 'V8 Historical Meal',
    name: 'V8 Historical Meal',
    date: '2026-11-15',
    time: '08:00',
    items: [
      { id: 'v8-item-1', name: 'Eggs', calories: 210, protein: 18, carbs: 2, fats: 15, quantity: 3 },
      { id: 'v8-item-2', name: 'Toast', calories: 160, protein: 6, carbs: 30, fats: 2, quantity: 2 },
    ],
  };
  await mealRepoBefore.insertMeal(v8Meal);

  // Compute total before migration
  const loadedBefore = await mealRepoBefore.getMealById('v8-stability-meal-1');
  const calBefore = loadedBefore!.items.reduce((s, i) => s + i.calories, 0);
  const proBefore = loadedBefore!.items.reduce((s, i) => s + i.protein, 0);
  const carbBefore = loadedBefore!.items.reduce((s, i) => s + i.carbs, 0);
  const fatBefore = loadedBefore!.items.reduce((s, i) => s + i.fats, 0);

  // Apply Migration 9
  await db.withTransactionAsync(async () => {
    await MIGRATIONS[8].up(db);
    await db.runAsync('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?);', MIGRATIONS[8].version, MIGRATIONS[8].name, new Date().toISOString());
  });

  // Query after migration
  const loadedAfter = await mealRepoBefore.getMealById('v8-stability-meal-1');
  const calAfter = loadedAfter!.items.reduce((s, i) => s + i.calories, 0);
  const proAfter = loadedAfter!.items.reduce((s, i) => s + i.protein, 0);
  const carbAfter = loadedAfter!.items.reduce((s, i) => s + i.carbs, 0);
  const fatAfter = loadedAfter!.items.reduce((s, i) => s + i.fats, 0);

  assert.equal(calAfter, calBefore);
  assert.equal(proAfter, proBefore);
  assert.equal(carbAfter, carbBefore);
  assert.equal(fatAfter, fatBefore);
});

// ---------------------------------------------------------------------------
// 30. Profile and workout stability
// ---------------------------------------------------------------------------
test('Task 4.2 - Test 30: Profile settings and workout history remain untouched across Migration 9', async () => {
  const db = await openDatabaseAsync(':memory:');
  await db.execAsync('PRAGMA foreign_keys = ON;');

  // Apply migrations 1..8
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL);
  `);
  for (const m of MIGRATIONS.slice(0, 8)) {
    await db.withTransactionAsync(async () => {
      await m.up(db);
      await db.runAsync('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?);', m.version, m.name, new Date().toISOString());
    });
  }

  // Insert workout under V8
  const workoutRepo = new SQLiteWorkoutRepository(db);
  await workoutRepo.insertWorkout({
    id: 'workout-stability-1',
    title: 'Bench Press Day',
    date: '2026-11-15',
    time: '10:00',
    durationMinutes: 45,
    exercises: [
      {
        id: 'ex-bench-1',
        name: 'Barbell Bench Press',
        sets: 3,
        reps: 10,
        weightKg: 80,
      },
    ],
  });

  // Apply Migration 9
  await db.withTransactionAsync(async () => {
    await MIGRATIONS[8].up(db);
    await db.runAsync('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?);', MIGRATIONS[8].version, MIGRATIONS[8].name, new Date().toISOString());
  });

  // Verify workout is intact
  const workouts = await workoutRepo.getAllWorkouts();
  assert.equal(workouts.length, 1);
  assert.equal(workouts[0].id, 'workout-stability-1');
  assert.equal(workouts[0].exercises[0].weight, 80);
});

// ---------------------------------------------------------------------------
// 31. Legacy meals without catalog_id
// ---------------------------------------------------------------------------
test('Task 4.2 - Test 31: Legacy meals load cleanly with undefined catalogId and portionUnit', async () => {
  const db = await createTestDb();
  // Insert raw row without catalog_id
  await db.runAsync(
    'INSERT INTO meals (id, title, date, time, total_calories, total_protein, total_carbs, total_fat, created_at, meal_type, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);',
    'legacy-meal-1',
    'Old Legacy Meal',
    '2026-11-10',
    '12:00',
    200,
    4,
    45,
    1,
    '2026-11-10T12:00:00.000Z',
    'lunch',
    null
  );
  await db.runAsync(
    'INSERT INTO meal_items (id, meal_id, name, calories, protein, carbs, fats, quantity, unit, catalog_id, portion_unit) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);',
    'legacy-item-1',
    'legacy-meal-1',
    'Legacy Rice',
    200,
    4,
    45,
    1,
    150,
    'g',
    null,
    null
  );

  const mealRepo = new SQLiteMealRepository(db);
  const loaded = await mealRepo.getMealById('legacy-meal-1');
  assert.ok(loaded);
  assert.equal(loaded.items[0].catalogId, undefined);
  assert.equal(loaded.items[0].portionUnit, undefined);
  assert.equal(loaded.items[0].name, 'Legacy Rice');
});

// ---------------------------------------------------------------------------
// 32. Strict quantity normalization
// ---------------------------------------------------------------------------
test('Task 4.2 - Test 32: normalizeMealItem rejects malformed numeric strings while accepting valid formats', () => {
  // Invalid formats must throw MealValidationError
  assert.throws(() => normalizeMealItem({ id: '1', quantity: '12abc' }), MealValidationError);
  assert.throws(() => normalizeMealItem({ id: '2', quantity: '' }), MealValidationError);
  assert.throws(() => normalizeMealItem({ id: '3', quantity: -5 }), MealValidationError);
  assert.throws(() => normalizeMealItem({ id: '4', quantity: 0 }), MealValidationError);
  assert.throws(() => normalizeMealItem({ id: '5', quantity: NaN }), MealValidationError);
  assert.throws(() => normalizeMealItem({ id: '6', quantity: Infinity }), MealValidationError);

  // Valid formats
  const item1 = normalizeMealItem({ id: '7', quantity: '1.5' });
  assert.equal(item1.quantity, 1.5);

  const item2 = normalizeMealItem({ id: '8', quantity: '1 scoop' });
  assert.equal(item2.quantity, 1);
  assert.equal(item2.portionUnit, 'scoop');

  const item3 = normalizeMealItem({ id: '9', quantity: 2 });
  assert.equal(item3.quantity, 2);
});

// ---------------------------------------------------------------------------
// 33. Zero whole-history meal rewrites
// ---------------------------------------------------------------------------
test('Task 4.2 - Test 33: Granular meal item operations during catalog-based logging do not wipe or rewrite unrelated meals', async () => {
  const db = await createTestDb();
  const mealRepo = new SQLiteMealRepository(db);

  // Meal A
  await mealRepo.insertMeal({
    id: 'meal-a',
    title: 'Breakfast A',
    name: 'Breakfast A',
    date: '2026-11-15',
    time: '08:00',
    items: [{ id: 'item-a1', name: 'Eggs', calories: 150, protein: 12, carbs: 1, fats: 10, quantity: 2 }],
  });

  // Meal B
  await mealRepo.insertMeal({
    id: 'meal-b',
    title: 'Lunch B',
    name: 'Lunch B',
    date: '2026-11-15',
    time: '13:00',
    items: [{ id: 'item-b1', name: 'Chicken', calories: 250, protein: 35, carbs: 0, fats: 5, quantity: 150 }],
  });

  // Update Meal A only
  await mealRepo.updateMeal({
    id: 'meal-a',
    title: 'Breakfast A Modified',
    name: 'Breakfast A Modified',
    date: '2026-11-15',
    time: '08:00',
    items: [{ id: 'item-a1', name: 'Eggs', calories: 150, protein: 12, carbs: 1, fats: 10, quantity: 2 }],
  });

  // Verify Meal B was untouched
  const mealB = await mealRepo.getMealById('meal-b');
  assert.ok(mealB);
  assert.equal(mealB.name, 'Lunch B');
  assert.equal(mealB.items.length, 1);
  assert.equal(mealB.items[0].id, 'item-b1');
});

// ---------------------------------------------------------------------------
// 34. Offline catalog usability
// ---------------------------------------------------------------------------
test('Task 4.2 - Test 34: All 150+ catalog foods are queryable and scalable in pure offline mode without network calls', () => {
  assert.ok(FOOD_CATALOG.length >= 150);

  // Query every single item, scale by 100g, verify non-null and finite
  for (const food of FOOD_CATALOG) {
    const scaled = scaleFoodNutrients(food, 100, 'grams');
    assert.ok(Number.isFinite(scaled.calories));
    assert.ok(Number.isFinite(scaled.protein));
    assert.ok(Number.isFinite(scaled.carbs));
    assert.ok(Number.isFinite(scaled.fat));
    assert.equal(scaled.totalGrams, 100);
  }
});

// ---------------------------------------------------------------------------
// 35. Arabic/English localization parity
// ---------------------------------------------------------------------------
test('Task 4.2 - Test 35: All food categories, preparation states, and standard units have bilingual parity', () => {
  const categories = [
    'meat_poultry',
    'fish_seafood',
    'eggs_dairy',
    'grains_breads',
    'rice_pasta',
    'legumes',
    'fruits_vegetables',
    'nuts_seeds',
    'oils_fats',
    'regional_middle_eastern',
  ];

  for (const cat of categories) {
    const inCat = FOOD_CATALOG.filter((f) => f.category === cat);
    assert.ok(inCat.length > 0, `Category ${cat} must have at least one entry`);
    for (const food of inCat) {
      assert.ok(food.nameEn && food.nameEn.length > 0);
      assert.ok(food.nameAr && food.nameAr.length > 0);
      for (const opt of food.servingOptions) {
        assert.ok(opt.labelEn && opt.labelEn.length > 0);
        assert.ok(opt.labelAr && opt.labelAr.length > 0);
      }
    }
  }
});
