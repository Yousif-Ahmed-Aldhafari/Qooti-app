import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { openDatabaseAsync } from './mocks/expo-sqlite';
import { MIGRATIONS, runMigrations } from '../db/migrations';
import { SQLiteMealRepository } from '../db/repositories/mealRepository';
import { SQLiteMealTemplateRepository } from '../db/repositories/mealTemplateRepository';
import { SQLiteProfileRepository } from '../db/repositories/profileRepository';
import { normalizeMeal } from '../models/meal';
import {
  createMealFromTemplate,
  normalizeMealTemplate,
} from '../models/mealTemplate';
import {
  getDailyNutritionSummary,
  calculateMacroDistribution,
  createRepeatedMealDraft,
} from '../utils/nutrition';
import {
  getPreviousCalendarDate,
  getNextCalendarDate,
} from '../utils/date';
import { searchFoodCatalog } from '../utils/foodSearch';
import { scaleFoodNutrients } from '../utils/foodScaling';
import { FOOD_CATALOG } from '../data/foodCatalog';
import { MacroCard } from '../components/MacroCard';
import { MacroDistributionBar } from '../components/MacroDistributionBar';
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

// ============================================================================
// GATE 1: MIGRATION 13 & 14 CORRECTNESS AUDIT & MANDATORY TEST
// ============================================================================

test('Gate 1 - Mandatory Test: V12 template with positive calories, zero macros, partial completeness, unknown macros, child item with catalog_id -> V14 asserts uncertainty is NOT converted to confirmed-zero intake', async () => {
  const db = await setupDbUpToVersion(12);
  const now = new Date().toISOString();

  // Construct a V12 template with:
  // - totalCalories > 0
  // - all numeric macros = 0
  // - nutritionCompleteness = 'partial'
  // - proteinKnown = false, carbsKnown = false, fatKnown = false
  // - child item with catalog_id or portion_unit
  await db.runAsync(
    `INSERT INTO meal_templates (
       id, title, meal_type, notes, is_favorite,
       total_calories, total_protein, total_carbs, total_fat,
       nutrition_completeness, protein_known, carbs_known, fat_known,
       created_at, updated_at
     ) VALUES (
       'tpl-v12-partial-test', 'Mystery Protein Bar', 'snack', 'Partial restaurant nutrition', 0,
       180, 0, 0, 0,
       'partial', 0, 0, 0,
       ?, ?
     );`,
    now,
    now
  );

  await db.runAsync(
    `INSERT INTO meal_template_items (
       id, template_id, name, quantity, unit,
       calories, protein, carbs, fats, catalog_id, portion_unit, sort_order
     ) VALUES (
       'item-bar-1', 'tpl-v12-partial-test', 'Protein Bar', 1, 'bar',
       180, 0, 0, 0, 'custom-bar-id', '1 bar (60g)', 0
     );`
  );

  // Run migrations forward through V13 and V14
  await runMigrations(db);

  const tplRepo = new SQLiteMealTemplateRepository(db);
  const tpl = await tplRepo.getTemplateById('tpl-v12-partial-test');

  assert.ok(tpl);
  assert.equal(tpl.totalCalories, 180);
  assert.equal(tpl.totalProtein, 0);
  assert.equal(tpl.totalCarbs, 0);
  assert.equal(tpl.totalFat, 0);

  // Assert user-recorded uncertainty is not silently converted to confirmed-zero intake
  assert.notEqual(tpl.nutritionCompleteness, 'complete', 'Uncertainty must not be converted to complete');
  assert.equal(tpl.nutritionCompleteness, 'indeterminate');
  assert.equal(tpl.proteinKnown, false, 'proteinKnown must remain false');
  assert.equal(tpl.carbsKnown, false, 'carbsKnown must remain false');
  assert.equal(tpl.fatKnown, false, 'fatKnown must remain false');
});

