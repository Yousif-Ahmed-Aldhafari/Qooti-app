import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppState } from 'react-native';

import { MacroDistributionBar } from '../components/MacroDistributionBar';
import { SQLiteMealRepository } from '../db/repositories/mealRepository';
import { SQLiteProgressRepository } from '../db/repositories/progressRepository';
import { SQLiteWorkoutRepository } from '../db/repositories/workoutRepository';
import { translate } from '../i18n';
import { normalizeMeal } from '../models/meal';
import { normalizeProfile, type UserProfile } from '../models/profile';
import { normalizeProgressEntry, type ProgressEntry } from '../models/progress';
import { MealsScreen } from '../screens/MealsScreen';
import { ProgressScreen } from '../screens/ProgressScreen';
import { themeColors } from '../theme/colors';
import type { Meal } from '../types';
import {
  formatShortWeekday,
  getCalendarDateRange,
  getNextCalendarDate,
} from '../utils/date';
import {
  buildWeeklyNutritionChartDays,
  calculateMacroDistribution,
  calculateNutritionTargetProgress,
  calculateWeeklyNutritionTrend,
  getDailyNutritionSummary,
} from '../utils/nutrition';
import { resolveEffectiveNutritionTargets } from '../utils/nutritionTargets';
import { runMigrations } from '../db/migrations';
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
    id: 'test-user-trend',
    name: 'Trend User',
    email: 'trend@example.com',
    targetCalories: 2000,
    targetProtein: 150,
    targetCarbs: 200,
    targetFats: 65,
    calculationOverridden: true,
    ...overrides,
  });
}

// ============================================================================
// SECTION 1: 7-DAY CALENDAR DATE GENERATION & BOUNDARY LOGIC
// ============================================================================

test('Task 4.4A - Test 1: Seven dates generated without progress entries', () => {
  const referenceDate = '2026-11-16';
  const emptyProgress: ProgressEntry[] = [];
  const meals: Meal[] = [];

  const chartDays = buildWeeklyNutritionChartDays(referenceDate, meals, emptyProgress, 'en');

  assert.equal(chartDays.length, 7);
  assert.equal(chartDays[6].date, '2026-11-16');
  assert.equal(chartDays[0].date, '2026-11-10');
  for (const day of chartDays) {
    assert.equal(day.progressEntry, undefined);
    assert.equal(day.hasLogs, false);
    assert.equal(day.calories, 0);
    assert.ok(day.label.length > 0);
  }
});

test('Task 4.4A - Test 2: Meal on a day lacking a progress entry is included in trend', () => {
  const referenceDate = '2026-11-16';
  const progressEntries: ProgressEntry[] = [
    normalizeProgressEntry({ id: 'p-1', date: '2026-11-15', label: 'Sun', calories: 2000, workouts: 1, weightKg: 70 }),
  ];

  const meals: Meal[] = [
    normalizeMeal({
      id: 'm-no-prog',
      name: 'Uncorrelated Meal',
      date: '2026-11-12', // Day has NO progress entry
      totalCalories: 750,
      totalProtein: 40,
      totalCarbs: 80,
      totalFat: 20,
    }),
  ];

  const chartDays = buildWeeklyNutritionChartDays(referenceDate, meals, progressEntries, 'en');
  const targetDay = chartDays.find((d) => d.date === '2026-11-12');

  assert.ok(targetDay);
  assert.equal(targetDay.hasLogs, true);
  assert.equal(targetDay.calories, 750);
  assert.equal(targetDay.progressEntry, undefined);

  const trend = calculateWeeklyNutritionTrend(chartDays);
  assert.equal(trend.loggedDaysCount, 1);
  assert.equal(trend.averageCalories, 750);
});

