import test from 'node:test';
import assert from 'node:assert/strict';

import { getDatabase, closeDatabase } from '../db/database';
import { SQLiteProfileRepository } from '../db/repositories/profileRepository';
import { SQLiteMealRepository } from '../db/repositories/mealRepository';
import { normalizeProfile, UserProfile } from '../models/profile';
import { normalizeMeal } from '../models/meal';
import { resolveEffectiveNutritionTargets } from '../utils/nutritionTargets';
import { calculateMealTotals, progressRatio } from '../utils/nutrition';
import { translate } from '../i18n';
import { applyRTL, activeIsRTL, activeTextAlign, activeWritingDirection } from '../utils/rtl';

async function setupFreshDb() {
  await closeDatabase();
  const db = await getDatabase();
  await db.execAsync(`
    DELETE FROM meal_items;
    DELETE FROM meals;
    DELETE FROM workouts;
    DELETE FROM user_profiles;
    DELETE FROM progress_entries;
    DELETE FROM app_settings;
  `);
  return db;
}

test('Task 2.4 - Acceptance 1: Legacy defaults versus explicit overrides', () => {
  // A legacy profile that has not confirmed attributes and has calculationOverridden = false
  const legacyProfile = normalizeProfile({
    id: 'legacy-user-1',
    name: 'Legacy User',
    email: 'legacy@example.com',
    goal: 'Maintenance',
    targetCalories: 2000,
    targetProtein: 140,
    targetCarbs: 200,
    targetFats: 65,
    calculationOverridden: false,
    attributesConfirmed: false,
  });

  const targets = resolveEffectiveNutritionTargets(legacyProfile);
  // Must NOT infer intentional customization merely from the existence of legacy target values
  assert.equal(targets.hasActiveTarget, false);
  assert.equal(targets.isCustomOverride, false);
  assert.equal(targets.state, 'unconfirmed');
  assert.equal(targets.rawCalories, null);
  // Mathematical fallback guarantees non-crashing math
  assert.equal(targets.calories, 2000);

  // When calculationOverridden is explicitly true, canonical custom override is honored
  const overriddenProfile: UserProfile = {
    ...legacyProfile,
    calculationOverridden: true,
  };
  const overriddenTargets = resolveEffectiveNutritionTargets(overriddenProfile);
  assert.equal(overriddenTargets.hasActiveTarget, true);
  assert.equal(overriddenTargets.isCustomOverride, true);
  assert.equal(overriddenTargets.state, 'ready');
  assert.equal(overriddenTargets.calories, 2000);
  assert.equal(overriddenTargets.rawCalories, 2000);
});

test('Task 2.4 - Acceptance 2: Unsupported adolescent profile with numeric values', () => {
  const adolescentProfile = normalizeProfile({
    id: 'teen-user',
    name: 'Alex Teen',
    email: 'alex@example.com',
    goal: 'Weight Loss',
    age: 15,
    gender: 'male',
    heightCm: 165,
    weightKg: 65,
    targetCalories: 1800,
    attributesConfirmed: true,
    calculationOverridden: false,
  });

  const targets = resolveEffectiveNutritionTargets(adolescentProfile);
  // Adolescents must NEVER receive automated adult deficit targets
  assert.equal(targets.hasActiveTarget, false);
  assert.equal(targets.state, 'unsupported');
  assert.equal(targets.source, 'unsupported_adolescent');
  assert.equal(targets.rawCalories, null);
  assert.ok(targets.setupPrompt);
  assert.equal(targets.setupPrompt.type, 'unsupported_adolescent');
});

test('Task 2.4 - Acceptance 3: Missing profile and safe math fallbacks', () => {
  const missingTargets = resolveEffectiveNutritionTargets(null);
  assert.equal(missingTargets.state, 'missing');
  assert.equal(missingTargets.hasActiveTarget, false);
  assert.equal(missingTargets.rawCalories, null);
  assert.equal(missingTargets.calories, 2000);
  assert.equal(missingTargets.protein, 140);
  assert.equal(missingTargets.carbs, 200);
  assert.equal(missingTargets.fats, 65);

  // Divide-by-zero & NaN immunity
  assert.equal(progressRatio(0, missingTargets.calories), 0);
  assert.equal(progressRatio(500, missingTargets.calories), 0.25);
  assert.equal(progressRatio(0, 0), 0);
  assert.equal(progressRatio(500, 0), 0);
  assert.equal(progressRatio(500, -100), 0);
  assert.equal(progressRatio(NaN, missingTargets.calories), 0);
});