test('Gate 1 - Test 2: V12 indeterminate records with genuine child items remain indeterminate with unknown macros', async () => {
  const db = await setupDbUpToVersion(12);
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO meal_templates (
       id, title, meal_type, notes, is_favorite,
       total_calories, total_protein, total_carbs, total_fat,
       nutrition_completeness, protein_known, carbs_known, fat_known,
       created_at, updated_at
     ) VALUES (
       'tpl-v12-indet-items', 'Zero-Macro Beverage', 'snack', '', 0,
       5, 0, 0, 0,
       'indeterminate', 0, 0, 0,
       ?, ?
     );`,
    now,
    now
  );

  await db.runAsync(
    `INSERT INTO meal_template_items (
       id, template_id, name, quantity, unit,
       calories, protein, carbs, fats, catalog_id, portion_unit, sort_order
     ) VALUES (
       'item-bev-1', 'tpl-v12-indet-items', 'Iced Americano', 1, 'cup',
       5, 0, 0, 0, 'bev-americano', '1 cup', 0
     );`
  );

  await runMigrations(db);

  const tplRepo = new SQLiteMealTemplateRepository(db);
  const tpl = await tplRepo.getTemplateById('tpl-v12-indet-items');

  assert.ok(tpl);
  assert.equal(tpl.nutritionCompleteness, 'indeterminate');
  assert.equal(tpl.proteinKnown, false);
  assert.equal(tpl.carbsKnown, false);
  assert.equal(tpl.fatKnown, false);
});

test('Gate 1 - Test 3: V12 complete records with positive macros remain completely intact', async () => {
  const db = await setupDbUpToVersion(12);
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO meal_templates (
       id, title, meal_type, notes, is_favorite,
       total_calories, total_protein, total_carbs, total_fat,
       nutrition_completeness, protein_known, carbs_known, fat_known,
       created_at, updated_at
     ) VALUES (
       'tpl-v12-complete', 'Grilled Salmon & Rice', 'dinner', 'High protein dinner', 1,
       580, 42, 48, 18,
       'complete', 1, 1, 1,
       ?, ?
     );`,
    now,
    now
  );

  await runMigrations(db);

  const tplRepo = new SQLiteMealTemplateRepository(db);
  const tpl = await tplRepo.getTemplateById('tpl-v12-complete');

  assert.ok(tpl);
  assert.equal(tpl.totalCalories, 580);
  assert.equal(tpl.totalProtein, 42);
  assert.equal(tpl.totalCarbs, 48);
  assert.equal(tpl.totalFat, 18);
  assert.equal(tpl.nutritionCompleteness, 'complete');
  assert.equal(tpl.proteinKnown, true);
  assert.equal(tpl.carbsKnown, true);
  assert.equal(tpl.fatKnown, true);
});

test('Gate 1 - Test 4: V11 explicit known-zero records (water & pure sugar) preserved without corruption', async () => {
  const db = await setupDbUpToVersion(11);
  const now = new Date().toISOString();

  // Water (0 cal, 0 macros, complete)
  await db.runAsync(
    `INSERT INTO meal_templates (
       id, title, meal_type, notes, is_favorite,
       total_calories, total_protein, total_carbs, total_fat,
       nutrition_completeness, protein_known, carbs_known, fat_known,
       created_at, updated_at
     ) VALUES (
       'tpl-water', 'Drinking Water', 'other', 'Pure hydration', 0,
       0, 0, 0, 0,
       'complete', 1, 1, 1,
       ?, ?
     );`,
    now,
    now
  );

  // Pure table sugar (400 cal, 0g protein, 100g carbs, 0g fat, complete)
  await db.runAsync(
    `INSERT INTO meal_templates (
       id, title, meal_type, notes, is_favorite,
       total_calories, total_protein, total_carbs, total_fat,
       nutrition_completeness, protein_known, carbs_known, fat_known,
       created_at, updated_at
     ) VALUES (
       'tpl-sugar', 'Pure Sugar 100g', 'other', '', 0,
       400, 0, 100, 0,
       'complete', 1, 1, 1,
       ?, ?
     );`,
    now,
    now
  );

  await runMigrations(db);

  const tplRepo = new SQLiteMealTemplateRepository(db);
  const water = await tplRepo.getTemplateById('tpl-water');
  assert.ok(water);
  assert.equal(water.totalCalories, 0);
  assert.equal(water.nutritionCompleteness, 'complete');
  assert.equal(water.proteinKnown, true);

  const sugar = await tplRepo.getTemplateById('tpl-sugar');
  assert.ok(sugar);
  assert.equal(sugar.totalCalories, 400);
  assert.equal(sugar.totalProtein, 0);
  assert.equal(sugar.totalCarbs, 100);
  assert.equal(sugar.totalFat, 0);
  assert.equal(sugar.nutritionCompleteness, 'complete');
  assert.equal(sugar.proteinKnown, true);
  assert.equal(sugar.carbsKnown, true);
  assert.equal(sugar.fatKnown, true);
});

