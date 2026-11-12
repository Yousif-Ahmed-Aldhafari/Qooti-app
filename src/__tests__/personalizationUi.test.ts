import test from 'node:test';
import assert from 'node:assert/strict';
import { Platform } from 'react-native';

import { getDatabase, closeDatabase } from '../db/database';
import { SQLiteProfileRepository } from '../db/repositories/profileRepository';
import { normalizeProfile, type UserProfile, DEFAULT_PROFILE_ATTRIBUTES } from '../models/profile';
import {
  calculateBMR,
  calculateFullRecommendation,
  validateProfileEligibility,
} from '../utils/personalization';
import { translate } from '../i18n';
import { activeIsRTL, activeTextAlign, activeWritingDirection, applyRTL } from '../utils/rtl';
import { getPressFeedback, MIN_TOUCH_TARGET } from '../utils/touchFeedback';
import { setActiveTheme, themeColors } from '../theme/colors';

async function setupFreshDb() {
  await closeDatabase();
  const db = await getDatabase();
  await db.execAsync(`
    DELETE FROM meals;
    DELETE FROM workouts;
    DELETE FROM user_profiles;
    DELETE FROM progress_entries;
    DELETE FROM app_settings;
  `);
  return db;
}

test('UI 1: Fresh onboarding completion sets confirmed attributes and approved targets', async () => {
  const freshDraft = normalizeProfile({
    id: 'user-fresh-1',
    name: 'Fresh User',
    email: 'fresh@example.com',
    goal: 'general_health',
    age: 26,
    gender: 'female',
    bmrBiologicalReference: 'female',
    heightCm: 165,
    weightKg: 62,
    activityLevel: 'moderately_active',
    primaryGoal: 'weight_loss',
    weeklyGoalRate: 'moderate',
    dietaryPreference: 'high_protein',
    attributesConfirmed: true,
  });

  const rec = calculateFullRecommendation(freshDraft);
  assert.equal(rec.status, 'eligible');
  assert.equal(rec.recommendationState, 'recommended_estimate');
  assert.equal(rec.hasApprovedTarget, true);
  assert.ok(rec.recommendedCalories !== null && rec.recommendedCalories > 1200);
  assert.ok(rec.recommendedProtein !== null && rec.recommendedProtein > 50);

  // Apply targets as completed onboarding does
  const completedProfile: UserProfile = {
    ...freshDraft,
    targetCalories: rec.recommendedCalories!,
    targetProtein: rec.recommendedProtein!,
    targetCarbs: rec.recommendedCarbs!,
    targetFats: rec.recommendedFats!,
    attributesConfirmed: true,
    calculationOverridden: false,
  };

  const db = await setupFreshDb();
  const repo = new SQLiteProfileRepository(db);
  await repo.saveProfile(completedProfile);

  const loaded = await repo.getProfile();
  assert.ok(loaded);
  assert.equal(loaded.age, 26);
  assert.equal(loaded.gender, 'female');
  assert.equal(loaded.bmrBiologicalReference, 'female');
  assert.equal(loaded.targetCalories, rec.recommendedCalories);
  assert.equal(loaded.attributesConfirmed, true);
  assert.equal(loaded.calculationOverridden, false);
});

test('UI 2: Existing user profile upgrades safely without losing data or custom targets', async () => {
  const db = await setupFreshDb();
  const repo = new SQLiteProfileRepository(db);

  // Older profile with custom target overrides and unconfirmed attributes
  const existingV2User = normalizeProfile({
    id: 'existing-v2',
    name: 'Legacy User',
    email: 'legacy@example.com',
    goal: 'Build strength',
    heightCm: 180,
    weightKg: 85,
    targetCalories: 2650,
    targetProtein: 190,
    targetCarbs: 270,
    targetFats: 80,
    attributesConfirmed: false,
    calculationOverridden: true,
  });

  await repo.saveProfile(existingV2User);

  // Verify initial state
  const loadedInitial = await repo.getProfile();
  assert.ok(loadedInitial);
  assert.equal(loadedInitial.targetCalories, 2650);
  assert.equal(loadedInitial.calculationOverridden, true);
  assert.equal(loadedInitial.attributesConfirmed, false);

  // User later confirms attributes in ProfileScreen
  const updatedUser: UserProfile = {
    ...loadedInitial,
    age: 32,
    gender: 'male',
    bmrBiologicalReference: 'male',
    activityLevel: 'very_active',
    primaryGoal: 'muscle_gain',
    attributesConfirmed: true,
    // Custom overrides remain preserved!
    calculationOverridden: true,
  };

  await repo.saveProfile(updatedUser);

  const loadedUpdated = await repo.getProfile();
  assert.ok(loadedUpdated);
  assert.equal(loadedUpdated.age, 32);
  assert.equal(loadedUpdated.gender, 'male');
  assert.equal(loadedUpdated.bmrBiologicalReference, 'male');
  assert.equal(loadedUpdated.targetCalories, 2650, 'Custom calories must not be overwritten');
  assert.equal(loadedUpdated.attributesConfirmed, true);
  assert.equal(loadedUpdated.calculationOverridden, true);
});

