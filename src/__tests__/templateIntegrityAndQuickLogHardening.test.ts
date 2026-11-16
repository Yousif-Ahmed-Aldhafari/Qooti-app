import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { QuickAddMealModal } from '../components/QuickAddMealModal';
import { MIGRATIONS, runMigrations } from '../db/migrations';
import { SQLiteMealRepository } from '../db/repositories/mealRepository';
import { SQLiteMealTemplateRepository } from '../db/repositories/mealTemplateRepository';
import { translate } from '../i18n';
import { normalizeMeal, type Meal } from '../models/meal';
import {
  createMealFromTemplate,
  createTemplateFromMeal,
  getMealTemplateTotals,
  normalizeMealTemplate,
  type MealTemplate,
} from '../models/mealTemplate';
import { normalizeProfile, type UserProfile } from '../models/profile';
import { MealDetailsScreen } from '../screens/MealDetailsScreen';
import { MealsScreen } from '../screens/MealsScreen';
import {
  calculateMacroDistribution,
  calculateNutritionTargetProgress,
  createRepeatedMealDraft,
  getDailyNutritionSummary,
} from '../utils/nutrition';
import { resolveEffectiveNutritionTargets } from '../utils/nutritionTargets';
import { openDatabaseAsync } from './mocks/expo-sqlite';

const t = (key: string, values?: Record<string, string | number>) => translate('en', key, values);
const tAr = (key: string, values?: Record<string, string | number>) => translate('ar', key, values);

async function createTestDb() {
  const db = await openDatabaseAsync(':memory:');
  await db.execAsync('PRAGMA foreign_keys = ON;');
  await runMigrations(db);
  return db;
}

function createMockProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return normalizeProfile({
    id: 'test-user-template',
    name: 'Template User',
    email: 'template@example.com',
    targetCalories: 2000,
    targetProtein: 150,
    targetCarbs: 200,
    targetFats: 65,
    calculationOverridden: true,
    ...overrides,
  });
}

// ============================================================================
// 1. MIGRATION 9 -> 10 INTEGRITY & SCHEMA VERIFICATION
// ============================================================================

test('Migration 9 -> 10: migrates [favorite] notes, sets indeterminate for 0-macro legacy, creates template tables', async () => {
  const db = await openDatabaseAsync(':memory:');
  await db.execAsync('PRAGMA foreign_keys = ON;');

  // Run migrations 1 through 9 only
  for (const migration of MIGRATIONS.slice(0, 9)) {
    await migration.up(db);
  }

  // Insert legacy meal with [favorite] in notes
  await db.runAsync(
    `INSERT INTO meals (id, title, date, time, total_calories, total_protein, total_carbs, total_fat, meal_type, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    'meal-fav-legacy',
    'Favorite Chicken Bowl',
    '2026-11-10',
    '12:00',
    500,
    40,
    50,
    15,
    'lunch',
    '[favorite] My favorite post-workout bowl with rice and chicken',
    '2026-11-10T12:00:00.000Z'
  );

  // Insert legacy itemless meal with 0 macros
  await db.runAsync(
    `INSERT INTO meals (id, title, date, time, total_calories, total_protein, total_carbs, total_fat, meal_type, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    'meal-itemless-legacy',
    'Quick Morning Coffee',
    '2026-11-10',
    '08:00',
    120,
    0,
    0,
    0,
    'breakfast',
    'Quick log without items',
    '2026-11-10T08:00:00.000Z'
  );

  // Now run Migration 10
  const migration10 = MIGRATIONS[9];
  assert.equal(migration10.version, 10);
  await migration10.up(db);

  // Verify column additions and data migration
  const favRow = await db.getFirstAsync<any>(
    'SELECT * FROM meals WHERE id = ?;',
    'meal-fav-legacy'
  );
  assert.equal(favRow.is_favorite, 1, 'Migration 10 must set is_favorite = 1 for [favorite] in notes');
  assert.equal(
    favRow.notes,
    '[favorite] My favorite post-workout bowl with rice and chicken',
    'Migration 10 must preserve raw notes content without destruction'
  );

  const itemlessRow = await db.getFirstAsync<any>(
    'SELECT * FROM meals WHERE id = ?;',
    'meal-itemless-legacy'
  );
  assert.equal(
    itemlessRow.nutrition_completeness,
    'indeterminate',
    'Migration 10 must mark legacy 0-macro itemless meals as indeterminate'
  );

  // Verify meal_templates and meal_template_items tables exist
  const templateTable = await db.getFirstAsync<any>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='meal_templates';"
  );
  assert.ok(templateTable, 'meal_templates table must exist after migration 10');

  const templateItemsTable = await db.getFirstAsync<any>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='meal_template_items';"
  );
  assert.ok(templateItemsTable, 'meal_template_items table must exist after migration 10');
});

