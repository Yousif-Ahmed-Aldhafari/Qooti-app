import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { openDatabaseAsync } from 'expo-sqlite';
import { runMigrations } from '../db/migrations';
import { SQLiteMealTemplateRepository } from '../db/repositories/mealTemplateRepository';
import {
  createMealFromTemplate,
  normalizeMealTemplate,
  type MealTemplate,
} from '../models/mealTemplate';
import { getDailyNutritionSummary, parseStrictNutrientInput } from '../utils/nutrition';
import { MealsScreen } from '../screens/MealsScreen';
import { ReviewTemplateModal } from '../components/ReviewTemplateModal';
import { translate } from '../i18n';
import type { IDatabase } from '../db/types';

function createMockTranslator(lang: 'en' | 'ar' = 'en') {
  return (key: string, params?: Record<string, string | number>) =>
    translate(lang, key, params);
}

async function setupDatabase(): Promise<IDatabase> {
  const db = await openDatabaseAsync(':memory:');
  await db.execAsync('PRAGMA foreign_keys = ON;');
  await runMigrations(db);
  return db;
}

// ============================================================================
// 1. ReviewTemplateModal UI & Markup Rendering
// ============================================================================

test('ReviewTemplateModal: renders cleanly in English with explanation, nutrients, and actions', () => {
  const t = createMockTranslator('en');
  const template: MealTemplate = normalizeMealTemplate({
    id: 'tpl-modal-en',
    title: 'Black Coffee with Sweetener',
    totalCalories: 4,
    totalProtein: 0,
    totalCarbs: 0,
    totalFat: 0,
    nutritionCompleteness: 'indeterminate',
    proteinKnown: false,
    carbsKnown: false,
    fatKnown: false,
    reviewStatus: 'ambiguous',
  });

  const html = renderToStaticMarkup(
    React.createElement(ReviewTemplateModal, {
      visible: true,
      template,
      onClose: () => {},
      onReconfirm: async () => {},
      t,
      language: 'en',
    })
  );

  assert.ok(html, 'Markup must be non-empty');
  assert.ok(html.includes('Review Macronutrients'), 'Must render modal title in English');
  assert.ok(html.includes('Black Coffee with Sweetener'), 'Must render template name');
  assert.ok(
    html.includes('unconfirmed macronutrients') || html.includes('positive calories'),
    'Must render historical ambiguity explanation banner'
  );
  assert.ok(html.includes('Known'), 'Must render Known toggle');
  assert.ok(html.includes('Unrecorded'), 'Must render Unrecorded toggle');
  assert.ok(html.includes('Confirm Macros') || html.includes('Confirm Macronutrients'), 'Must render action button');
});

test('ReviewTemplateModal: renders cleanly in Arabic with RTL layout and localized text', () => {
  const t = createMockTranslator('ar');
  const template: MealTemplate = normalizeMealTemplate({
    id: 'tpl-modal-ar',
    title: 'قهوة سوداء مع محلي',
    totalCalories: 4,
    totalProtein: 0,
    totalCarbs: 0,
    totalFat: 0,
    nutritionCompleteness: 'indeterminate',
    proteinKnown: false,
    carbsKnown: false,
    fatKnown: false,
    reviewStatus: 'ambiguous',
  });

  const html = renderToStaticMarkup(
    React.createElement(ReviewTemplateModal, {
      visible: true,
      template,
      onClose: () => {},
      onReconfirm: async () => {},
      t,
      language: 'ar',
    })
  );

  assert.ok(html, 'Markup must be non-empty');
  assert.ok(html.includes('مراجعة العناصر الغذائية'), 'Must render Arabic modal title');
  assert.ok(html.includes('قهوة سوداء مع محلي'), 'Must render Arabic template title');
  assert.ok(html.includes('معلوم'), 'Must render Arabic Known toggle');
  assert.ok(html.includes('غير مسجل'), 'Must render Arabic Unrecorded toggle');
  assert.ok(html.includes('تأكيد العناصر الغذائية') || html.includes('تأكيد العناصر'), 'Must render Arabic confirmation action');
});

test('ReviewTemplateModal: renders null when template is null', () => {
  const t = createMockTranslator('en');
  const html = renderToStaticMarkup(
    React.createElement(ReviewTemplateModal, {
      visible: true,
      template: null,
      onClose: () => {},
      onReconfirm: async () => {},
      t,
      language: 'en',
    })
  );

  assert.equal(html, '', 'Must render empty markup when template is null');
});

// ============================================================================
// 2. MealsScreen Review Action & Badge Verification
// ============================================================================

test('MealsScreen: renders Review Macros action and ambiguous badge on ambiguous templates', () => {
  const t = createMockTranslator('en');
  const ambiguousTpl: MealTemplate = normalizeMealTemplate({
    id: 'tpl-screen-ambiguous',
    title: 'Diet Soda Snack',
    totalCalories: 2,
    totalProtein: 0,
    totalCarbs: 0,
    totalFat: 0,
    nutritionCompleteness: 'indeterminate',
    reviewStatus: 'ambiguous',
  });

  const confirmedTpl: MealTemplate = normalizeMealTemplate({
    id: 'tpl-screen-confirmed',
    title: 'Oatmeal Bowl',
    totalCalories: 300,
    totalProtein: 12,
    totalCarbs: 50,
    totalFat: 5,
    nutritionCompleteness: 'complete',
    reviewStatus: 'confirmed',
  });

  const html = renderToStaticMarkup(
    React.createElement(MealsScreen, {
      t,
      meals: [],
      mealTemplates: [ambiguousTpl, confirmedTpl],
      onAddMeal: () => {},
      onMealPress: () => {},
      onLogFromTemplate: async () => {},
      onDeleteTemplate: async () => {},
      onReconfirmTemplate: async () => {},
      language: 'en',
      initialFilterMode: 'templates',
    })
  );

  assert.ok(html.includes('Diet Soda Snack'), 'Must render ambiguous template');
  assert.ok(
    html.includes('Macronutrients need review') || html.includes('⚠️'),
    'Must render ambiguous notice warning badge'
  );
  assert.ok(
    html.includes('Review Macros'),
    'Must render Review Macros action button for ambiguous template'
  );
});