test('UI 3: Profile editing calculates recommendations live without auto-overwriting manual targets', () => {
  const customUser = normalizeProfile({
    id: 'custom-1',
    name: 'Custom Target User',
    email: 'custom@example.com',
    goal: 'Custom Macros',
    age: 30,
    heightCm: 175,
    weightKg: 75,
    targetCalories: 3000,
    targetProtein: 220,
    targetCarbs: 320,
    targetFats: 90,
    calculationOverridden: true,
    attributesConfirmed: true,
  });

  // Algorithm recommendation is calculated
  const rec = calculateFullRecommendation(customUser);
  assert.equal(rec.hasCustomOverride, true);
  assert.deepEqual(rec.customTargets, {
    calories: 3000,
    protein: 220,
    carbs: 320,
    fats: 90,
  });
  // Algorithmic values differ from custom targets
  assert.notEqual(rec.recommendedCalories, 3000);
});

test('UI 4: Incomplete and invalid inputs fail eligibility safely and cleanly', () => {
  // Negative age
  const invalidAge = validateProfileEligibility({ age: -5, heightCm: 170, weightKg: 70 });
  assert.equal(invalidAge.isEligible, false);
  assert.equal(invalidAge.status, 'invalid_inputs');

  // Extreme age > 120
  const extremeAge = validateProfileEligibility({ age: 140, heightCm: 170, weightKg: 70 });
  assert.equal(extremeAge.isEligible, false);
  assert.equal(extremeAge.status, 'invalid_inputs');

  // Zero weight
  const zeroWeight = validateProfileEligibility({ age: 25, heightCm: 170, weightKg: 0 });
  assert.equal(zeroWeight.isEligible, false);
  assert.equal(zeroWeight.status, 'invalid_inputs');

  // Recommendation engine returns unsupported state with null approved targets
  const rec = calculateFullRecommendation(
    normalizeProfile({
      id: 'bad-input',
      name: 'Bad',
      email: 'bad@example.com',
      goal: 'None',
      age: -10,
    })
  );
  assert.equal(rec.recommendationState, 'unsupported');
  assert.equal(rec.hasApprovedTarget, false);
  assert.equal(rec.recommendedCalories, null);
});

test('UI 5: Age eligibility disables adult deficit calculations for adolescent profiles', () => {
  const teenProfile = normalizeProfile({
    id: 'teen-1',
    name: 'Teen User',
    email: 'teen@example.com',
    goal: 'Lose weight',
    age: 15,
    heightCm: 160,
    weightKg: 65,
    activityLevel: 'moderately_active',
    primaryGoal: 'weight_loss',
    weeklyGoalRate: 'aggressive',
    attributesConfirmed: true,
  });

  const eligibility = validateProfileEligibility(teenProfile);
  assert.equal(eligibility.isEligible, false);
  assert.equal(eligibility.status, 'unsupported_adolescent');

  const rec = calculateFullRecommendation(teenProfile);
  assert.equal(rec.recommendationState, 'unsupported');
  assert.equal(rec.hasApprovedTarget, false);
  assert.equal(rec.recommendedCalories, null);
  assert.equal(rec.recommendedProtein, null);
  assert.ok(rec.professionalReviewReasons.length > 0);
  assert.ok(rec.professionalReviewReasons[0].includes('pediatric'));
});

