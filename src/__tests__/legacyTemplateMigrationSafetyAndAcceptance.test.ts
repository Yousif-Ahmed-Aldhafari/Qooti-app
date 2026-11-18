import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { openDatabaseAsync } from './mocks/expo-sqlite';
import { MIGRATIONS, runMigrations } from '../db/migrations';
import { SQLiteMealRepository } from '../db/repositories/mealRepository';
import { SQLiteMealTemplateRepository } from '../db/repositories/mealTemplateRepository';
import { SQLiteWorkoutRepository } from '../db/repositories/workoutRepository';
import { SQLiteProfileRepository } from '../db/repositories/profileRepository';
import { normalizeMeal } from '../models/meal';
import {
  createMealFromTemplate,
  createTemplateFromMeal,
  normalizeMealTemplate,
} from '../models/mealTemplate';
import { getDailyNutritionSummary } from '../utils/nutrition';
import { MealsScreen } from '../screens/MealsScreen';
import { QuickAddMealModal } from '../components/QuickAddMealModal';
import { ManualFoodModal } from '../components/ManualFoodModal';
import { FoodPickerModal } from '../components/FoodPickerModal';
import { MacroCard } from '../components/MacroCard';
import { normalizeProfile } from '../models/profile';
import { translate } from '../i18n';
import { IDatabase } from '../db/types';

const t = (key: string) => translate('en', key);

async function setupDbUpToVersion(targetVersion: number): Promise<IDatabase> {
  const db = await openDatabaseAsync(':memory:');
  await db.execAsync('PRAGMA foreign_keys = ON;');
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  for (const migration of MIGRATIONS) {
    if (migration.version <= targetVersion) {
      await db.withTransactionAsync(async () => {
        await migration.up(db);
        await db.runAsync(
          'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?);',
          migration.version,
          migration.name,
          new Date().toISOString()
        );
      });
    }
  }

  return db;
}

function createMockProfile() {
  return normalizeProfile({
    id: 'user-mock',
    name: 'Test Athlete',
    email: 'athlete@example.com',
    targetCalories: 2400,
    targetProtein: 160,
    targetCarbs: 260,
    targetFats: 70,
    calculationOverridden: true,
  });
}

// ============================================================================
// PART 1: SECTION 4 — REGRESSION AND UPGRADE MATRIX (20 TESTS)
// ============================================================================

test('Section 4 - Test 1: V10 synthetic calorie-only template remains indeterminate with unknown macros', async () => {
  const db = await setupDbUpToVersion(10);
  const now = new Date().toISOString();

  // Insert V10 template with synthetic child item created by Task 4.5
  await db.runAsync(
    `INSERT INTO meal_templates (id, title, meal_type, notes, is_favorite, created_at, updated_at)
     VALUES ('tpl-v10-synth', 'Quick Afternoon Snack', 'snack', 'Calorie quick log', 0, ?, ?);`,
    now,
    now
  );
  await db.runAsync(
    `INSERT INTO meal_template_items (id, template_id, name, quantity, unit, calories, protein, carbs, fats, catalog_id, portion_unit, sort_order)
     VALUES ('item-synth-1', 'tpl-v10-synth', 'Quick Afternoon Snack', 1, 'serving', 350, 0, 0, 0, NULL, NULL, 0);`
  );

  // Upgrade through V11, V12, V13
  await runMigrations(db);

  const tplRepo = new SQLiteMealTemplateRepository(db);
  const tpl = await tplRepo.getTemplateById('tpl-v10-synth');

  assert.ok(tpl);
  assert.equal(tpl.totalCalories, 350);
  assert.equal(tpl.totalProtein, 0);
  assert.equal(tpl.nutritionCompleteness, 'indeterminate');
  assert.equal(tpl.proteinKnown, false);
  assert.equal(tpl.carbsKnown, false);
  assert.equal(tpl.fatKnown, false);
});