// ============================================================================
// 2. INDEPENDENT PERSISTENT MEAL TEMPLATES CRUD & ISOLATION
// ============================================================================

test('createTemplateFromMeal: creates template with independent IDs, preserving items and order', () => {
  const sourceMeal: Meal = {
    id: 'meal-source-1',
    title: 'Protein Oatmeal',
    date: '2026-11-15',
    time: '08:30',
    mealType: 'breakfast',
    totalCalories: 450,
    totalProtein: 35,
    totalCarbs: 55,
    totalFat: 9,
    totalFats: 9,
    notes: '[favorite] Morning recipe',
    isFavorite: true,
    items: [
      {
        id: 'item-1',
        name: 'Rolled Oats',
        quantity: 60,
        unit: 'g',
        calories: 220,
        protein: 8,
        carbs: 40,
        fat: 4,
        fats: 4,
        sortOrder: 0,
      },
      {
        id: 'item-2',
        name: 'Whey Isolate',
        quantity: 30,
        unit: 'g',
        calories: 120,
        protein: 25,
        carbs: 2,
        fat: 1,
        fats: 1,
        sortOrder: 1,
      },
    ],
  };

  const template = createTemplateFromMeal(sourceMeal);
  assert.notEqual(template.id, sourceMeal.id, 'Template ID must be newly generated');
  assert.equal(template.title, 'Protein Oatmeal');
  assert.equal(template.isFavorite, false, 'New template must not inherit favorite state');
  assert.equal(template.notes, 'Morning recipe', 'Notes must have [favorite] stripped');
  assert.equal(template.items.length, 2);
  assert.notEqual(template.items[0].id, sourceMeal.items![0].id, 'Item IDs must be freshly generated');
  assert.equal(template.items[0].name, 'Rolled Oats');
  assert.equal(template.items[1].name, 'Whey Isolate');
  assert.equal(template.items[0].sortOrder, 0);
  assert.equal(template.items[1].sortOrder, 1);
});

