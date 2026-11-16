import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { QuickAddMealModal } from '../components/QuickAddMealModal';
import { runMigrations } from '../db/migrations';
import { SQLiteMealRepository } from '../db/repositories/mealRepository';
import { translate } from '../i18n';
import { normalizeMeal } from '../models/meal';
import { normalizeProfile, type UserProfile } from '../models/profile';
import { MealDetailsScreen } from '../screens/MealDetailsScreen';
import { MealsScreen } from '../screens/MealsScreen';
import type { Meal } from '../types';
import {
  calculateMacroDistribution,
  calculateNutritionTargetProgress,
  createRepeatedMealDraft,
  getDailyNutritionSummary,
  parseStrictNutrientInput,
} from '../utils/nutrition';
import { resolveEffectiveNutritionTargets } from '../utils/nutritionTargets';
import { openDatabaseAsync } from './mocks/expo-sqlite';

async function createTestDb() {
  const db = await openDatabaseAsync(':memory:');
  await db.execAsync('PRAGMA foreign_keys = ON;');
  await runMigrations(db);
  return db;
}

const t = (key: string, values?: Record<string, string | number>) => translate('en', key, values);
const tAr = (key: string, values?: Record<string, string | number>) => translate('ar', key, values);

function createMockProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return normalizeProfile({
    id: 'test-user-fav',
    name: 'Favorite User',
    email: 'favorite@example.com',
    targetCalories: 2200,
    targetProtein: 160,
    targetCarbs: 220,
    targetFats: 70,
    calculationOverridden: true,
    ...overrides,
  });
}

// ============================================================================
// SECTION 1: CREATE REPEATED MEAL DRAFT (ISOLATION & INTEGRITY)
// ============================================================================

test('createRepeatedMealDraft: generates brand-new meal ID and new item IDs', () => {
  const sourceMeal: Meal = {
    id: 'meal-source-100',
    title: 'Post-Workout Chicken & Rice',
    date: '2026-11-10',
    time: '12:30',
    mealType: 'lunch',
    notes: 'Extra seasoning',
    isFavorite: true,
    items: [
      {
        id: 'item-source-1',
        foodName: 'Grilled Chicken Breast',
        quantity: 200,
        unit: 'g',
        calories: 330,
        protein: 62,
        carbs: 0,
        fat: 7,
        catalogId: 'cat-chick-1',
        portionUnit: 'g',
      },
      {
        id: 'item-source-2',
        foodName: 'White Rice Cooked',
        quantity: 150,
        unit: 'g',
        calories: 195,
        protein: 4,
        carbs: 42,
        fat: 0.5,
        catalogId: 'cat-rice-1',
        portionUnit: 'g',
      },
    ],
  };

  const repeated = createRepeatedMealDraft(sourceMeal, '2026-11-16', '13:00');

  // Verify fresh IDs
  assert.notEqual(repeated.id, sourceMeal.id);
  assert.ok(repeated.id.startsWith('meal-'));
  assert.equal(repeated.date, '2026-11-16');
  assert.equal(repeated.time, '13:00');
  assert.equal(repeated.title, 'Post-Workout Chicken & Rice');
  assert.equal(repeated.mealType, 'lunch');
  assert.equal(repeated.notes, 'Extra seasoning');
  assert.equal(repeated.isFavorite, true);

  // Child items integrity
  assert.equal(repeated.items.length, 2);
  assert.notEqual(repeated.items[0].id, sourceMeal.items[0].id);
  assert.notEqual(repeated.items[1].id, sourceMeal.items[1].id);
  assert.notEqual(repeated.items[0].id, repeated.items[1].id);
  assert.ok(repeated.items[0].id.startsWith('meal-item-'));
  assert.ok(repeated.items[1].id.startsWith('meal-item-'));

  // Macros & catalog provenance preservation
  assert.equal(repeated.items[0].quantity, 200);
  assert.equal(repeated.items[0].calories, 330);
  assert.equal(repeated.items[0].protein, 62);
  assert.equal(repeated.items[0].catalogId, 'cat-chick-1');

  // Strict immutability: source meal must be completely unmutated
  assert.equal(sourceMeal.id, 'meal-source-100');
  assert.equal(sourceMeal.date, '2026-11-10');
  assert.equal(sourceMeal.items[0].id, 'item-source-1');
});

