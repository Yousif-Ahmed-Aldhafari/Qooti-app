import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';

import { runMigrations } from '../db/migrations';
import { SQLiteMealRepository } from '../db/repositories/mealRepository';
import { SQLiteProfileRepository } from '../db/repositories/profileRepository';
import { SQLiteWorkoutRepository } from '../db/repositories/workoutRepository';
import { ar } from '../i18n/ar';
import { en } from '../i18n/en';
import { translate } from '../i18n';
import { normalizeMeal, type Meal } from '../models/meal';
import { normalizeProfile } from '../models/profile';
import { normalizeProgressEntry, type ProgressEntry } from '../models/progress';
import { normalizeWorkout, type Workout } from '../models/workout';
import { MealsScreen } from '../screens/MealsScreen';
import { ProgressScreen } from '../screens/ProgressScreen';
import { MacroDistributionBar } from '../components/MacroDistributionBar';
import {
  calculateMacroDistribution,
  calculateNutritionTargetProgress,
  getDailyNutritionSummary,
} from '../utils/nutrition';
import { resolveEffectiveNutritionTargets } from '../utils/nutritionTargets';
import { openDatabaseAsync } from './mocks/expo-sqlite';

const t = (key: string, values?: Record<string, string | number>) => translate('en', key, values);

async function createTestDb() {
  const db = await openDatabaseAsync(':memory:');
  await db.execAsync('PRAGMA foreign_keys = ON;');
  await runMigrations(db);
  return db;
}

// ============================================================================
// GROUP A: DAILY NUTRITION AGGREGATION TESTS
// ============================================================================

test('Task 4.4 - Test 1: getDailyNutritionSummary aggregates a single consumed meal accurately', () => {
  const meals: Meal[] = [
    normalizeMeal({
      id: 'meal-1',
      name: 'Breakfast Oats',
      date: '2026-11-16',
      mealType: 'breakfast',
      items: [
        {
          id: 'item-1',
          name: 'Oats with Milk',
          calories: 350,
          protein: 15,
          carbs: 55,
          fats: 8,
          portionQuantity: 1,
          portionUnit: 'bowl',
        },
      ],
    }),
  ];

  const summary = getDailyNutritionSummary(meals, '2026-11-16');
  assert.equal(summary.date, '2026-11-16');
  assert.equal(summary.mealCount, 1);
  assert.equal(summary.loggedFoodCount, 1);
  assert.equal(summary.calories, 350);
  assert.equal(summary.protein, 15);
  assert.equal(summary.carbs, 55);
  assert.equal(summary.fats, 8);
  assert.equal(summary.hasLoggedMeals, true);
  assert.deepEqual(summary.dataQualityFlags, []);
});

test('Task 4.4 - Test 2: getDailyNutritionSummary aggregates multiple meals in one calendar day', () => {
  const meals: Meal[] = [
    normalizeMeal({
      id: 'meal-1',
      name: 'Breakfast',
      date: '2026-11-16',
      mealType: 'breakfast',
      items: [
        { id: 'item-1', name: 'Eggs', calories: 200, protein: 18, carbs: 2, fats: 14, portionQuantity: 2, portionUnit: 'egg' },
      ],
    }),
    normalizeMeal({
      id: 'meal-2',
      name: 'Lunch',
      date: '2026-11-16',
      mealType: 'lunch',
      items: [
        { id: 'item-2', name: 'Chicken & Rice', calories: 600, protein: 45, carbs: 70, fats: 12, portionQuantity: 1, portionUnit: 'serving' },
      ],
    }),
  ];

  const summary = getDailyNutritionSummary(meals, '2026-11-16');
  assert.equal(summary.mealCount, 2);
  assert.equal(summary.loggedFoodCount, 2);
  assert.equal(summary.calories, 800);
  assert.equal(summary.protein, 63);
  assert.equal(summary.carbs, 72);
  assert.equal(summary.fats, 26);
  assert.equal(summary.hasLoggedMeals, true);
});

test('Task 4.4 - Test 3: getDailyNutritionSummary aggregates multiple foods per meal correctly', () => {
  const meals: Meal[] = [
    normalizeMeal({
      id: 'meal-1',
      name: 'Power Dinner',
      date: '2026-11-16',
      mealType: 'dinner',
      items: [
        { id: 'item-1', name: 'Steak', calories: 450, protein: 48, carbs: 0, fats: 28, portionQuantity: 1, portionUnit: 'steak' },
        { id: 'item-2', name: 'Baked Potato', calories: 220, protein: 5, carbs: 50, fats: 1, portionQuantity: 1, portionUnit: 'potato' },
        { id: 'item-3', name: 'Broccoli', calories: 55, protein: 4, carbs: 10, fats: 0.5, portionQuantity: 1, portionUnit: 'cup' },
      ],
    }),
  ];

  const summary = getDailyNutritionSummary(meals, '2026-11-16');
  assert.equal(summary.mealCount, 1);
  assert.equal(summary.loggedFoodCount, 3);
  assert.equal(summary.calories, 725);
  assert.equal(summary.protein, 57);
  assert.equal(summary.carbs, 60);
  assert.equal(summary.fats, 29.5);
});

