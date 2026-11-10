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
  assert.ok(rec.bmr > 1500);
  assert.ok(rec.tdee > 2000);
  assert.ok(rec.recommendedCalories > rec.tdee); // because muscle_gain adds surplus
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
  assert.equal(migrationsAfter.length, 2);
  assert.equal(migrationsAfter[1].version, 2);
  assert.equal(migrationsAfter[1].name, 'add_profile_personalization_v2');

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
  assert.equal(finalMigrations.length, 2, 'Migration 2 must not be re-applied or duplicated');
});