// ============================================================================
// 3. SQLite Persistence & Reconfirmation Lifecycle
// ============================================================================

test('Reconfirmation Lifecycle: user confirms labeled 0g macros atomically updates review_status and completeness', async () => {
  const db = await setupDatabase();
  const repo = new SQLiteMealTemplateRepository(db);
  const now = new Date().toISOString();

  // Insert ambiguous template with positive calories and 0g macros
  await db.runAsync(
    `INSERT INTO meal_templates (
       id, title, meal_type, notes, is_favorite,
       total_calories, total_protein, total_carbs, total_fat,
       nutrition_completeness, protein_known, carbs_known, fat_known,
       review_status, created_at, updated_at
     ) VALUES (
       'tpl-reconfirm-1', 'Green Tea Infusion', 'snack', 'Explicit 0g on box', 0,
       3, 0, 0, 0,
       'indeterminate', 0, 0, 0,
       'ambiguous', ?, ?
     );`,
    now,
    now
  );

  // User reviews and confirms that all macros are known as 0g
  const updated = await repo.reconfirmTemplate('tpl-reconfirm-1', 'complete', {
    proteinKnown: true,
    carbsKnown: true,
    fatKnown: true,
    totalCalories: 3,
    totalProtein: 0,
    totalCarbs: 0,
    totalFat: 0,
  });

  assert.equal(updated.reviewStatus, 'confirmed');
  assert.equal(updated.nutritionCompleteness, 'complete');
  assert.equal(updated.proteinKnown, true);
  assert.equal(updated.carbsKnown, true);
  assert.equal(updated.fatKnown, true);
  assert.equal(updated.totalCalories, 3);
  assert.equal(updated.totalProtein, 0);

  // Verify direct SQLite row persistence
  const row = await db.getFirstAsync<{
    review_status: string;
    nutrition_completeness: string;
    protein_known: number;
    carbs_known: number;
    fat_known: number;
  }>('SELECT review_status, nutrition_completeness, protein_known, carbs_known, fat_known FROM meal_templates WHERE id = ?;', 'tpl-reconfirm-1');

  assert.ok(row);
  assert.equal(row.review_status, 'confirmed');
  assert.equal(row.nutrition_completeness, 'complete');
  assert.equal(row.protein_known, 1);
  assert.equal(row.carbs_known, 1);
  assert.equal(row.fat_known, 1);
});

test('Reconfirmation Lifecycle: user corrects nutrient numbers updates child item and totals atomically', async () => {
  const db = await setupDatabase();
  const repo = new SQLiteMealTemplateRepository(db);
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO meal_templates (
       id, title, meal_type, notes, is_favorite,
       total_calories, total_protein, total_carbs, total_fat,
       nutrition_completeness, protein_known, carbs_known, fat_known,
       review_status, created_at, updated_at
     ) VALUES (
       'tpl-reconfirm-2', 'Electrolyte Drink', 'snack', 'Originally logged without macros', 0,
       50, 0, 0, 0,
       'indeterminate', 0, 0, 0,
       'ambiguous', ?, ?
     );`,
    now,
    now
  );

  await db.runAsync(
    `INSERT INTO meal_template_items (id, template_id, name, quantity, unit, calories, protein, carbs, fats, sort_order)
     VALUES ('ti-reconfirm-2', 'tpl-reconfirm-2', 'Electrolyte Powder', 1, 'scoop', 50, 0, 0, 0, 0);`
  );

  // User specifies that carbs are actually 12g, protein is 0g, fat is 0g
  const updated = await repo.reconfirmTemplate('tpl-reconfirm-2', 'complete', {
    proteinKnown: true,
    carbsKnown: true,
    fatKnown: true,
    totalCalories: 50,
    totalProtein: 0,
    totalCarbs: 12,
    totalFat: 0,
  });

  assert.equal(updated.reviewStatus, 'confirmed');
  assert.equal(updated.totalCarbs, 12);
  assert.equal(updated.items.length, 1);
  assert.equal(updated.items[0].carbs, 12);

  // Verify child row updated in SQLite
  const itemRow = await db.getFirstAsync<{ carbs: number; calories: number }>(
    'SELECT carbs, calories FROM meal_template_items WHERE template_id = ?;',
    'tpl-reconfirm-2'
  );
  assert.ok(itemRow);
  assert.equal(itemRow.carbs, 12);
  assert.equal(itemRow.calories, 50);
});

test('Reconfirmation Lifecycle: user marks macros as unrecorded sets calories_only and confirmed review status', async () => {
  const db = await setupDatabase();
  const repo = new SQLiteMealTemplateRepository(db);
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO meal_templates (
       id, title, meal_type, notes, is_favorite,
       total_calories, total_protein, total_carbs, total_fat,
       nutrition_completeness, protein_known, carbs_known, fat_known,
       review_status, created_at, updated_at
     ) VALUES (
       'tpl-reconfirm-3', 'Unmeasured Snack Bar', 'snack', null, 0,
       220, 0, 0, 0,
       'indeterminate', 0, 0, 0,
       'ambiguous', ?, ?
     );`,
    now,
    now
  );

  // User confirms that macros were unmeasured and should remain unknown
  const updated = await repo.reconfirmTemplate('tpl-reconfirm-3', 'calories_only', {
    proteinKnown: false,
    carbsKnown: false,
    fatKnown: false,
    totalCalories: 220,
    totalProtein: 0,
    totalCarbs: 0,
    totalFat: 0,
  });

  assert.equal(updated.reviewStatus, 'confirmed');
  assert.equal(updated.nutritionCompleteness, 'calories_only');
  assert.equal(updated.proteinKnown, false);
  assert.equal(updated.carbsKnown, false);
  assert.equal(updated.fatKnown, false);
  assert.equal(updated.totalCalories, 220);
});

// ============================================================================
// 4. Restart Persistence & Failure Recovery
// ============================================================================