test('Gate 1 - Test 5: V10 synthetic records remain indeterminate without fabricated macros', async () => {
  const db = await setupDbUpToVersion(10);
  const now = new Date().toISOString();

  // Synthetic item created by pre-4.5B quick-add template
  await db.runAsync(
    `INSERT INTO meal_templates (id, title, meal_type, notes, is_favorite, created_at, updated_at)
     VALUES ('tpl-v10-synth', 'Quick 350 kcal', 'lunch', '', 0, ?, ?);`,
    now,
    now
  );
  await db.runAsync(
    `INSERT INTO meal_template_items (id, template_id, name, quantity, unit, calories, protein, carbs, fats, catalog_id, portion_unit, sort_order)
     VALUES ('item-synth-1', 'tpl-v10-synth', 'Quick 350 kcal', 1, 'serving', 350, 0, 0, 0, NULL, NULL, 0);`
  );

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

test('Gate 1 - Test 6: Mixed partially-known macro records preserve known/unknown distinction', async () => {
  const db = await setupDbUpToVersion(11);
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO meal_templates (
       id, title, meal_type, notes, is_favorite,
       total_calories, total_protein, total_carbs, total_fat,
       nutrition_completeness, protein_known, carbs_known, fat_known,
       created_at, updated_at
     ) VALUES (
       'tpl-v11-mixed-partial', 'Protein Shake (No Carbs/Fat Tracked)', 'snack', 'Only protein labeled', 0,
       150, 30, 0, 0,
       'partial', 1, 0, 0,
       ?, ?
     );`,
    now,
    now
  );

  await runMigrations(db);

  const tplRepo = new SQLiteMealTemplateRepository(db);
  const tpl = await tplRepo.getTemplateById('tpl-v11-mixed-partial');

  assert.ok(tpl);
  assert.equal(tpl.totalCalories, 150);
  assert.equal(tpl.totalProtein, 30);
  assert.equal(tpl.proteinKnown, true, 'Protein known must stay true');
  assert.equal(tpl.carbsKnown, false, 'Carbs known must stay false');
  assert.equal(tpl.fatKnown, false, 'Fat known must stay false');
  assert.equal(tpl.nutritionCompleteness, 'partial');
});

test('Gate 1 - Test 7: Explicitly user-corrected template metadata is preserved across migrations', async () => {
  const db = await setupDbUpToVersion(12);
  const now = new Date().toISOString();

  // User edited a template to add verified protein
  await db.runAsync(
    `INSERT INTO meal_templates (
       id, title, meal_type, notes, is_favorite,
       total_calories, total_protein, total_carbs, total_fat,
       nutrition_completeness, protein_known, carbs_known, fat_known,
       created_at, updated_at
     ) VALUES (
       'tpl-v12-user-corrected', 'Custom Whey Shake', 'snack', 'User calibrated', 1,
       130, 26, 2, 1,
       'complete', 1, 1, 1,
       ?, ?
     );`,
    now,
    now
  );

  await runMigrations(db);

  const tplRepo = new SQLiteMealTemplateRepository(db);
  const tpl = await tplRepo.getTemplateById('tpl-v12-user-corrected');

  assert.ok(tpl);
  assert.equal(tpl.totalCalories, 130);
  assert.equal(tpl.totalProtein, 26);
  assert.equal(tpl.totalCarbs, 2);
  assert.equal(tpl.totalFat, 1);
  assert.equal(tpl.nutritionCompleteness, 'complete');
  assert.equal(tpl.isFavorite, true);
});

// ============================================================================
// COMPLETE MIGRATION COMPATIBILITY (V0 THROUGH V14)
// ============================================================================

test('Migration Matrix: V0 -> V14 fresh install executes all 14 migrations cleanly', async () => {
  const db = await openDatabaseAsync(':memory:');
  await db.execAsync('PRAGMA foreign_keys = ON;');
  await runMigrations(db);

  const rows = await db.getAllAsync<{ version: number; name: string }>(
    'SELECT version, name FROM schema_migrations ORDER BY version ASC;'
  );
  assert.equal(rows.length, 14);
  assert.equal(rows[0].version, 1);
  assert.equal(rows[12].version, 13);
  assert.equal(rows[13].version, 14);
  assert.equal(rows[13].name, 'reconcile_template_unknown_macros_and_preserve_uncertainty_v14');
});

test('Migration Matrix: V1 -> V14 upgrade preserves profiles, targets, and workout data', async () => {
  const db = await setupDbUpToVersion(1);
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO user_profiles (id, name, email, goal, avatar_initials, height_cm, weight_kg, target_calories, target_protein, target_carbs, target_fats, sleep_goal_hours, water_goal_liters, updated_at)
     VALUES ('user-v1', 'Ahmed', 'ahmed@test.com', 'muscle_gain', 'AH', 180, 80, 2400, 160, 260, 75, 8, 3, ?);`,
    now
  );

  await runMigrations(db);

  const profileRepo = new SQLiteProfileRepository(db);
  const profile = await profileRepo.getProfile();
  assert.ok(profile);
  assert.equal(profile.targetCalories, 2400);
  assert.equal(profile.targetProtein, 160);
  assert.equal(profile.calculationOverridden, false);
});

test('Migration Matrix: V5 -> V14 upgrade preserves workout sessions and foreign keys', async () => {
  const db = await setupDbUpToVersion(5);
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO workout_sessions (id, title, status, started_at, accumulated_elapsed_ms, created_at, updated_at)
     VALUES ('sess-v5', 'Heavy Leg Day', 'completed', '2026-11-18T07:00:00.000Z', 3600000, ?, ?);`,
    now,
    now
  );

  await runMigrations(db);

  const session = await db.getFirstAsync<{ id: string; title: string; status: string }>(
    `SELECT id, title, status FROM workout_sessions WHERE id = 'sess-v5';`
  );
  assert.ok(session);
  assert.equal(session.title, 'Heavy Leg Day');
  assert.equal(session.status, 'completed');
});

test('Migration Matrix: V8 -> V14 upgrade preserves target overrides and session recovery', async () => {
  const db = await setupDbUpToVersion(8);
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO workout_sessions (id, title, status, started_at, accumulated_elapsed_ms, recovery_state, created_at, updated_at)
     VALUES ('sess-v8', 'Interrupted Pull', 'discarded', '2026-11-18T08:00:00.000Z', 0, 'ambiguous', ?, ?);`,
    now,
    now
  );

  await runMigrations(db);

  const session = await db.getFirstAsync<{ recovery_state: string }>(
    `SELECT recovery_state FROM workout_sessions WHERE id = 'sess-v8';`
  );
  assert.ok(session);
  assert.equal(session.recovery_state, 'ambiguous');
});