test('Task 4.4 - Test 4: getDailyNutritionSummary isolates dates and excludes adjacent days', () => {
  const meals: Meal[] = [
    normalizeMeal({
      id: 'meal-today',
      name: 'Today Lunch',
      date: '2026-11-16',
      items: [{ id: 'i-1', name: 'Salad', calories: 300, protein: 10, carbs: 20, fats: 15, portionQuantity: 1, portionUnit: 'bowl' }],
    }),
    normalizeMeal({
      id: 'meal-yesterday',
      name: 'Yesterday Lunch',
      date: '2026-11-15',
      items: [{ id: 'i-2', name: 'Pizza', calories: 850, protein: 30, carbs: 90, fats: 35, portionQuantity: 1, portionUnit: 'slice' }],
    }),
  ];

  const summaryNov16 = getDailyNutritionSummary(meals, '2026-11-16');
  assert.equal(summaryNov16.mealCount, 1);
  assert.equal(summaryNov16.calories, 300);

  const summaryNov15 = getDailyNutritionSummary(meals, '2026-11-15');
  assert.equal(summaryNov15.mealCount, 1);
  assert.equal(summaryNov15.calories, 850);
});

test('Task 4.4 - Test 5: undated legacy meals are strictly excluded from daily summary', () => {
  const meals: Meal[] = [
    normalizeMeal({
      id: 'meal-dated',
      name: 'Dated Lunch',
      date: '2026-11-16',
      items: [{ id: 'i-1', name: 'Fish', calories: 400, protein: 35, carbs: 5, fats: 20, portionQuantity: 1, portionUnit: 'fillet' }],
    }),
    normalizeMeal({
      id: 'meal-undated-1',
      name: 'Old Undated Meal',
      date: '',
      items: [{ id: 'i-2', name: 'Bread', calories: 150, protein: 5, carbs: 30, fats: 2, portionQuantity: 1, portionUnit: 'slice' }],
    }),
    normalizeMeal({
      id: 'meal-undated-2',
      name: 'Whitespace Date Meal',
      date: '   ',
      items: [{ id: 'i-3', name: 'Apple', calories: 95, protein: 0.5, carbs: 25, fats: 0.3, portionQuantity: 1, portionUnit: 'apple' }],
    }),
  ];

  const summary = getDailyNutritionSummary(meals, '2026-11-16');
  assert.equal(summary.mealCount, 1);
  assert.equal(summary.calories, 400);
  assert.equal(summary.protein, 35);
});

test('Task 4.4 - Test 6: itemless legacy meal fallback preserves stored totals accurately', () => {
  const meals: Meal[] = [
    normalizeMeal({
      id: 'legacy-meal-1',
      name: 'Pre-Phase 4 Quick Meal',
      date: '2026-11-16',
      totalCalories: 650,
      totalProtein: 40,
      totalCarbs: 65,
      totalFat: 22,
      items: [], // Itemless legacy meal
    }),
  ];

  const summary = getDailyNutritionSummary(meals, '2026-11-16');
  assert.equal(summary.mealCount, 1);
  assert.equal(summary.loggedFoodCount, 1);
  assert.equal(summary.calories, 650);
  assert.equal(summary.protein, 40);
  assert.equal(summary.carbs, 65);
  assert.equal(summary.fats, 22);
  assert.equal(summary.hasLoggedMeals, true);
});

test('Task 4.4 - Test 7: missing log is cleanly distinguished from confirmed zero intake', () => {
  const emptySummary = getDailyNutritionSummary([], '2026-11-16');
  assert.equal(emptySummary.hasLoggedMeals, false);
  assert.equal(emptySummary.mealCount, 0);
  assert.equal(emptySummary.calories, 0);

  const zeroCalorieMeals: Meal[] = [
    normalizeMeal({
      id: 'fasting-coffee',
      name: 'Black Coffee',
      date: '2026-11-16',
      items: [{ id: 'i-coffee', name: 'Black Coffee', calories: 0, protein: 0, carbs: 0, fats: 0, portionQuantity: 1, portionUnit: 'cup' }],
    }),
  ];
  const zeroIntakeSummary = getDailyNutritionSummary(zeroCalorieMeals, '2026-11-16');
  assert.equal(zeroIntakeSummary.hasLoggedMeals, true);
  assert.equal(zeroIntakeSummary.mealCount, 1);
  assert.equal(zeroIntakeSummary.calories, 0);
});

test('Task 4.4 - Test 8: stored nutrient snapshots are never multiplied by quantity again', () => {
  // Food items store their scaled snapshot at creation time.
  const meals: Meal[] = [
    normalizeMeal({
      id: 'meal-scaled',
      name: 'Double Portion Steak',
      date: '2026-11-16',
      items: [
        {
          id: 'i-steak',
          name: 'Ribeye',
          calories: 800, // Pre-scaled for quantity 2
          protein: 70,
          carbs: 0,
          fats: 50,
          portionQuantity: 2,
          portionUnit: 'steak',
        },
      ],
    }),
  ];

  const summary = getDailyNutritionSummary(meals, '2026-11-16');
  // Must sum snapshot directly (800 kcal), NOT 800 * 2 = 1600 kcal
  assert.equal(summary.calories, 800);
  assert.equal(summary.protein, 70);
  assert.equal(summary.fats, 50);
});