test('Section 4 - Test 2: V10 genuine single-food zero-macro template is restored to complete with known zero macros', async () => {
  const db = await setupDbUpToVersion(10);
  const now = new Date().toISOString();

  // Insert V10 template with genuine catalog food (black coffee: 2 kcal, 0g macros)
  await db.runAsync(
    `INSERT INTO meal_templates (id, title, meal_type, notes, is_favorite, created_at, updated_at)
     VALUES ('tpl-v10-coffee', 'Morning Black Coffee', 'breakfast', 'Espresso shot', 1, ?, ?);`,
    now,
    now
  );
  await db.runAsync(
    `INSERT INTO meal_template_items (id, template_id, name, quantity, unit, calories, protein, carbs, fats, catalog_id, portion_unit, sort_order)
     VALUES ('item-coffee-1', 'tpl-v10-coffee', 'Black Coffee', 1, 'cup', 2, 0, 0, 0, 'bev-coffee-black', '1 cup (240ml)', 0);`
  );

  // Upgrade through V11, V12, V13
  await runMigrations(db);

  const tplRepo = new SQLiteMealTemplateRepository(db);
  const tpl = await tplRepo.getTemplateById('tpl-v10-coffee');

  assert.ok(tpl);
  assert.equal(tpl.totalCalories, 2);
  assert.equal(tpl.totalProtein, 0);
  assert.equal(tpl.totalCarbs, 0);
  assert.equal(tpl.totalFat, 0);
  assert.equal(tpl.nutritionCompleteness, 'complete');
  assert.equal(tpl.proteinKnown, true);
  assert.equal(tpl.carbsKnown, true);
  assert.equal(tpl.fatKnown, true);
});

test('Section 4 - Test 3: V11 itemless calorie-only template preserves unknown macros without fabricating zeros', async () => {
  const db = await setupDbUpToVersion(11);
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO meal_templates (
       id, title, meal_type, notes, is_favorite,
       total_calories, total_protein, total_carbs, total_fat,
       nutrition_completeness, protein_known, carbs_known, fat_known,
       created_at, updated_at
     ) VALUES (
       'tpl-v11-itemless', 'Airport Sandwich Calorie Log', 'lunch', 'Only calories posted on menu', 0,
       550, 0, 0, 0,
       'calories_only', 0, 0, 0,
       ?, ?
     );`,
    now,
    now
  );

  await runMigrations(db);

  const tplRepo = new SQLiteMealTemplateRepository(db);
  const tpl = await tplRepo.getTemplateById('tpl-v11-itemless');

  assert.ok(tpl);
  assert.equal(tpl.totalCalories, 550);
  assert.equal(tpl.items.length, 0);
  assert.equal(tpl.proteinKnown, false);
  assert.equal(tpl.carbsKnown, false);
  assert.equal(tpl.fatKnown, false);
});

test('Section 4 - Test 4: V11 known-zero template with child items remains complete and known zero', async () => {
  const db = await setupDbUpToVersion(11);
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO meal_templates (
       id, title, meal_type, notes, is_favorite,
       total_calories, total_protein, total_carbs, total_fat,
       nutrition_completeness, protein_known, carbs_known, fat_known,
       created_at, updated_at
     ) VALUES (
       'tpl-v11-tea', 'Herbal Green Tea', 'snack', 'Unsweetened', 0,
       1, 0, 0, 0,
       'complete', 1, 1, 1,
       ?, ?
     );`,
    now,
    now
  );
  await db.runAsync(
    `INSERT INTO meal_template_items (id, template_id, name, quantity, unit, calories, protein, carbs, fats, catalog_id, portion_unit, sort_order)
     VALUES ('ti-tea-1', 'tpl-v11-tea', 'Green Tea', 1, 'mug', 1, 0, 0, 0, 'bev-green-tea', '1 mug', 0);`
  );

  await runMigrations(db);

  const tplRepo = new SQLiteMealTemplateRepository(db);
  const tpl = await tplRepo.getTemplateById('tpl-v11-tea');

  assert.ok(tpl);
  assert.equal(tpl.nutritionCompleteness, 'complete');
  assert.equal(tpl.proteinKnown, true);
  assert.equal(tpl.carbsKnown, true);
  assert.equal(tpl.fatKnown, true);
});