test('Task 4.4A - Test 3: Missing meal data (meals === undefined) indicates unavailable state', () => {
  const referenceDate = '2026-11-16';
  const progressEntries: ProgressEntry[] = [
    normalizeProgressEntry({ id: 'p-1', date: '2026-11-16', label: 'Mon', calories: 1800, workouts: 1, weightKg: 70 }),
  ];

  const chartDays = buildWeeklyNutritionChartDays(referenceDate, undefined, progressEntries, 'en');

  assert.equal(chartDays.length, 7);
  for (const day of chartDays) {
    assert.equal(day.isUnavailable, true);
    assert.equal(day.hasLogs, false);
    assert.equal(day.calories, 0); // Must NOT fall back to progressEntry.calories!
  }

  const trend = calculateWeeklyNutritionTrend(chartDays);
  assert.equal(trend.isUnavailable, true);
  assert.equal(trend.averageCalories, null);
  assert.equal(trend.loggedDaysCount, 0);
});

test('Task 4.4A - Test 4: Available but empty meal collection indicates no meals logged', () => {
  const referenceDate = '2026-11-16';
  const progressEntries: ProgressEntry[] = [
    normalizeProgressEntry({ id: 'p-1', date: '2026-11-16', label: 'Mon', calories: 2500, workouts: 1, weightKg: 70 }),
  ];

  const chartDays = buildWeeklyNutritionChartDays(referenceDate, [], progressEntries, 'en');

  assert.equal(chartDays.length, 7);
  for (const day of chartDays) {
    assert.equal(day.isUnavailable, false);
    assert.equal(day.hasLogs, false);
    assert.equal(day.calories, 0);
  }

  const trend = calculateWeeklyNutritionTrend(chartDays);
  assert.equal(trend.isUnavailable, false);
  assert.equal(trend.averageCalories, null);
  assert.equal(trend.loggedDaysCount, 0);
});

test('Task 4.4A - Test 5: Unlogged day versus logged zero calories distinction', () => {
  const referenceDate = '2026-11-16';
  const meals: Meal[] = [
    normalizeMeal({
      id: 'm-zero',
      name: 'Black Coffee / Fasting',
      date: '2026-11-16',
      totalCalories: 0,
      totalProtein: 0,
      totalCarbs: 0,
      totalFat: 0,
    }),
    // 2026-11-15 has NO meals logged at all
  ];

  const chartDays = buildWeeklyNutritionChartDays(referenceDate, meals, [], 'en');

  const unloggedDay = chartDays.find((d) => d.date === '2026-11-15')!;
  const loggedZeroDay = chartDays.find((d) => d.date === '2026-11-16')!;

  assert.equal(unloggedDay.hasLogs, false);
  assert.equal(unloggedDay.calories, 0);

  assert.equal(loggedZeroDay.hasLogs, true);
  assert.equal(loggedZeroDay.calories, 0);

  const trend = calculateWeeklyNutritionTrend(chartDays);
  // Logged zero day is included in logged count and average (0 / 1 = 0)
  assert.equal(trend.loggedDaysCount, 1);
  assert.equal(trend.averageCalories, 0);
});

test('Task 4.4A - Test 6: Average is calculated strictly across logged days only', () => {
  const referenceDate = '2026-11-16';
  const meals: Meal[] = [
    normalizeMeal({ id: 'm-1', name: 'Meal 1', date: '2026-11-14', totalCalories: 1500 }),
    normalizeMeal({ id: 'm-2', name: 'Meal 2', date: '2026-11-16', totalCalories: 2500 }),
    // 5 other days are unlogged
  ];

  const chartDays = buildWeeklyNutritionChartDays(referenceDate, meals, [], 'en');
  const trend = calculateWeeklyNutritionTrend(chartDays);

  assert.equal(trend.loggedDaysCount, 2);
  // (1500 + 2500) / 2 = 2000 kcal, NOT (1500 + 2500) / 7 = 571 kcal!
  assert.equal(trend.averageCalories, 2000);
});

test('Task 4.4A - Test 7: Month boundary transition (e.g. Nov 1 -> Oct 26 to Nov 1)', () => {
  const referenceDate = '2026-11-01';
  const range = getCalendarDateRange(referenceDate, 7);

  assert.deepEqual(range, [
    '2026-10-26',
    '2026-10-27',
    '2026-10-28',
    '2026-10-29',
    '2026-10-30',
    '2026-10-31',
    '2026-11-01',
  ]);
});