test('createRepeatedMealDraft: repeated multiple times produces distinct IDs every time', () => {
  const sourceMeal: Meal = {
    id: 'meal-source-200',
    title: 'Protein Oatmeal',
    date: '2026-11-01',
    items: [
      {
        id: 'item-oats-1',
        foodName: 'Rolled Oats',
        quantity: 50,
        unit: 'g',
        calories: 190,
        protein: 7,
        carbs: 34,
        fat: 3,
      },
    ],
  };

  const repeat1 = createRepeatedMealDraft(sourceMeal);
  const repeat2 = createRepeatedMealDraft(sourceMeal);

  assert.notEqual(repeat1.id, repeat2.id);
  assert.notEqual(repeat1.items[0].id, repeat2.items[0].id);
  assert.notEqual(repeat1.id, sourceMeal.id);
  assert.notEqual(repeat2.id, sourceMeal.id);
});

test('createRepeatedMealDraft: handles itemless legacy meals safely', () => {
  const legacyMeal: Meal = {
    id: 'meal-legacy-1',
    title: 'Quick Restaurant Lunch',
    date: '2026-10-15',
    mealType: 'lunch',
    totalCalories: 750,
    totalProtein: 45,
    totalCarbs: 60,
    totalFat: 30,
    items: [],
  };

  const repeated = createRepeatedMealDraft(legacyMeal, '2026-11-16');

  assert.notEqual(repeated.id, legacyMeal.id);
  assert.equal(repeated.date, '2026-11-16');
  assert.equal(repeated.totalCalories, 750);
  assert.equal(repeated.totalProtein, 45);
  assert.equal(repeated.totalCarbs, 60);
  assert.equal(repeated.totalFat, 30);
  assert.equal(repeated.items.length, 0);
});

// ============================================================================
// SECTION 2: FAVORITES & TEMPLATES PERSISTENCE
// ============================================================================

test('normalizeMeal: parses and sets isFavorite and isTemplate flags', () => {
  const meal1 = normalizeMeal({
    id: 'm-fav-1',
    title: 'Favorite Salmon',
    isFavorite: true,
  });
  assert.equal(meal1.isFavorite, true);
  assert.equal(meal1.isTemplate, true);

  const meal2 = normalizeMeal({
    id: 'm-fav-2',
    title: 'Tag in Notes',
    notes: '[favorite] High protein dinner',
  });
  assert.equal(meal2.isFavorite, true);
  assert.equal(meal2.isTemplate, true);

  const meal3 = normalizeMeal({
    id: 'm-normal-1',
    title: 'Regular Snack',
    isFavorite: false,
  });
  assert.equal(meal3.isFavorite, false);
});

test('SQLiteMealRepository: persists and retrieves favorite status across roundtrips', async () => {
  const db = await createTestDb();
  const repo = new SQLiteMealRepository(db);

  const favMeal: Meal = {
    id: 'meal-db-fav-1',
    title: 'Pre-Workout Oats & Whey',
    date: '2026-11-16',
    time: '08:00',
    mealType: 'breakfast',
    notes: 'Blend with almond milk',
    isFavorite: true,
    items: [
      {
        id: 'item-db-1',
        foodName: 'Whey Protein',
        quantity: 30,
        unit: 'g',
        calories: 120,
        protein: 24,
        carbs: 2,
        fat: 1.5,
      },
    ],
  };

  await repo.insertMeal(favMeal);

  // Retrieve by ID
  const retrieved = await repo.getMealById('meal-db-fav-1');
  assert.ok(retrieved);
  assert.equal(retrieved.id, 'meal-db-fav-1');
  assert.equal(retrieved.isFavorite, true);
  assert.equal(retrieved.title, 'Pre-Workout Oats & Whey');
  assert.equal(retrieved.notes, 'Blend with almond milk');
  assert.equal(retrieved.items.length, 1);

  // Retrieve via getAllMeals
  const allMeals = await repo.getAllMeals();
  const found = allMeals.find((m) => m.id === 'meal-db-fav-1');
  assert.ok(found);
  assert.equal(found.isFavorite, true);
  assert.equal(found.notes, 'Blend with almond milk');

  // Toggle favorite off via updateMeal
  const updatedMeal: Meal = {
    ...retrieved,
    isFavorite: false,
  };
  await repo.updateMeal(updatedMeal);

  const retrievedAfterUpdate = await repo.getMealById('meal-db-fav-1');
  assert.ok(retrievedAfterUpdate);
  assert.equal(retrievedAfterUpdate.isFavorite, false);
  assert.equal(retrievedAfterUpdate.notes, 'Blend with almond milk');
});