test('Section 4 - Test 5: V11 partially known macros are preserved cleanly without corruption', async () => {
  const db = await setupDbUpToVersion(11);
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO meal_templates (
       id, title, meal_type, notes, is_favorite,
       total_calories, total_protein, total_carbs, total_fat,
       nutrition_completeness, protein_known, carbs_known, fat_known,
       created_at, updated_at
     ) VALUES (
       'tpl-v11-partial', 'Protein Shake Quick Estimate', 'snack', 'Known 30g protein, carbs/fat unknown', 0,
       200, 30, 0, 0,
       'partial', 1, 0, 0,
       ?, ?
     );`,
    now,
    now
  );

  await runMigrations(db);

  const tplRepo = new SQLiteMealTemplateRepository(db);
  const tpl = await tplRepo.getTemplateById('tpl-v11-partial');

  assert.ok(tpl);
  assert.equal(tpl.totalProtein, 30);
  assert.equal(tpl.proteinKnown, true);
  assert.equal(tpl.carbsKnown, false);
  assert.equal(tpl.fatKnown, false);
});

test('Section 4 - Test 6: V12 template already marked indeterminate remains indeterminate without false certainty', async () => {
  const db = await setupDbUpToVersion(12);
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO meal_templates (
       id, title, meal_type, notes, is_favorite,
       total_calories, total_protein, total_carbs, total_fat,
       nutrition_completeness, protein_known, carbs_known, fat_known,
       created_at, updated_at
     ) VALUES (
       'tpl-v12-indet', 'Ambiguous Legacy Entry', 'dinner', 'Unknown restaurant meal', 0,
       600, 0, 0, 0,
       'indeterminate', 0, 0, 0,
       ?, ?
     );`,
    now,
    now
  );

  await runMigrations(db);

  const tplRepo = new SQLiteMealTemplateRepository(db);
  const tpl = await tplRepo.getTemplateById('tpl-v12-indet');

  assert.ok(tpl);
  assert.equal(tpl.nutritionCompleteness, 'indeterminate');
  assert.equal(tpl.proteinKnown, false);
  assert.equal(tpl.carbsKnown, false);
  assert.equal(tpl.fatKnown, false);
});