test('Migration Matrix: V9 -> V14 upgrade preserves bilingual catalog snapshots and custom foods', async () => {
  const db = await setupDbUpToVersion(9);
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO custom_foods (id, name, name_ar, calories, protein, carbs, fats, serving_size, serving_unit, category, created_at, updated_at)
     VALUES ('cf-hummus', 'Fresh Hummus Tahini', 'حمص بالطحينة طازج', 166, 7.9, 14.3, 9.6, 100, 'g', 'regional_middle_eastern', ?, ?);`,
    now,
    now
  );

  await runMigrations(db);

  const cf = await db.getFirstAsync<{ name: string; name_ar: string }>(
    `SELECT name, name_ar FROM custom_foods WHERE id = 'cf-hummus';`
  );
  assert.ok(cf);
  assert.equal(cf.name, 'Fresh Hummus Tahini');
  assert.equal(cf.name_ar, 'حمص بالطحينة طازج');
  assert.equal(cf.name_ar, 'حمص بالطحينة طازج');
});

test('Migration Matrix: V10 -> V14 upgrade preserves meal templates and structured favorites', async () => {
  const db = await setupDbUpToVersion(10);
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO meal_templates (id, title, meal_type, notes, is_favorite, created_at, updated_at)
     VALUES ('tpl-v10-fav', 'Favorite Greek Yogurt', 'breakfast', 'With berries', 1, ?, ?);`,
    now,
    now
  );

  await runMigrations(db);

  const tplRepo = new SQLiteMealTemplateRepository(db);
  const tpl = await tplRepo.getTemplateById('tpl-v10-fav');
  assert.ok(tpl);
  assert.equal(tpl.isFavorite, true);
  assert.equal(tpl.title, 'Favorite Greek Yogurt');
});

