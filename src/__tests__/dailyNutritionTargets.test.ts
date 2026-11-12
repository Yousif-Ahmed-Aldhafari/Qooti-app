import test from 'node:test';
import assert from 'node:assert/strict';

import { getDatabase, closeDatabase } from '../db/database';
import { SQLiteMealRepository } from '../db/repositories/mealRepository';
import { SQLiteProfileRepository } from '../db/repositories/profileRepository';
import { normalizeMeal } from '../models/meal';
import { normalizeProfile, type UserProfile, DEFAULT_PROFILE_ATTRIBUTES } from '../models/profile';
import { calculateDailyNutrition, progressRatio } from '../utils/nutrition';
import { resolveEffectiveNutritionTargets } from '../utils/nutritionTargets';
import { translate } from '../i18n';
import { applyRTL, activeIsRTL, activeTextAlign, activeWritingDirection } from '../utils/rtl';
import { setActiveTheme, themeColors } from '../theme/colors';

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

test('Daily Targets 1: Confirmed adult recommended targets resolved cleanly', () => {
  const confirmedAdult = normalizeProfile({
    id: 'user-confirmed-adult',
    name: 'Adult User',
    email: 'adult@example.com',
    goal: 'Weight Loss',
    age: 28,
    gender: 'female',
    bmrBiologicalReference: 'female',
    heightCm: 165,
    weightKg: 65,
    activityLevel: 'moderately_active',
    primaryGoal: 'weight_loss',
    weeklyGoalRate: 'moderate',
    dietaryPreference: 'high_protein',
    attributesConfirmed: true,
    calculationOverridden: false,
  });

  const targets = resolveEffectiveNutritionTargets(confirmedAdult);
  assert.equal(targets.state, 'ready');
  assert.equal(targets.source, 'recommended_estimate');
  assert.equal(targets.hasActiveTarget, true);
  assert.equal(targets.hasApprovedTarget, true);
  assert.equal(targets.isCustomOverride, false);
  assert.ok(targets.calories > 1200);
  assert.ok(targets.protein > 50);
  assert.equal(targets.rawCalories, targets.calories);
  assert.equal(targets.rawProtein, targets.protein);
  assert.ok(targets.bmr !== null && targets.bmr > 1000);
  assert.ok(targets.tdee !== null && targets.tdee > targets.bmr);
});

test('Daily Targets 2: User-customized targets take precedence over recommendations', () => {
  const customUser = normalizeProfile({
    id: 'user-custom-targets',
    name: 'Custom User',
    email: 'custom@example.com',
    goal: 'Bodybuilding',
    age: 29,
    gender: 'male',
    heightCm: 180,
    weightKg: 85,
    activityLevel: 'very_active',
    primaryGoal: 'muscle_gain',
    targetCalories: 3200,
    targetProtein: 210,
    targetCarbs: 350,
    targetFats: 80,
    attributesConfirmed: true,
    calculationOverridden: true,
  });

  const targets = resolveEffectiveNutritionTargets(customUser);
  assert.equal(targets.state, 'ready');
  assert.equal(targets.source, 'custom_override');
  assert.equal(targets.hasActiveTarget, true);
  assert.equal(targets.isCustomOverride, true);
  assert.equal(targets.calories, 3200);
  assert.equal(targets.protein, 210);
  assert.equal(targets.carbs, 350);
  assert.equal(targets.fats, 80);
});

test('Daily Targets 3: Reset to recommended restores algorithmic recommendations', () => {
  const user = normalizeProfile({
    id: 'user-reset-test',
    name: 'Reset User',
    email: 'reset@example.com',
    goal: 'Maintain',
    age: 30,
    gender: 'female',
    bmrBiologicalReference: 'female',
    heightCm: 168,
    weightKg: 60,
    activityLevel: 'moderately_active',
    primaryGoal: 'maintenance',
    targetCalories: 2800,
    targetProtein: 180,
    targetCarbs: 250,
    targetFats: 70,
    attributesConfirmed: true,
    calculationOverridden: true,
  });

  // While overridden: uses custom 2800 kcal
  const customTargets = resolveEffectiveNutritionTargets(user);
  assert.equal(customTargets.calories, 2800);
  assert.equal(customTargets.isCustomOverride, true);

  // When reset: calculationOverridden becomes false
  const resetUser = { ...user, calculationOverridden: false };
  const recTargets = resolveEffectiveNutritionTargets(resetUser);
  assert.equal(recTargets.source, 'recommended_estimate');
  assert.equal(recTargets.isCustomOverride, false);
  assert.notEqual(recTargets.calories, 2800);
});