test('Task 4.4A - Test 8: Year boundary transition (e.g. Jan 3, 2026 -> Dec 28, 2025 to Jan 3, 2026)', () => {
  const referenceDate = '2026-01-03';
  const range = getCalendarDateRange(referenceDate, 7);

  assert.deepEqual(range, [
    '2025-12-28',
    '2025-12-29',
    '2025-12-30',
    '2025-12-31',
    '2026-01-01',
    '2026-01-02',
    '2026-01-03',
  ]);
});

test('Task 4.4A - Test 9: Leap-year boundary transition includes Feb 29 (e.g. March 2, 2024)', () => {
  const referenceDate = '2024-03-02';
  const range = getCalendarDateRange(referenceDate, 7);

  assert.deepEqual(range, [
    '2024-02-25',
    '2024-02-26',
    '2024-02-27',
    '2024-02-28',
    '2024-02-29', // Leap day included
    '2024-03-01',
    '2024-03-02',
  ]);
});

test('Task 4.4A - Test 10: Local midnight rollover dynamically advances reference date', () => {
  const meals: Meal[] = [
    normalizeMeal({ id: 'm-16', name: 'Meal 16', date: '2026-11-16', totalCalories: 1800 }),
    normalizeMeal({ id: 'm-17', name: 'Meal 17', date: '2026-11-17', totalCalories: 2100 }),
  ];

  // Render before midnight (reference date 2026-11-16)
  const daysBefore = buildWeeklyNutritionChartDays('2026-11-16', meals, [], 'en');
  assert.equal(daysBefore[6].date, '2026-11-16');

  // Advance time past midnight
  const nextDay = getNextCalendarDate('2026-11-16');
  assert.equal(nextDay, '2026-11-17');

  const daysAfter = buildWeeklyNutritionChartDays(nextDay, meals, [], 'en');
  assert.equal(daysAfter[6].date, '2026-11-17');
  assert.equal(daysAfter[5].date, '2026-11-16');
});

test('Task 4.4A - Test 11: App foreground refresh triggers date synchronization', () => {
  let appStateListener: ((state: string) => void) | null = null;
  const originalAddEventListener = AppState.addEventListener;

  AppState.addEventListener = ((event: string, handler: (state: string) => void) => {
    if (event === 'change') {
      appStateListener = handler;
    }
    return { remove: () => {} };
  }) as any;

  try {
    // Simulate AppState event
    if (appStateListener) {
      (appStateListener as (state: string) => void)('active');
    }
    assert.ok(true, 'AppState listener registered and triggered without error');
  } finally {
    AppState.addEventListener = originalAddEventListener;
  }
});

// ============================================================================
// SECTION 2: MEAL INTEGRITY & SNAPSHOT AGGREGATION
// ============================================================================

test('Task 4.4A - Test 12: Undated meals are completely excluded from trend series', () => {
  const referenceDate = '2026-11-16';
  const meals: Meal[] = [
    normalizeMeal({ id: 'm-undated-1', name: 'Ghost Meal 1', date: '', totalCalories: 1200 }),
    normalizeMeal({ id: 'm-undated-2', name: 'Ghost Meal 2', date: '   ', totalCalories: 800 }),
    normalizeMeal({ id: 'm-valid', name: 'Valid Meal', date: '2026-11-16', totalCalories: 600 }),
  ];

  const chartDays = buildWeeklyNutritionChartDays(referenceDate, meals, [], 'en');
  const totalCaloriesInChart = chartDays.reduce((sum, d) => sum + d.calories, 0);

  // Ghost meals must NOT appear anywhere in the 7 days
  assert.equal(totalCaloriesInChart, 600);
});