// ============================================================================
// SECTION 3: QUICK-ADD CALORIE ENTRY & AGGREGATION
// ============================================================================

test('parseStrictNutrientInput: validates nutrient quantities strictly', () => {
  // Valid integers and decimals
  assert.equal(parseStrictNutrientInput('500').isValid, true);
  assert.equal(parseStrictNutrientInput('500').value, 500);
  assert.equal(parseStrictNutrientInput('25.5').isValid, true);
  assert.equal(parseStrictNutrientInput('25.5').value, 25.5);
  assert.equal(parseStrictNutrientInput('0').isValid, true);
  assert.equal(parseStrictNutrientInput('0').value, 0);

  // Empty string
  assert.equal(parseStrictNutrientInput('').isEmpty, true);
  assert.equal(parseStrictNutrientInput('   ').isEmpty, true);

  // Invalid values
  assert.equal(parseStrictNutrientInput('abc').isValid, false);
  assert.equal(parseStrictNutrientInput('Infinity').isValid, false);
  assert.equal(parseStrictNutrientInput('-Infinity').isValid, false);
  assert.equal(parseStrictNutrientInput('NaN').isValid, false);
  assert.equal(parseStrictNutrientInput('-10').isValid, false); // Negative
  assert.equal(parseStrictNutrientInput('100001', { max: 100000 }).isValid, false); // Overflow
});

test('calculateDailyNutrition & getDailyNutritionSummary: aggregates itemless quick-add meals', () => {
  const quickMeal1: Meal = {
    id: 'qm-1',
    title: 'Protein Bar Quick Log',
    date: '2026-11-16',
    time: '15:00',
    mealType: 'snack',
    totalCalories: 250,
    totalProtein: 20,
    totalCarbs: 25,
    totalFat: 8,
    items: [],
  };

  const detailedMeal: Meal = {
    id: 'dm-1',
    title: 'Dinner',
    date: '2026-11-16',
    time: '20:00',
    mealType: 'dinner',
    items: [
      {
        id: 'dm-item-1',
        foodName: 'Steak',
        quantity: 250,
        unit: 'g',
        calories: 500,
        protein: 55,
        carbs: 0,
        fat: 30,
      },
    ],
  };

  const allMeals = [quickMeal1, detailedMeal];
  const summary = getDailyNutritionSummary(allMeals, '2026-11-16');

  assert.equal(summary.mealCount, 2);
  assert.equal(summary.calories, 750);
  assert.equal(summary.protein, 75);
  assert.equal(summary.carbs, 25);
  assert.equal(summary.fats, 38);
  assert.equal(summary.hasLoggedMeals, true);

  // Progress against targets
  const profile = createMockProfile({ targetCalories: 2000, targetProtein: 150 });
  const targets = resolveEffectiveNutritionTargets(profile);
  const progress = calculateNutritionTargetProgress(summary, targets);

  assert.equal(progress.calories.consumed, 750);
  assert.equal(progress.calories.remaining, 1250);
  assert.equal(progress.calories.isReached, false);
  assert.equal(progress.protein.consumed, 75);

  // Macro distribution includes itemless quick meal
  const distribution = calculateMacroDistribution(summary);
  assert.ok(distribution.proteinPct > 0);
  assert.ok(distribution.carbsPct > 0);
  assert.ok(distribution.fatsPct > 0);
});