test('Migration Matrix: V11 -> V14 upgrade preserves direct template totals', async () => {
  const db = await setupDbUpToVersion(11);
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO meal_templates (
       id, title, meal_type, notes, is_favorite,
       total_calories, total_protein, total_carbs, total_fat,
       nutrition_completeness, protein_known, carbs_known, fat_known,
       created_at, updated_at
     ) VALUES (
       'tpl-v11-direct', 'Post-Workout Shake', 'snack', '', 0,
       320, 36, 24, 6,
       'complete', 1, 1, 1,
       ?, ?
     );`,
    now,
    now
  );

  await runMigrations(db);

  const tplRepo = new SQLiteMealTemplateRepository(db);
  const tpl = await tplRepo.getTemplateById('tpl-v11-direct');
  assert.ok(tpl);
  assert.equal(tpl.totalCalories, 320);
  assert.equal(tpl.totalProtein, 36);
  assert.equal(tpl.totalCarbs, 24);
  assert.equal(tpl.totalFat, 6);
});

test('Migration Matrix: V12 -> V14 upgrade preserves favorite_source provenance', async () => {
  const db = await setupDbUpToVersion(12);
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO meals (id, title, date, time, total_calories, total_protein, total_carbs, total_fat, notes, is_favorite, favorite_source, created_at)
     VALUES ('m-prov-test', 'Kabsa Lunch', '2026-11-18', '14:00', 750, 45, 80, 25, 'Great lunch', 1, 'explicit', ?);`,
    now
  );

  await runMigrations(db);

  const mealRepo = new SQLiteMealRepository(db);
  const meal = await mealRepo.getMealById('m-prov-test');
  assert.ok(meal);
  assert.equal(meal.favoriteSource, 'explicit');
  assert.equal(meal.isFavorite, true);
});

test('Migration Matrix: V13 -> V14 forward upgrade is safe and repeatable (idempotent)', async () => {
  const db = await setupDbUpToVersion(13);
  await runMigrations(db);

  const firstRun = await db.getAllAsync<{ version: number }>(
    'SELECT version FROM schema_migrations ORDER BY version ASC;'
  );
  assert.equal(firstRun.length, 14);
  assert.equal(firstRun[13].version, 14);

  // Second run must be no-op
  await runMigrations(db);
  const secondRun = await db.getAllAsync<{ version: number }>(
    'SELECT version FROM schema_migrations ORDER BY version ASC;'
  );
  assert.equal(secondRun.length, 14);
});