test('SQLiteMealTemplateRepository: full CRUD and lifecycle decoupling from meals', async () => {
  const db = await createTestDb();
  const mealRepo = new SQLiteMealRepository(db);
  const templateRepo = new SQLiteMealTemplateRepository(db);

  // 1. Insert source meal
  const sourceMeal: Meal = {
    id: 'meal-lifecycle-1',
    title: 'Salmon & Asparagus Dinner',
    date: '2026-11-15',
    time: '19:00',
    mealType: 'dinner',
    totalCalories: 520,
    totalProtein: 45,
    totalCarbs: 10,
    totalFat: 32,
    totalFats: 32,
    items: [
      {
        id: 'salmon-item-1',
        name: 'Wild Atlantic Salmon',
        quantity: 200,
        unit: 'g',
        calories: 416,
        protein: 40,
        carbs: 0,
        fats: 28,
        sortOrder: 0,
      },
      {
        id: 'asparagus-item-2',
        name: 'Steamed Asparagus',
        quantity: 150,
        unit: 'g',
        calories: 30,
        protein: 3,
        carbs: 6,
        fats: 0.3,
        sortOrder: 1,
      },
    ],
  };
  await mealRepo.insertMeal(sourceMeal);

  // 2. Create template from meal and persist it
  const template = createTemplateFromMeal(sourceMeal);
  await templateRepo.createTemplate(template);

  // 3. Read back template
  const loadedTemplate = await templateRepo.getTemplateById(template.id);
  assert.ok(loadedTemplate, 'Template must be retrieved from database');
  assert.equal(loadedTemplate.title, 'Salmon & Asparagus Dinner');
  assert.equal(loadedTemplate.items.length, 2);

  // 4. Update template
  const updatedTemplate: MealTemplate = {
    ...loadedTemplate,
    title: 'Salmon, Asparagus & Lemon',
    notes: 'Squeeze fresh lemon before serving',
  };
  await templateRepo.updateTemplate(updatedTemplate);
  const reloaded = await templateRepo.getTemplateById(template.id);
  assert.equal(reloaded?.title, 'Salmon, Asparagus & Lemon');
  assert.equal(reloaded?.notes, 'Squeeze fresh lemon before serving');

  // 5. Toggle template favorite
  await templateRepo.toggleTemplateFavorite(template.id, true);
  const favTemplate = await templateRepo.getTemplateById(template.id);
  assert.equal(favTemplate?.isFavorite, true);

  // 6. DECOUPLING: Delete source meal from meals table
  await mealRepo.deleteMeal(sourceMeal.id);
  const deletedMeal = await mealRepo.getMealById(sourceMeal.id);
  assert.equal(deletedMeal, null, 'Source meal should be deleted');

  // Verify template is STILL present and intact
  const survivingTemplate = await templateRepo.getTemplateById(template.id);
  assert.ok(survivingTemplate, 'Template must survive source meal deletion');
  assert.equal(survivingTemplate.items.length, 2);

  // 7. Log new meal from template
  const loggedMeal = createMealFromTemplate(survivingTemplate, '2026-11-16');
  await mealRepo.insertMeal(loggedMeal);
  const retrievedLoggedMeal = await mealRepo.getMealById(loggedMeal.id);
  assert.ok(retrievedLoggedMeal);
  assert.equal(retrievedLoggedMeal.date, '2026-11-16');
  assert.equal(retrievedLoggedMeal.title, 'Salmon, Asparagus & Lemon');

  // 8. Delete template: verify logged meal still survives
  await templateRepo.deleteTemplate(template.id);
  const deletedTemplate = await templateRepo.getTemplateById(template.id);
  assert.equal(deletedTemplate, null);

  const survivingLoggedMeal = await mealRepo.getMealById(loggedMeal.id);
  assert.ok(survivingLoggedMeal, 'Historical logged meal must survive template deletion');
});

test('createTemplateFromMeal: supports itemless quick-add meals by synthesizing template item', () => {
  const quickMeal: Meal = {
    id: 'quick-meal-1',
    title: 'Protein Bar',
    date: '2026-11-15',
    time: '15:00',
    mealType: 'snack',
    totalCalories: 210,
    totalProtein: 20,
    totalCarbs: 22,
    totalFat: 7,
    totalFats: 7,
    items: [],
  };

  const template = createTemplateFromMeal(quickMeal);
  assert.equal(template.title, 'Protein Bar');
  assert.equal(template.items.length, 1);
  assert.equal(template.items[0].name, 'Protein Bar');
  assert.equal(template.items[0].calories, 210);
  assert.equal(template.items[0].protein, 20);
  assert.equal(template.items[0].carbs, 22);
  assert.equal(template.items[0].fats, 7);

  const totals = getMealTemplateTotals(template);
  assert.equal(totals.calories, 210);
  assert.equal(totals.protein, 20);
  assert.equal(totals.carbs, 22);
  assert.equal(totals.fats, 7);
});

// ============================================================================
// 3. SAFE FAVORITE MANAGEMENT & NOTES PURITY
// ============================================================================