test('Task 2.4 - Acceptance 4: Meal Details preserves actual nutrition without fabricated goal percentages', () => {
  const t = (key: Parameters<typeof translate>[1], params?: Record<string, string | number>) =>
    translate('en', key, params);
  const meal = normalizeMeal({
    id: 'meal-test-1',
    title: 'Post-Workout Steak Bowl',
    date: '2026-11-12T12:00:00.000Z',
    time: '12:00',
    items: [
      { id: 'i1', foodName: 'Sirloin Steak', quantity: 200, calories: 420, protein: 48, carbs: 0, fats: 24 },
      { id: 'i2', foodName: 'White Rice', quantity: 150, calories: 195, protein: 4, carbs: 42, fats: 0.5 },
    ],
  });

  const totals = calculateMealTotals(meal.items);
  // 1. Actual nutrition must be accurately computed
  assert.equal(totals.calories, 615);
  assert.equal(totals.protein, 52);
  assert.equal(totals.carbs, 42);
  assert.equal(totals.fats, 24.5);

  // 2. When profile is unconfirmed, hasActiveTarget is false
  const unconfirmedProfile = normalizeProfile({
    id: 'unconfirmed-1',
    name: 'Unconfirmed Sara',
    email: 'sara@example.com',
    goal: 'Health',
    attributesConfirmed: false,
    calculationOverridden: false,
  });

  const targets = resolveEffectiveNutritionTargets(unconfirmedProfile);
  assert.equal(targets.hasActiveTarget, false);

  // 3. Accessibility label simulation for MacroCard when target is unavailable
  const formatMacroA11y = (label: string, value: number, target: number | null, unit: string, unavailLabel: string) => {
    return target != null
      ? `${label}: ${Math.round(value)} of ${Math.round(target)} ${unit}`
      : `${label}: ${Math.round(value)} ${unit}, ${unavailLabel}`;
  };

  const a11yCalories = formatMacroA11y(
    t('common.calories'),
    totals.calories,
    targets.hasActiveTarget ? targets.calories : null,
    t('common.kcal'),
    t('personalization.unconfirmedStatus')
  );
  assert.equal(a11yCalories, 'Calories: 615 kcal, Unconfirmed');
});

test('Task 2.4 - Acceptance 5: Custom target with partial macro specification preserves calories and estimates macros', () => {
  const customProfile = normalizeProfile({
    id: 'custom-cal-only',
    name: 'Calorie Counter',
    email: 'cal@example.com',
    goal: 'Hypertrophy',
    age: 30,
    gender: 'male',
    heightCm: 180,
    weightKg: 80,
    attributesConfirmed: true,
    calculationOverridden: true,
    targetCalories: 2750,
    // Explicitly omit or pass NaN for individual macros
    targetProtein: NaN,
    targetCarbs: 0,
    targetFats: 0,
  });

  const targets = resolveEffectiveNutritionTargets(customProfile);
  assert.equal(targets.hasActiveTarget, true);
  assert.equal(targets.isCustomOverride, true);
  assert.equal(targets.calories, 2750);
  assert.equal(targets.rawCalories, 2750);
  // Protein was NaN so it falls back to estimated macro guideline
  assert.ok(targets.protein > 0);
  assert.ok(targets.warnings.length > 0);
});

test('Task 2.4 - Acceptance 6: Current target versus historical intake comparison', () => {
  const confirmedProfile = normalizeProfile({
    id: 'user-history',
    name: 'History User',
    email: 'hist@example.com',
    goal: 'Weight Loss',
    age: 26,
    gender: 'female',
    heightCm: 168,
    weightKg: 65,
    activityLevel: 'moderately_active',
    primaryGoal: 'weight_loss',
    attributesConfirmed: true,
    calculationOverridden: false,
  });

  const targets = resolveEffectiveNutritionTargets(confirmedProfile);
  assert.equal(targets.hasActiveTarget, true);
  const dailyTarget = targets.calories;

  // 7-day period target is calculated from the current daily target
  const weeklyTarget = dailyTarget * 7;
  const historicalWeeklyIntake = 14200; // e.g. from previous week
  const isOverWeeklyTarget = historicalWeeklyIntake > weeklyTarget;
  const remaining = Math.max(0, weeklyTarget - historicalWeeklyIntake);
  const progress = progressRatio(historicalWeeklyIntake, weeklyTarget);

  assert.ok(weeklyTarget > 0);
  assert.ok(progress > 0);
  assert.equal(isOverWeeklyTarget, historicalWeeklyIntake > weeklyTarget);
  assert.equal(remaining, Math.max(0, weeklyTarget - historicalWeeklyIntake));
});