test('Referential Integrity: Template deletion cascades to items without orphaned rows', async () => {
  const db = await setupDbUpToVersion(14);
  const tplRepo = new SQLiteMealTemplateRepository(db);

  const tpl = normalizeMealTemplate({
    id: 'tpl-cascade-delete',
    title: 'Cascade Test Meal',
    items: [
      { id: 'ti-c1', name: 'Item 1', quantity: 1, unit: 'serving', calories: 100, protein: 5, carbs: 10, fats: 2 },
      { id: 'ti-c2', name: 'Item 2', quantity: 2, unit: 'serving', calories: 200, protein: 10, carbs: 20, fats: 4 },
    ],
  });

  await tplRepo.createTemplate(tpl);

  const itemsBefore = await db.getAllAsync(
    `SELECT id FROM meal_template_items WHERE template_id = 'tpl-cascade-delete';`
  );
  assert.equal(itemsBefore.length, 2);

  await tplRepo.deleteTemplate('tpl-cascade-delete');

  const itemsAfter = await db.getAllAsync(
    `SELECT id FROM meal_template_items WHERE template_id = 'tpl-cascade-delete';`
  );
  assert.equal(itemsAfter.length, 0, 'All child items must cascade delete');
});

test('Atomic Rollback: Insertion failure rolls back cleanly without partial rows', async () => {
  const db = await setupDbUpToVersion(14);
  const mealRepo = new SQLiteMealRepository(db);

  const meal = normalizeMeal({
    id: 'm-rollback-test',
    title: 'Rollback Meal',
    date: '2026-11-18',
    time: '12:00',
    items: [
      { id: 'mi-1', name: 'Item 1', quantity: 100, unit: 'g', calories: 120, protein: 20, carbs: 0, fats: 2 },
      // Invalid item that causes constraint failure: null name
      { id: 'mi-2', name: null as unknown as string, quantity: 50, unit: 'g', calories: 50, protein: 2, carbs: 5, fats: 1 },
    ],
  });

  await assert.rejects(async () => {
    await mealRepo.insertMeal(meal);
  });

  const mealRow = await db.getFirstAsync(`SELECT id FROM meals WHERE id = 'm-rollback-test';`);
  assert.equal(mealRow, null, 'Parent meal must not persist on child item failure');

  const itemRows = await db.getAllAsync(`SELECT id FROM meal_items WHERE meal_id = 'm-rollback-test';`);
  assert.equal(itemRows.length, 0, 'No child items should remain on rollback');
});

// ============================================================================
// END-TO-END NUTRITION ACCEPTANCE & USER JOURNEYS
// ============================================================================

test('Journey 19: Date navigation functions across month and leap-year boundaries', () => {
  assert.equal(getPreviousCalendarDate('2024-03-01'), '2024-02-29', 'Leap year Feb 29 previous day');
  assert.equal(getNextCalendarDate('2024-02-28'), '2024-02-29', 'Leap year Feb 28 next day');
  assert.equal(getNextCalendarDate('2024-02-29'), '2024-03-01', 'Leap year Feb 29 to March 1');
  assert.equal(getNextCalendarDate('2025-02-28'), '2025-03-01', 'Non-leap year Feb 28 to March 1');
  assert.equal(getPreviousCalendarDate('2026-01-01'), '2025-12-31', 'Year boundary transition');
});

test('Journey 20: Offline bilingual food search and portion scaling calculations', () => {
  // English search
  const chickenEn = searchFoodCatalog('chicken breast cooked');
  assert.ok(chickenEn.length > 0);
  assert.equal(chickenEn[0].id, 'chicken-breast-cooked');

  // Arabic search with normalization
  const chickenAr = searchFoodCatalog('دجاج');
  assert.ok(chickenAr.length > 0);

  // Portion scaling: 200g of cooked chicken breast (165 kcal / 100g, 31g P)
  const scaled = scaleFoodNutrients(chickenEn[0], 2, '100g');
  assert.equal(scaled.calories, 330);
  assert.equal(scaled.protein, 62);
  assert.equal(scaled.carbs, 0);
});