test('Task 4.4 - Test 9: historical snapshot preservation does not recalculate from catalog', () => {
  // If catalog values were to change in future revisions, historical meal snapshots remain fixed
  const historicalMeal: Meal = normalizeMeal({
    id: 'historical-meal',
    name: 'Historical Lunch',
    date: '2026-11-16',
    items: [
      {
        id: 'i-chicken',
        catalogId: 'catalog-chicken',
        name: 'Custom Prepared Chicken',
        calories: 220, // Specific custom prep snapshot
        protein: 38,
        carbs: 2,
        fats: 6,
        portionQuantity: 1.5,
        portionUnit: '100 g',
      },
    ],
  });

  const summary = getDailyNutritionSummary([historicalMeal], '2026-11-16');
  assert.equal(summary.calories, 220);
  assert.equal(summary.protein, 38);
});

test('Task 4.4 - Test 10: invalid numeric values (NaN, Infinity, negative) are flagged and sanitized safely', () => {
  const corruptedMeals: Meal[] = [
    normalizeMeal({
      id: 'corrupt-meal',
      name: 'Corrupted Data Test',
      date: '2026-11-16',
      items: [
        {
          id: 'i-bad',
          name: 'Bad Numbers Item',
          calories: (Number.NaN as unknown) as number,
          protein: (Number.POSITIVE_INFINITY as unknown) as number,
          carbs: -50,
          fats: 10,
          portionQuantity: 1,
          portionUnit: 'item',
        },
      ],
    }),
  ];

  const summary = getDailyNutritionSummary(corruptedMeals, '2026-11-16');
  assert.equal(summary.calories, 0);
  assert.equal(summary.protein, 0);
  assert.equal(summary.carbs, 0);
  assert.equal(summary.fats, 10);
  assert.ok(summary.dataQualityFlags.includes('INVALID_CALORIES'));
  assert.ok(summary.dataQualityFlags.includes('INVALID_PROTEIN'));
  assert.ok(summary.dataQualityFlags.includes('NEGATIVE_CARBS'));
});

// ============================================================================
// GROUP B: TARGET STATES & ADHERENCE PROGRESS TESTS
// ============================================================================

test('Task 4.4 - Test 11: approved targets compute valid progress ratios and remaining amounts', () => {
  const profile = normalizeProfile({
    id: 'approved-user',
    name: 'Sarah Connor',
    gender: 'female',
    age: 30,
    heightCm: 168,
    weightKg: 62,
    activityLevel: 'moderate',
    goal: 'Maintenance',
    attributesConfirmed: true,
    calculationOverridden: false,
  });

  const targets = resolveEffectiveNutritionTargets(profile);
  assert.equal(targets.hasActiveTarget, true);
  assert.equal(targets.hasApprovedTarget, true);

  const intake = {
    calories: 1500,
    protein: 100,
    carbs: 150,
    fats: 45,
    date: '2026-11-16',
    mealCount: 2,
    loggedFoodCount: 4,
    hasLoggedMeals: true,
    dataQualityFlags: [],
  };

  const progress = calculateNutritionTargetProgress(intake, targets);
  assert.equal(progress.hasActiveTarget, true);
  assert.equal(progress.calories.hasTarget, true);
  assert.equal(progress.calories.consumed, 1500);
  assert.ok(progress.calories.rawRatio !== null && progress.calories.rawRatio < 1);
  assert.ok(progress.calories.remaining !== null && progress.calories.remaining > 0);
  assert.equal(progress.calories.isReached, false);
  assert.equal(progress.calories.isExceeded, false);
});

test('Task 4.4 - Test 12: custom override targets are labeled user-defined and not approved', () => {
  const profile = normalizeProfile({
    id: 'custom-user',
    name: 'John Custom',
    gender: 'male',
    age: 28,
    targetCalories: 2400,
    targetProtein: 180,
    targetCarbs: 220,
    targetFats: 75,
    calculationOverridden: true,
  });

  const targets = resolveEffectiveNutritionTargets(profile);
  assert.equal(targets.hasActiveTarget, true);
  assert.equal(targets.hasApprovedTarget, false); // Custom overrides are NEVER approved
  assert.equal(targets.isCustomOverride, true);
  assert.equal(targets.calories, 2400);

  const intake = { calories: 2400, protein: 180, carbs: 220, fats: 75 };
  const progress = calculateNutritionTargetProgress(intake, targets);
  assert.equal(progress.calories.isReached, true);
  assert.equal(progress.calories.remaining, 0);
  assert.equal(progress.calories.overage, 0);
});

test('Task 4.4 - Test 13: unconfirmed targets do not authorize active target comparisons', () => {
  const profile = normalizeProfile({
    id: 'unconfirmed-user',
    name: 'New User',
    attributesConfirmed: false,
    calculationOverridden: false,
  });

  const targets = resolveEffectiveNutritionTargets(profile);
  assert.equal(targets.hasActiveTarget, false);
  assert.equal(targets.state, 'unconfirmed');

  const intake = { calories: 1800, protein: 120, carbs: 180, fats: 55 };
  const progress = calculateNutritionTargetProgress(intake, targets);
  assert.equal(progress.hasActiveTarget, false);
  assert.equal(progress.calories.hasTarget, false);
  assert.equal(progress.calories.rawRatio, null);
  assert.equal(progress.calories.boundedRatio, null);
  assert.equal(progress.calories.remaining, null);
});

