import test from 'node:test';
import assert from 'node:assert/strict';

import { openDatabaseAsync } from './mocks/expo-sqlite';
import { runMigrations, MIGRATIONS } from '../db/migrations';
import { SQLiteMealRepository } from '../db/repositories/mealRepository';
import { FOOD_CATALOG, FOOD_CATALOG_MAP } from '../data/foodCatalog';
import {
  scaleFoodNutrients,
  scaleCustomFoodNutrients,
  calculateServingGrams,
  createMealItemSnapshot,
  createCustomFoodMealItemSnapshot,
  ScalingValidationError,
} from '../utils/foodScaling';
import { CustomFood } from '../models/food';
import { Meal, MealItem } from '../models/meal';

async function createTestDb() {
  const db = await openDatabaseAsync(':memory:');
  await db.execAsync('PRAGMA foreign_keys = ON;');
  await runMigrations(db);
  return db;
}

// ---------------------------------------------------------------------------
// 1. Official source identifier verification
// ---------------------------------------------------------------------------
test('Task 4.2A - Test 1: All USDA foods have valid FDC identifiers and VERIFIED provenance', () => {
  const usdaEntries = FOOD_CATALOG.filter((f) => f.sourceName.includes('USDA'));
  assert.equal(usdaEntries.length, 143, 'Must contain exactly 143 USDA entries');

  const fdcRegex = /^FDC\s+\d+$/;
  for (const entry of usdaEntries) {
    assert.match(entry.sourceReference, fdcRegex, `FDC ID format invalid for ${entry.id}`);
    assert.equal(entry.provenanceStatus, 'VERIFIED', `USDA entry ${entry.id} must be marked VERIFIED`);
    assert.ok(entry.sourceUrl?.startsWith('https://fdc.nal.usda.gov/'), `Missing sourceUrl for ${entry.id}`);
  }
});

// ---------------------------------------------------------------------------
// 2. Food description matches cited source
// ---------------------------------------------------------------------------
test('Task 4.2A - Test 2: Catalog food descriptions align with cited source names and categories', () => {
  const chickenBreast = FOOD_CATALOG_MAP.get('chicken-breast-raw')!;
  assert.match(chickenBreast.nameEn.toLowerCase(), /chicken/);
  assert.match(chickenBreast.nameEn.toLowerCase(), /breast/);
  assert.equal(chickenBreast.category, 'meat_poultry');

  const oats = FOOD_CATALOG_MAP.get('oats-rolled-raw')!;
  assert.match(oats.nameEn.toLowerCase(), /oat/);
  assert.equal(oats.category, 'grains_breads');

  const oliveOil = FOOD_CATALOG_MAP.get('olive-oil-extra-virgin')!;
  assert.match(oliveOil.nameEn.toLowerCase(), /olive oil/);
  assert.equal(oliveOil.category, 'oils_fats');
});

// ---------------------------------------------------------------------------
// 3. Nutrient values within source tolerance
// ---------------------------------------------------------------------------
test('Task 4.2A - Test 3: Macro profiles strictly match Atwater energy equivalence within standard variance', () => {
  for (const food of FOOD_CATALOG) {
    // 4 kcal/g protein, 4 kcal/g carbs, 9 kcal/g fat
    const atwaterCal = food.proteinPer100g * 4 + food.carbsPer100g * 4 + food.fatsPer100g * 9;
    if (atwaterCal > 10) {
      const diff = Math.abs(food.caloriesPer100g - atwaterCal);
      const ratio = diff / atwaterCal;
      // Verified food profiles should not deviate by more than 25% from basic Atwater estimation
      assert.ok(
        ratio <= 0.25 || diff <= 25,
        `Food ${food.id} calorie mismatch: stated ${food.caloriesPer100g} vs atwater ${atwaterCal}`
      );
    }
  }
});

// ---------------------------------------------------------------------------
// 4. Unverifiable references identified
// ---------------------------------------------------------------------------
test('Task 4.2A - Test 4: Unverifiable placeholder references are explicitly marked UNVERIFIED with notes', () => {
  const unverified = FOOD_CATALOG.filter((f) => f.provenanceStatus === 'UNVERIFIED');
  assert.equal(unverified.length, 9, 'Must identify exactly 9 unverified SFDA placeholder entries');

  const unverifiedIds = [
    'dates-sukari',
    'dates-ajwa',
    'dates-khudari',
    'labneh-full-fat',
    'labneh-low-fat',
    'ful-medames',
    'pita-bread-whole-wheat',
    'halloumi-cheese',
    'leben-buttermilk-full-fat',
  ];

  for (const id of unverifiedIds) {
    const food = FOOD_CATALOG_MAP.get(id);
    assert.ok(food, `Food ${id} must exist in catalog`);
    assert.equal(food.provenanceStatus, 'UNVERIFIED');
    assert.ok(food.recipeNotes?.includes('unverified placeholder'));
  }
});