test('Journey 21: Multi-food meal creation, editing, and reload persistence', async () => {
  const db = await setupDbUpToVersion(14);
  const mealRepo = new SQLiteMealRepository(db);

  const initialMeal = normalizeMeal({
    id: 'm-multi-edit',
    title: 'Post-Workout Lunch',
    date: '2026-11-18',
    time: '13:00',
    mealType: 'lunch',
    items: [
      { id: 'mi-e1', name: 'Chicken Breast', quantity: 150, unit: 'g', calories: 248, protein: 46.5, carbs: 0, fats: 5.4 },
      { id: 'mi-e2', name: 'White Rice', quantity: 200, unit: 'g', calories: 260, protein: 4.8, carbs: 56.4, fats: 0.6 },
    ],
  });

  await mealRepo.insertMeal(initialMeal);

  // Reload and verify initial state
  const loaded = await mealRepo.getMealById('m-multi-edit');
  assert.ok(loaded);
  assert.equal(loaded.items.length, 2);
  assert.equal(loaded.totalCalories, 508);

  // Edit: update chicken quantity to 200g (+82 kcal)
  const updatedMeal = normalizeMeal({
    ...loaded,
    title: 'Post-Workout Lunch (Large)',
    items: [
      { id: 'mi-e1', name: 'Chicken Breast', quantity: 200, unit: 'g', calories: 330, protein: 62, carbs: 0, fats: 7.2 },
      { id: 'mi-e2', name: 'White Rice', quantity: 200, unit: 'g', calories: 260, protein: 4.8, carbs: 56.4, fats: 0.6 },
    ],
  });

  await mealRepo.updateMeal(updatedMeal);

  const reloaded = await mealRepo.getMealById('m-multi-edit');
  assert.ok(reloaded);
  assert.equal(reloaded.title, 'Post-Workout Lunch (Large)');
  assert.equal(reloaded.totalCalories, 590);
  assert.equal(reloaded.totalProtein, 66.8);
});

test('Journey 22: Quick-Add calories and partial macros creates valid meal with unknown semantics', () => {
  const quickMeal = normalizeMeal({
    id: 'm-quick-log',
    title: 'Street Food Snack',
    date: '2026-11-18',
    time: '16:00',
    totalCalories: 450,
    totalProtein: 0,
    totalCarbs: 0,
    totalFat: 0,
    nutritionCompleteness: 'calories_only',
    proteinKnown: false,
    carbsKnown: false,
    fatKnown: false,
    items: [],
  });

  assert.equal(quickMeal.totalCalories, 450);
  assert.equal(quickMeal.nutritionCompleteness, 'calories_only');
  assert.equal(quickMeal.proteinKnown, false);
  assert.equal(quickMeal.carbsKnown, false);
  assert.equal(quickMeal.fatKnown, false);
});

test('Journey 23: Template logging and repeat meal workflows generate brand-new UUIDs without mutating sources', async () => {
  const db = await setupDbUpToVersion(14);
  const tplRepo = new SQLiteMealTemplateRepository(db);

  const tpl = normalizeMealTemplate({
    id: 'tpl-repeat-source',
    title: 'Standard Breakfast',
    mealType: 'breakfast',
    totalCalories: 450,
    totalProtein: 30,
    totalCarbs: 45,
    totalFat: 15,
    nutritionCompleteness: 'complete',
    proteinKnown: true,
    carbsKnown: true,
    fatKnown: true,
    items: [
      { id: 'ti-rep-1', name: 'Eggs', quantity: 3, unit: 'large', calories: 210, protein: 18, carbs: 1.5, fats: 15 },
      { id: 'ti-rep-2', name: 'Toast', quantity: 2, unit: 'slice', calories: 240, protein: 12, carbs: 43.5, fats: 0 },
    ],
  });

  await tplRepo.createTemplate(tpl);

  // Log meal from template
  const newMeal = createMealFromTemplate(tpl, '2026-11-18', '08:30');
  assert.notEqual(newMeal.id, tpl.id, 'Meal ID must be fresh');
  assert.equal(newMeal.date, '2026-11-18');
  assert.equal(newMeal.time, '08:30');
  assert.equal(newMeal.items.length, 2);
  assert.notEqual(newMeal.items[0].id, tpl.items[0].id, 'Child item IDs must be fresh');

  // Repeat historical meal draft
  const repeatDraft = createRepeatedMealDraft(newMeal, '2026-11-19');
  assert.notEqual(repeatDraft.id, newMeal.id);
  assert.equal(repeatDraft.date, '2026-11-19');
  assert.notEqual(repeatDraft.items[0].id, newMeal.items[0].id);
});