test('toggleMealFavorite: granular update does NOT modify child meal items', async () => {
  const db = await createTestDb();
  const mealRepo = new SQLiteMealRepository(db);

  const meal: Meal = {
    id: 'granular-fav-meal',
    title: 'Egg White Scramble',
    date: '2026-11-15',
    time: '07:30',
    mealType: 'breakfast',
    totalCalories: 250,
    totalProtein: 30,
    totalCarbs: 5,
    totalFat: 10,
    totalFats: 10,
    notes: 'Cook with olive oil spray',
    isFavorite: false,
    items: [
      {
        id: 'egg-item-1',
        name: 'Egg Whites',
        quantity: 200,
        unit: 'g',
        calories: 104,
        protein: 22,
        carbs: 1.4,
        fats: 0.3,
        sortOrder: 0,
      },
    ],
  };

  await mealRepo.insertMeal(meal);

  // Toggle favorite to true
  await mealRepo.toggleMealFavorite(meal.id, true);

  const updated = await mealRepo.getMealById(meal.id);
  assert.ok(updated);
  assert.equal(updated.isFavorite, true);
  assert.equal(updated.notes, 'Cook with olive oil spray', 'Notes must remain clean without [favorite]');
  assert.equal(updated.items?.length, 1);
  assert.equal(updated.items![0].id, 'egg-item-1', 'Child item ID must remain identical');

  // Toggle favorite to false
  await mealRepo.toggleMealFavorite(meal.id, false);
  const updatedAgain = await mealRepo.getMealById(meal.id);
  assert.equal(updatedAgain?.isFavorite, false);
  assert.equal(updatedAgain?.notes, 'Cook with olive oil spray');
});

test('meal repository: preserves literal notes containing [favorite] text', async () => {
  const db = await createTestDb();
  const mealRepo = new SQLiteMealRepository(db);

  const mealWithLiteralNotes: Meal = {
    id: 'literal-notes-meal',
    title: 'Grandma Pancake Recipe',
    date: '2026-11-15',
    time: '09:00',
    mealType: 'breakfast',
    totalCalories: 380,
    totalProtein: 12,
    totalCarbs: 60,
    totalFat: 10,
    totalFats: 10,
    notes: 'This is my [favorite] recipe from 1995',
    isFavorite: false,
  };

  await mealRepo.insertMeal(mealWithLiteralNotes);
  const fetched = await mealRepo.getMealById(mealWithLiteralNotes.id);
  assert.ok(fetched);
  assert.equal(
    fetched.notes,
    'This is my [favorite] recipe from 1995',
    'Literal notes containing [favorite] must be preserved'
  );
});

// ============================================================================
// 4. UNKNOWN MACRONUTRIENTS & COMPLETENESS SEMANTICS
// ============================================================================

test('normalizeMeal: handles complete, partial, and calories_only semantics', () => {
  // 1. Calories only
  const caloriesOnly = normalizeMeal({
    id: 'cal-only',
    title: 'Coffee with Sugar',
    date: '2026-11-15',
    time: '10:00',
    totalCalories: 150,
    totalProtein: 0,
    totalCarbs: 0,
    totalFat: 0,
    nutritionCompleteness: 'calories_only',
    proteinKnown: false,
    carbsKnown: false,
    fatKnown: false,
  });
  assert.equal(caloriesOnly.nutritionCompleteness, 'calories_only');
  assert.equal(caloriesOnly.proteinKnown, false);
  assert.equal(caloriesOnly.carbsKnown, false);
  assert.equal(caloriesOnly.fatKnown, false);

  // 2. Partial (Protein known, Carbs/Fat unknown)
  const partial = normalizeMeal({
    id: 'part-meal',
    title: 'Protein Shake',
    date: '2026-11-15',
    time: '11:00',
    totalCalories: 160,
    totalProtein: 30,
    totalCarbs: 0,
    totalFat: 0,
    nutritionCompleteness: 'partial',
    proteinKnown: true,
    carbsKnown: false,
    fatKnown: false,
  });
  assert.equal(partial.nutritionCompleteness, 'partial');
  assert.equal(partial.proteinKnown, true);
  assert.equal(partial.carbsKnown, false);
  assert.equal(partial.fatKnown, false);

  // 3. Confirmed 0g (Egg whites: 0g fat confirmed)
  const confirmedZero = normalizeMeal({
    id: 'egg-whites',
    title: 'Liquid Egg Whites',
    date: '2026-11-15',
    time: '12:00',
    totalCalories: 100,
    totalProtein: 22,
    totalCarbs: 1,
    totalFat: 0,
    nutritionCompleteness: 'complete',
    proteinKnown: true,
    carbsKnown: true,
    fatKnown: true,
  });
  assert.equal(confirmedZero.nutritionCompleteness, 'complete');
  assert.equal(confirmedZero.fatKnown, true, 'Confirmed 0g must have fatKnown = true');
});

