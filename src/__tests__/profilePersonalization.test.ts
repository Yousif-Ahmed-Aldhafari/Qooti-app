import test from 'node:test';
import assert from 'node:assert/strict';

import { openDatabaseAsync } from './mocks/expo-sqlite';
import { runMigrations } from '../db/migrations';
import { SQLiteProfileRepository } from '../db/repositories/profileRepository';
import {
  UserProfile,
  normalizeProfile,
  DEFAULT_PROFILE_ATTRIBUTES,
} from '../models/profile';
import {
  calculateBMR,
  calculateTDEE,
  calculateCaloricTarget,
  calculateMacroTargets,
  calculateWaterRecommendation,
  calculateSleepRecommendation,
  calculateFullRecommendation,
  isCustomTargetsOverridden,
  validateProfileEligibility,
  resolveBMREquation,
  PAL_MULTIPLIERS,
} from '../utils/personalization';
import { SCHEMA_V1_SQL } from '../db/schema';

test('Personalization: BMR calculation matches Mifflin-St Jeor formula accurately', () => {
  // Test Male: 10 * 80 + 6.25 * 180 - 5 * 30 + 5 = 800 + 1125 - 150 + 5 = 1780
  const bmrMale = calculateBMR(80, 180, 30, 'male');
  assert.equal(bmrMale, 1780);

  // Test Female: 10 * 60 + 6.25 * 165 - 5 * 25 - 161 = 600 + 1031.25 - 125 - 161 = 1345.25 -> 1345
  const bmrFemale = calculateBMR(60, 165, 25, 'female');
  assert.equal(bmrFemale, 1345);

  // Test Other / Unspecified: 10 * 70 + 6.25 * 170 - 5 * 28 - 78 = 700 + 1062.5 - 140 - 78 = 1544.5 -> 1545
  const bmrUnspecified = calculateBMR(70, 170, 28, 'unspecified');
  assert.equal(bmrUnspecified, 1545);

  const bmrOther = calculateBMR(70, 170, 28, 'other');
  assert.equal(bmrOther, 1545);

  // Bounds and extreme inputs safety (should not produce NaN or Infinity)
  const bmrExtremeLow = calculateBMR(-5, 0, 5, 'male');
  assert.ok(Number.isFinite(bmrExtremeLow));
  assert.ok(bmrExtremeLow > 0);

  const bmrExtremeHigh = calculateBMR(500, 300, 150, 'female');
  assert.ok(Number.isFinite(bmrExtremeHigh));
  assert.ok(bmrExtremeHigh > 0);
});

test('Personalization: TDEE calculation applies correct PAL activity multipliers', () => {
  const bmr = 1600;

  assert.equal(PAL_MULTIPLIERS.sedentary, 1.2);
  assert.equal(PAL_MULTIPLIERS.extra_active, 1.9);
  assert.equal(calculateTDEE(bmr, 'sedentary'), Math.round(1600 * 1.2)); // 1920
  assert.equal(calculateTDEE(bmr, 'lightly_active'), Math.round(1600 * 1.375)); // 2200
  assert.equal(calculateTDEE(bmr, 'moderately_active'), Math.round(1600 * 1.55)); // 2480
  assert.equal(calculateTDEE(bmr, 'very_active'), Math.round(1600 * 1.725)); // 2760
  assert.equal(calculateTDEE(bmr, 'extra_active'), Math.round(1600 * 1.9)); // 3040
});

test('Personalization: Caloric targets respect goals and physiological safety floors', () => {
  const tdee = 2200;

  // Weight loss adjustments
  const lossCons = calculateCaloricTarget(tdee, 'weight_loss', 'conservative', 'male');
  assert.equal(lossCons.target, 1900); // 2200 - 300
  assert.equal(lossCons.delta, -300);

  const lossMod = calculateCaloricTarget(tdee, 'weight_loss', 'moderate', 'male');
  assert.equal(lossMod.target, 1700); // 2200 - 500
  assert.equal(lossMod.delta, -500);

  const lossAgg = calculateCaloricTarget(tdee, 'weight_loss', 'aggressive', 'male');
  assert.equal(lossAgg.target, 1500); // 2200 - 750 = 1450, clamped to 1500 male safety floor!
  assert.equal(lossAgg.delta, -700); // actual delta after safety floor clamping

  // Female safety floor clamp (1200 kcal)
  const lowTdee = 1500;
  const femaleLossAgg = calculateCaloricTarget(lowTdee, 'weight_loss', 'aggressive', 'female');
  assert.equal(femaleLossAgg.target, 1200); // 1500 - 750 = 750 -> clamped to 1200

  // Muscle gain adjustments
  const gainCons = calculateCaloricTarget(tdee, 'muscle_gain', 'conservative');
  assert.equal(gainCons.target, 2400); // 2200 + 200

  const gainMod = calculateCaloricTarget(tdee, 'muscle_gain', 'moderate');
  assert.equal(gainMod.target, 2550); // 2200 + 350

  const gainAgg = calculateCaloricTarget(tdee, 'muscle_gain', 'aggressive');
  assert.equal(gainAgg.target, 2700); // 2200 + 500

  // Maintenance and general health
  const maint = calculateCaloricTarget(tdee, 'maintenance');
  assert.equal(maint.target, 2200);
  assert.equal(maint.delta, 0);

  const general = calculateCaloricTarget(tdee, 'general_health');
  assert.equal(general.target, 2200);
});