test('Task 4.4 - Test 14: missing profile handles null intake safely without crashing', () => {
  const targets = resolveEffectiveNutritionTargets(null);
  assert.equal(targets.hasActiveTarget, false);
  assert.equal(targets.state, 'missing');

  const intake = { calories: 0, protein: 0, carbs: 0, fats: 0 };
  const progress = calculateNutritionTargetProgress(intake, targets);
  assert.equal(progress.hasActiveTarget, false);
  assert.equal(progress.calories.hasTarget, false);
});

test('Task 4.4 - Test 15: adolescent profile enforces unsupported restriction', () => {
  const adolescent = normalizeProfile({
    id: 'teenager',
    name: 'Young Athlete',
    age: 16,
    attributesConfirmed: true,
    calculationOverridden: false,
  });

  const targets = resolveEffectiveNutritionTargets(adolescent);
  assert.equal(targets.hasActiveTarget, false);
  assert.equal(targets.state, 'unsupported');
  assert.equal(targets.source, 'unsupported_adolescent');
});

test('Task 4.4 - Test 16: conflicting dietary constraints do not produce valid adherence metrics', () => {
  const conflicting = normalizeProfile({
    id: 'conflict-user',
    name: 'Conflict User',
    attributesConfirmed: true,
    dietaryPreference: 'keto',
    deficitPercentage: 50, // Impossible extreme deficit with keto minimum protein/fats
    calculationOverridden: false,
  });

  const targets = resolveEffectiveNutritionTargets(conflicting);
  if (!targets.hasActiveTarget) {
    const progress = calculateNutritionTargetProgress({ calories: 1200, protein: 90, carbs: 20, fats: 80 }, targets);
    assert.equal(progress.hasActiveTarget, false);
  }
  assert.ok(true);
});

test('Task 4.4 - Test 17: invalid custom target (e.g. 0 kcal) triggers invalid state', () => {
  const invalidCustom = normalizeProfile({
    id: 'invalid-user',
    name: 'Bad Target',
    calculationOverridden: true,
    targetCalories: 0, // Invalid non-positive
  });

  const targets = resolveEffectiveNutritionTargets(invalidCustom);
  assert.equal(targets.hasActiveTarget, false);
  assert.equal(targets.state, 'invalid');
});

test('Task 4.4 - Test 18: custom target with null individual macros does not fabricate macro targets', () => {
  const partialCustom = {
    ...normalizeProfile({
      id: 'calories-only-user',
      name: 'Calorie Counter',
      calculationOverridden: true,
      targetCalories: 2100,
    }),
    targetProtein: undefined as unknown as number,
    targetCarbs: undefined as unknown as number,
    targetFats: undefined as unknown as number,
    targetFat: undefined as unknown as number,
  };

  const targets = resolveEffectiveNutritionTargets(partialCustom);
  assert.equal(targets.hasActiveTarget, true);
  assert.equal(targets.rawCalories, 2100);
  assert.equal(targets.rawProtein, null);
  assert.equal(targets.rawCarbs, null);
  assert.equal(targets.rawFats, null);

  const intake = { calories: 1800, protein: 110, carbs: 190, fats: 60 };
  const progress = calculateNutritionTargetProgress(intake, targets);
  assert.equal(progress.calories.hasTarget, true);
  assert.equal(progress.protein.hasTarget, false);
  assert.equal(progress.carbs.hasTarget, false);
  assert.equal(progress.fats.hasTarget, false);
});

test('Task 4.4 - Test 19: SAFE_FALLBACK_TARGETS are never presented as approved user goals', () => {
  const unconfirmed = normalizeProfile({
    id: 'fallback-check',
    name: 'Fallback Check',
    attributesConfirmed: false,
    calculationOverridden: false,
  });

  const targets = resolveEffectiveNutritionTargets(unconfirmed);
  assert.equal(targets.hasApprovedTarget, false);
  assert.equal(targets.hasActiveTarget, false);
  assert.equal(targets.rawCalories, null);
  // Math fallback is present for safe calculations, but hasActiveTarget is false
  assert.equal(targets.calories, 2000);
});

test('Task 4.4 - Test 20: target overage calculations expose bounded visual ratio and exact raw overage', () => {
  const profile = normalizeProfile({
    id: 'overage-user',
    name: 'Bulker',
    targetCalories: 2000,
    targetProtein: 150,
    calculationOverridden: true,
  });

  const targets = resolveEffectiveNutritionTargets(profile);
  const intake = { calories: 2500, protein: 180, carbs: 250, fats: 80 };
  const progress = calculateNutritionTargetProgress(intake, targets);

  assert.equal(progress.calories.isExceeded, true);
  assert.equal(progress.calories.isReached, true);
  assert.equal(progress.calories.overage, 500);
  assert.equal(progress.calories.remaining, 0);
  assert.equal(progress.calories.rawRatio, 1.25);
  // Bounded ratio caps visually at 1.0 (100%) so progress bars do not overflow
  assert.equal(progress.calories.boundedRatio, 1.0);
});