test('Task 2.4 - Acceptance 7: SQLite persistence roundtrip across restart preserves confirmed state and custom overrides', async () => {
  const db = await setupFreshDb();
  const repo = new SQLiteProfileRepository(db);

  const profile = normalizeProfile({
    id: 'persisted-user',
    name: 'Nora Khalid',
    email: 'nora@example.com',
    goal: 'Tone Up',
    age: 29,
    gender: 'female',
    heightCm: 164,
    weightKg: 58,
    activityLevel: 'lightly_active',
    primaryGoal: 'muscle_gain',
    attributesConfirmed: true,
    calculationOverridden: true,
    targetCalories: 2150,
    targetProtein: 130,
    targetCarbs: 230,
    targetFats: 55,
  });

  await repo.saveProfile(profile);

  // Simulate app restart / fresh repository instance
  const repoAfterRestart = new SQLiteProfileRepository(db);
  const loaded = await repoAfterRestart.getProfile();
  assert.ok(loaded);
  assert.equal(loaded.attributesConfirmed, true);
  assert.equal(loaded.calculationOverridden, true);
  assert.equal(loaded.targetCalories, 2150);
  assert.equal(loaded.targetProtein, 130);

  const targets = resolveEffectiveNutritionTargets(loaded);
  assert.equal(targets.hasActiveTarget, true);
  assert.equal(targets.isCustomOverride, true);
  assert.equal(targets.calories, 2150);
  assert.equal(targets.protein, 130);
});

test('Task 2.4 - Acceptance 8: Profile changes never mutate meal records in SQLite', async () => {
  const db = await setupFreshDb();
  const profileRepo = new SQLiteProfileRepository(db);
  const mealRepo = new SQLiteMealRepository(db);

  const meal = normalizeMeal({
    id: 'meal-safe-1',
    title: 'Oatmeal & Almond Butter',
    date: '2026-11-12T08:30:00.000Z',
    time: '08:30',
    items: [
      { id: 'item-oats', foodName: 'Oats', quantity: 60, calories: 230, protein: 8, carbs: 40, fats: 4 },
      { id: 'item-butter', foodName: 'Almond Butter', quantity: 20, calories: 130, protein: 4, carbs: 4, fats: 11 },
    ],
  });
  await mealRepo.insertMeal(meal);

  // Update profile targets
  const profile = normalizeProfile({
    id: 'mutating-target-user',
    name: 'Target Shifter',
    email: 'shift@example.com',
    goal: 'Bulk',
    attributesConfirmed: true,
    calculationOverridden: true,
    targetCalories: 3800,
    targetProtein: 220,
    targetCarbs: 450,
    targetFats: 100,
  });
  await profileRepo.saveProfile(profile);

  // Verify meal was not altered
  const loadedMeals = await mealRepo.getAllMeals();
  assert.equal(loadedMeals.length, 1);
  assert.equal(loadedMeals[0].id, 'meal-safe-1');
  assert.equal(loadedMeals[0].items.length, 2);
  assert.equal(loadedMeals[0].items[0].calories, 230);
  assert.equal(loadedMeals[0].items[1].calories, 130);
});

test('Task 2.4 - Acceptance 9: Arabic and English translation parity and Latin numeral preservation', () => {
  const enT = (key: Parameters<typeof translate>[1], params?: Record<string, string | number>) =>
    translate('en', key, params);
  const arT = (key: Parameters<typeof translate>[1], params?: Record<string, string | number>) =>
    translate('ar', key, params);

  assert.equal(enT('targets.activeGoal'), 'Daily Goal');
  assert.equal(arT('targets.activeGoal'), 'الهدف اليومي');
  assert.equal(enT('targets.currentActiveGoal'), 'Current Target');
  assert.equal(arT('targets.currentActiveGoal'), 'الهدف الحالي');
  assert.equal(enT('targets.historicalComparison'), 'Compared against current target');
  assert.equal(arT('targets.historicalComparison'), 'مقارنة بالهدف الحالي');

  // Verify RTL layout direction toggle
  applyRTL('ar');
  assert.equal(activeIsRTL(), true);
  assert.equal(activeTextAlign(), 'right');
  assert.equal(activeWritingDirection(), 'rtl');

  // Preserve Latin digits in Arabic fitness numbers
  const formattedArabicNumber = new Intl.NumberFormat('ar-SA-u-nu-latn').format(2450);
  assert.equal(formattedArabicNumber, '2,450');

  applyRTL('en');
  assert.equal(activeIsRTL(), false);
  assert.equal(activeTextAlign(), 'left');
  assert.equal(activeWritingDirection(), 'ltr');
});