test('Daily Targets 4: Unconfirmed profile never activates preliminary estimates automatically', () => {
  const unconfirmed = normalizeProfile({
    id: 'user-unconfirmed',
    name: 'Unconfirmed',
    email: 'unconfirmed@example.com',
    goal: 'Health',
    age: 25,
    heightCm: 175,
    weightKg: 70,
    attributesConfirmed: false,
    calculationOverridden: false,
  });

  const targets = resolveEffectiveNutritionTargets(unconfirmed);
  assert.equal(targets.state, 'unconfirmed');
  assert.equal(targets.source, 'unconfirmed_estimate');
  assert.equal(targets.hasActiveTarget, false);
  assert.equal(targets.hasApprovedTarget, false);
  assert.equal(targets.rawCalories, null);
  // Safe mathematical fallback prevents divide-by-zero or NaN
  assert.equal(targets.calories, 2000);
  assert.ok(targets.setupPrompt);
  assert.equal(targets.setupPrompt.type, 'unconfirmed');
});

test('Daily Targets 5: Under-18 profile strictly disables adult targets', () => {
  const adolescent = normalizeProfile({
    id: 'user-adolescent',
    name: 'Young User',
    email: 'young@example.com',
    goal: 'Lose Weight',
    age: 16,
    heightCm: 168,
    weightKg: 64,
    activityLevel: 'moderately_active',
    primaryGoal: 'weight_loss',
    weeklyGoalRate: 'aggressive',
    attributesConfirmed: true,
  });

  const targets = resolveEffectiveNutritionTargets(adolescent);
  assert.equal(targets.state, 'unsupported');
  assert.equal(targets.source, 'unsupported_adolescent');
  assert.equal(targets.hasActiveTarget, false);
  assert.equal(targets.rawCalories, null);
  assert.ok(targets.setupPrompt);
  assert.equal(targets.setupPrompt.type, 'unsupported_adolescent');
});

test('Daily Targets 6: Conflicting dietary constraints do not activate conflicting numbers', () => {
  const conflictUser = normalizeProfile({
    id: 'user-conflict',
    name: 'Conflict User',
    email: 'conflict@example.com',
    goal: 'Lose weight',
    age: 60,
    gender: 'female',
    weightKg: 200,
    heightCm: 150,
    activityLevel: 'sedentary',
    primaryGoal: 'weight_loss',
    weeklyGoalRate: 'aggressive',
    dietaryPreference: 'high_protein',
    attributesConfirmed: true,
    calculationOverridden: false,
  });

  const targets = resolveEffectiveNutritionTargets(conflictUser);
  assert.equal(targets.state, 'conflicting');
  assert.equal(targets.source, 'conflicting_constraints');
  assert.equal(targets.hasActiveTarget, false);
  assert.equal(targets.rawCalories, null);
  assert.ok(targets.setupPrompt);
  assert.equal(targets.setupPrompt.type, 'conflicting_constraints');
});

test('Daily Targets 7: Missing and invalid numerical targets provide safe math fallbacks without activating fake goals', () => {
  // Undefined profile
  const missing = resolveEffectiveNutritionTargets(null);
  assert.equal(missing.state, 'missing');
  assert.equal(missing.hasActiveTarget, false);
  assert.equal(missing.rawCalories, null);
  assert.equal(missing.calories, 2000, 'Must provide safe fallback to avoid divide-by-zero');

  // Negative / 0 custom calories
  const invalidCustom = normalizeProfile({
    id: 'user-invalid-custom',
    name: 'Invalid',
    email: 'invalid@example.com',
    goal: 'None',
    targetCalories: -100,
    calculationOverridden: true,
  });
  const invalidResult = resolveEffectiveNutritionTargets(invalidCustom);
  assert.equal(invalidResult.state, 'invalid');
  assert.equal(invalidResult.hasActiveTarget, false);
  assert.equal(invalidResult.rawCalories, null);
  assert.equal(invalidResult.calories, 2000);
});