test('getDailyNutritionSummary & analytics: handles calories-only logs without assuming 0g macros', () => {
  const meals: Meal[] = [
    {
      id: 'm1',
      title: 'Known Breakfast',
      date: '2026-11-15',
      time: '08:00',
      totalCalories: 400,
      totalProtein: 30,
      totalCarbs: 40,
      totalFat: 12,
      totalFats: 12,
      nutritionCompleteness: 'complete',
      proteinKnown: true,
      carbsKnown: true,
      fatKnown: true,
    },
    {
      id: 'm2',
      title: 'Quick Donut',
      date: '2026-11-15',
      time: '15:00',
      totalCalories: 300,
      totalProtein: 0,
      totalCarbs: 0,
      totalFat: 0,
      totalFats: 0,
      nutritionCompleteness: 'calories_only',
      proteinKnown: false,
      carbsKnown: false,
      fatKnown: false,
    },
  ];

  const summary = getDailyNutritionSummary(meals, '2026-11-15');
  assert.equal(summary.calories, 700, 'Calories must include both meals');
  assert.equal(summary.protein, 30, 'Protein must only count known sources');
  assert.equal(summary.hasUnknownMacros, true, 'Summary must flag unknown macros');
  assert.equal(summary.isPartial, true);
  assert.equal(summary.proteinKnown, false, 'Daily proteinKnown must be false when any meal has unknown protein');

  // Target progress
  const profile = createMockProfile({ targetCalories: 2000, targetProtein: 150 });
  const targets = resolveEffectiveNutritionTargets(profile);
  const progress = calculateNutritionTargetProgress(summary, targets);
  assert.equal(progress.calories.consumed, 700);
  assert.equal(progress.protein.consumed, 30);
  assert.equal(progress.protein.isPartial, true);

  // Macro distribution
  const distribution = calculateMacroDistribution(summary);
  assert.equal(distribution.isPartial, true, 'Macro distribution must be flagged partial');
});

// ============================================================================
// 5. REPEAT MEAL SAFETY
// ============================================================================

test('createRepeatedMealDraft: resets favorite and template flags, preserves unknown macros', () => {
  const sourceMeal: Meal = {
    id: 'meal-repeat-source',
    title: 'Quick Protein Bar',
    date: '2026-11-10',
    time: '14:00',
    mealType: 'snack',
    totalCalories: 200,
    totalProtein: 20,
    totalCarbs: 0,
    totalFat: 0,
    totalFats: 0,
    notes: '[favorite] Fast snack on the go',
    isFavorite: true,
    isTemplate: true,
    nutritionCompleteness: 'partial',
    proteinKnown: true,
    carbsKnown: false,
    fatKnown: false,
  };

  const draft = createRepeatedMealDraft(sourceMeal, '2026-11-15');
  assert.notEqual(draft.id, sourceMeal.id);
  assert.equal(draft.date, '2026-11-15');
  assert.equal(draft.isFavorite, false, 'Repeated meal must NOT be marked favorite');
  assert.equal(draft.isTemplate, false, 'Repeated meal must NOT be marked template');
  assert.equal(draft.notes, 'Fast snack on the go', 'Notes must have [favorite] stripped');
  assert.equal(draft.nutritionCompleteness, 'partial');
  assert.equal(draft.proteinKnown, true);
  assert.equal(draft.carbsKnown, false);
  assert.equal(draft.fatKnown, false);
});