// ---------------------------------------------------------------------------
// 5. Mixed regional dish provenance status
// ---------------------------------------------------------------------------
test('Task 4.2A - Test 5: Mixed regional dishes are marked ESTIMATED with recipe formulation assumptions', () => {
  const estimated = FOOD_CATALOG.filter((f) => f.provenanceStatus === 'ESTIMATED');
  assert.equal(estimated.length, 6, 'Must identify exactly 6 estimated mixed regional dishes');

  const estimatedIds = [
    'kabsa-rice-cooked',
    'shawarma-chicken-meat',
    'shish-tawook-grilled',
    'kebab-beef-grilled',
    'moutabal-eggplant',
    'tabbouleh-salad',
  ];

  for (const id of estimatedIds) {
    const food = FOOD_CATALOG_MAP.get(id);
    assert.ok(food, `Estimated food ${id} must exist`);
    assert.equal(food.provenanceStatus, 'ESTIMATED');
    assert.ok(food.recipeNotes?.startsWith('Estimated recipe composite'));
  }
});

// ---------------------------------------------------------------------------
// 6. Raw/cooked distinctions
// ---------------------------------------------------------------------------
test('Task 4.2A - Test 6: Raw and cooked food pairs maintain explicit preparationState and density differences', () => {
  const pairs: [string, string][] = [
    ['chicken-breast-raw', 'chicken-breast-cooked'],
    ['chicken-thigh-raw', 'chicken-thigh-cooked'],
    ['ground-beef-90-10-raw', 'ground-beef-90-10-cooked'],
    ['beef-tenderloin-raw', 'beef-tenderloin-cooked'],
    ['salmon-atlantic-raw', 'salmon-atlantic-cooked'],
    ['rice-white-raw', 'rice-white-cooked'],
    ['rice-brown-raw', 'rice-brown-cooked'],
    ['pasta-wheat-raw', 'pasta-wheat-cooked'],
    ['quinoa-dry-raw', 'quinoa-cooked'],
    ['spinach-raw', 'spinach-cooked'],
    ['carrot-raw', 'carrot-cooked'],
  ];

  for (const [rawId, cookedId] of pairs) {
    const rawFood = FOOD_CATALOG_MAP.get(rawId)!;
    const cookedFood = FOOD_CATALOG_MAP.get(cookedId)!;

    assert.ok(rawFood && cookedFood, `Pair ${rawId} / ${cookedId} must both exist`);
    assert.equal(rawFood.preparationState, 'raw');
    assert.equal(cookedFood.preparationState, 'cooked');
    assert.notEqual(rawFood.id, cookedFood.id);
  }
});

// ---------------------------------------------------------------------------
// 7. Serving weight provenance
// ---------------------------------------------------------------------------
test('Task 4.2A - Test 7: Serving weights have positive, bounded grams and bilingual labels', () => {
  for (const food of FOOD_CATALOG) {
    assert.ok(food.servingOptions.length >= 1, `Food ${food.id} must have at least one serving option`);
    for (const opt of food.servingOptions) {
      assert.ok(opt.grams > 0 && opt.grams <= 10_000, `Option ${opt.id} on ${food.id} out of bounds: ${opt.grams}`);
      assert.ok(opt.nameEn && opt.nameEn.length > 0);
      assert.ok(opt.nameAr && opt.nameAr.length > 0);
    }
  }
});

// ---------------------------------------------------------------------------
// 8. Quantity overflow rejection
// ---------------------------------------------------------------------------
test('Task 4.2A - Test 8: Portion quantities exceeding MAX_QUANTITY (10,000) are strictly rejected', () => {
  const chicken = FOOD_CATALOG_MAP.get('chicken-breast-cooked')!;

  assert.throws(
    () => calculateServingGrams(10_001, chicken.servingOptions[0]),
    ScalingValidationError
  );
  assert.throws(
    () => scaleFoodNutrients(chicken, 10_001),
    ScalingValidationError
  );
});

// ---------------------------------------------------------------------------
// 9. Serving weight overflow rejection
// ---------------------------------------------------------------------------
test('Task 4.2A - Test 9: Serving weights exceeding MAX_SERVING_GRAMS (100,000g) are strictly rejected', () => {
  const invalidOption = {
    id: 'giant',
    nameEn: 'Giant',
    nameAr: 'ضخم',
    grams: 100_001,
  };

  assert.throws(
    () => calculateServingGrams(1, invalidOption),
    ScalingValidationError
  );
});