test('Daily Targets 8: Meal aggregation calculates daily consumed totals accurately', () => {
  const today = new Date().toISOString().slice(0, 10);
  const sampleMeals = [
    normalizeMeal({
      id: 'm1',
      title: 'Breakfast',
      date: `${today}T08:00:00.000Z`,
      time: '08:00',
      items: [
        { id: 'i1', foodName: 'Oatmeal', calories: 300, protein: 10, carbs: 55, fats: 5 },
        { id: 'i2', foodName: 'Eggs', calories: 210, protein: 18, carbs: 2, fats: 15 },
      ],
    }),
    normalizeMeal({
      id: 'm2',
      title: 'Lunch',
      date: `${today}T13:00:00.000Z`,
      time: '13:00',
      items: [
        { id: 'i3', foodName: 'Chicken Breast', calories: 350, protein: 60, carbs: 0, fats: 8 },
        { id: 'i4', foodName: 'Rice', calories: 250, protein: 6, carbs: 50, fats: 2 },
      ],
    }),
  ];

  const totals = calculateDailyNutrition(sampleMeals);
  assert.equal(totals.calories, 1110);
  assert.equal(totals.protein, 94);
  assert.equal(totals.carbs, 107);
  assert.equal(totals.fats, 30);
});

test('Daily Targets 9: Dashboard progress ratio computes accurately without NaN or divide-by-zero', () => {
  // Standard ratio
  assert.equal(progressRatio(1000, 2000), 0.5);

  // Exact completion
  assert.equal(progressRatio(2000, 2000), 1);

  // Clamped at 1 for visual progress bars
  assert.equal(progressRatio(2500, 2000), 1);

  // Zero target defense
  assert.equal(progressRatio(500, 0), 0);

  // Negative / NaN inputs
  assert.equal(progressRatio(-100, 2000), 0);
  assert.equal(progressRatio(NaN as any, 2000), 0);
  assert.equal(progressRatio(500, NaN as any), 0);
});

test('Daily Targets 10: Over-target consumption calculates remaining and overage correctly', () => {
  const targetCalories = 2000;
  const consumedCalories = 2350;

  const remaining = Math.max(0, targetCalories - consumedCalories);
  const overage = consumedCalories > targetCalories ? consumedCalories - targetCalories : 0;

  assert.equal(remaining, 0);
  assert.equal(overage, 350);

  const overageString = translate('en', 'targets.caloriesOver', { amount: overage });
  assert.equal(overageString, '+350 kcal over target');
});

test('Daily Targets 11: Profile editing updates effective targets immediately without reload', () => {
  let profile = normalizeProfile({
    id: 'user-edit-sync',
    name: 'Dynamic User',
    email: 'dynamic@example.com',
    goal: 'Health',
    age: 27,
    gender: 'female',
    bmrBiologicalReference: 'female',
    heightCm: 165,
    weightKg: 60,
    activityLevel: 'moderately_active',
    primaryGoal: 'maintenance',
    attributesConfirmed: true,
    calculationOverridden: false,
  });

  const initialTargets = resolveEffectiveNutritionTargets(profile);
  assert.equal(initialTargets.state, 'ready');

  // User edits weight from 60kg to 75kg
  profile = normalizeProfile({
    ...profile,
    weightKg: 75,
  });

  const updatedTargets = resolveEffectiveNutritionTargets(profile);
  assert.equal(updatedTargets.state, 'ready');
  assert.ok(updatedTargets.calories > initialTargets.calories);
  assert.ok(updatedTargets.protein > initialTargets.protein);
});