// ============================================================================
// 6. QUICK-ADD MEAL MODAL RENDERING & ERROR RECOVERY
// ============================================================================

test('QuickAddMealModal: renders cleanly with localized labels', () => {
  const html = renderToStaticMarkup(
    React.createElement(QuickAddMealModal, {
      visible: true,
      onClose: () => {},
      onSaveQuickMeal: () => {},
      t,
      language: 'en',
    })
  );

  assert.ok(html.includes('Quick Add Calories'), 'Must render quick add title');
  assert.ok(
    html.includes('Log calories and macros directly without individual foods.') ||
      html.includes('Log calories directly without item breakdown.'),
    'Must render subtitle'
  );
});

// ============================================================================
// 7. MEALS SCREEN & MEAL DETAILS SCREEN RENDERING
// ============================================================================

test('MealsScreen: renders All Meals, Favorites, and Templates filter tabs', () => {
  const meals: Meal[] = [
    {
      id: 'm-screen-1',
      title: 'Healthy Salad',
      date: '2026-11-15',
      time: '12:00',
      totalCalories: 350,
      totalProtein: 20,
      totalCarbs: 30,
      totalFat: 15,
      totalFats: 15,
      isFavorite: true,
    },
  ];

  const templates: MealTemplate[] = [
    normalizeMealTemplate({
      id: 't-screen-1',
      title: 'Standard Breakfast',
      mealType: 'breakfast',
      totalCalories: 400,
    }),
  ];

  const html = renderToStaticMarkup(
    React.createElement(MealsScreen, {
      t,
      meals,
      mealTemplates: templates,
      onAddMeal: () => {},
      onMealPress: () => {},
      selectedDate: '2026-11-15',
      profile: createMockProfile(),
    })
  );

  assert.ok(html.includes('All Meals'), 'Must render All Meals filter chip');
  assert.ok(html.includes('Favorites'), 'Must render Favorites filter chip');
  assert.ok(html.includes('Templates'), 'Must render Templates filter chip');

  // Also verify Arabic rendering
  const htmlAr = renderToStaticMarkup(
    React.createElement(MealsScreen, {
      t: tAr,
      meals,
      mealTemplates: templates,
      onAddMeal: () => {},
      onMealPress: () => {},
      language: 'ar',
      selectedDate: '2026-11-15',
      profile: createMockProfile(),
    })
  );
  assert.ok(htmlAr.includes(tAr('meals.title')), 'Must render Arabic meals title');
  assert.ok(htmlAr.includes(tAr('meals.templates')), 'Must render Arabic templates filter chip');
});

test('MealDetailsScreen: renders Save as Template button and unknown macro status', () => {
  const mealWithUnknownMacros: Meal = {
    id: 'meal-details-test',
    title: 'Restaurant Pasta',
    date: '2026-11-15',
    time: '20:00',
    mealType: 'dinner',
    totalCalories: 800,
    totalProtein: 0,
    totalCarbs: 0,
    totalFat: 0,
    totalFats: 0,
    nutritionCompleteness: 'calories_only',
    proteinKnown: false,
    carbsKnown: false,
    fatKnown: false,
    isFavorite: false,
  };

  const html = renderToStaticMarkup(
    React.createElement(MealDetailsScreen, {
      t,
      meal: mealWithUnknownMacros,
      profile: createMockProfile(),
      onRepeat: () => {},
      onSaveAsTemplate: () => {},
      onToggleFavorite: () => {},
      onEdit: () => {},
      onDelete: () => {},
    })
  );

  assert.ok(html.includes('Save as Template'), 'Must render Save as Template button');
  assert.ok(
    html.includes('Calories-only log. Macronutrients not recorded.'),
    'Must render calories-only notice'
  );
});