// ============================================================================
// SECTION 4: COMPONENT STATIC RENDERING (REACT DOM / SSR)
// ============================================================================

test('QuickAddMealModal: renders cleanly in EN and AR when visible', () => {
  const htmlEn = renderToStaticMarkup(
    React.createElement(QuickAddMealModal, {
      visible: true,
      onClose: () => {},
      onSaveQuickMeal: async () => {},
      t,
      language: 'en',
    })
  );

  assert.ok(htmlEn.includes('Quick Add Calories') || htmlEn.includes('quickAdd'));
  assert.ok(htmlEn.includes('Calories'));

  const htmlAr = renderToStaticMarkup(
    React.createElement(QuickAddMealModal, {
      visible: true,
      onClose: () => {},
      onSaveQuickMeal: async () => {},
      t: tAr,
      language: 'ar',
    })
  );

  assert.ok(htmlAr.includes('إضافة سعرات سريعة') || htmlAr.includes('السعرات'));
});

test('MealDetailsScreen: renders favorite badge, favorite toggle and repeat button', () => {
  const profile = createMockProfile();
  const meal: Meal = {
    id: 'meal-details-test-1',
    title: 'Salmon Bowl',
    date: '2026-11-16',
    time: '19:00',
    mealType: 'dinner',
    isFavorite: true,
    items: [
      {
        id: 'it-1',
        foodName: 'Grilled Salmon',
        quantity: 150,
        unit: 'g',
        calories: 310,
        protein: 34,
        carbs: 0,
        fat: 18,
      },
    ],
  };

  const htmlEn = renderToStaticMarkup(
    React.createElement(MealDetailsScreen, {
      t,
      meal,
      profile,
      onEdit: () => {},
      onDelete: () => {},
      onRepeat: async () => {},
      onToggleFavorite: async () => {},
    })
  );

  assert.ok(htmlEn.includes('Salmon Bowl'));
  assert.ok(htmlEn.includes('Favorite'));
  assert.ok(htmlEn.includes('Log Again Today'));

  const htmlAr = renderToStaticMarkup(
    React.createElement(MealDetailsScreen, {
      t: tAr,
      meal,
      profile,
      onEdit: () => {},
      onDelete: () => {},
      onRepeat: async () => {},
      onToggleFavorite: async () => {},
    })
  );

  assert.ok(htmlAr.includes('مفضلة'));
  assert.ok(htmlAr.includes('تسجيلها مجدداً اليوم'));
});

test('MealsScreen: renders Quick Add button and Filter tabs', () => {
  const profile = createMockProfile();
  const meals: Meal[] = [
    {
      id: 'm-screen-1',
      title: 'Morning Eggs',
      date: '2026-11-16',
      mealType: 'breakfast',
      totalCalories: 300,
      totalProtein: 24,
      totalCarbs: 2,
      totalFat: 20,
      isFavorite: true,
      items: [],
    },
  ];

  const htmlEn = renderToStaticMarkup(
    React.createElement(MealsScreen, {
      t,
      meals,
      profile,
      language: 'en',
      selectedDate: '2026-11-16',
      onAddMeal: () => {},
      onMealPress: () => {},
      onQuickAddMeal: async () => {},
    })
  );

  assert.ok(htmlEn.includes('Quick Add'));
  assert.ok(htmlEn.includes('Favorites'));
  assert.ok(htmlEn.includes('All Meals'));
  assert.ok(htmlEn.includes('Morning Eggs'));

  const htmlAr = renderToStaticMarkup(
    React.createElement(MealsScreen, {
      t: tAr,
      meals,
      profile,
      language: 'ar',
      selectedDate: '2026-11-16',
      onAddMeal: () => {},
      onMealPress: () => {},
      onQuickAddMeal: async () => {},
    })
  );

  assert.ok(htmlAr.includes('إضافة سريعة'));
  assert.ok(htmlAr.includes('المفضلة'));
  assert.ok(htmlAr.includes('جميع الوجبات'));
});