test('UI 6: Biological reference selection decouples physiological equation from gender identity', () => {
  const weight = 70;
  const height = 175;
  const age = 28;

  // Non-binary/other gender with explicit female reference
  const bmrFemaleRef = calculateBMR(weight, height, age, 'other', 'female');
  // MSJ female: 10*70 + 6.25*175 - 5*28 - 161 = 700 + 1093.75 - 140 - 161 = 1492.75 -> 1493
  assert.equal(bmrFemaleRef, 1493);

  // Non-binary/other gender with explicit male reference
  const bmrMaleRef = calculateBMR(weight, height, age, 'other', 'male');
  // MSJ male: 10*70 + 6.25*175 - 5*28 + 5 = 700 + 1093.75 - 140 + 5 = 1658.75 -> 1659
  assert.equal(bmrMaleRef, 1659);

  // Non-binary/other gender with unspecified reference (midpoint)
  const bmrMidpoint = calculateBMR(weight, height, age, 'other', undefined);
  // Midpoint: 10*70 + 6.25*175 - 5*28 - 78 = 700 + 1093.75 - 140 - 78 = 1575.75 -> 1576
  assert.equal(bmrMidpoint, 1576);

  assert.equal(bmrMaleRef > bmrMidpoint, true);
  assert.equal(bmrMidpoint > bmrFemaleRef, true);
});

test('UI 7: Unconfirmed attributes present preview estimates but no approved targets', () => {
  const unconfirmed = normalizeProfile({
    id: 'unconfirmed-1',
    name: 'Unconfirmed Adult',
    email: 'unconfirmed@example.com',
    goal: 'Health',
    age: 28,
    heightCm: 172,
    weightKg: 68,
    activityLevel: 'lightly_active',
    primaryGoal: 'maintenance',
    attributesConfirmed: false,
  });

  const rec = calculateFullRecommendation(unconfirmed);
  assert.equal(rec.recommendationState, 'unconfirmed_estimate');
  assert.equal(rec.isConfirmed, false);
  assert.equal(rec.hasApprovedTarget, false);
  assert.equal(rec.recommendedCalories, null);
  // Preliminary preview is available for preview UI
  assert.ok(rec.preliminaryEstimate !== null);
  assert.ok(rec.preliminaryEstimate.calories > 1500);
  assert.ok(rec.preliminaryEstimate.protein > 50);
});

test('UI 8: Diet constraint conflict triggers conflicting_constraints state', () => {
  const conflictUser = normalizeProfile({
    id: 'conflict-1',
    name: 'Conflict User',
    email: 'conflict@example.com',
    goal: 'Lose weight fast',
    age: 60,
    gender: 'female',
    weightKg: 200,
    heightCm: 150,
    activityLevel: 'sedentary',
    primaryGoal: 'weight_loss',
    weeklyGoalRate: 'aggressive',
    dietaryPreference: 'high_protein',
    attributesConfirmed: true,
  });

  const rec = calculateFullRecommendation(conflictUser);
  assert.equal(rec.recommendationState, 'conflicting_constraints');
  assert.equal(rec.dietConstraintSatisfied, false);
  assert.equal(rec.hasApprovedTarget, false);
  assert.equal(rec.recommendedCalories, null);
});