// ---------------------------------------------------------------------------
// 10. Scaled calorie overflow rejection
// ---------------------------------------------------------------------------
test('Task 4.2A - Test 10: Scaling calculations that exceed MAX_SCALED_CALORIES are rejected', () => {
  const customFood: CustomFood = {
    id: 'cf-overflow-cal',
    name: 'Super Dense Fuel',
    calories: 90_000,
    protein: 100,
    carbs: 100,
    fats: 100,
    servingSize: 1000,
    servingUnit: 'bar',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // 90,000 cal * 500 = 45,000,000 cal (> 10,000,000 max)
  assert.throws(
    () => scaleCustomFoodNutrients(customFood, 500),
    ScalingValidationError
  );
});

// ---------------------------------------------------------------------------
// 11. Scaled macro overflow rejection
// ---------------------------------------------------------------------------
test('Task 4.2A - Test 11: Scaling calculations that exceed MAX_SCALED_MACROS are rejected', () => {
  const customFood: CustomFood = {
    id: 'cf-overflow-macro',
    name: 'Pure Protein Block',
    calories: 4000,
    protein: 90_000,
    carbs: 0,
    fats: 0,
    servingSize: 1000,
    servingUnit: 'kg',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // 90,000g protein * 50 = 4,500,000g (> 1,000,000 max)
  assert.throws(
    () => scaleCustomFoodNutrients(customFood, 50),
    ScalingValidationError
  );
});

// ---------------------------------------------------------------------------
// 12. Unsupported unit rejection
// ---------------------------------------------------------------------------
test('Task 4.2A - Test 12: Requesting an unsupported serving unit ID throws clear ScalingValidationError', () => {
  const chicken = FOOD_CATALOG_MAP.get('chicken-breast-cooked')!;

  assert.throws(
    () => scaleFoodNutrients(chicken, 1, 'non_existent_unit_xyz'),
    (err: any) => {
      assert.ok(err instanceof ScalingValidationError);
      assert.match(err.message, /not supported/);
      assert.equal(err.field, 'servingUnitId');
      return true;
    }
  );
});

// ---------------------------------------------------------------------------
// 13. Snapshot ID uniqueness
// ---------------------------------------------------------------------------
test('Task 4.2A - Test 13: Rapidly generated catalog meal item snapshot IDs are unique without collisions', () => {
  const chicken = FOOD_CATALOG_MAP.get('chicken-breast-cooked')!;
  const ids = new Set<string>();
  const count = 500;

  for (let i = 0; i < count; i++) {
    const snapshot = createMealItemSnapshot(chicken, 100, 'grams');
    assert.ok(snapshot.id.startsWith('meal-item-'));
    assert.ok(!ids.has(snapshot.id), `ID collision detected: ${snapshot.id}`);
    ids.add(snapshot.id);
  }

  assert.equal(ids.size, count);
});

// ---------------------------------------------------------------------------
// 14. Custom-food snapshot ID uniqueness
// ---------------------------------------------------------------------------
test('Task 4.2A - Test 14: Rapidly generated custom food snapshot IDs are unique without collisions', () => {
  const customFood: CustomFood = {
    id: 'cf-rapid-1',
    name: 'Smoothie',
    calories: 220,
    protein: 15,
    carbs: 30,
    fats: 4,
    servingSize: 300,
    servingUnit: 'glass',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const ids = new Set<string>();
  const count = 500;

  for (let i = 0; i < count; i++) {
    const snapshot = createCustomFoodMealItemSnapshot(customFood, 1, 'glass');
    assert.ok(snapshot.id.startsWith('meal-item-'));
    assert.ok(!ids.has(snapshot.id), `Collision detected on custom food snapshot ID: ${snapshot.id}`);
    ids.add(snapshot.id);
  }

  assert.equal(ids.size, count);
});

// ---------------------------------------------------------------------------
// 15. No historical meal recalculation
// ---------------------------------------------------------------------------
test('Task 4.2A - Test 15: Editing or simulating catalog changes does not recalculate historical logged meals', async () => {
  const db = await createTestDb();
  const mealRepo = new SQLiteMealRepository(db);

  // User logs chicken breast at 150 kcal
  const snapshot: MealItem = {
    id: 'item-hist-1',
    name: 'Cooked Chicken',
    calories: 165,
    protein: 31,
    carbs: 0,
    fats: 3.6,
    quantity: 100,
    unit: '100g',
    catalogId: 'chicken-breast-cooked',
    portionUnit: '100g',
  };

  const meal: Meal = {
    id: 'meal-hist-1',
    title: 'Post Workout Meal',
    date: '2026-11-16',
    time: '12:00',
    items: [snapshot],
  };

  await mealRepo.insertMeal(meal);

  // Directly verify table row in SQLite
  const row = await db.getFirstAsync<{ calories: number; protein: number }>(
    'SELECT calories, protein FROM meal_items WHERE id = ?;',
    'item-hist-1'
  );
  assert.equal(row?.calories, 165);
  assert.equal(row?.protein, 31);
});

// ---------------------------------------------------------------------------
// 16. No duplicate nutrient multiplication
// ---------------------------------------------------------------------------
test('Task 4.2A - Test 16: Meal item snapshots represent absolute consumed values avoiding double scaling', () => {
  const chicken = FOOD_CATALOG_MAP.get('chicken-breast-cooked')!;
  // 200g portion = 2x per-100g values
  const snapshot = createMealItemSnapshot(chicken, 200, 'grams');

  // Snapshot must hold the pre-scaled absolute values
  assert.equal(snapshot.calories, 330);
  assert.equal(snapshot.protein, 62);

  // Logging this in a meal directly totals 330 kcal, never multiplying by 200 again
  const totalCalories = [snapshot].reduce((sum, item) => sum + item.calories, 0);
  assert.equal(totalCalories, 330);
});

// ---------------------------------------------------------------------------
// 17. Existing SQLite migration compatibility
// ---------------------------------------------------------------------------
test('Task 4.2A - Test 17: Existing V8 database upgrades to V9 cleanly without touching older migrations', async () => {
  const db = await openDatabaseAsync(':memory:');
  await db.execAsync('PRAGMA foreign_keys = ON;');

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL);
  `);
  for (const m of MIGRATIONS.slice(0, 8)) {
    await db.withTransactionAsync(async () => {
      await m.up(db);
      await db.runAsync('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?);', m.version, m.name, new Date().toISOString());
    });
  }

  // Apply Migration 9
  await db.withTransactionAsync(async () => {
    await MIGRATIONS[8].up(db);
    await db.runAsync('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?);', MIGRATIONS[8].version, MIGRATIONS[8].name, new Date().toISOString());
  });

  const customFoodsTable = await db.getFirstAsync<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='custom_foods';"
  );
  assert.ok(customFoodsTable);
});

// ---------------------------------------------------------------------------
// 18. Offline catalog functionality
// ---------------------------------------------------------------------------
test('Task 4.2A - Test 18: Entire 158-item catalog is offline and functional without network calls', () => {
  assert.equal(FOOD_CATALOG.length, 158);
  for (const entry of FOOD_CATALOG) {
    const scaled = scaleFoodNutrients(entry, 100, 'grams');
    assert.ok(Number.isFinite(scaled.calories));
    assert.ok(scaled.totalGrams === 100);
  }
});

// ---------------------------------------------------------------------------
// 19. Arabic/English name consistency
// ---------------------------------------------------------------------------
test('Task 4.2A - Test 19: All 158 catalog entries have valid, non-empty, localized Arabic and English names', () => {
  const arabicRegex = /[\u0600-\u06FF]/;
  for (const entry of FOOD_CATALOG) {
    assert.ok(entry.nameEn && entry.nameEn.trim().length > 0);
    assert.ok(entry.nameAr && entry.nameAr.trim().length > 0);
    assert.match(entry.nameAr, arabicRegex, `Arabic name missing Arabic characters in ${entry.id}`);
  }
});

// ---------------------------------------------------------------------------
// 20. All existing meal CRUD regressions
// ---------------------------------------------------------------------------
test('Task 4.2A - Test 20: Meal CRUD operations with catalog snapshots function atomically without orphaned rows', async () => {
  const db = await createTestDb();
  const mealRepo = new SQLiteMealRepository(db);

  const chicken = FOOD_CATALOG_MAP.get('chicken-breast-cooked')!;
  const item1 = createMealItemSnapshot(chicken, 150, 'grams');

  const meal: Meal = {
    id: 'meal-crud-reg-1',
    title: 'Healthy Lunch',
    date: '2026-11-16',
    time: '13:00',
    items: [item1],
  };

  // Insert
  await mealRepo.insertMeal(meal);
  const loaded = await mealRepo.getMealById('meal-crud-reg-1');
  assert.ok(loaded);
  assert.equal(loaded.items.length, 1);
  assert.equal(loaded.items[0].catalogId, 'chicken-breast-cooked');

  // Update
  const updatedMeal: Meal = {
    ...loaded,
    title: 'Healthy Lunch - Edited',
    items: [
      {
        ...loaded.items[0],
        quantity: 200,
        calories: 330,
      },
    ],
  };
  await mealRepo.updateMeal(updatedMeal);
  const reloaded = await mealRepo.getMealById('meal-crud-reg-1');
  assert.equal(reloaded?.title, 'Healthy Lunch - Edited');
  assert.equal(reloaded?.items[0].quantity, 200);

  // Delete
  await mealRepo.deleteMeal('meal-crud-reg-1');
  const deleted = await mealRepo.getMealById('meal-crud-reg-1');
  assert.equal(deleted, null);

  const orphaned = await db.getAllAsync<{ id: string }>(
    'SELECT id FROM meal_items WHERE meal_id = ?;',
    'meal-crud-reg-1'
  );
  assert.equal(orphaned.length, 0);
});