test('Personalization: Macro distributions adapt to diet preferences and goal requirements', () => {
  const weightKg = 75;
  const calories = 2400;

  // Standard diet with muscle_gain (protein = 2.0g/kg = 150g = 600kcal)
  const standard = calculateMacroTargets(calories, weightKg, 'standard', 'muscle_gain');
  assert.equal(standard.protein, 150);
  // Fat: 28% of 2400 = 672 kcal / 9 = 75g
  assert.equal(standard.fats, 75);
  // Remaining kcal: 2400 - (600 + 675) = 1125 kcal / 4 = 281g carbs
  assert.ok(standard.carbs > 200);

  // High Protein diet (protein = 2.2g/kg = 165g = 660kcal)
  const highProtein = calculateMacroTargets(calories, weightKg, 'high_protein', 'muscle_gain');
  assert.equal(highProtein.protein, 165);
  assert.equal(highProtein.fats, Math.round((2400 * 0.25) / 9)); // 25% fat = 67g

  // Keto diet (protein = 1.8g/kg = 135g, fat = 70% of 2400 = 187g, carbs capped <= 35g)
  const keto = calculateMacroTargets(calories, weightKg, 'keto', 'weight_loss');
  assert.equal(keto.protein, 135);
  assert.equal(keto.fats, Math.round((2400 * 0.7) / 9)); // 187g
  assert.ok(keto.carbs <= 35, `Keto carbs should be <= 35g, got ${keto.carbs}`);

  // Safe minimum floors (low calorie test)
  const lowCal = calculateMacroTargets(1200, 40, 'standard', 'general_health');
  assert.ok(lowCal.protein >= 50, 'Protein must meet safe floor of at least 50g');
  assert.ok(lowCal.fats >= 30, 'Fat must meet safe floor of at least 30g');
});

test('Personalization: Full recommendation and custom override detection', () => {
  const testProfile: UserProfile = normalizeProfile({
    id: 'user_override_test',
    name: 'Karim',
    email: 'karim@test.com',
    goal: 'Build Muscle',
    heightCm: 175,
    weightKg: 75,
    age: 26,
    gender: 'male',
    activityLevel: 'moderately_active',
    primaryGoal: 'muscle_gain',
    weeklyGoalRate: 'moderate',
    dietaryPreference: 'standard',
  });

  const rec = calculateFullRecommendation(testProfile);
  assert.equal(rec.hasApprovedTarget, true);
  assert.equal(rec.recommendationState, 'recommended_estimate');
  assert.ok(rec.bmr !== null && rec.bmr > 1500);
  assert.ok(rec.tdee !== null && rec.tdee > 2000);
  assert.ok(rec.recommendedCalories !== null && rec.recommendedCalories > rec.tdee); // because muscle_gain adds surplus
  assert.ok(rec.recommendedProtein !== null);
  assert.ok(rec.recommendedCarbs !== null);
  assert.ok(rec.recommendedFats !== null);
  assert.equal(rec.waterIntakeLiters, calculateWaterRecommendation(75));
  assert.equal(rec.sleepHours, 8.0);
  assert.equal(calculateSleepRecommendation('extra_active'), 8.5);
  assert.equal(calculateSleepRecommendation('sedentary'), 7.5);

  // Not overridden when matching recommendation
  const alignedProfile: UserProfile = {
    ...testProfile,
    targetCalories: rec.recommendedCalories,
    targetProtein: rec.recommendedProtein,
    targetCarbs: rec.recommendedCarbs,
    targetFats: rec.recommendedFats,
    calculationOverridden: false,
  };
  assert.equal(isCustomTargetsOverridden(alignedProfile), false);

  // Overridden when manual flag is set
  assert.equal(isCustomTargetsOverridden({ ...alignedProfile, calculationOverridden: true }), true);

  // Overridden when calorie target significantly diverges
  assert.equal(isCustomTargetsOverridden({ ...alignedProfile, targetCalories: 3500 }), true);
});