test('Daily Targets 12: Application restart preserves confirmed targets from SQLite', async () => {
  const db = await setupFreshDb();
  const repo = new SQLiteProfileRepository(db);

  const profile: UserProfile = {
    ...DEFAULT_PROFILE_ATTRIBUTES,
    id: 'restart-sync-user',
    name: 'Sync User',
    email: 'sync@example.com',
    goal: 'Lose Weight',
    avatarInitials: 'SU',
    heightCm: 175,
    weightKg: 80,
    targetCalories: 1950,
    targetProtein: 155,
    targetCarbs: 180,
    targetFats: 65,
    age: 31,
    gender: 'male',
    bmrBiologicalReference: 'male',
    primaryGoal: 'weight_loss',
    weeklyGoalRate: 'moderate',
    activityLevel: 'moderately_active',
    attributesConfirmed: true,
    calculationOverridden: false,
  };

  await repo.saveProfile(profile);

  // Simulate restart by closing and reopening
  await closeDatabase();
  const newDb = await getDatabase();
  const newRepo = new SQLiteProfileRepository(newDb);
  const loaded = await newRepo.getProfile();

  assert.ok(loaded);
  const targets = resolveEffectiveNutritionTargets(loaded);
  assert.equal(targets.state, 'ready');
  assert.equal(targets.hasActiveTarget, true);
  assert.equal(targets.calories, 2203);
});

test('Daily Targets 13: Profile target changes never mutate or destroy existing meal records', async () => {
  const db = await setupFreshDb();
  const mealRepo = new SQLiteMealRepository(db);
  const profileRepo = new SQLiteProfileRepository(db);

  // 1. Save meal record
  const meal = normalizeMeal({
    id: 'preserved-meal-1',
    title: 'Post-Workout Shake',
    date: '2026-11-12T10:00:00.000Z',
    time: '10:00',
    items: [{ id: 'item-1', foodName: 'Whey Protein', quantity: 1, calories: 150, protein: 30, carbs: 3, fats: 2 }],
  });
  await mealRepo.insertMeal(meal);

  // 2. Change profile target drastically
  const profile = normalizeProfile({
    id: 'target-changer',
    name: 'Changer',
    email: 'changer@example.com',
    goal: 'Bulk',
    targetCalories: 4000,
    targetProtein: 250,
    calculationOverridden: true,
    attributesConfirmed: true,
  });
  await profileRepo.saveProfile(profile);

  // 3. Verify meal record remained 100% intact
  const loadedMeals = await mealRepo.getAllMeals();
  assert.equal(loadedMeals.length, 1);
  assert.equal(loadedMeals[0].title, 'Post-Workout Shake');
  assert.equal(loadedMeals[0].items[0].calories, 150);
  assert.equal(loadedMeals[0].items[0].protein, 30);
});

test('Daily Targets 14: Bilingual translation and Latin numeral preservation in Arabic', () => {
  // English translation keys
  assert.ok(translate('en', 'targets.unconfirmedPrompt'));
  assert.ok(translate('en', 'targets.caloriesOver', { amount: 200 }));
  assert.ok(translate('en', 'targets.activeGoal'));
  assert.ok(translate('en', 'targets.customTarget'));

  // Arabic translation keys
  assert.ok(translate('ar', 'targets.unconfirmedPrompt'));
  assert.ok(translate('ar', 'targets.caloriesOver', { amount: 200 }));
  assert.ok(translate('ar', 'targets.activeGoal'));
  assert.ok(translate('ar', 'targets.customTarget'));

  // RTL layout direction
  applyRTL('ar');
  assert.equal(activeIsRTL(), true);
  assert.equal(activeTextAlign(), 'right');
  assert.equal(activeWritingDirection(), 'rtl');

  // Latin numeral formatting in Arabic
  const formattedLatinNum = new Intl.DateTimeFormat('ar-SA-u-nu-latn', { year: 'numeric' }).format(new Date(2026, 0, 1));
  assert.equal(formattedLatinNum, '2026');

  applyRTL('en');
  assert.equal(activeIsRTL(), false);
});

test('Daily Targets 15: Light and Dark theme compatibility for target and progress components', () => {
  setActiveTheme('light');
  const light = themeColors();
  assert.ok(light.background);
  assert.ok(light.card);
  assert.ok(light.accent);
  assert.ok(light.calories);
  assert.ok(light.limeSoft);

  setActiveTheme('dark');
  const dark = themeColors();
  assert.ok(dark.background);
  assert.ok(dark.card);
  assert.ok(dark.accent);
  assert.ok(dark.calories);
  assert.ok(dark.limeSoft);
});