test('Restart Persistence: reconfirmed template state survives repository re-instantiation', async () => {
  const db = await setupDatabase();
  const repo1 = new SQLiteMealTemplateRepository(db);
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO meal_templates (
       id, title, total_calories, total_protein, total_carbs, total_fat,
       nutrition_completeness, protein_known, carbs_known, fat_known,
       review_status, created_at, updated_at
     ) VALUES ('tpl-restart-test', 'Diet Iced Tea', 5, 0, 0, 0, 'indeterminate', 0, 0, 0, 'ambiguous', ?, ?);`,
    now,
    now
  );

  await repo1.reconfirmTemplate('tpl-restart-test', 'complete', {
    proteinKnown: true,
    carbsKnown: true,
    fatKnown: true,
    totalCalories: 5,
    totalProtein: 0,
    totalCarbs: 0,
    totalFat: 0,
  });

  // Re-instantiate fresh repository to simulate app restart
  const repo2 = new SQLiteMealTemplateRepository(db);
  const loaded = await repo2.getTemplateById('tpl-restart-test');

  assert.ok(loaded);
  assert.equal(loaded.reviewStatus, 'confirmed');
  assert.equal(loaded.nutritionCompleteness, 'complete');
  assert.equal(loaded.totalCalories, 5);
  assert.equal(loaded.totalProtein, 0);
  assert.equal(loaded.proteinKnown, true);
});

test('Failure Recovery: transaction failure during reconfirmation rolls back completely', async () => {
  const db = await setupDatabase();
  const repo = new SQLiteMealTemplateRepository(db);
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO meal_templates (
       id, title, total_calories, total_protein, total_carbs, total_fat,
       nutrition_completeness, protein_known, carbs_known, fat_known,
       review_status, created_at, updated_at
     ) VALUES ('tpl-fail-test', 'Rollback Candidate', 100, 0, 0, 0, 'indeterminate', 0, 0, 0, 'ambiguous', ?, ?);`,
    now,
    now
  );

  // Attempt reconfirmation with a mock failing transaction
  const failingTxn = Object.create(db);
  failingTxn.runAsync = async () => {
    throw new Error('Simulated SQLite disk write failure');
  };

  await assert.rejects(
    async () => repo.reconfirmTemplate('tpl-fail-test', 'complete', { proteinKnown: true }, failingTxn as any),
    /Simulated SQLite disk write failure/
  );

  // Verify template in database was NOT mutated
  const untouched = await repo.getTemplateById('tpl-fail-test');
  assert.ok(untouched);
  assert.equal(untouched.reviewStatus, 'ambiguous', 'Must remain ambiguous on failure');
  assert.equal(untouched.nutritionCompleteness, 'indeterminate', 'Must retain original completeness');
});

// ============================================================================
// 5. Reconfirmed Template Meal Logging
// ============================================================================