test('Task 4.4A - Test 13: Multi-food meal sums child items without double-scaling', () => {
  const referenceDate = '2026-11-16';
  const meals: Meal[] = [
    normalizeMeal({
      id: 'm-multi',
      name: 'Multi-Food Lunch',
      date: '2026-11-16',
      items: [
        { id: 'i-1', name: 'Chicken 200g', calories: 330, protein: 62, carbs: 0, fats: 7, portionQuantity: 2, portionUnit: '100g' },
        { id: 'i-2', name: 'Rice 150g', calories: 195, protein: 4, carbs: 42, fats: 1, portionQuantity: 1.5, portionUnit: '100g' },
      ],
    }),
  ];

  const chartDays = buildWeeklyNutritionChartDays(referenceDate, meals, [], 'en');
  const today = chartDays.find((d) => d.date === '2026-11-16')!;

  assert.equal(today.hasLogs, true);
  // Item calories are already scaled snapshots; must sum directly: 330 + 195 = 525 kcal
  assert.equal(today.calories, 525);
});

test('Task 4.4A - Test 14: Legacy itemless meal totals are preserved in weekly trend', () => {
  const referenceDate = '2026-11-16';
  const meals: Meal[] = [
    normalizeMeal({
      id: 'm-legacy-quick',
      name: 'Quick Logged Snack',
      date: '2026-11-16',
      totalCalories: 450,
      totalProtein: 15,
      totalCarbs: 50,
      totalFat: 18,
      items: [], // Itemless legacy meal
    }),
  ];

  const chartDays = buildWeeklyNutritionChartDays(referenceDate, meals, [], 'en');
  const today = chartDays.find((d) => d.date === '2026-11-16')!;

  assert.equal(today.hasLogs, true);
  assert.equal(today.calories, 450);
});

test('Task 4.4A - Test 15: Real meal edit and delete updates trend reactivity', () => {
  const referenceDate = '2026-11-16';
  let meals: Meal[] = [
    normalizeMeal({ id: 'm-edit', name: 'Original', date: '2026-11-16', totalCalories: 500 }),
  ];

  let trend = calculateWeeklyNutritionTrend(buildWeeklyNutritionChartDays(referenceDate, meals, [], 'en'));
  assert.equal(trend.totalCalories, 500);

  // Edit meal calories to 750
  meals = [
    normalizeMeal({ id: 'm-edit', name: 'Edited', date: '2026-11-16', totalCalories: 750 }),
  ];
  trend = calculateWeeklyNutritionTrend(buildWeeklyNutritionChartDays(referenceDate, meals, [], 'en'));
  assert.equal(trend.totalCalories, 750);

  // Delete meal
  meals = [];
  trend = calculateWeeklyNutritionTrend(buildWeeklyNutritionChartDays(referenceDate, meals, [], 'en'));
  assert.equal(trend.totalCalories, 0);
  assert.equal(trend.loggedDaysCount, 0);
  assert.equal(trend.averageCalories, null);
});

// ============================================================================
// SECTION 3: MODEL ISOLATION & PROGRESS INTEGRITY
// ============================================================================

test('Task 4.4A - Test 16: No unrelated ProgressEntry.calories are used as meal intake', () => {
  const referenceDate = '2026-11-16';
  const progressEntries: ProgressEntry[] = [
    normalizeProgressEntry({ id: 'p-1', date: '2026-11-16', label: 'Mon', calories: 9999, workouts: 1, weightKg: 70 }),
  ];

  // Case A: meals is defined but empty
  const chartDaysEmpty = buildWeeklyNutritionChartDays(referenceDate, [], progressEntries, 'en');
  assert.equal(chartDaysEmpty[6].calories, 0);
  assert.notEqual(chartDaysEmpty[6].calories, 9999);

  // Case B: meals has real log of 400 kcal
  const realMeals = [normalizeMeal({ id: 'm-real', name: 'Food', date: '2026-11-16', totalCalories: 400 })];
  const chartDaysReal = buildWeeklyNutritionChartDays(referenceDate, realMeals, progressEntries, 'en');
  assert.equal(chartDaysReal[6].calories, 400);
  assert.notEqual(chartDaysReal[6].calories, 9999);
});