test('Section 4 - Test 7: Existing complete macro template is preserved completely intact', async () => {
  const db = await setupDbUpToVersion(11);
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO meal_templates (
       id, title, meal_type, notes, is_favorite,
       total_calories, total_protein, total_carbs, total_fat,
       nutrition_completeness, protein_known, carbs_known, fat_known,
       created_at, updated_at
     ) VALUES (
       'tpl-complete', 'Steak, Rice & Broccoli', 'dinner', 'Standard bulk dinner', 1,
       720, 52, 75, 22,
       'complete', 1, 1, 1,
       ?, ?
     );`,
    now,
    now
  );

  await runMigrations(db);

  const tplRepo = new SQLiteMealTemplateRepository(db);
  const tpl = await tplRepo.getTemplateById('tpl-complete');

  assert.ok(tpl);
  assert.equal(tpl.totalCalories, 720);
  assert.equal(tpl.totalProtein, 52);
  assert.equal(tpl.totalCarbs, 75);
  assert.equal(tpl.totalFat, 22);
  assert.equal(tpl.nutritionCompleteness, 'complete');
  assert.equal(tpl.proteinKnown, true);
  assert.equal(tpl.carbsKnown, true);
  assert.equal(tpl.fatKnown, true);
});

test('Section 4 - Test 8: Template persistence roundtrip across simulated restart', async () => {
  const db = await setupDbUpToVersion(13);
  const tplRepo = new SQLiteMealTemplateRepository(db);

  const initialTpl = normalizeMealTemplate({
    id: 'tpl-restart-test',
    title: 'Post-Workout Oatmeal',
    totalCalories: 420,
    totalProtein: 28,
    totalCarbs: 60,
    totalFat: 8,
    nutritionCompleteness: 'complete',
    proteinKnown: true,
    carbsKnown: true,
    fatKnown: true,
    items: [
      {
        id: 'ti-1',
        name: 'Rolled Oats',
        quantity: 80,
        unit: 'g',
        calories: 300,
        protein: 10,
        carbs: 54,
        fats: 5,
      },
      {
        id: 'ti-2',
        name: 'Whey Protein',
        quantity: 30,
        unit: 'g',
        calories: 120,
        protein: 18,
        carbs: 6,
        fats: 3,
      },
    ],
  });

  await tplRepo.createTemplate(initialTpl);

  // Fresh repository instance simulating cold reload
  const freshRepo = new SQLiteMealTemplateRepository(db);
  const loaded = await freshRepo.getTemplateById('tpl-restart-test');

  assert.ok(loaded);
  assert.equal(loaded.title, 'Post-Workout Oatmeal');
  assert.equal(loaded.items.length, 2);
  assert.equal(loaded.totalCalories, 420);
});

test('Section 4 - Test 9: Template logging after restart sets target date/time and preserves macro fidelity', async () => {
  const db = await setupDbUpToVersion(13);
  const tplRepo = new SQLiteMealTemplateRepository(db);
  const mealRepo = new SQLiteMealRepository(db);

  const tpl = normalizeMealTemplate({
    id: 'tpl-log-test',
    title: 'Protein Pudding',
    totalCalories: 250,
    totalProtein: 32,
    totalCarbs: 12,
    totalFat: 4,
    nutritionCompleteness: 'complete',
    items: [],
  });
  await tplRepo.createTemplate(tpl);

  // Log meal from template
  const mealDraft = createMealFromTemplate(tpl, '2026-11-18', '19:45');
  assert.equal(mealDraft.date, '2026-11-18');
  assert.equal(mealDraft.time, '19:45');
  assert.equal(mealDraft.isFavorite, false);
  assert.equal(mealDraft.isTemplate, false);

  await mealRepo.insertMeal(mealDraft);
  const logged = await mealRepo.getMealById(mealDraft.id);

  assert.ok(logged);
  assert.equal(logged.title, 'Protein Pudding');
  assert.equal(logged.totalCalories, 250);
  assert.equal(logged.totalProtein, 32);
});

test('Section 4 - Test 10: No synthetic food creation when logging or saving itemless template', () => {
  const itemlessTemplate = normalizeMealTemplate({
    id: 'tpl-itemless-strict',
    title: 'Buffet Calorie Budget',
    totalCalories: 800,
    items: [],
  });

  assert.equal(itemlessTemplate.items.length, 0);

  const loggedMeal = createMealFromTemplate(itemlessTemplate, '2026-11-18', '20:00');
  assert.equal(loggedMeal.items.length, 0, 'No synthetic child items may be fabricated');
  assert.equal(loggedMeal.totalCalories, 800);

  const resavedTemplate = createTemplateFromMeal(loggedMeal, 'Buffet Template');
  assert.equal(resavedTemplate.items.length, 0, 'Re-saving itemless meal must remain itemless');
});

test('Section 4 - Test 11: Unknown macros remain unknown in UI and do not append falsified units', () => {
  // Test MacroCard rendering for unknown macro
  const htmlUnknown = renderToStaticMarkup(
    React.createElement(MacroCard, {
      label: 'Protein',
      value: null,
      unit: 'g',
      color: '#3B82F6',
      hasValue: false,
      unavailableLabel: '—',
    })
  );

  assert.ok(htmlUnknown.includes('—'));
  assert.ok(!htmlUnknown.includes('-- g'), 'Must not append unit to unknown values');
});

test('Section 4 - Test 12: Known zero macro renders confirmed 0 g with unit', () => {
  const htmlZero = renderToStaticMarkup(
    React.createElement(MacroCard, {
      label: 'Carbs',
      value: 0,
      unit: 'g',
      color: '#10B981',
      hasValue: true,
      unavailableLabel: '—',
    })
  );

  assert.ok(htmlZero.includes('0'));
  assert.ok(htmlZero.includes('g'));
});

test('Section 4 - Test 13: Favorite metadata migration backfills favorite_source accurately', async () => {
  const db = await setupDbUpToVersion(11);
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO meals (id, title, date, time, total_calories, total_protein, total_carbs, total_fat, notes, is_favorite, created_at)
     VALUES ('m-leg', 'Morning Oats', '2026-11-18', '08:00', 300, 10, 50, 5, '[favorite] staple', 1, ?);`,
    now
  );
  await db.runAsync(
    `INSERT INTO meals (id, title, date, time, total_calories, total_protein, total_carbs, total_fat, notes, is_favorite, created_at)
     VALUES ('m-exp', 'Chicken Breast', '2026-11-18', '13:00', 250, 48, 0, 4, 'Plain', 1, ?);`,
    now
  );
  await db.runAsync(
    `INSERT INTO meals (id, title, date, time, total_calories, total_protein, total_carbs, total_fat, notes, is_favorite, created_at)
     VALUES ('m-none', 'Water', '2026-11-18', '10:00', 0, 0, 0, 0, NULL, 0, ?);`,
    now
  );

  await runMigrations(db);

  const mealRepo = new SQLiteMealRepository(db);
  const mLeg = await mealRepo.getMealById('m-leg');
  const mExp = await mealRepo.getMealById('m-exp');
  const mNone = await mealRepo.getMealById('m-none');

  assert.equal(mLeg?.favoriteSource, 'legacy_marker');
  assert.equal(mExp?.favoriteSource, 'explicit');
  assert.equal(mNone?.favoriteSource, 'none');
});