test('Meal Logging: logging meal from reconfirmed template generates independent meal with confirmed semantics', async () => {
  const db = await setupDatabase();
  const repo = new SQLiteMealTemplateRepository(db);
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO meal_templates (
       id, title, total_calories, total_protein, total_carbs, total_fat,
       nutrition_completeness, protein_known, carbs_known, fat_known,
       review_status, created_at, updated_at
     ) VALUES ('tpl-log-test', 'Verified Zero Drink', 2, 0, 0, 0, 'indeterminate', 0, 0, 0, 'ambiguous', ?, ?);`,
    now,
    now
  );

  // Reconfirm
  const confirmed = await repo.reconfirmTemplate('tpl-log-test', 'complete', {
    proteinKnown: true,
    carbsKnown: true,
    fatKnown: true,
    totalCalories: 2,
    totalProtein: 0,
    totalCarbs: 0,
    totalFat: 0,
  });

  // Log meal into today's diary
  const logged = createMealFromTemplate(confirmed, '2026-11-18', '14:30');
  assert.notEqual(logged.id, confirmed.id, 'Logged meal must receive fresh unique ID');
  assert.equal(logged.date, '2026-11-18');
  assert.equal(logged.time, '14:30');
  assert.equal(logged.totalCalories, 2);
  assert.equal(logged.totalProtein, 0);
  assert.equal(logged.proteinKnown, true);
  assert.equal(logged.isFavorite, false, 'Logged meal must default to isFavorite = false');

  // Daily aggregate calculates confirmed intake accurately
  const summary = getDailyNutritionSummary([logged], logged.date);
  assert.equal(summary.calories, 2);
  assert.equal(summary.protein, 0);
  assert.equal(summary.hasUnknownMacros, false);
});

// ============================================================================
// 6. Multi-Item Template Reconfirmation & Silent Discard Prevention
// ============================================================================

test('Multi-Item Reconfirmation: explicit per-item corrections update child items and template totals atomically', async () => {
  const db = await setupDatabase();
  const repo = new SQLiteMealTemplateRepository(db);
  const now = new Date().toISOString();

  // Create ambiguous multi-item template
  await db.runAsync(
    `INSERT INTO meal_templates (
       id, title, meal_type, notes, is_favorite,
       total_calories, total_protein, total_carbs, total_fat,
       nutrition_completeness, protein_known, carbs_known, fat_known,
       review_status, created_at, updated_at
     ) VALUES (
       'tpl-multi-1', 'Post-Workout Fuel', 'snack', 'Needs item macro reconfirmation', 0,
       365, 0, 0, 0,
       'indeterminate', 0, 0, 0,
       'ambiguous', ?, ?
     );`,
    now,
    now
  );

  await db.runAsync(
    `INSERT INTO meal_template_items (id, template_id, name, quantity, unit, calories, protein, carbs, fats, sort_order)
     VALUES
       ('ti-multi-1', 'tpl-multi-1', 'White Rice', 200, 'g', 200, 0, 0, 0, 0),
       ('ti-multi-2', 'tpl-multi-1', 'Chicken Breast', 150, 'g', 165, 0, 0, 0, 1);`
  );

  // User explicitly provides per-item corrected macros
  const updated = await repo.reconfirmTemplate('tpl-multi-1', 'complete', {
    proteinKnown: true,
    carbsKnown: true,
    fatKnown: true,
    items: [
      {
        id: 'ti-multi-1',
        templateId: 'tpl-multi-1',
        name: 'White Rice',
        quantity: 200,
        unit: 'g',
        calories: 200,
        protein: 4,
        carbs: 44,
        fats: 0.5,
      },
      {
        id: 'ti-multi-2',
        templateId: 'tpl-multi-1',
        name: 'Chicken Breast',
        quantity: 150,
        unit: 'g',
        calories: 165,
        protein: 31,
        carbs: 0,
        fats: 3.6,
      },
    ],
  });

  assert.equal(updated.reviewStatus, 'confirmed');
  assert.equal(updated.nutritionCompleteness, 'complete');
  assert.equal(updated.items.length, 2);
  assert.equal(updated.items[0].protein, 4);
  assert.equal(updated.items[0].carbs, 44);
  assert.equal(updated.items[0].fats, 0.5);
  assert.equal(updated.items[1].protein, 31);
  assert.equal(updated.items[1].carbs, 0);
  assert.equal(updated.items[1].fats, 3.6);

  // Totals computed accurately from child items
  assert.equal(updated.totalCalories, 365);
  assert.equal(updated.totalProtein, 35);
  assert.equal(updated.totalCarbs, 44);
  assert.equal(updated.totalFat, 4.1);

  // Verify child items and template row in SQLite
  const rows = await db.getAllAsync<{ name: string; protein: number; carbs: number; fats: number }>(
    'SELECT name, protein, carbs, fats FROM meal_template_items WHERE template_id = ? ORDER BY sort_order ASC;',
    'tpl-multi-1'
  );
  assert.equal(rows.length, 2);
  assert.equal(rows[0].protein, 4);
  assert.equal(rows[1].protein, 31);

  const tplRow = await db.getFirstAsync<{ total_protein: number; review_status: string }>(
    'SELECT total_protein, review_status FROM meal_templates WHERE id = ?;',
    'tpl-multi-1'
  );
  assert.ok(tplRow);
  assert.equal(tplRow.total_protein, 35);
  assert.equal(tplRow.review_status, 'confirmed');
});

test('Multi-Item Protection: aggregate edits without item breakdown are strictly rejected to prevent silent discards', async () => {
  const db = await setupDatabase();
  const repo = new SQLiteMealTemplateRepository(db);
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO meal_templates (
       id, title, total_calories, total_protein, total_carbs, total_fat,
       nutrition_completeness, protein_known, carbs_known, fat_known,
       review_status, created_at, updated_at
     ) VALUES ('tpl-multi-reject', 'Multi Reject Candidate', 300, 0, 0, 0, 'indeterminate', 0, 0, 0, 'ambiguous', ?, ?);`,
    now,
    now
  );

  await db.runAsync(
    `INSERT INTO meal_template_items (id, template_id, name, quantity, unit, calories, protein, carbs, fats, sort_order)
     VALUES
       ('ti-r-1', 'tpl-multi-reject', 'Item A', 100, 'g', 150, 0, 0, 0, 0),
       ('ti-r-2', 'tpl-multi-reject', 'Item B', 100, 'g', 150, 0, 0, 0, 1);`
  );

  // Calling reconfirmTemplate with aggregate calorie/macro edits without items array must reject
  await assert.rejects(
    async () =>
      repo.reconfirmTemplate('tpl-multi-reject', 'complete', {
        totalCalories: 450, // Aggregate change without item breakdown
        proteinKnown: true,
      }),
    /Aggregate nutrient corrections are not supported for multi-item templates/
  );

  // Verify template was NOT mutated and remains ambiguous
  const untouched = await repo.getTemplateById('tpl-multi-reject');
  assert.ok(untouched);
  assert.equal(untouched.reviewStatus, 'ambiguous');
  assert.equal(untouched.totalCalories, 300);
});