test('UI 9: SQLite persistence and simulated restart preserves all V3 fields', async () => {
  const db = await setupFreshDb();
  const repo = new SQLiteProfileRepository(db);

  const testProfile: UserProfile = {
    ...DEFAULT_PROFILE_ATTRIBUTES,
    id: 'persist-test-1',
    name: 'Persisted User',
    email: 'persist@example.com',
    goal: 'Weight Loss',
    avatarInitials: 'PU',
    heightCm: 182,
    weightKg: 88,
    targetCalories: 2150,
    targetProtein: 165,
    targetCarbs: 190,
    targetFats: 65,
    age: 34,
    gender: 'male',
    bmrBiologicalReference: 'male',
    primaryGoal: 'weight_loss',
    weeklyGoalRate: 'moderate',
    activityLevel: 'very_active',
    trainingExperience: 'intermediate',
    preferredWorkoutDays: 5,
    workoutLocationPreference: 'gym',
    availableEquipment: ['dumbbells', 'barbell', 'full_gym'],
    dietaryPreference: 'high_protein',
    mealsPerDayPreference: 4,
    allergiesRestrictions: ['dairy_free'],
    attributesConfirmed: true,
    calculationOverridden: false,
  };

  await repo.saveProfile(testProfile);

  // Close and reopen database to simulate full app restart
  await closeDatabase();
  const reopenedDb = await getDatabase();
  const newRepo = new SQLiteProfileRepository(reopenedDb);
  const loaded = await newRepo.getProfile();

  assert.ok(loaded);
  assert.equal(loaded.name, 'Persisted User');
  assert.equal(loaded.age, 34);
  assert.equal(loaded.gender, 'male');
  assert.equal(loaded.bmrBiologicalReference, 'male');
  assert.equal(loaded.heightCm, 182);
  assert.equal(loaded.weightKg, 88);
  assert.equal(loaded.targetCalories, 2150);
  assert.equal(loaded.targetProtein, 165);
  assert.equal(loaded.targetCarbs, 190);
  assert.equal(loaded.targetFats, 65);
  assert.equal(loaded.activityLevel, 'very_active');
  assert.equal(loaded.trainingExperience, 'intermediate');
  assert.equal(loaded.preferredWorkoutDays, 5);
  assert.equal(loaded.workoutLocationPreference, 'gym');
  assert.deepEqual(loaded.availableEquipment, ['dumbbells', 'barbell', 'full_gym']);
  assert.equal(loaded.dietaryPreference, 'high_protein');
  assert.equal(loaded.mealsPerDayPreference, 4);
  assert.deepEqual(loaded.allergiesRestrictions, ['dairy_free']);
  assert.equal(loaded.attributesConfirmed, true);
  assert.equal(loaded.calculationOverridden, false);
});

test('UI 10: Arabic and English layout direction and translation keys', () => {
  // Test Arabic RTL
  applyRTL('ar');
  assert.equal(activeIsRTL(), true);
  assert.equal(activeTextAlign(), 'right');
  assert.equal(activeWritingDirection(), 'rtl');

  assert.ok(translate('ar', 'personalization.step1Title'));
  assert.ok(translate('ar', 'personalization.confirmAttributes'));
  assert.ok(translate('ar', 'personalization.unsupportedAdolescent'));
  assert.ok(translate('ar', 'personalization.editAttributes'));

  // Test English LTR
  applyRTL('en');
  assert.equal(activeIsRTL(), false);
  assert.equal(activeTextAlign(), 'left');
  assert.equal(activeWritingDirection(), 'ltr');

  assert.ok(translate('en', 'personalization.step1Title'));
  assert.ok(translate('en', 'personalization.confirmAttributes'));
  assert.ok(translate('en', 'personalization.unsupportedAdolescent'));
  assert.ok(translate('en', 'personalization.editAttributes'));
});

test('UI 11: Theme colors and WCAG contrast tokens in light and dark modes', () => {
  // Test Light Theme
  setActiveTheme('light');
  const lightColors = themeColors();
  assert.equal(lightColors.background, '#F7F8F3');
  assert.equal(lightColors.text, '#171A1A');
  assert.ok(lightColors.card);
  assert.ok(lightColors.accent);

  // Test Dark Theme
  setActiveTheme('dark');
  const darkColors = themeColors();
  assert.equal(darkColors.background, '#181A1B');
  assert.equal(darkColors.text, '#FFFFFF');
  assert.ok(darkColors.card);
  assert.ok(darkColors.accent);
});

test('UI 12: Platform-native touch behavior and minimum targets (Android vs iOS)', () => {
  // Android ripple feedback
  Platform.setOS('android');
  const androidFeedback = getPressFeedback({
    rippleColor: 'rgba(47, 158, 103, 0.2)',
    activeOpacity: 0.72,
  });
  assert.ok(androidFeedback.android_ripple);
  assert.equal(MIN_TOUCH_TARGET.android, 48);

  // iOS smooth opacity dimming
  Platform.setOS('ios');
  const iosFeedback = getPressFeedback({
    rippleColor: 'rgba(47, 158, 103, 0.2)',
    activeOpacity: 0.72,
  });
  assert.equal(iosFeedback.android_ripple, undefined);
  assert.deepEqual(iosFeedback.styleModifier({ pressed: true }), { opacity: 0.72 });
  assert.equal(MIN_TOUCH_TARGET.ios, 44);

  Platform.reset();
});