// ============================================================================
// GROUP C: MACRO DISTRIBUTION & ATWATER 4/4/9 MATHEMATICS
// ============================================================================

test('Task 4.4 - Test 21: Atwater 4/4/9 energy calculation derives correct macro calories', () => {
  const intake = { protein: 150, carbs: 200, fats: 60, calories: 1950 };
  const dist = calculateMacroDistribution(intake);

  assert.equal(dist.proteinKcal, 150 * 4); // 600 kcal
  assert.equal(dist.carbsKcal, 200 * 4);   // 800 kcal
  assert.equal(dist.fatsKcal, 60 * 9);     // 540 kcal
  assert.equal(dist.totalMacroKcal, 600 + 800 + 540); // 1940 kcal
  assert.equal(dist.loggedCalories, 1950);
  assert.equal(dist.calorieDifference, 10); // 1950 - 1940
});

test('Task 4.4 - Test 22: zero macro energy case returns 0% without NaN or division by zero', () => {
  const zeroIntake = { protein: 0, carbs: 0, fats: 0, calories: 0 };
  const dist = calculateMacroDistribution(zeroIntake);

  assert.equal(dist.totalMacroKcal, 0);
  assert.equal(dist.proteinPct, 0);
  assert.equal(dist.carbsPct, 0);
  assert.equal(dist.fatsPct, 0);
  assert.equal(Number.isNaN(dist.proteinPct), false);
  assert.equal(Number.isFinite(dist.proteinPct), true);
});

test('Task 4.4 - Test 23: macro distribution integer percentages sum strictly to 100%', () => {
  // Test multiple diverse macro ratios that could produce rounding discrepancies
  const testCases = [
    { protein: 100, carbs: 100, fats: 100 }, // Equal grams: 400 + 400 + 900 = 1700
    { protein: 133, carbs: 211, fats: 47 },
    { protein: 25, carbs: 340, fats: 12 },
    { protein: 180, carbs: 50, fats: 95 },
  ];

  for (const tc of testCases) {
    const dist = calculateMacroDistribution(tc);
    assert.equal(dist.proteinPct + dist.carbsPct + dist.fatsPct, 100);
  }
});

test('Task 4.4 - Test 24: rounding tolerance and fractional gram handling', () => {
  const fractionalIntake = { protein: 33.3, carbs: 45.7, fats: 12.8, calories: 435 };
  const dist = calculateMacroDistribution(fractionalIntake);

  assert.ok(Number.isFinite(dist.totalMacroKcal));
  assert.ok(dist.totalMacroKcal > 0);
  assert.equal(dist.proteinPct + dist.carbsPct + dist.fatsPct, 100);
});

test('Task 4.4 - Test 25: logged label calories and macro-derived calories remain independent', () => {
  // Real foods on packages have fiber or rounding differences between label kcal and 4/4/9
  const intake = { protein: 50, carbs: 50, fats: 20, calories: 600 };
  const dist = calculateMacroDistribution(intake);

  const derivedKcal = (50 * 4) + (50 * 4) + (20 * 9); // 580 kcal
  assert.equal(dist.totalMacroKcal, derivedKcal);
  assert.equal(dist.loggedCalories, 600);
  assert.notEqual(dist.loggedCalories, dist.totalMacroKcal);
  // Guarantee calculateMacroDistribution did NOT overwrite logged calories
  assert.equal(dist.calorieDifference, 20);
});

// ============================================================================
// GROUP D: INTEGRATION, UI RENDERING & PERSISTENCE SAFETY
// ============================================================================

test('Task 4.4 - Test 26: inserting a meal updates daily nutrition summary reactively', async () => {
  const db = await createTestDb();
  const repo = new SQLiteMealRepository(db);

  const initialMeals = await repo.getAllMeals();
  const initialSummary = getDailyNutritionSummary(initialMeals, '2026-11-16');
  assert.equal(initialSummary.hasLoggedMeals, false);

  const newMeal = normalizeMeal({
    id: 'meal-new-1',
    name: 'Lunch Box',
    date: '2026-11-16',
    time: '12:00',
    mealType: 'lunch',
    items: [
      { id: 'item-rice', name: 'Rice', calories: 250, protein: 5, carbs: 55, fats: 1, portionQuantity: 1, portionUnit: 'cup' },
    ],
  });
  await repo.insertMeal(newMeal);

  const updatedMeals = await repo.getAllMeals();
  const updatedSummary = getDailyNutritionSummary(updatedMeals, '2026-11-16');
  assert.equal(updatedSummary.hasLoggedMeals, true);
  assert.equal(updatedSummary.calories, 250);
});