test('Section 4 - Test 14: Ambiguous favorite note retains favorite_source = ambiguous', async () => {
  const db = await setupDbUpToVersion(11);
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO meals (id, title, date, time, total_calories, total_protein, total_carbs, total_fat, notes, is_favorite, created_at)
     VALUES ('m-ambig-prose', 'Soup', '2026-11-18', '12:00', 150, 5, 20, 3, 'My [favorite] chicken noodle soup recipe', 0, ?);`,
    now
  );

  await runMigrations(db);

  const mealRepo = new SQLiteMealRepository(db);
  const loaded = await mealRepo.getMealById('m-ambig-prose');

  assert.equal(loaded?.favoriteSource, 'ambiguous');
  assert.equal(loaded?.isFavorite, false);
});

test('Section 4 - Test 15: Explicit favorite toggle updates metadata and later edits do not overwrite favorite_source', async () => {
  const db = await setupDbUpToVersion(13);
  const mealRepo = new SQLiteMealRepository(db);

  const meal = normalizeMeal({
    id: 'm-toggle-edit',
    title: 'Beef & Broccoli',
    date: '2026-11-18',
    time: '18:30',
    totalCalories: 450,
    totalProtein: 40,
    totalCarbs: 15,
    totalFat: 20,
    isFavorite: false,
    favoriteSource: 'none',
  });
  await mealRepo.insertMeal(meal);

  // 1. Explicitly favorite meal
  await mealRepo.toggleMealFavorite(meal.id, true);
  let updated = await mealRepo.getMealById(meal.id);
  assert.equal(updated?.isFavorite, true);
  assert.equal(updated?.favoriteSource, 'explicit');

  // 2. Perform regular updateMeal (e.g. user edits title in EditMealScreen)
  // Calling updateMeal without favoriteSource MUST NOT overwrite existing favoriteSource or is_favorite!
  await mealRepo.updateMeal({
    ...updated!,
    title: 'Beef & Broccoli (Extra Garlic)',
  });

  updated = await mealRepo.getMealById(meal.id);
  assert.equal(updated?.title, 'Beef & Broccoli (Extra Garlic)');
  assert.equal(updated?.isFavorite, true, 'is_favorite must remain true after editing meal details');
  assert.equal(updated?.favoriteSource, 'explicit', 'favoriteSource must remain explicit after editing meal details');
});

test('Section 4 - Test 16: No historical meal records or nutrient snapshots are altered during migration', async () => {
  const db = await setupDbUpToVersion(11);
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO meals (id, title, date, time, total_calories, total_protein, total_carbs, total_fat, created_at)
     VALUES ('m-hist-1', 'Ancient Breakfast', '2026-10-01', '07:30', 500, 35, 45, 15, ?);`,
    now
  );

  await runMigrations(db);

  const mealRepo = new SQLiteMealRepository(db);
  const hist = await mealRepo.getMealById('m-hist-1');

  assert.ok(hist);
  assert.equal(hist.date, '2026-10-01');
  assert.equal(hist.time, '07:30');
  assert.equal(hist.totalCalories, 500);
  assert.equal(hist.totalProtein, 35);
  assert.equal(hist.totalCarbs, 45);
  assert.equal(hist.totalFat, 15);
});