test('Itemless Reconfirmation: corrected totals are saved directly to template without creating synthetic items', async () => {
  const db = await setupDatabase();
  const repo = new SQLiteMealTemplateRepository(db);
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO meal_templates (
       id, title, total_calories, total_protein, total_carbs, total_fat,
       nutrition_completeness, protein_known, carbs_known, fat_known,
       review_status, created_at, updated_at
     ) VALUES ('tpl-itemless-1', 'Quick Smoothie', 250, 0, 0, 0, 'indeterminate', 0, 0, 0, 'ambiguous', ?, ?);`,
    now,
    now
  );

  const updated = await repo.reconfirmTemplate('tpl-itemless-1', 'complete', {
    totalCalories: 260,
    totalProtein: 25,
    totalCarbs: 30,
    totalFat: 5,
    proteinKnown: true,
    carbsKnown: true,
    fatKnown: true,
  });

  assert.equal(updated.reviewStatus, 'confirmed');
  assert.equal(updated.totalCalories, 260);
  assert.equal(updated.totalProtein, 25);
  assert.equal(updated.totalCarbs, 30);
  assert.equal(updated.totalFat, 5);
  assert.equal(updated.items.length, 0, 'Must remain strictly itemless without synthetic items');

  const itemsInDb = await db.getAllAsync('SELECT * FROM meal_template_items WHERE template_id = ?;', 'tpl-itemless-1');
  assert.equal(itemsInDb.length, 0, 'Database must have zero child items');
});

// ============================================================================
// 7. Strict Input Validation & Out-of-Range Rejections
// ============================================================================

test('Strict Nutrient Input Validation: parseStrictNutrientInput rejects invalid, non-finite, and malformed values', () => {
  // Empty
  assert.equal(parseStrictNutrientInput('').isValid, false);
  assert.equal(parseStrictNutrientInput('   ').isValid, false);
  assert.equal(parseStrictNutrientInput(undefined).isValid, false);
  assert.equal(parseStrictNutrientInput(null).isValid, false);

  // Non-finite
  assert.equal(parseStrictNutrientInput('Infinity').isValid, false);
  assert.equal(parseStrictNutrientInput('-Infinity').isValid, false);
  assert.equal(parseStrictNutrientInput('NaN').isValid, false);
  assert.equal(parseStrictNutrientInput('nan').isValid, false);

  // Negative
  assert.equal(parseStrictNutrientInput('-1').isValid, false);
  assert.equal(parseStrictNutrientInput('-0.5').isValid, false);

  // Malformed decimals and symbols
  assert.equal(parseStrictNutrientInput('1.2.3').isValid, false);
  assert.equal(parseStrictNutrientInput('1,2,3').isValid, false);
  assert.equal(parseStrictNutrientInput('12.').isValid, false);
  assert.equal(parseStrictNutrientInput('.').isValid, false);
  assert.equal(parseStrictNutrientInput('++5').isValid, false);
  assert.equal(parseStrictNutrientInput('100g').isValid, false);
  assert.equal(parseStrictNutrientInput('abc').isValid, false);

  // Scientific notation
  assert.equal(parseStrictNutrientInput('1e50').isValid, false);
  assert.equal(parseStrictNutrientInput('2.5e3').isValid, false);

  // Out of range (max: 100,000)
  assert.equal(parseStrictNutrientInput('100001', { max: 100_000 }).isValid, false);
  assert.equal(parseStrictNutrientInput('999999999', { max: 100_000 }).isValid, false);

  // Valid values
  const valid1 = parseStrictNutrientInput('0');
  assert.equal(valid1.isValid, true);
  assert.equal(valid1.value, 0);

  const valid2 = parseStrictNutrientInput('350');
  assert.equal(valid2.isValid, true);
  assert.equal(valid2.value, 350);

  const valid3 = parseStrictNutrientInput('25.5');
  assert.equal(valid3.isValid, true);
  assert.equal(valid3.value, 25.5);

  const validComma = parseStrictNutrientInput('25,5');
  assert.equal(validComma.isValid, true);
  assert.equal(validComma.value, 25.5);
});

// ============================================================================
// 8. Multi-Item Modal UI & Error Banner Rendering
// ============================================================================

test('ReviewTemplateModal: renders multi-item template with individual food item inputs', () => {
  const t = createMockTranslator('en');
  const multiTemplate: MealTemplate = normalizeMealTemplate({
    id: 'tpl-modal-multi',
    title: 'Rice and Chicken Meal',
    items: [
      {
        id: 'ti-m-1',
        name: 'Jasmine Rice',
        quantity: 150,
        unit: 'g',
        calories: 195,
        protein: 0,
        carbs: 0,
        fats: 0,
      },
      {
        id: 'ti-m-2',
        name: 'Grilled Chicken',
        quantity: 200,
        unit: 'g',
        calories: 220,
        protein: 0,
        carbs: 0,
        fats: 0,
      },
    ],
    totalCalories: 415,
    totalProtein: 0,
    totalCarbs: 0,
    totalFat: 0,
    nutritionCompleteness: 'indeterminate',
    proteinKnown: false,
    carbsKnown: false,
    fatKnown: false,
    reviewStatus: 'ambiguous',
  });

  const html = renderToStaticMarkup(
    React.createElement(ReviewTemplateModal, {
      visible: true,
      template: multiTemplate,
      onClose: () => {},
      onReconfirm: async () => {},
      t,
      language: 'en',
    })
  );

  assert.ok(html.includes('Rice and Chicken Meal'), 'Must render template title');
  assert.ok(html.includes('Jasmine Rice'), 'Must render first item name');
  assert.ok(html.includes('Grilled Chicken'), 'Must render second item name');
  assert.ok(html.includes('Food Items') || html.includes('items'), 'Must render items section header');
  assert.ok(html.includes('Known'), 'Must render Known toggle');
  assert.ok(html.includes('Unrecorded'), 'Must render Unrecorded toggle');
});

// ============================================================================
// 9. Data Preservation & Non-Zero Unknown Macros Verification
// ============================================================================

test('Data Preservation: existing nonzero protein is preserved when marked unknown without manufactured zero', async () => {
  const db = await setupDatabase();
  const repo = new SQLiteMealTemplateRepository(db);
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO meal_templates (
       id, title, total_calories, total_protein, total_carbs, total_fat,
       nutrition_completeness, protein_known, carbs_known, fat_known,
       review_status, created_at, updated_at
     ) VALUES ('tpl-dp-protein', 'Protein Shake and Oats', 450, 42, 50, 8, 'indeterminate', 0, 0, 0, 'ambiguous', ?, ?);`,
    now,
    now
  );

  await db.runAsync(
    `INSERT INTO meal_template_items (id, template_id, name, quantity, unit, calories, protein, carbs, fats, sort_order)
     VALUES
       ('ti-dp-p1', 'tpl-dp-protein', 'Whey Protein', 1, 'scoop', 150, 30, 3, 2, 0),
       ('ti-dp-p2', 'tpl-dp-protein', 'Rolled Oats', 80, 'g', 300, 12, 47, 6, 1);`
  );

  // User confirms carbs and fat are known, but protein is marked UNRECORDED (unknown)
  // Per-item protein values must be preserved exactly (30 and 12), NOT zeroed out!
  const updated = await repo.reconfirmTemplate('tpl-dp-protein', 'partial', {
    proteinKnown: false,
    carbsKnown: true,
    fatKnown: true,
    items: [
      {
        id: 'ti-dp-p1',
        name: 'Whey Protein',
        quantity: 1,
        unit: 'scoop',
        calories: 150,
        protein: 30, // preserved
        carbs: 3,
        fats: 2,
      },
      {
        id: 'ti-dp-p2',
        name: 'Rolled Oats',
        quantity: 80,
        unit: 'g',
        calories: 300,
        protein: 12, // preserved
        carbs: 47,
        fats: 6,
      },
    ],
  });

  assert.equal(updated.reviewStatus, 'confirmed');
  assert.equal(updated.proteinKnown, false, 'Protein must be marked unknown');
  assert.equal(updated.carbsKnown, true, 'Carbs must be marked known');
  assert.equal(updated.fatKnown, true, 'Fat must be marked known');
  assert.equal(updated.totalProtein, 42, 'Total protein must retain original non-zero sum, never 0');
  assert.equal(updated.items[0].protein, 30, 'First item must retain 30g protein');
  assert.equal(updated.items[1].protein, 12, 'Second item must retain 12g protein');

  // Direct SQLite row verification
  const tplRow = await db.getFirstAsync<{ total_protein: number; protein_known: number }>(
    'SELECT total_protein, protein_known FROM meal_templates WHERE id = ?;',
    'tpl-dp-protein'
  );
  assert.ok(tplRow);
  assert.equal(tplRow.total_protein, 42);
  assert.equal(tplRow.protein_known, 0);

  const itemRows = await db.getAllAsync<{ name: string; protein: number }>(
    'SELECT name, protein FROM meal_template_items WHERE template_id = ? ORDER BY sort_order ASC;',
    'tpl-dp-protein'
  );
  assert.equal(itemRows[0].protein, 30);
  assert.equal(itemRows[1].protein, 12);
});