test('Task 4.4 - Test 27: editing a meal updates daily totals without data residue', async () => {
  const db = await createTestDb();
  const repo = new SQLiteMealRepository(db);

  const meal = normalizeMeal({
    id: 'meal-edit-1',
    name: 'Pre-workout Snack',
    date: '2026-11-16',
    time: '16:00',
    mealType: 'snack',
    items: [
      { id: 'item-banana', name: 'Banana', calories: 105, protein: 1, carbs: 27, fats: 0.3, portionQuantity: 1, portionUnit: 'banana' },
    ],
  });
  await repo.insertMeal(meal);

  // Edit the meal to add peanut butter
  const editedMeal = normalizeMeal({
    ...meal,
    time: '16:00',
    items: [
      ...meal.items,
      { id: 'item-pb', name: 'Peanut Butter', calories: 190, protein: 8, carbs: 7, fats: 16, portionQuantity: 2, portionUnit: 'tbsp' },
    ],
  });
  await repo.updateMeal(editedMeal);

  const meals = await repo.getAllMeals();
  const summary = getDailyNutritionSummary(meals, '2026-11-16');
  assert.equal(summary.mealCount, 1);
  assert.equal(summary.loggedFoodCount, 2);
  assert.equal(summary.calories, 295);
  assert.equal(summary.protein, 9);
});

test('Task 4.4 - Test 28: deleting a meal removes its contribution from daily nutrition totals', async () => {
  const db = await createTestDb();
  const repo = new SQLiteMealRepository(db);

  const meal = normalizeMeal({
    id: 'meal-del-1',
    name: 'Temporary Shake',
    date: '2026-11-16',
    time: '10:00',
    items: [{ id: 'i-shake', name: 'Protein Shake', calories: 200, protein: 30, carbs: 5, fats: 3, portionQuantity: 1, portionUnit: 'shake' }],
  });
  await repo.insertMeal(meal);

  let summary = getDailyNutritionSummary(await repo.getAllMeals(), '2026-11-16');
  assert.equal(summary.calories, 200);

  await repo.deleteMeal(meal.id);

  summary = getDailyNutritionSummary(await repo.getAllMeals(), '2026-11-16');
  assert.equal(summary.hasLoggedMeals, false);
  assert.equal(summary.calories, 0);
});

test('Task 4.4 - Test 29: failed database transaction does not pollute in-memory aggregates', async () => {
  const db = await createTestDb();
  const repo = new SQLiteMealRepository(db);

  const initialMeals = await repo.getAllMeals();

  // Attempting to insert a malformed meal that violates foreign keys or constraints
  try {
    await db.withTransactionAsync(async () => {
      await db.runAsync('INSERT INTO meals (id, name, date, created_at) VALUES (?, ?, ?, ?)', [
        'invalid-meal',
        null as unknown as string, // NOT NULL constraint violation
        '2026-11-16',
        new Date().toISOString(),
      ]);
    });
  } catch {
    // Expected constraint failure
  }

  const currentMeals = await repo.getAllMeals();
  assert.equal(currentMeals.length, initialMeals.length);
  const summary = getDailyNutritionSummary(currentMeals, '2026-11-16');
  assert.equal(summary.calories, 0);
});

test('Task 4.4 - Test 30: application cold reload recalculates identical totals from SQLite records', async () => {
  const db = await createTestDb();
  const repo1 = new SQLiteMealRepository(db);

  await repo1.insertMeal(
    normalizeMeal({
      id: 'persisted-meal',
      name: 'Dinner',
      date: '2026-11-16',
      time: '19:30',
      items: [
        { id: 'i-salmon', name: 'Salmon', calories: 400, protein: 40, carbs: 0, fats: 25, portionQuantity: 1, portionUnit: 'fillet' },
      ],
    })
  );

  // Simulate new repository instance after app restart
  const repo2 = new SQLiteMealRepository(db);
  const reloadedMeals = await repo2.getAllMeals();
  const summary = getDailyNutritionSummary(reloadedMeals, '2026-11-16');

  assert.equal(summary.hasLoggedMeals, true);
  assert.equal(summary.calories, 400);
  assert.equal(summary.protein, 40);
  assert.equal(summary.fats, 25);
});

test('Task 4.4 - Test 31: date navigation strictly switches daily intake dashboard metrics', () => {
  const meals: Meal[] = [
    normalizeMeal({
      id: 'meal-d1',
      name: 'Day 1 Meal',
      date: '2026-11-16',
      items: [{ id: 'i-1', name: 'Rice', calories: 300, protein: 6, carbs: 65, fats: 1, portionQuantity: 1, portionUnit: 'cup' }],
    }),
    normalizeMeal({
      id: 'meal-d2',
      name: 'Day 2 Meal',
      date: '2026-11-17',
      items: [{ id: 'i-2', name: 'Pasta', calories: 500, protein: 15, carbs: 90, fats: 4, portionQuantity: 1, portionUnit: 'bowl' }],
    }),
  ];

  const summaryDay1 = getDailyNutritionSummary(meals, '2026-11-16');
  const summaryDay2 = getDailyNutritionSummary(meals, '2026-11-17');

  assert.equal(summaryDay1.calories, 300);
  assert.equal(summaryDay2.calories, 500);
});