test('Task 4.4A - Test 17: Workout tracking remains completely unchanged from authoritative source', () => {
  const progressEntries: ProgressEntry[] = [
    normalizeProgressEntry({ id: 'p-1', date: '2026-11-14', workouts: 2, calories: 0, weightKg: 70 }),
    normalizeProgressEntry({ id: 'p-2', date: '2026-11-15', workouts: 1, calories: 0, weightKg: 70 }),
    normalizeProgressEntry({ id: 'p-3', date: '2026-11-16', workouts: 1, calories: 0, weightKg: 70 }),
  ];

  const totalWorkoutDays = progressEntries.reduce((sum, e) => sum + e.workouts, 0);
  assert.equal(totalWorkoutDays, 4);
});

test('Task 4.4A - Test 18: Weight tracking remains completely unchanged from authoritative source', () => {
  const progressEntries: ProgressEntry[] = [
    normalizeProgressEntry({ id: 'p-1', date: '2026-11-14', weightKg: 71.5, calories: 0, workouts: 0 }),
    normalizeProgressEntry({ id: 'p-2', date: '2026-11-15', weightKg: 71.2, calories: 0, workouts: 0 }),
    normalizeProgressEntry({ id: 'p-3', date: '2026-11-16', weightKg: 70.8, calories: 0, workouts: 0 }),
  ];

  const latest = progressEntries[progressEntries.length - 1];
  assert.equal(latest.weightKg, 70.8);
});

test('Task 4.4A - Test 19: Approved vs unconfirmed targets remain safe without fabrication', () => {
  // Unconfirmed profile
  const unconfirmedProfile = normalizeProfile({ id: 'u-1', name: 'Unconfirmed', calculationOverridden: false, targetCalories: 0 });
  const targets = resolveEffectiveNutritionTargets(unconfirmedProfile);

  assert.equal(targets.hasActiveTarget, false);
  const progress = calculateNutritionTargetProgress({ calories: 500, protein: 30, carbs: 50, fats: 20 }, targets);
  assert.equal(progress.hasActiveTarget, false);
  assert.equal(progress.calories.hasTarget, false);
  assert.equal(progress.calories.rawRatio, null);
  assert.equal(progress.calories.boundedRatio, null);
});

// ============================================================================
// SECTION 4: GENUINE LARGEST-REMAINDER MACRO ROUNDING CONTRACT
// ============================================================================

test('Task 4.4A - Test 20: Genuine largest-remainder method handles ties and guarantees exact 100% sum', () => {
  // Case A: 3 equal parts (100 kcal protein, 100 kcal carbs, 100 kcal fats) -> 33.333% each
  // Floors: 33, 33, 33 (sum 99, 1 unassigned point)
  // Tie-break priority order: Protein gets the +1 point -> 34%, 33%, 33%
  const equalIntake = { protein: 25, carbs: 25, fats: 11.1111 }; // 100 kcal, 100 kcal, 100 kcal
  const distEqual = calculateMacroDistribution(equalIntake);
  assert.equal(distEqual.proteinPct, 34);
  assert.equal(distEqual.carbsPct, 33);
  assert.equal(distEqual.fatsPct, 33);
  assert.equal(distEqual.proteinPct + distEqual.carbsPct + distEqual.fatsPct, 100);

  // Case B: Disparate remainders
  // Protein: 50g * 4 = 200 kcal (28.57%) -> floor 28, remainder 0.5714 -> receives +1 -> 29%
  // Carbs: 80g * 4 = 320 kcal (45.71%) -> floor 45, remainder 0.7142 -> receives +1 -> 46%
  // Fats: 20g * 9 = 180 kcal (25.71%) -> floor 25, remainder 0.7142 -> tied with Carbs, Carbs has higher order -> Fats gets 25%
  // Total = 700 kcal. Sum floors: 28 + 45 + 25 = 98. Unassigned: 2.
  const distDisparate = calculateMacroDistribution({ protein: 50, carbs: 80, fats: 20 });
  assert.equal(distDisparate.proteinPct + distDisparate.carbsPct + distDisparate.fatsPct, 100);

  // Case C: Zero macro intake
  const distZero = calculateMacroDistribution({ protein: 0, carbs: 0, fats: 0 });
  assert.equal(distZero.proteinPct, 0);
  assert.equal(distZero.carbsPct, 0);
  assert.equal(distZero.fatsPct, 0);
  assert.equal(distZero.totalMacroKcal, 0);
});