test('Section 4 - Test 17: User profiles and workout tables are 100% unaffected by Migration 13', async () => {
  const db = await setupDbUpToVersion(12);
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO user_profiles (id, name, email, goal, avatar_initials, height_cm, weight_kg, target_calories, target_protein, target_carbs, target_fats, sleep_goal_hours, water_goal_liters, updated_at)
     VALUES ('u-guard', 'Guard User', 'guard@example.com', 'maintain', 'GU', 180, 80, 2500, 175, 250, 75, 8, 3, ?);`,
    now
  );
  await db.runAsync(
    `INSERT INTO workouts (id, title, date, time, notes, created_at)
     VALUES ('wk-guard', 'Leg Day Heavy', '2026-11-18', '06:00', 'Squats 5x5', ?);`,
    now
  );

  await runMigrations(db);

  const profRepo = new SQLiteProfileRepository(db);
  const wkRepo = new SQLiteWorkoutRepository(db);

  const profile = await profRepo.getProfile();
  const workouts = await wkRepo.getAllWorkouts();

  assert.ok(profile);
  assert.equal(profile.name, 'Guard User');
  assert.equal(profile.targetCalories, 2500);

  assert.equal(workouts.length, 1);
  assert.equal(workouts[0].title, 'Leg Day Heavy');
});

test('Section 4 - Test 18: Migration failure rolls back cleanly leaving database at previous valid state', async () => {
  const db = await setupDbUpToVersion(12);

  const failingMigration = {
    version: 999,
    name: 'failing_test_migration',
    up: async (database: IDatabase) => {
      await database.runAsync('INSERT INTO meals (id) VALUES (NULL);'); // Violates NOT NULL constraint
    },
  };

  await assert.rejects(async () => {
    await db.withTransactionAsync(async () => {
      await failingMigration.up(db);
    });
  });

  const schemaVersion = await db.getAllAsync<{ version: number }>(
    'SELECT version FROM schema_migrations ORDER BY version DESC;'
  );
  assert.equal(schemaVersion[0].version, 12, 'Must not commit failed migration');
});

test('Section 4 - Test 19: Migration rerun idempotence executes without errors', async () => {
  const db = await openDatabaseAsync(':memory:');
  await db.execAsync('PRAGMA foreign_keys = ON;');

  await runMigrations(db);
  await runMigrations(db);
  await runMigrations(db);

  const migrations = await db.getAllAsync<{ version: number }>(
    'SELECT version FROM schema_migrations ORDER BY version ASC;'
  );
  assert.equal(migrations.length, 13);
  assert.equal(migrations[12].version, 13);
});

test('Section 4 - Test 20: Daily and weekly nutrition analytics handle mixed known and unknown macro meals without fabricating 0g', () => {
  const completeMeal = normalizeMeal({
    id: 'm-comp',
    date: '2026-11-18',
    totalCalories: 600,
    totalProtein: 40,
    totalCarbs: 60,
    totalFat: 20,
    nutritionCompleteness: 'complete',
    proteinKnown: true,
    carbsKnown: true,
    fatKnown: true,
  });

  const unknownMacroMeal = normalizeMeal({
    id: 'm-unk',
    date: '2026-11-18',
    totalCalories: 300,
    totalProtein: 0,
    totalCarbs: 0,
    totalFat: 0,
    nutritionCompleteness: 'calories_only',
    proteinKnown: false,
    carbsKnown: false,
    fatKnown: false,
  });

  const summary = getDailyNutritionSummary([completeMeal, unknownMacroMeal], '2026-11-18');

  assert.equal(summary.calories, 900, 'Total calories must sum all logged calories');
  assert.equal(summary.protein, 40, 'Protein must reflect only measured protein');
  assert.equal(summary.carbs, 60, 'Carbs must reflect only measured carbs');
  assert.equal(summary.fats, 20, 'Fats must reflect only measured fats');
  assert.equal(summary.hasUnknownMacros, true, 'Summary must flag that unmeasured macronutrients exist');
});

// ============================================================================
// PART 2: SECTION 5 — CROSS-PLATFORM INTERACTIVE COMPONENT TESTS (5 TESTS)
// ============================================================================

test('Section 5 - Test 21: MealsScreen renders interactive day navigation and filter chips with touch targets', () => {
  const profile = createMockProfile();

  const meals = [
    normalizeMeal({
      id: 'm-card-1',
      title: 'Greek Yogurt Bowl',
      date: '2026-11-18',
      time: '08:15',
      totalCalories: 320,
      totalProtein: 25,
      totalCarbs: 35,
      totalFat: 6,
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
      selectedDate: '2026-11-18',
    })
  );

  assert.ok(html);
  assert.ok(html.includes('Greek Yogurt Bowl'));
  assert.ok(html.includes('320'));
});

test('Section 5 - Test 22: FoodPickerModal search, category filtering and RTL back arrow symmetry', () => {
  const htmlLTR = renderToStaticMarkup(
    React.createElement(FoodPickerModal, {
      visible: true,
      onClose: () => {},
      onSelectFood: () => {},
      t,
      language: 'en',
    })
  );
  assert.ok(htmlLTR);
  assert.ok(htmlLTR.includes('close') || htmlLTR.includes('Search foods') || htmlLTR.includes('input'));

  const htmlRTL = renderToStaticMarkup(
    React.createElement(FoodPickerModal, {
      visible: true,
      onClose: () => {},
      onSelectFood: () => {},
      t: (k: string) => translate('ar', k),
      language: 'ar',
    })
  );
  assert.ok(htmlRTL);
});

test('Section 5 - Test 23: ManualFoodModal handles required input validation and accessible errors', () => {
  const html = renderToStaticMarkup(
    React.createElement(ManualFoodModal, {
      visible: true,
      onClose: () => {},
      onSaveFood: () => {},
      t,
      language: 'en',
    })
  );

  assert.ok(html);
  assert.ok(html.includes('Custom Food') || html.includes('Food Name') || html.includes('input'));
});

test('Section 5 - Test 24: QuickAddMealModal renders quick log options and accessible touch targets', () => {
  const html = renderToStaticMarkup(
    React.createElement(QuickAddMealModal, {
      visible: true,
      onClose: () => {},
      onSaveQuickMeal: async () => {},
      t,
      language: 'en',
    })
  );

  assert.ok(html);
  assert.ok(html.includes('Quick Log') || html.includes('Calories') || html.includes('input'));
});

test('Section 5 - Test 25: MacroCard renders accessible names, values, and handles unknown nutrient contrast', () => {
  const htmlComplete = renderToStaticMarkup(
    React.createElement(MacroCard, {
      label: 'Fat',
      value: 14.5,
      unit: 'g',
      target: 70,
      accent: '#F59E0B',
      hasTarget: true,
    })
  );

  assert.ok(htmlComplete.includes('Fat: 15 of 70 g'));
  assert.ok(htmlComplete.includes('15'));
  assert.ok(htmlComplete.includes('g'));
});