test('Data Preservation: existing nonzero carbs is preserved when marked unknown without manufactured zero', async () => {
  const db = await setupDatabase();
  const repo = new SQLiteMealTemplateRepository(db);
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO meal_templates (
       id, title, total_calories, total_protein, total_carbs, total_fat,
       nutrition_completeness, protein_known, carbs_known, fat_known,
       review_status, created_at, updated_at
     ) VALUES ('tpl-dp-carbs', 'Sweet Potato & Beef', 550, 40, 65, 12, 'indeterminate', 0, 0, 0, 'ambiguous', ?, ?);`,
    now,
    now
  );

  await db.runAsync(
    `INSERT INTO meal_template_items (id, template_id, name, quantity, unit, calories, protein, carbs, fats, sort_order)
     VALUES
       ('ti-dp-c1', 'tpl-dp-carbs', 'Baked Sweet Potato', 200, 'g', 180, 4, 41, 0, 0),
       ('ti-dp-c2', 'tpl-dp-carbs', 'Lean Beef with Glaze', 150, 'g', 370, 36, 24, 12, 1);`
  );

  // User marks carbs as UNRECORDED, keeping protein and fat known
  const updated = await repo.reconfirmTemplate('tpl-dp-carbs', 'partial', {
    proteinKnown: true,
    carbsKnown: false,
    fatKnown: true,
    items: [
      {
        id: 'ti-dp-c1',
        name: 'Baked Sweet Potato',
        quantity: 200,
        unit: 'g',
        calories: 180,
        protein: 4,
        carbs: 41, // preserved
        fats: 0,
      },
      {
        id: 'ti-dp-c2',
        name: 'Lean Beef with Glaze',
        quantity: 150,
        unit: 'g',
        calories: 370,
        protein: 36,
        carbs: 24, // preserved
        fats: 12,
      },
    ],
  });

  assert.equal(updated.reviewStatus, 'confirmed');
  assert.equal(updated.carbsKnown, false);
  assert.equal(updated.totalCarbs, 65, 'Total carbs must retain 65g, never 0');
  assert.equal(updated.items[0].carbs, 41);
  assert.equal(updated.items[1].carbs, 24);

  // Verify SQLite row
  const tplRow = await db.getFirstAsync<{ total_carbs: number; carbs_known: number }>(
    'SELECT total_carbs, carbs_known FROM meal_templates WHERE id = ?;',
    'tpl-dp-carbs'
  );
  assert.ok(tplRow);
  assert.equal(tplRow.total_carbs, 65);
  assert.equal(tplRow.carbs_known, 0);
});

test('Data Preservation: existing nonzero fat is preserved when marked unknown without manufactured zero', async () => {
  const db = await setupDatabase();
  const repo = new SQLiteMealTemplateRepository(db);
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO meal_templates (
       id, title, total_calories, total_protein, total_carbs, total_fat,
       nutrition_completeness, protein_known, carbs_known, fat_known,
       review_status, created_at, updated_at
     ) VALUES ('tpl-dp-fat', 'Avocado & Salmon Bowl', 600, 35, 20, 38, 'indeterminate', 0, 0, 0, 'ambiguous', ?, ?);`,
    now,
    now
  );

  await db.runAsync(
    `INSERT INTO meal_template_items (id, template_id, name, quantity, unit, calories, protein, carbs, fats, sort_order)
     VALUES
       ('ti-dp-f1', 'tpl-dp-fat', 'Avocado', 100, 'g', 160, 2, 9, 15, 0),
       ('ti-dp-f2', 'tpl-dp-fat', 'Salmon Fillet', 180, 'g', 440, 33, 11, 23, 1);`
  );

  // User marks fat as UNRECORDED, keeping protein and carbs known
  const updated = await repo.reconfirmTemplate('tpl-dp-fat', 'partial', {
    proteinKnown: true,
    carbsKnown: true,
    fatKnown: false,
    items: [
      {
        id: 'ti-dp-f1',
        name: 'Avocado',
        quantity: 100,
        unit: 'g',
        calories: 160,
        protein: 2,
        carbs: 9,
        fats: 15, // preserved
      },
      {
        id: 'ti-dp-f2',
        name: 'Salmon Fillet',
        quantity: 180,
        unit: 'g',
        calories: 440,
        protein: 33,
        carbs: 11,
        fats: 23, // preserved
      },
    ],
  });

  assert.equal(updated.reviewStatus, 'confirmed');
  assert.equal(updated.fatKnown, false);
  assert.equal(updated.totalFat, 38, 'Total fat must retain 38g, never 0');
  assert.equal(updated.items[0].fats, 15);
  assert.equal(updated.items[1].fats, 23);

  // Verify SQLite row
  const tplRow = await db.getFirstAsync<{ total_fat: number; fat_known: number }>(
    'SELECT total_fat, fat_known FROM meal_templates WHERE id = ?;',
    'tpl-dp-fat'
  );
  assert.ok(tplRow);
  assert.equal(tplRow.total_fat, 38);
  assert.equal(tplRow.fat_known, 0);
});