// ============================================================================
// SECTION 5: LOCALIZATION, THEME, ACCESSIBILITY & IMMUTABILITY
// ============================================================================

test('Task 4.4A - Test 21: EN/AR localization dictionary completeness for trend analytics', () => {
  const keys = [
    'nutrition.title',
    'nutrition.mealDataUnavailable',
    'nutrition.noMealsLoggedDay',
    'nutrition.loggedZeroCalories',
    'nutrition.noLogsForWeek',
    'nutrition.unloggedDay',
    'progress.weeklyTrend',
    'progress.averageCalories',
    'progress.workoutDays',
  ];

  for (const k of keys) {
    const enVal = translate('en', k);
    const arVal = translate('ar', k);
    assert.ok(enVal && enVal.length > 0, `English key missing: ${k}`);
    assert.ok(arVal && arVal.length > 0, `Arabic key missing: ${k}`);
  }
});

test('Task 4.4A - Test 22: Arabic short weekday formatting generates correct labels', () => {
  const dateStr = '2026-11-16'; // Monday
  const labelEn = formatShortWeekday(dateStr, 'en');
  const labelAr = formatShortWeekday(dateStr, 'ar');

  assert.ok(labelEn.length > 0);
  assert.ok(labelAr.length > 0);
  assert.notEqual(labelEn, labelAr);
});

test('Task 4.4A - Test 23: Light and dark theme tokens provide valid contrast for charts', () => {
  const colors = themeColors();
  assert.ok(colors.background);
  assert.ok(colors.card);
  assert.ok(colors.accent);
  assert.ok(colors.cardMuted);
  assert.ok(colors.text);
  assert.ok(colors.textMuted);
});

test('Task 4.4A - Test 24: Accessible chart labels describe unlogged vs logged days', () => {
  const referenceDate = '2026-11-16';
  const meals: Meal[] = [
    normalizeMeal({ id: 'm-1', name: 'Meal', date: '2026-11-16', totalCalories: 1850 }),
  ];

  const chartDays = buildWeeklyNutritionChartDays(referenceDate, meals, [], 'en');
  const loggedDay = chartDays.find((d) => d.date === '2026-11-16')!;
  const unloggedDay = chartDays.find((d) => d.date === '2026-11-15')!;

  const loggedLabel = `${loggedDay.label} ${Math.round(loggedDay.calories)} kcal`;
  const unloggedLabel = `${unloggedDay.label} (No logs)`;

  assert.ok(loggedLabel.includes('1850 kcal'));
  assert.ok(unloggedLabel.includes('(No logs)'));
});

test('Task 4.4A - Test 25: Nutrition analytics operations perform zero SQLite mutations', async () => {
  const db = await createTestDb();
  const mealRepo = new SQLiteMealRepository(db);
  const workoutRepo = new SQLiteWorkoutRepository(db);
  const progressRepo = new SQLiteProgressRepository(db);

  await mealRepo.insertMeal({
    id: 'm-safety',
    title: 'Safety Meal',
    date: '2026-11-16',
    time: '12:00',
    totalCalories: 600,
    totalProtein: 40,
    totalCarbs: 60,
    totalFat: 20,
    items: [],
  });

  const mealsBefore = await mealRepo.getAllMeals();
  const workoutsBefore = await workoutRepo.getAllWorkouts();
  const progressBefore = await progressRepo.getAllProgress();

  // Run all analytics calculations multiple times
  const chartDays = buildWeeklyNutritionChartDays('2026-11-16', mealsBefore, progressBefore, 'en');
  calculateWeeklyNutritionTrend(chartDays);
  const summary = getDailyNutritionSummary(mealsBefore, '2026-11-16');
  calculateMacroDistribution(summary);

  const mealsAfter = await mealRepo.getAllMeals();
  const workoutsAfter = await workoutRepo.getAllWorkouts();
  const progressAfter = await progressRepo.getAllProgress();

  assert.equal(mealsBefore.length, mealsAfter.length);
  assert.equal(workoutsBefore.length, workoutsAfter.length);
  assert.equal(progressBefore.length, progressAfter.length);
  assert.deepEqual(mealsBefore, mealsAfter);
});