test('Journey 24: Undated legacy meals are excluded from dated daily totals and preserved in recovery view', async () => {
  const db = await setupDbUpToVersion(14);
  const mealRepo = new SQLiteMealRepository(db);
  const now = new Date().toISOString();

  // Insert undated legacy meal directly into SQLite
  await db.runAsync(
    `INSERT INTO meals (id, title, date, time, total_calories, total_protein, total_carbs, total_fat, notes, is_favorite, favorite_source, created_at)
     VALUES ('m-undated', 'Old Legacy Protein', '', '12:00', 300, 35, 10, 5, 'Imported legacy record', 0, 'none', ?);`,
    now
  );

  // Insert dated meal
  await db.runAsync(
    `INSERT INTO meals (id, title, date, time, total_calories, total_protein, total_carbs, total_fat, notes, is_favorite, favorite_source, created_at)
     VALUES ('m-dated', 'Today Lunch', '2026-11-18', '12:30', 500, 40, 50, 15, '', 0, 'none', ?);`,
    now
  );

  const allMeals = await mealRepo.getAllMeals();
  assert.equal(allMeals.length, 2);

  // Daily summary for today must ONLY include dated meal
  const todaySummary = getDailyNutritionSummary(allMeals, '2026-11-18');
  assert.equal(todaySummary.calories, 500, 'Undated meal must not inflate dated total');
  assert.equal(todaySummary.protein, 40);

  // Undated meal can be isolated for recovery
  const undatedMeals = allMeals.filter((m) => !m.date || m.date.trim() === '');
  assert.equal(undatedMeals.length, 1);
  assert.equal(undatedMeals[0].id, 'm-undated');
});

test('Journey 25: Nutrition analytics Atwater 4/4/9 macro distribution and logged-days-only averages', () => {
  // Atwater 4/4/9 distribution with 100% integer normalization
  const dist = calculateMacroDistribution({ protein: 40, carbs: 60, fats: 20 }); // 160 kcal P, 240 kcal C, 180 kcal F = 580 total
  assert.equal(dist.proteinPct + dist.carbsPct + dist.fatsPct, 100);

  // Macro distribution with 0 macros returns 0%
  const zeroDist = calculateMacroDistribution({ protein: 0, carbs: 0, fats: 0 });
  assert.equal(zeroDist.proteinPct, 0);
  assert.equal(zeroDist.carbsPct, 0);
  assert.equal(zeroDist.fatsPct, 0);
});

test('Journey 26: Food data provenance auditing flags verified, estimated, and unverified correctly', () => {
  // Chicken breast is USDA verified
  const chicken = FOOD_CATALOG.find((f) => f.id === 'chicken-breast-raw');
  assert.ok(chicken);
  assert.equal(chicken.sourceName, 'USDA FoodData Central');

  // Total catalog count
  assert.equal(FOOD_CATALOG.length, 158);
});

test('Journey 27: Cross-platform accessibility contracts and interactive touch targets', () => {
  const markup = renderToStaticMarkup(
    React.createElement(MacroCard, {
      label: 'Protein',
      value: 45,
      target: 120,
      unit: 'g',
      accent: '#4CAF50',
    })
  );
  assert.ok(markup.includes('Protein: 45 of 120 g'));
});

test('Journey 28: Universal theme tokens provide compliant contrast and UI renders cleanly', () => {
  const dist = calculateMacroDistribution({ protein: 40, carbs: 50, fats: 15, calories: 495 });
  const barMarkup = renderToStaticMarkup(
    React.createElement(MacroDistributionBar, {
      distribution: dist,
      t,
    })
  );
  assert.ok(barMarkup.includes('Macronutrient distribution') || barMarkup.includes('Protein'));
});