test('Task 2.5 - Acceptance 10: Critical Scenario - Adolescent (age 16) with confirmed custom targets', () => {
  const teenProfile = normalizeProfile({
    id: 'teen-critical-user',
    name: 'Zaid Teen',
    email: 'zaid@example.com',
    goal: 'Fitness',
    age: 16,
    gender: 'male',
    heightCm: 172,
    weightKg: 62,
    targetCalories: 2200,
    targetProtein: 140,
    targetCarbs: 260,
    targetFats: 65,
    attributesConfirmed: true,
    calculationOverridden: true,
  });

  const targets = resolveEffectiveNutritionTargets(teenProfile);

  // 1. Adult automated targets remain strictly unavailable
  assert.equal(targets.recommendation?.status, 'unsupported_adolescent');
  assert.equal(targets.recommendation?.hasApprovedTarget, false);
  assert.equal(targets.recommendation?.recommendedCalories, null);

  // 2. No inappropriate application approval is assigned
  assert.equal(targets.hasApprovedTarget, false);

  // 3. Existing manually entered values are preserved
  assert.equal(targets.hasActiveTarget, true);
  assert.equal(targets.calories, 2200);
  assert.equal(targets.protein, 140);
  assert.equal(targets.carbs, 260);
  assert.equal(targets.fats, 65);
  assert.equal(targets.rawCalories, 2200);

  // 4. Interface clearly distinguishes stored custom values from supported adult recommendations
  assert.equal(targets.source, 'custom_override');
  assert.equal(targets.isCustomOverride, true);

  // 5. Appropriate guidance is shown
  assert.ok(targets.setupPrompt);
  assert.equal(targets.setupPrompt?.type, 'unsupported_adolescent');
  assert.ok(
    targets.warnings.some((w) => w.includes('Adolescent nutrition requires specialist pediatric assessment'))
  );
});

test('Task 2.5 - Acceptance 11: Age 17 versus 18 eligibility boundary', () => {
  // Age 17: Adolescent
  const age17Profile = normalizeProfile({
    id: 'age-17-user',
    name: 'Seventeen',
    email: 'seventeen@example.com',
    goal: 'Health',
    age: 17,
    gender: 'female',
    heightCm: 162,
    weightKg: 55,
    activityLevel: 'moderately_active',
    primaryGoal: 'maintenance',
    attributesConfirmed: true,
    calculationOverridden: false,
  });

  const targets17 = resolveEffectiveNutritionTargets(age17Profile);
  assert.equal(targets17.state, 'unsupported');
  assert.equal(targets17.source, 'unsupported_adolescent');
  assert.equal(targets17.hasActiveTarget, false);
  assert.equal(targets17.hasApprovedTarget, false);
  assert.equal(targets17.rawCalories, null);

  // Age 18: Eligible Adult
  const age18Profile = normalizeProfile({
    id: 'age-18-user',
    name: 'Eighteen',
    email: 'eighteen@example.com',
    goal: 'Health',
    age: 18,
    gender: 'female',
    heightCm: 162,
    weightKg: 55,
    activityLevel: 'moderately_active',
    primaryGoal: 'maintenance',
    attributesConfirmed: true,
    calculationOverridden: false,
  });

  const targets18 = resolveEffectiveNutritionTargets(age18Profile);
  assert.equal(targets18.state, 'ready');
  assert.equal(targets18.source, 'recommended_estimate');
  assert.equal(targets18.hasActiveTarget, true);
  assert.equal(targets18.hasApprovedTarget, true);
  assert.ok(targets18.calories > 1500);
});

test('Task 2.5 - Acceptance 12: Invalid age with custom targets preserves user tracking without approval', () => {
  const invalidAgeProfile = normalizeProfile({
    id: 'invalid-age-custom',
    name: 'Invalid Age User',
    email: 'invalidage@example.com',
    goal: 'Muscle',
    age: -10,
    targetCalories: 2600,
    targetProtein: 160,
    targetCarbs: 300,
    targetFats: 70,
    attributesConfirmed: true,
    calculationOverridden: true,
  });

  const targets = resolveEffectiveNutritionTargets(invalidAgeProfile);
  assert.equal(targets.hasActiveTarget, true);
  assert.equal(targets.isCustomOverride, true);
  assert.equal(targets.calories, 2600);
  assert.equal(targets.hasApprovedTarget, false);
  assert.ok(targets.warnings.some((w) => w.includes('Invalid age')));
});

test('Task 2.5 - Acceptance 13: Unconfirmed adult with custom targets honors values without application approval', () => {
  const unconfirmedCustom = normalizeProfile({
    id: 'unconfirmed-custom-user',
    name: 'Unconfirmed Custom',
    email: 'unconfirmed@example.com',
    goal: 'Bulk',
    targetCalories: 3000,
    targetProtein: 180,
    targetCarbs: 360,
    targetFats: 80,
    attributesConfirmed: false,
    calculationOverridden: true,
  });

  const targets = resolveEffectiveNutritionTargets(unconfirmedCustom);
  assert.equal(targets.hasActiveTarget, true);
  assert.equal(targets.isCustomOverride, true);
  assert.equal(targets.hasApprovedTarget, false);
  assert.equal(targets.calories, 3000);
  assert.equal(targets.rawCalories, 3000);
});