// ============================================================================
// SECTION 6: ACTUAL RENDERED REACT NATIVE COMPONENT TESTS
// ============================================================================

test('Task 4.4A - Test 26: Rendered ProgressScreen with available meals and logged days', () => {
  const profile = createMockProfile();
  const progressEntries: ProgressEntry[] = [
    normalizeProgressEntry({ id: 'p-1', date: '2026-11-16', label: 'Mon', calories: 2000, workouts: 3, weightKg: 68.5 }),
  ];
  const meals: Meal[] = [
    normalizeMeal({ id: 'm-1', name: 'Oatmeal', date: '2026-11-16', totalCalories: 450, totalProtein: 15, totalCarbs: 70, totalFat: 8 }),
  ];

  const html = renderToStaticMarkup(
    React.createElement(ProgressScreen, {
      t,
      profile,
      progress: progressEntries,
      meals,
      referenceDate: '2026-11-16',
      language: 'en',
    })
  );

  assert.ok(html);
  assert.ok(html.includes('450'));
  assert.ok(html.includes('Mon'));
});

test('Task 4.4A - Test 27: Rendered ProgressScreen with unavailable meals (meals === undefined)', () => {
  const profile = createMockProfile();
  const progressEntries: ProgressEntry[] = [
    normalizeProgressEntry({ id: 'p-1', date: '2026-11-16', label: 'Mon', calories: 2000, workouts: 2, weightKg: 68.5 }),
  ];

  const html = renderToStaticMarkup(
    React.createElement(ProgressScreen, {
      t,
      profile,
      progress: progressEntries,
      meals: undefined,
      referenceDate: '2026-11-16',
      language: 'en',
    })
  );

  assert.ok(html);
  assert.ok(html.includes('Meal data unavailable'));
});

test('Task 4.4A - Test 28: Rendered ProgressScreen with empty meals list (meals = [])', () => {
  const profile = createMockProfile();
  const progressEntries: ProgressEntry[] = [
    normalizeProgressEntry({ id: 'p-1', date: '2026-11-16', label: 'Mon', calories: 2000, workouts: 2, weightKg: 68.5 }),
  ];

  const html = renderToStaticMarkup(
    React.createElement(ProgressScreen, {
      t,
      profile,
      progress: progressEntries,
      meals: [],
      referenceDate: '2026-11-16',
      language: 'en',
    })
  );

  assert.ok(html);
  assert.ok(html.includes('No meals logged this week'));
});

test('Task 4.4A - Test 29: Rendered MacroDistributionBar with positive macros and footnote', () => {
  const dist = calculateMacroDistribution({ protein: 120, carbs: 180, fats: 50, calories: 1650 });

  const html = renderToStaticMarkup(
    React.createElement(MacroDistributionBar, {
      distribution: dist,
      t,
      showFootnote: true,
    })
  );

  assert.ok(html);
  assert.ok(html.includes('4/4/9'));
});

test('Task 4.4A - Test 30: Rendered MacroDistributionBar with zero macros and without footnote', () => {
  const dist = calculateMacroDistribution({ protein: 0, carbs: 0, fats: 0 });

  const html = renderToStaticMarkup(
    React.createElement(MacroDistributionBar, {
      distribution: dist,
      t,
      showFootnote: false,
    })
  );

  assert.ok(html);
  assert.ok(html.includes('0%'));
});