test('Personalization: Profile domain model normalization guarantees default fallbacks', () => {
  const minimal = normalizeProfile({
    id: 'min-1',
    name: 'Mona Zaki',
    email: 'mona@test.com',
    goal: 'Tone up',
  });

  assert.equal(minimal.age, DEFAULT_PROFILE_ATTRIBUTES.age);
  assert.equal(minimal.gender, 'unspecified');
  assert.equal(minimal.activityLevel, 'moderately_active');
  assert.equal(minimal.primaryGoal, 'general_health');
  assert.equal(minimal.weeklyGoalRate, 'moderate');
  assert.equal(minimal.trainingExperience, 'beginner');
  assert.equal(minimal.preferredWorkoutDays, 4);
  assert.deepEqual(minimal.availableEquipment, ['bodyweight']);
  assert.equal(minimal.workoutLocationPreference, 'flexible');
  assert.equal(minimal.dietaryPreference, 'standard');
  assert.equal(minimal.mealsPerDayPreference, 3);
  assert.deepEqual(minimal.allergiesRestrictions, []);
  assert.equal(minimal.calculationOverridden, false);
});

test('SQLite: Migration 2 upgrades V1 schema to V2 preserving existing profile data non-destructively', async () => {
  const db = await openDatabaseAsync(':memory:');
  await db.execAsync('PRAGMA foreign_keys = ON;');

  // 1. Initialize V1 schema directly (simulating pre-Phase 2 database)
  await db.execAsync(SCHEMA_V1_SQL);
  await db.runAsync(
    'INSERT INTO schema_migrations (version, name, applied_at) VALUES (1, ?, ?);',
    'initial_schema_v1',
    new Date().toISOString()
  );

  // 2. Insert existing V1 profile data
  await db.runAsync(
    `INSERT INTO user_profiles (
      id, name, email, goal, avatar_initials, height_cm, weight_kg,
      target_calories, target_protein, target_carbs, target_fats,
      sleep_goal_hours, water_goal_liters, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    'legacy-user',
    'Fatima Al-Mansoor',
    'fatima@example.com',
    'Lose weight',
    'FA',
    165,
    68,
    1800,
    120,
    180,
    55,
    7.5,
    2.5,
    new Date().toISOString()
  );

  // Verify only 1 migration currently applied
  const migrationsBefore = await db.getAllAsync<{ version: number }>('SELECT version FROM schema_migrations;');
  assert.equal(migrationsBefore.length, 1);

  // 3. Execute runMigrations which must apply Migration 2
  await runMigrations(db);

  const migrationsAfter = await db.getAllAsync<{ version: number; name: string }>(
    'SELECT version, name FROM schema_migrations ORDER BY version ASC;'
  );
  assert.equal(migrationsAfter.length, 8);
  assert.equal(migrationsAfter[1].version, 2);
  assert.equal(migrationsAfter[1].name, 'add_profile_personalization_v2');
  assert.equal(migrationsAfter[2].version, 3);
  assert.equal(migrationsAfter[2].name, 'add_profile_confirmation_and_bmr_ref_v3');
  assert.equal(migrationsAfter[3].version, 4);
  assert.equal(migrationsAfter[3].name, 'add_workout_exercise_catalog_id_v4');
  assert.equal(migrationsAfter[4].version, 5);
  assert.equal(migrationsAfter[4].name, 'add_workout_execution_sessions_v5');

  // 4. Verify existing profile data is completely preserved
  const repo = new SQLiteProfileRepository(db);
  const loadedProfile = await repo.getProfile();

  assert.ok(loadedProfile);
  assert.equal(loadedProfile.id, 'legacy-user');
  assert.equal(loadedProfile.name, 'Fatima Al-Mansoor');
  assert.equal(loadedProfile.email, 'fatima@example.com');
  assert.equal(loadedProfile.heightCm, 165);
  assert.equal(loadedProfile.weightKg, 68);
  assert.equal(loadedProfile.targetCalories, 1800);
  assert.equal(loadedProfile.targetProtein, 120);

  // Verify default fallbacks populated by Migration 2 / normalization
  assert.equal(loadedProfile.gender, 'unspecified');
  assert.equal(loadedProfile.activityLevel, 'moderately_active');
  assert.equal(loadedProfile.primaryGoal, 'general_health');
  assert.equal(loadedProfile.preferredWorkoutDays, 4);

  // 5. Update profile with full extended Phase 2 attributes
  const updatedExtendedProfile: UserProfile = {
    ...loadedProfile,
    age: 32,
    gender: 'female',
    activityLevel: 'very_active',
    primaryGoal: 'weight_loss',
    targetWeightKg: 60,
    weeklyGoalRate: 'aggressive',
    trainingExperience: 'intermediate',
    preferredWorkoutDays: 5,
    availableEquipment: ['dumbbells', 'barbell', 'kettlebell', 'resistance_bands'],
    workoutLocationPreference: 'gym',
    dietaryPreference: 'mediterranean',
    mealsPerDayPreference: 4,
    allergiesRestrictions: ['peanuts', 'shellfish'],
    calculationOverridden: true,
  };

  await repo.saveProfile(updatedExtendedProfile);

  // 6. Reload from SQLite and verify complete attribute roundtrip fidelity
  const reloaded = await repo.getProfile();
  assert.ok(reloaded);
  assert.equal(reloaded.id, 'legacy-user');
  assert.equal(reloaded.age, 32);
  assert.equal(reloaded.gender, 'female');
  assert.equal(reloaded.activityLevel, 'very_active');
  assert.equal(reloaded.primaryGoal, 'weight_loss');
  assert.equal(reloaded.targetWeightKg, 60);
  assert.equal(reloaded.weeklyGoalRate, 'aggressive');
  assert.equal(reloaded.trainingExperience, 'intermediate');
  assert.equal(reloaded.preferredWorkoutDays, 5);
  assert.deepEqual(reloaded.availableEquipment, ['dumbbells', 'barbell', 'kettlebell', 'resistance_bands']);
  assert.equal(reloaded.workoutLocationPreference, 'gym');
  assert.equal(reloaded.dietaryPreference, 'mediterranean');
  assert.equal(reloaded.mealsPerDayPreference, 4);
  assert.deepEqual(reloaded.allergiesRestrictions, ['peanuts', 'shellfish']);
  assert.equal(reloaded.calculationOverridden, true);

  // 7. Test migration idempotence by running runMigrations again
  await runMigrations(db);
  const finalMigrations = await db.getAllAsync<{ version: number }>('SELECT version FROM schema_migrations;');
  assert.equal(finalMigrations.length, 8, 'Migrations must not be re-applied or duplicated');
});

test('Personalization Safety: Age 17 vs 18 eligibility and adolescent protection', () => {
  // Age 17 adolescent profile
  const adolescentProfile = normalizeProfile({
    id: 'user_teen',
    name: 'Yousef',
    email: 'yousef@teen.com',
    goal: 'Get leaner',
    age: 17,
    gender: 'male',
    weightKg: 72,
    heightCm: 176,
    primaryGoal: 'weight_loss',
    weeklyGoalRate: 'aggressive',
  });

  const teenEligibility = validateProfileEligibility(adolescentProfile);
  assert.equal(teenEligibility.isEligible, false);
  assert.equal(teenEligibility.status, 'unsupported_adolescent');
  assert.ok(teenEligibility.reason?.includes('under 18'));

  const teenRec = calculateFullRecommendation(adolescentProfile);
  assert.equal(teenRec.isEligible, false);
  assert.equal(teenRec.status, 'unsupported_adolescent');
  assert.equal(teenRec.calorieDelta, 0, 'Must not calculate adult weight loss deficit for under-18 users');
  assert.equal(teenRec.requiresProfessionalReview, true);

  // Age 18 adult profile
  const adultProfile = normalizeProfile({
    id: 'user_adult',
    name: 'Ziad',
    email: 'ziad@adult.com',
    goal: 'Get leaner',
    age: 18,
    gender: 'male',
    weightKg: 72,
    heightCm: 176,
    primaryGoal: 'weight_loss',
    weeklyGoalRate: 'moderate',
  });

  const adultEligibility = validateProfileEligibility(adultProfile);
  assert.equal(adultEligibility.isEligible, true);
  assert.equal(adultEligibility.status, 'eligible');

  const adultRec = calculateFullRecommendation(adultProfile);
  assert.equal(adultRec.isEligible, true);
  assert.equal(adultRec.status, 'eligible');
  assert.equal(adultRec.calorieDelta, -500);
});

test('Personalization Transparency: BMR equation transparency and biological reference choice', () => {
  // Male equation (+5)
  assert.equal(resolveBMREquation('male'), 'mifflin_st_jeor_male');
  const bmrMale = calculateBMR(70, 170, 25, 'male');
  assert.equal(bmrMale, Math.round(10 * 70 + 6.25 * 170 - 5 * 25 + 5));

  // Female equation (-161)
  assert.equal(resolveBMREquation('female'), 'mifflin_st_jeor_female');
  const bmrFemale = calculateBMR(70, 170, 25, 'female');
  assert.equal(bmrFemale, Math.round(10 * 70 + 6.25 * 170 - 5 * 25 - 161));

  // Other / unspecified default: arithmetic midpoint approximation (-78)
  assert.equal(resolveBMREquation('unspecified'), 'mifflin_st_jeor_midpoint_approximation');
  assert.equal(resolveBMREquation('other'), 'mifflin_st_jeor_midpoint_approximation');
  const bmrMidpoint = calculateBMR(70, 170, 25, 'unspecified');
  assert.equal(bmrMidpoint, Math.round(10 * 70 + 6.25 * 170 - 5 * 25 - 78));

  // Other / unspecified with explicit biological reference equation selection
  assert.equal(resolveBMREquation('other', 'male'), 'mifflin_st_jeor_male');
  assert.equal(resolveBMREquation('other', 'female'), 'mifflin_st_jeor_female');
  assert.equal(calculateBMR(70, 170, 25, 'other', 'male'), bmrMale);
  assert.equal(calculateBMR(70, 170, 25, 'unspecified', 'female'), bmrFemale);
});

test('Personalization Safety: Boundary, invalid, zero, negative, and non-finite inputs', () => {
  // Invalid zero/negative weight & height validation
  const invalidProfile = normalizeProfile({
    id: 'user_invalid',
    name: 'Ghost',
    email: 'ghost@test.com',
    goal: 'Stay safe',
    weightKg: 0,
    heightCm: -10,
    age: 25,
  });

  const eligibility = validateProfileEligibility(invalidProfile);
  assert.equal(eligibility.isEligible, false);
  assert.equal(eligibility.status, 'invalid_inputs');

  // Math calculation graceful safety without NaN
  assert.ok(Number.isFinite(calculateBMR(0, 0, 0, 'unspecified')));
  assert.ok(Number.isFinite(calculateBMR(-50, -100, -20, 'male')));
  assert.ok(Number.isFinite(calculateBMR(NaN, Infinity, -Infinity, 'female')));
  assert.ok(Number.isFinite(calculateTDEE(NaN, 'sedentary')));
  assert.ok(Number.isFinite(calculateWaterRecommendation(-10)));
});

test('Personalization Safety: Aggressive goal adjustments and professional review flags', () => {
  // Aggressive weight loss
  const aggResult = calculateCaloricTarget(2400, 'weight_loss', 'aggressive', 'female', 30);
  assert.equal(aggResult.target, 1650); // 2400 - 750
  assert.equal(aggResult.requiresProfessionalReview, true);
  assert.ok(aggResult.warnings.some((w) => w.includes('Aggressive calorie deficit')));

  // Moderate weight loss
  const modResult = calculateCaloricTarget(2400, 'weight_loss', 'moderate', 'female', 30);
  assert.equal(modResult.target, 1900); // 2400 - 500
  assert.equal(modResult.requiresProfessionalReview, false);

  // Clamping to conventional clinical floor
  const lowTdeeResult = calculateCaloricTarget(1400, 'weight_loss', 'moderate', 'female', 30);
  assert.equal(lowTdeeResult.target, 1200); // Clamped to 1200
  assert.equal(lowTdeeResult.requiresProfessionalReview, true);
  assert.ok(lowTdeeResult.warnings.some((w) => w.includes('conventional non-supervised threshold')));
});

test('Personalization Macros: Exact calorie-macro reconciliation across diverse diet patterns', () => {
  const diets: ('standard' | 'high_protein' | 'low_carb' | 'keto' | 'mediterranean')[] = [
    'standard',
    'high_protein',
    'low_carb',
    'keto',
    'mediterranean',
  ];
  const goals: ('weight_loss' | 'muscle_gain' | 'maintenance' | 'endurance')[] = [
    'weight_loss',
    'muscle_gain',
    'maintenance',
    'endurance',
  ];

  for (const diet of diets) {
    for (const goal of goals) {
      const calories = 2150;
      const weightKg = 70;
      const result = calculateMacroTargets(calories, weightKg, diet, goal);

      // Verify Atwater energy reconciliation
      const totalFromMacros = result.protein * 4 + result.carbs * 4 + result.fats * 9;
      const diff = Math.abs(calories - totalFromMacros);

      // Documented rounding tolerance: <= 4 kcal for carb-reconciled diets, <= 60 kcal for strict carbohydrate-capped keto
      const maxTolerance = diet === 'keto' ? 60 : 4;
      assert.ok(
        diff <= maxTolerance,
        `Diet '${diet}' with goal '${goal}' exceeded documented rounding tolerance (diff: ${diff} kcal, max: ${maxTolerance})`
      );
      assert.ok(result.carbs >= 0, `Carbohydrates must never be negative (got ${result.carbs})`);
      assert.ok(result.protein >= 50, 'Protein must satisfy essential floor');
      assert.ok(result.fats >= 30, 'Fat must satisfy essential floor');
      assert.equal(result.reconciliationDiff, diff);
    }
  }
});

test('Personalization Macros: Impossible diet constraint conflict resolution', () => {
  // Low calories (900 kcal) + heavy individual (120 kg) on high_protein (2.2 g/kg = 264g = 1056 kcal > 900 kcal!)
  const conflictResult = calculateMacroTargets(900, 120, 'high_protein', 'muscle_gain');

  assert.equal(conflictResult.dietConstraintSatisfied, false);
  assert.ok(conflictResult.warning?.includes('cannot be mathematically satisfied'));
  assert.ok(conflictResult.carbs >= 0, 'Carbohydrates must never be negative');

  // Verify total macro calories do not exceed the caloric allowance
  const totalMacroKcal = conflictResult.protein * 4 + conflictResult.carbs * 4 + conflictResult.fats * 9;
  assert.ok(totalMacroKcal <= 900 + 4, `Macro calories (${totalMacroKcal}) should not exceed ceiling`);
});

test('Personalization Integrity: Unconfirmed vs confirmed attributes and user override preservation', () => {
  // Unconfirmed minimal profile
  const unconfirmed = normalizeProfile({
    id: 'u-unconf',
    name: 'Laila',
    email: 'laila@test.com',
    goal: 'Tone',
    attributesConfirmed: false,
  });

  const unconfRec = calculateFullRecommendation(unconfirmed);
  assert.equal(unconfRec.status, 'unconfirmed_attributes');
  assert.ok(unconfRec.warnings.some((w) => w.includes('baseline defaults')));

  // Confirmed profile with manual custom targets
  const customProfile = normalizeProfile({
    id: 'u-custom',
    name: 'Tareq',
    email: 'tareq@test.com',
    goal: 'Custom macros',
    age: 29,
    weightKg: 80,
    heightCm: 182,
    targetCalories: 2800,
    targetProtein: 210,
    targetCarbs: 310,
    targetFats: 80,
    calculationOverridden: true,
    attributesConfirmed: true,
  });

  assert.equal(isCustomTargetsOverridden(customProfile), true);

  // Verify that calculating recommendations does not overwrite stored targets
  const customRec = calculateFullRecommendation(customProfile);
  assert.notEqual(customRec.recommendedCalories, customProfile.targetCalories);
  assert.equal(customProfile.targetCalories, 2800, 'Original custom target calories must be preserved');
  assert.equal(customProfile.targetProtein, 210, 'Original custom target protein must be preserved');
});

test('SQLite: Migration 2 upgrades V1 database preserving existing manually customized targets', async () => {
  const db = await openDatabaseAsync(':memory:');
  await db.execAsync('PRAGMA foreign_keys = ON;');

  // Initialize V1 schema
  await db.execAsync(SCHEMA_V1_SQL);
  await db.runAsync(
    'INSERT INTO schema_migrations (version, name, applied_at) VALUES (1, ?, ?);',
    'initial_schema_v1',
    new Date().toISOString()
  );

  // Insert user with custom non-default targets in V1
  await db.runAsync(
    `INSERT INTO user_profiles (
      id, name, email, goal, avatar_initials, height_cm, weight_kg,
      target_calories, target_protein, target_carbs, target_fats,
      sleep_goal_hours, water_goal_liters, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    'custom-v1-user',
    'Hassan Omar',
    'hassan@custom.com',
    'Strict Bodybuilding',
    'HO',
    185,
    92,
    3150,
    220,
    360,
    90,
    8.5,
    4.0,
    new Date().toISOString()
  );

  // Run Migration 2
  await runMigrations(db);

  const repo = new SQLiteProfileRepository(db);
  const loaded = await repo.getProfile();

  assert.ok(loaded);
  assert.equal(loaded.id, 'custom-v1-user');
  assert.equal(loaded.name, 'Hassan Omar');
  assert.equal(loaded.targetCalories, 3150, 'Custom calories must be preserved across migration');
  assert.equal(loaded.targetProtein, 220, 'Custom protein must be preserved across migration');
  assert.equal(loaded.targetCarbs, 360, 'Custom carbs must be preserved across migration');
  assert.equal(loaded.targetFats, 90, 'Custom fats must be preserved across migration');
  assert.equal(loaded.sleepGoalHours, 8.5);
  assert.equal(loaded.waterGoalLiters, 4.0);

  // Update with explicit biological reference and confirmed status
  const updated: UserProfile = {
    ...loaded,
    age: 27,
    gender: 'other',
    bmrBiologicalReference: 'male',
    attributesConfirmed: true,
  };
  await repo.saveProfile(updated);

  const reloaded = await repo.getProfile();
  assert.ok(reloaded);
  assert.equal(reloaded.gender, 'other');
  assert.equal(reloaded.bmrBiologicalReference, 'male');
  assert.equal(reloaded.attributesConfirmed, true);
  assert.equal(reloaded.targetCalories, 3150);
});

test('SQLite: Already-applied original V2 (ce7bbe1) upgrades cleanly to V3 preserving records and custom targets', async () => {
  const db = await openDatabaseAsync(':memory:');
  await db.execAsync('PRAGMA foreign_keys = ON;');

  // 1. Initialize V1 schema and apply ONLY original V2 columns (from ce7bbe1)
  await db.execAsync(SCHEMA_V1_SQL);
  await db.runAsync(
    'INSERT INTO schema_migrations (version, name, applied_at) VALUES (1, ?, ?);',
    'initial_schema_v1',
    new Date().toISOString()
  );

  // Original Migration 2 DDL without attributes_confirmed / bmr_biological_reference
  await db.execAsync(`
    ALTER TABLE user_profiles ADD COLUMN age INTEGER DEFAULT 28;
    ALTER TABLE user_profiles ADD COLUMN gender TEXT DEFAULT 'unspecified';
    ALTER TABLE user_profiles ADD COLUMN activity_level TEXT DEFAULT 'moderately_active';
    ALTER TABLE user_profiles ADD COLUMN primary_goal TEXT DEFAULT 'general_health';
    ALTER TABLE user_profiles ADD COLUMN target_weight_kg REAL DEFAULT 70;
    ALTER TABLE user_profiles ADD COLUMN weekly_goal_rate TEXT DEFAULT 'moderate';
    ALTER TABLE user_profiles ADD COLUMN training_experience TEXT DEFAULT 'beginner';
    ALTER TABLE user_profiles ADD COLUMN preferred_workout_days INTEGER DEFAULT 4;
    ALTER TABLE user_profiles ADD COLUMN available_equipment TEXT DEFAULT '["bodyweight"]';
    ALTER TABLE user_profiles ADD COLUMN workout_location TEXT DEFAULT 'flexible';
    ALTER TABLE user_profiles ADD COLUMN dietary_preference TEXT DEFAULT 'standard';
    ALTER TABLE user_profiles ADD COLUMN meals_per_day INTEGER DEFAULT 3;
    ALTER TABLE user_profiles ADD COLUMN allergies_restrictions TEXT DEFAULT '[]';
    ALTER TABLE user_profiles ADD COLUMN calculation_overridden INTEGER DEFAULT 0;
  `);
  await db.runAsync(
    'INSERT INTO schema_migrations (version, name, applied_at) VALUES (2, ?, ?);',
    'add_profile_personalization_v2',
    new Date().toISOString()
  );

  // 2. Insert an existing V2 user record with custom targets
  await db.runAsync(
    `INSERT INTO user_profiles (
      id, name, email, goal, avatar_initials, height_cm, weight_kg,
      target_calories, target_protein, target_carbs, target_fats,
      sleep_goal_hours, water_goal_liters, age, gender, calculation_overridden, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    'v2-existing-user',
    'Nadia Mansour',
    'nadia@example.com',
    'Strength',
    'NM',
    166,
    62,
    2250,
    145,
    250,
    70,
    8,
    2.5,
    31,
    'female',
    1,
    new Date().toISOString()
  );

  // 3. Run current runMigrations(db) — Migration 2 is already recorded so only Migration 3 must run
  await runMigrations(db);

  const migrations = await db.getAllAsync<{ version: number; name: string }>(
    'SELECT version, name FROM schema_migrations ORDER BY version ASC;'
  );
  assert.equal(migrations.length, 8);
  assert.equal(migrations[2].version, 3);
  assert.equal(migrations[2].name, 'add_profile_confirmation_and_bmr_ref_v3');
  assert.equal(migrations[3].version, 4);
  assert.equal(migrations[3].name, 'add_workout_exercise_catalog_id_v4');
  assert.equal(migrations[4].version, 5);
  assert.equal(migrations[4].name, 'add_workout_execution_sessions_v5');
  assert.equal(migrations[5].version, 6);
  assert.equal(migrations[5].name, 'enforce_single_open_workout_session_v6');
  assert.equal(migrations[6].version, 7);
  assert.equal(migrations[6].name, 'recover_conflicted_workout_sessions_v7');
  assert.equal(migrations[7].version, 8);
  assert.equal(migrations[7].name, 'clarify_session_recovery_provenance_v8');

  // 4. Confirm both new columns exist
  const cols = await db.getAllAsync<{ name: string }>('PRAGMA table_info(user_profiles);');
  const colNames = new Set(cols.map((c) => c.name));
  assert.ok(colNames.has('attributes_confirmed'), 'attributes_confirmed column must exist after V2->V3 upgrade');
  assert.ok(colNames.has('bmr_biological_reference'), 'bmr_biological_reference column must exist after V2->V3 upgrade');

  // 5. Verify existing V2 record and custom targets are preserved and CRUD works
  const repo = new SQLiteProfileRepository(db);
  const loaded = await repo.getProfile();
  assert.ok(loaded);
  assert.equal(loaded.id, 'v2-existing-user');
  assert.equal(loaded.targetCalories, 2250);
  assert.equal(loaded.targetProtein, 145);
  assert.equal(loaded.calculationOverridden, true);

  await repo.saveProfile({
    ...loaded,
    attributesConfirmed: true,
    bmrBiologicalReference: 'female',
  });
  const afterSave = await repo.getProfile();
  assert.ok(afterSave);
  assert.equal(afterSave.attributesConfirmed, true);
  assert.equal(afterSave.bmrBiologicalReference, 'female');
  assert.equal(afterSave.targetCalories, 2250);
});

test('SQLite: Interrupted migration recovery and repeated migration idempotence', async () => {
  const db = await openDatabaseAsync(':memory:');
  await db.execAsync(SCHEMA_V1_SQL);
  await db.runAsync(
    'INSERT INTO schema_migrations (version, name, applied_at) VALUES (1, ?, ?);',
    'initial_schema_v1',
    new Date().toISOString()
  );

  // Simulate an interrupted Migration 3 where one column was added before failure/rollback of schema_migrations
  await db.execAsync('ALTER TABLE user_profiles ADD COLUMN age INTEGER DEFAULT 28;');
  await db.execAsync('ALTER TABLE user_profiles ADD COLUMN attributes_confirmed INTEGER DEFAULT 0;');

  // Running migrations now must recover cleanly without duplicate-column errors
  await runMigrations(db);
  await runMigrations(db);

  const migrations = await db.getAllAsync<{ version: number }>('SELECT version FROM schema_migrations ORDER BY version ASC;');
  assert.deepEqual(
    migrations.map((m) => m.version),
    [1, 2, 3, 4, 5, 6, 7, 8]
  );
});

test('Personalization Contract: Explicit states for adolescent, unconfirmed, impossible diet, and valid confirmed adult', () => {
  // 1. Unsupported adolescent: never exposes approved target
  const adolescent = normalizeProfile({
    id: 'c-teen',
    name: 'Teen User',
    email: 'teen@example.com',
    goal: 'Weight loss',
    age: 17,
    weightKg: 65,
    heightCm: 170,
    primaryGoal: 'weight_loss',
    attributesConfirmed: true,
  });
  const teenRec = calculateFullRecommendation(adolescent);
  assert.equal(teenRec.status, 'unsupported_adolescent');
  assert.equal(teenRec.recommendationState, 'unsupported');
  assert.equal(teenRec.isEligible, false);
  assert.equal(teenRec.hasApprovedTarget, false);
  assert.equal(teenRec.recommendedCalories, null);
  assert.equal(teenRec.recommendedProtein, null);
  assert.equal(teenRec.recommendedCarbs, null);
  assert.equal(teenRec.recommendedFats, null);
  assert.equal(teenRec.bmr, null);
  assert.equal(teenRec.tdee, null);
  assert.equal(teenRec.requiresProfessionalReview, true);

  // 2. Unconfirmed profile: cannot be represented as confirmed personalized result
  const unconfirmed = normalizeProfile({
    id: 'c-unconf',
    name: 'Unconfirmed User',
    email: 'unconf@example.com',
    goal: 'General health',
  });
  const unconfRec = calculateFullRecommendation(unconfirmed);
  assert.equal(unconfRec.status, 'unconfirmed_attributes');
  assert.equal(unconfRec.recommendationState, 'unconfirmed_estimate');
  assert.equal(unconfRec.isConfirmed, false);
  assert.equal(unconfRec.hasApprovedTarget, false);
  assert.equal(unconfRec.recommendedCalories, null);
  assert.ok(unconfRec.preliminaryEstimate !== null);

  // 3. Impossible diet constraint: clearly identified as constraint conflict, no approved target exposed
  const impossibleDiet = normalizeProfile({
    id: 'c-conflict',
    name: 'Conflict User',
    email: 'conflict@example.com',
    goal: 'Lose fat',
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
  // At 2222 kcal target: 200kg * 2.2 = 440g protein (1760 kcal) + 25% fat (556 kcal) = 2316 kcal > 2222 kcal
  const conflictRec = calculateFullRecommendation(impossibleDiet);
  assert.equal(conflictRec.status, 'impossible_diet_constraints');
  assert.equal(conflictRec.recommendationState, 'conflicting_constraints');
  assert.equal(conflictRec.dietConstraintSatisfied, false);
  assert.equal(conflictRec.hasApprovedTarget, false);
  assert.equal(conflictRec.recommendedCalories, null);
  assert.equal(conflictRec.recommendedProtein, null);
  assert.equal(conflictRec.requiresProfessionalReview, true);

  // 4. Valid confirmed adult recommendation: approved target exposed cleanly
  const validAdult = normalizeProfile({
    id: 'c-valid',
    name: 'Valid Adult',
    email: 'valid@example.com',
    goal: 'Maintain',
    age: 30,
    gender: 'male',
    weightKg: 75,
    heightCm: 178,
    activityLevel: 'moderately_active',
    primaryGoal: 'maintenance',
    dietaryPreference: 'standard',
    attributesConfirmed: true,
  });
  const validRec = calculateFullRecommendation(validAdult);
  assert.equal(validRec.status, 'eligible');
  assert.equal(validRec.recommendationState, 'recommended_estimate');
  assert.equal(validRec.isEligible, true);
  assert.equal(validRec.isConfirmed, true);
  assert.equal(validRec.hasApprovedTarget, true);
  assert.equal(validRec.dietConstraintSatisfied, true);
  assert.ok(validRec.recommendedCalories !== null && validRec.recommendedCalories > 1500);
  assert.ok(validRec.recommendedProtein !== null && validRec.recommendedProtein >= 50);
  assert.ok(validRec.recommendedCarbs !== null && validRec.recommendedCarbs >= 0);
  assert.ok(validRec.recommendedFats !== null && validRec.recommendedFats >= 30);
});