test('Data Preservation: mixed known and unknown macros maintain exact values and independent flags', async () => {
  const db = await setupDatabase();
  const repo = new SQLiteMealTemplateRepository(db);
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO meal_templates (
       id, title, total_calories, total_protein, total_carbs, total_fat,
       nutrition_completeness, protein_known, carbs_known, fat_known,
       review_status, created_at, updated_at
     ) VALUES ('tpl-dp-mixed', 'Mixed Macros Plate', 480, 28, 52, 14, 'indeterminate', 0, 0, 0, 'ambiguous', ?, ?);`,
    now,
    now
  );

  await db.runAsync(
    `INSERT INTO meal_template_items (id, template_id, name, quantity, unit, calories, protein, carbs, fats, sort_order)
     VALUES ('ti-dp-m1', 'tpl-dp-mixed', 'Plate Item', 1, 'serving', 480, 28, 52, 14, 0);`
  );

  // Protein known (28g), Carbs unknown (52g), Fat known (14g)
  const updated = await repo.reconfirmTemplate('tpl-dp-mixed', 'partial', {
    proteinKnown: true,
    carbsKnown: false,
    fatKnown: true,
    items: [
      {
        id: 'ti-dp-m1',
        name: 'Plate Item',
        quantity: 1,
        unit: 'serving',
        calories: 480,
        protein: 28,
        carbs: 52,
        fats: 14,
      },
    ],
  });

  assert.equal(updated.nutritionCompleteness, 'partial');
  assert.equal(updated.proteinKnown, true);
  assert.equal(updated.carbsKnown, false);
  assert.equal(updated.fatKnown, true);
  assert.equal(updated.totalProtein, 28);
  assert.equal(updated.totalCarbs, 52);
  assert.equal(updated.totalFat, 14);
});

test('Data Preservation: explicitly entered 0g remains known zero and does not become unknown', async () => {
  const db = await setupDatabase();
  const repo = new SQLiteMealTemplateRepository(db);
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO meal_templates (
       id, title, total_calories, total_protein, total_carbs, total_fat,
       nutrition_completeness, protein_known, carbs_known, fat_known,
       review_status, created_at, updated_at
     ) VALUES ('tpl-dp-zero', 'Pure Olive Oil Shot', 120, 0, 5, 14, 'indeterminate', 0, 0, 0, 'ambiguous', ?, ?);`,
    now,
    now
  );

  await db.runAsync(
    `INSERT INTO meal_template_items (id, template_id, name, quantity, unit, calories, protein, carbs, fats, sort_order)
     VALUES ('ti-dp-z1', 'tpl-dp-zero', 'Extra Virgin Olive Oil', 1, 'tbsp', 120, 0, 5, 14, 0);`
  );

  // User explicitly corrects carbs to 0g and marks all macros KNOWN
  const updated = await repo.reconfirmTemplate('tpl-dp-zero', 'complete', {
    proteinKnown: true,
    carbsKnown: true,
    fatKnown: true,
    items: [
      {
        id: 'ti-dp-z1',
        name: 'Extra Virgin Olive Oil',
        quantity: 1,
        unit: 'tbsp',
        calories: 120,
        protein: 0,
        carbs: 0, // explicitly zero
        fats: 14,
      },
    ],
  });

  assert.equal(updated.nutritionCompleteness, 'complete');
  assert.equal(updated.proteinKnown, true);
  assert.equal(updated.carbsKnown, true);
  assert.equal(updated.fatKnown, true);
  assert.equal(updated.totalProtein, 0);
  assert.equal(updated.totalCarbs, 0);
  assert.equal(updated.totalFat, 14);
  assert.equal(updated.items[0].carbs, 0);
});

test('Data Preservation: reconfirmation preserves unchanged items without mutating unrelated items', async () => {
  const db = await setupDatabase();
  const repo = new SQLiteMealTemplateRepository(db);
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO meal_templates (
       id, title, total_calories, total_protein, total_carbs, total_fat,
       nutrition_completeness, protein_known, carbs_known, fat_known,
       review_status, created_at, updated_at
     ) VALUES ('tpl-dp-partial-edit', 'Steak and Potato', 650, 45, 50, 18, 'indeterminate', 0, 0, 0, 'ambiguous', ?, ?);`,
    now,
    now
  );

  await db.runAsync(
    `INSERT INTO meal_template_items (id, template_id, name, quantity, unit, calories, protein, carbs, fats, sort_order)
     VALUES
       ('ti-pe-1', 'tpl-dp-partial-edit', 'Ribeye Steak', 200, 'g', 450, 42, 0, 18, 0),
       ('ti-pe-2', 'tpl-dp-partial-edit', 'Mashed Potato', 150, 'g', 200, 3, 50, 0, 1);`
  );

  // User only corrects Item 1's calories and protein; Item 2 is passed without changes
  const updated = await repo.reconfirmTemplate('tpl-dp-partial-edit', 'complete', {
    proteinKnown: true,
    carbsKnown: true,
    fatKnown: true,
    items: [
      {
        id: 'ti-pe-1',
        name: 'Ribeye Steak',
        quantity: 200,
        unit: 'g',
        calories: 460, // +10 cals
        protein: 44,  // +2g protein
        carbs: 0,
        fats: 18,
      },
      {
        id: 'ti-pe-2',
        name: 'Mashed Potato',
        quantity: 150,
        unit: 'g',
        calories: 200,
        protein: 3,
        carbs: 50,
        fats: 0,
      },
    ],
  });

  assert.equal(updated.items[0].protein, 44);
  assert.equal(updated.items[0].calories, 460);
  // Item 2 completely preserved
  assert.equal(updated.items[1].name, 'Mashed Potato');
  assert.equal(updated.items[1].quantity, 150);
  assert.equal(updated.items[1].unit, 'g');
  assert.equal(updated.items[1].calories, 200);
  assert.equal(updated.items[1].protein, 3);
  assert.equal(updated.items[1].carbs, 50);
  assert.equal(updated.items[1].fats, 0);
});

test('Data Preservation: SQLite persistence across restart verifies preserved non-zero values and flags', async () => {
  const db = await setupDatabase();
  const repo1 = new SQLiteMealTemplateRepository(db);
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO meal_templates (
       id, title, total_calories, total_protein, total_carbs, total_fat,
       nutrition_completeness, protein_known, carbs_known, fat_known,
       review_status, created_at, updated_at
     ) VALUES ('tpl-dp-restart', 'Restart Fidelity Test', 380, 24, 45, 10, 'indeterminate', 0, 0, 0, 'ambiguous', ?, ?);`,
    now,
    now
  );

  await db.runAsync(
    `INSERT INTO meal_template_items (id, template_id, name, quantity, unit, calories, protein, carbs, fats, sort_order)
     VALUES ('ti-dp-r1', 'tpl-dp-restart', 'High Protein Granola', 100, 'g', 380, 24, 45, 10, 0);`
  );

  // User marks protein as unknown, but preserves numbers
  await repo1.reconfirmTemplate('tpl-dp-restart', 'partial', {
    proteinKnown: false,
    carbsKnown: true,
    fatKnown: true,
    items: [
      {
        id: 'ti-dp-r1',
        name: 'High Protein Granola',
        quantity: 100,
        unit: 'g',
        calories: 380,
        protein: 24,
        carbs: 45,
        fats: 10,
      },
    ],
  });

  // Re-instantiate fresh repository to simulate cold app launch
  const repo2 = new SQLiteMealTemplateRepository(db);
  const reloaded = await repo2.getTemplateById('tpl-dp-restart');

  assert.ok(reloaded);
  assert.equal(reloaded.reviewStatus, 'confirmed');
  assert.equal(reloaded.proteinKnown, false);
  assert.equal(reloaded.carbsKnown, true);
  assert.equal(reloaded.fatKnown, true);
  assert.equal(reloaded.totalProtein, 24, 'Survives restart with non-zero protein intact');
  assert.equal(reloaded.totalCarbs, 45);
  assert.equal(reloaded.totalFat, 10);
  assert.equal(reloaded.items[0].protein, 24);
});

