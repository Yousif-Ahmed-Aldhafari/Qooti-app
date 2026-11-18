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