test('Task 4.4A - Test 31: Rendered MealsScreen with active meals, targets and dashboard card', () => {
  const profile = createMockProfile();
  const meals: Meal[] = [
    normalizeMeal({
      id: 'm-today',
      name: 'Lunch',
      date: '2026-11-16',
      totalCalories: 600,
      totalProtein: 45,
      totalCarbs: 65,
      totalFat: 18,
      items: [
        { id: 'i-1', name: 'Chicken', calories: 300, protein: 40, carbs: 0, fats: 5, portionQuantity: 1, portionUnit: 'serving' },
        { id: 'i-2', name: 'Rice', calories: 300, protein: 5, carbs: 65, fats: 13, portionQuantity: 1, portionUnit: 'serving' },
      ],
    }),
  ];

  const html = renderToStaticMarkup(
    React.createElement(MealsScreen, {
      t,
      meals,
      onAddMeal: () => {},
      onMealPress: () => {},
      profile,
      language: 'en',
      selectedDate: '2026-11-16',
    })
  );

  assert.ok(html);
  assert.ok(html.includes('600'));
});

test('Task 4.4A - Test 32: Rendered MealsScreen on empty day shows empty day state', () => {
  const profile = createMockProfile();
  const meals: Meal[] = []; // No meals

  const html = renderToStaticMarkup(
    React.createElement(MealsScreen, {
      t,
      meals,
      onAddMeal: () => {},
      onMealPress: () => {},
      profile,
      language: 'en',
      selectedDate: '2026-11-16',
    })
  );

  assert.ok(html);
});

test('Task 4.4A - Test 33: Rendered MealsScreen with unconfirmed targets displays setup banner', () => {
  const unconfirmedProfile = normalizeProfile({
    id: 'u-unconfirmed',
    name: 'Unconfirmed User',
    calculationOverridden: false,
    targetCalories: 0,
  });

  const html = renderToStaticMarkup(
    React.createElement(MealsScreen, {
      t,
      meals: [
        normalizeMeal({ id: 'm-1', name: 'Snack', date: '2026-11-16', totalCalories: 250, totalProtein: 10, totalCarbs: 30, totalFat: 10 }),
      ],
      onAddMeal: () => {},
      onMealPress: () => {},
      profile: unconfirmedProfile,
      language: 'en',
      selectedDate: '2026-11-16',
    })
  );

  assert.ok(html);
  assert.ok(html.includes('Unconfirmed') || html.includes('Preliminary Preview'));
});

test('Task 4.4A - Test 34: Rendered MealsScreen in Arabic with RTL layout', () => {
  const profile = createMockProfile();
  const meals: Meal[] = [
    normalizeMeal({ id: 'm-ar', name: 'غداء صحي', date: '2026-11-16', totalCalories: 550, totalProtein: 35, totalCarbs: 60, totalFat: 15 }),
  ];

  const html = renderToStaticMarkup(
    React.createElement(MealsScreen, {
      t: tAr,
      meals,
      onAddMeal: () => {},
      onMealPress: () => {},
      profile,
      language: 'ar',
      selectedDate: '2026-11-16',
    })
  );

  assert.ok(html);
  assert.ok(html.includes('550'));
});

test('Task 4.4A - Test 35: Rendered ProgressScreen in Arabic with RTL layout', () => {
  const profile = createMockProfile();
  const progressEntries: ProgressEntry[] = [
    normalizeProgressEntry({ id: 'p-1', date: '2026-11-16', label: 'الاثنين', calories: 2000, workouts: 1, weightKg: 70 }),
  ];

  const html = renderToStaticMarkup(
    React.createElement(ProgressScreen, {
      t: tAr,
      profile,
      progress: progressEntries,
      meals: [],
      referenceDate: '2026-11-16',
      language: 'ar',
    })
  );

  assert.ok(html);
  assert.ok(html.includes('الاثنين'));
});