test('Data Preservation: transaction failure during reconfirmation leaves existing template and items untouched', async () => {
  const db = await setupDatabase();
  const repo = new SQLiteMealTemplateRepository(db);
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO meal_templates (
       id, title, total_calories, total_protein, total_carbs, total_fat,
       nutrition_completeness, protein_known, carbs_known, fat_known,
       review_status, created_at, updated_at
     ) VALUES ('tpl-dp-fail', 'Failure Safe Meal', 500, 30, 60, 15, 'indeterminate', 0, 0, 0, 'ambiguous', ?, ?);`,
    now,
    now
  );

  await db.runAsync(
    `INSERT INTO meal_template_items (id, template_id, name, quantity, unit, calories, protein, carbs, fats, sort_order)
     VALUES ('ti-dp-f1', 'tpl-dp-fail', 'Pre-existing Item', 1, 'bowl', 500, 30, 60, 15, 0);`
  );

  // Pass an invalid transaction mock that will reject mid-flight on write
  const failingTxn = Object.create(db);
  failingTxn.runAsync = async () => {
    throw new Error('Simulated SQLite disk write failure');
  };

  await assert.rejects(
    async () =>
      repo.reconfirmTemplate(
        'tpl-dp-fail',
        'complete',
        {
          proteinKnown: true,
          carbsKnown: true,
          fatKnown: true,
          totalCalories: 600,
        },
        failingTxn as any
      ),
    /Simulated SQLite disk write failure/
  );

  // Verify template in real DB remains completely unmutated
  const untouched = await repo.getTemplateById('tpl-dp-fail');
  assert.ok(untouched);
  assert.equal(untouched.reviewStatus, 'ambiguous');
  assert.equal(untouched.totalCalories, 500);
  assert.equal(untouched.items[0].protein, 30);
});

test('Data Preservation: template logging retains unknown flags and non-zero nutrients on generated Meal', () => {
  const template: MealTemplate = normalizeMealTemplate({
    id: 'tpl-dp-log',
    title: 'Protein Bar with Unmeasured Carbs',
    totalCalories: 240,
    totalProtein: 20,
    totalCarbs: 25,
    totalFat: 8,
    nutritionCompleteness: 'partial',
    proteinKnown: true,
    carbsKnown: false, // unmeasured carbs
    fatKnown: true,
    reviewStatus: 'confirmed',
    items: [
      {
        id: 'ti-log-1',
        name: 'Protein Bar',
        quantity: 1,
        unit: 'bar',
        calories: 240,
        protein: 20,
        carbs: 25, // non-zero carbs preserved
        fats: 8,
      },
    ],
  });

  const loggedMeal = createMealFromTemplate(template, '2026-11-19', '14:30');

  // Verify logged meal retains non-zero values and exact flags
  assert.notEqual(loggedMeal.id, template.id);
  assert.equal(loggedMeal.title, 'Protein Bar with Unmeasured Carbs');
  assert.equal(loggedMeal.totalCalories, 240);
  assert.equal(loggedMeal.totalProtein, 20);
  assert.equal(loggedMeal.totalCarbs, 25, 'Carbs must be 25g, not zeroed out');
  assert.equal(loggedMeal.totalFat, 8);
  assert.equal(loggedMeal.proteinKnown, true);
  assert.equal(loggedMeal.carbsKnown, false, 'Carbs known flag must remain false');
  assert.equal(loggedMeal.fatKnown, true);
  assert.equal(loggedMeal.nutritionCompleteness, 'partial');
  assert.equal(loggedMeal.items.length, 1);
  assert.equal(loggedMeal.items[0].carbs, 25, 'Child item carbs must remain 25g');

  // Also verify itemless template logging preserves unknown flags and analytics reflect it
  const itemlessTemplate: MealTemplate = normalizeMealTemplate({
    id: 'tpl-dp-log-itemless',
    title: 'Itemless Shake with Unknown Carbs',
    totalCalories: 240,
    totalProtein: 20,
    totalCarbs: 25,
    totalFat: 8,
    nutritionCompleteness: 'partial',
    proteinKnown: true,
    carbsKnown: false,
    fatKnown: true,
    reviewStatus: 'confirmed',
  });

  const loggedItemless = createMealFromTemplate(itemlessTemplate, '2026-11-19', '15:00');
  assert.equal(loggedItemless.totalCalories, 240);
  assert.equal(loggedItemless.totalCarbs, 25);
  assert.equal(loggedItemless.carbsKnown, false);

  const summary = getDailyNutritionSummary([loggedItemless], '2026-11-19');
  assert.equal(summary.calories, 240);
  assert.equal(summary.protein, 20);
  assert.equal(summary.carbsKnown, false, 'Summary carbsKnown reflects meal carbsKnown');
});