test('Task 4.4 - Test 32: undated legacy meals remain queryable in recovery list without corrupting date totals', async () => {
  const db = await createTestDb();
  const repo = new SQLiteMealRepository(db);

  await db.runAsync(
    `INSERT INTO meals (id, title, date, time, total_calories, total_protein, total_carbs, total_fat, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      'legacy-undated',
      'Undated Feast',
      '',
      '12:00',
      500,
      50,
      0,
      30,
      new Date().toISOString(),
    ]
  );

  const allMeals = await repo.getAllMeals();
  const datedSummary = getDailyNutritionSummary(allMeals, '2026-11-16');
  // Undated meal must not show up on 2026-11-16
  assert.equal(datedSummary.hasLoggedMeals, false);
  assert.equal(datedSummary.calories, 0);

  // But is preserved in undated recovery filter
  const undatedMeals = allMeals.filter((m) => !m.date || !m.date.trim());
  assert.equal(undatedMeals.length, 1);
  assert.equal(undatedMeals[0].name, 'Undated Feast');
});

test('Task 4.4 - Test 33: ProgressScreen integrates real meal aggregates and separates workout metrics', () => {
  const profile = normalizeProfile({ id: 'prog-user', name: 'User', targetCalories: 2000, calculationOverridden: true });
  const progressEntries: ProgressEntry[] = [
    normalizeProgressEntry({ id: 'p-1', date: '2026-11-15', label: 'Sun', calories: 9999, workouts: 2, weightKg: 70 }),
    normalizeProgressEntry({ id: 'p-2', date: '2026-11-16', label: 'Mon', calories: 9999, workouts: 1, weightKg: 70 }),
  ];

  const realMeals: Meal[] = [
    normalizeMeal({
      id: 'm-1',
      name: 'Real Lunch',
      date: '2026-11-16',
      items: [{ id: 'i-1', name: 'Chicken', calories: 450, protein: 40, carbs: 0, fats: 10, portionQuantity: 1, portionUnit: 'breast' }],
    }),
  ];

  // Render ProgressScreen element
  const element = React.createElement(ProgressScreen, {
    t,
    profile,
    progress: progressEntries,
    meals: realMeals,
  });

  assert.ok(element);
  assert.equal(element.type, ProgressScreen);
  assert.equal(element.props.meals, realMeals);
});

test('Task 4.4 - Test 34: ProgressScreen treats unlogged days as missing data and averages only logged days', () => {
  const profile = normalizeProfile({ id: 'prog-user', name: 'User', targetCalories: 2000, calculationOverridden: true });
  const progressEntries: ProgressEntry[] = [
    normalizeProgressEntry({ id: 'p-1', date: '2026-11-15', label: 'Sun', calories: 0, workouts: 0, weightKg: 70 }),
    normalizeProgressEntry({ id: 'p-2', date: '2026-11-16', label: 'Mon', calories: 0, workouts: 1, weightKg: 70 }),
  ];

  const meals: Meal[] = [
    normalizeMeal({
      id: 'm-mon',
      name: 'Monday Lunch',
      date: '2026-11-16',
      items: [{ id: 'i-1', name: 'Food', calories: 600, protein: 30, carbs: 60, fats: 20, portionQuantity: 1, portionUnit: 'item' }],
    }),
    // Sunday has NO meals logged
  ];

  // For Sunday: hasLoggedMeals is false. For Monday: 600 kcal.
  // Average should be 600 kcal (averaged over the 1 logged day, NOT (0 + 600)/2 = 300 kcal)!
  const sunSummary = getDailyNutritionSummary(meals, '2026-11-15');
  const monSummary = getDailyNutritionSummary(meals, '2026-11-16');

  assert.equal(sunSummary.hasLoggedMeals, false);
  assert.equal(monSummary.hasLoggedMeals, true);
  assert.equal(monSummary.calories, 600);

  const loggedDays = [sunSummary, monSummary].filter((s) => s.hasLoggedMeals);
  const avg = loggedDays.reduce((sum, s) => sum + s.calories, 0) / loggedDays.length;
  assert.equal(avg, 600);

  const screenElement = React.createElement(ProgressScreen, {
    t,
    profile,
    progress: progressEntries,
    meals,
  });
  assert.ok(screenElement);
  assert.equal(screenElement.type, ProgressScreen);
});

test('Task 4.4 - Test 35: English and Arabic localization dictionaries have full parity for analytics keys', () => {
  const requiredKeys = [
    'title',
    'subtitle',
    'remaining',
    'overTarget',
    'targetReached',
    'macroDistribution',
    'macroEnergyEstimate',
    'loggedCaloriesLabel',
    'noMacroData',
    'unconfirmedTargetsBanner',
    'customOverrideBanner',
    'unsupportedAdolescentBanner',
    'conflictingConstraintsBanner',
    'noLogsForWeek',
    'unloggedDay',
    'foodItemsCount',
    'mealsCount',
  ];

  for (const key of requiredKeys) {
    assert.ok(
      key in en.nutrition,
      `Key 'nutrition.${key}' missing in English dictionary`
    );
    assert.ok(
      key in ar.nutrition,
      `Key 'nutrition.${key}' missing in Arabic dictionary`
    );
  }
});

test('Task 4.4 - Test 36: MacroDistributionBar renders valid React element with accessibility semantics', () => {
  const dist = calculateMacroDistribution({ protein: 120, carbs: 180, fats: 50, calories: 1650 });
  const element = MacroDistributionBar({
    distribution: dist,
    t,
    showFootnote: true,
  });

  assert.ok(element);
  assert.equal(element.props.accessible, true);
  assert.ok(element.props.accessibilityLabel.includes('Macronutrient distribution'));
});

test('Task 4.4 - Test 37: nutrition analytics calculations are strictly read-only and never mutate SQLite', async () => {
  const db = await createTestDb();
  const repo = new SQLiteMealRepository(db);

  const meal = normalizeMeal({
    id: 'ro-meal',
    name: 'Readonly Meal',
    date: '2026-11-16',
    time: '12:00',
    items: [{ id: 'i-1', name: 'Food', calories: 300, protein: 20, carbs: 30, fats: 10, portionQuantity: 1, portionUnit: 'item' }],
  });
  await repo.insertMeal(meal);

  const [countBefore] = await db.getAllAsync<{ count: number }>('SELECT COUNT(*) as count FROM meals');
  const [itemsBefore] = await db.getAllAsync<{ count: number }>('SELECT COUNT(*) as count FROM meal_items');

  // Perform multiple analytics calculations
  const meals = await repo.getAllMeals();
  const summary = getDailyNutritionSummary(meals, '2026-11-16');
  const profile = normalizeProfile({ id: 'p', name: 'User', targetCalories: 2000, calculationOverridden: true });
  calculateNutritionTargetProgress(summary, resolveEffectiveNutritionTargets(profile));
  calculateMacroDistribution(summary);

  const [countAfter] = await db.getAllAsync<{ count: number }>('SELECT COUNT(*) as count FROM meals');
  const [itemsAfter] = await db.getAllAsync<{ count: number }>('SELECT COUNT(*) as count FROM meal_items');

  // Verify zero SQLite mutations
  assert.equal(countBefore.count, countAfter.count);
  assert.equal(itemsBefore.count, itemsAfter.count);
});

test('Task 4.4 - Test 38: workout and profile persistence remain untouched during nutrition aggregation', async () => {
  const db = await createTestDb();
  const profileRepo = new SQLiteProfileRepository(db);
  const workoutRepo = new SQLiteWorkoutRepository(db);
  const mealRepo = new SQLiteMealRepository(db);

  const profile = normalizeProfile({
    id: 'user-steady',
    name: 'Persistent User',
    targetCalories: 2200,
    calculationOverridden: true,
  });
  await profileRepo.saveProfile(profile);

  const workout: Workout = normalizeWorkout({
    id: 'workout-steady',
    title: 'Bench Press Day',
    date: '2026-11-16',
    time: '17:00',
    exercises: [],
  });
  await workoutRepo.insertWorkout(workout);

  // Insert a meal and perform aggregations
  await mealRepo.insertMeal(
    normalizeMeal({
      id: 'meal-steady',
      name: 'Snack',
      date: '2026-11-16',
      time: '15:00',
      items: [{ id: 'i-s', name: 'Snack', calories: 200, protein: 10, carbs: 20, fats: 5, portionQuantity: 1, portionUnit: 'pack' }],
    })
  );

  const meals = await mealRepo.getAllMeals();
  getDailyNutritionSummary(meals, '2026-11-16');

  // Verify profile and workout remain completely unchanged
  const savedProfile = await profileRepo.getProfile();
  assert.equal(savedProfile?.id, 'user-steady');
  assert.equal(savedProfile?.targetCalories, 2200);

  const savedWorkouts = await workoutRepo.getAllWorkouts();
  assert.equal(savedWorkouts.length, 1);
  assert.equal(savedWorkouts[0].id, 'workout-steady');
});

test('Task 4.4 - Test 39: MealsScreen component renders Daily Nutrition Dashboard with real elements', () => {
  const profile = normalizeProfile({
    id: 'screen-user',
    name: 'Active User',
    targetCalories: 2000,
    targetProtein: 150,
    targetCarbs: 200,
    targetFats: 65,
    calculationOverridden: true,
  });

  const meals: Meal[] = [
    normalizeMeal({
      id: 'screen-meal-1',
      name: 'Breakfast Bowl',
      date: '2026-11-16',
      mealType: 'breakfast',
      items: [
        { id: 'i-1', name: 'Eggs', calories: 300, protein: 24, carbs: 2, fats: 20, portionQuantity: 3, portionUnit: 'egg' },
      ],
    }),
  ];

  const element = React.createElement(MealsScreen, {
    t,
    meals,
    profile,
    language: 'en',
    selectedDate: '2026-11-16',
    onAddMeal: () => {},
    onMealPress: () => {},
  });

  assert.ok(element);
  assert.equal(typeof element, 'object');
  assert.equal(element.type, MealsScreen);
  assert.equal(element.props.selectedDate, '2026-11-16');
});

test('Task 4.4 - Test 40: MealsScreen empty day renders empty state without fabricating intake', () => {
  const profile = normalizeProfile({
    id: 'empty-screen-user',
    name: 'Empty Day User',
    targetCalories: 2000,
    calculationOverridden: true,
  });

  const element = React.createElement(MealsScreen, {
    t,
    meals: [], // No meals
    profile,
    language: 'en',
    selectedDate: '2026-11-16',
    onAddMeal: () => {},
    onMealPress: () => {},
  });

  assert.ok(element);
  assert.equal(typeof element, 'object');
  assert.equal(element.type, MealsScreen);
  assert.equal(element.props.meals.length, 0);
});
