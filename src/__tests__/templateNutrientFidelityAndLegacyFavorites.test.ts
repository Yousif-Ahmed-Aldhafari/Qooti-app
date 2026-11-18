import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabaseAsync } from 'expo-sqlite';
import { runMigrations, MIGRATIONS } from '../db/migrations';
import { IDatabase } from '../db/types';
import { Meal, normalizeMeal } from '../models/meal';
import {
  MealTemplate,
  createTemplateFromMeal,
  createMealFromTemplate,
  getMealTemplateTotals,
  normalizeMealTemplate,
} from '../models/mealTemplate';
import { SQLiteMealRepository } from '../db/repositories/mealRepository';
import { SQLiteMealTemplateRepository } from '../db/repositories/mealTemplateRepository';
import {
  getDailyNutritionSummary,
  calculateNutritionTargetProgress,
  buildWeeklyNutritionChartDays,
} from '../utils/nutrition';
import { resolveEffectiveNutritionTargets } from '../utils/nutritionTargets';

async function createFreshDb(): Promise<IDatabase> {
  const db = await openDatabaseAsync(':memory:');
  await db.execAsync('PRAGMA foreign_keys = ON;');
  await runMigrations(db);
  return db;
}

// ============================================================================
// 1. MIGRATION 10 -> 11 UPGRADE & REPAIR TESTS
// ============================================================================

test('Migration 10 -> 11: adds nutrient fidelity columns, backfills totals, and repairs legacy favorites', async () => {
  const db = await openDatabaseAsync(':memory:');
  await db.execAsync('PRAGMA foreign_keys = ON;');

  // Apply migrations 1 through 10 manually
  for (let v = 1; v <= 10; v++) {
    const m = MIGRATIONS.find((mig) => mig.version === v)!;
    await db.withTransactionAsync(async () => {
      await m.up(db);
      await db.runAsync(
        'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?);',
        m.version,
        m.name,
        new Date().toISOString()
      );
    });
  }

  const now = new Date().toISOString();

  // Insert meals into V10 database:
  // 1. Meal with [favorite] at start of notes (real legacy favorite)
  await db.runAsync(
    `INSERT INTO meals (id, title, date, time, total_calories, total_protein, total_carbs, total_fat, notes, is_favorite, created_at)
     VALUES ('m-leg-fav', 'Real Favorite', '2026-11-15', '08:00', 350, 20, 40, 10, '[favorite] Mom recipe', 1, ?);`,
    now
  );

  // 2. Meal with [favorite] as sole note (real legacy favorite)
  await db.runAsync(
    `INSERT INTO meals (id, title, date, time, total_calories, total_protein, total_carbs, total_fat, notes, is_favorite, created_at)
     VALUES ('m-sole-fav', 'Sole Favorite Marker', '2026-11-15', '09:00', 400, 25, 45, 12, '[favorite]', 1, ?);`,
    now
  );

  // 3. Meal with user prose containing [favorite] in the middle (falsely favorited by Migration 10)
  await db.runAsync(
    `INSERT INTO meals (id, title, date, time, total_calories, total_protein, total_carbs, total_fat, notes, is_favorite, created_at)
     VALUES ('m-prose-fav', 'Grandma Stew', '2026-11-15', '12:00', 500, 30, 50, 15, 'This is my [favorite] recipe from 1995', 1, ?);`,
    now
  );

  // 4. Meal with user prose containing [favorite] at the end
  await db.runAsync(
    `INSERT INTO meals (id, title, date, time, total_calories, total_protein, total_carbs, total_fat, notes, is_favorite, created_at)
     VALUES ('m-end-fav', 'Apple Pie', '2026-11-15', '14:00', 300, 2, 60, 5, 'Dessert is my [favorite]', 1, ?);`,
    now
  );

  // 5. Legitimate user-favorited meal without [favorite] in notes (created in Task 4.5)
  await db.runAsync(
    `INSERT INTO meals (id, title, date, time, total_calories, total_protein, total_carbs, total_fat, notes, is_favorite, created_at)
     VALUES ('m-legit-fav', 'Steak Dinner', '2026-11-15', '19:00', 700, 60, 0, 45, 'Cook medium rare with butter', 1, ?);`,
    now
  );

  // 6. Normal unfavorited meal
  await db.runAsync(
    `INSERT INTO meals (id, title, date, time, total_calories, total_protein, total_carbs, total_fat, notes, is_favorite, created_at)
     VALUES ('m-unfav', 'Quick Snack', '2026-11-15', '16:00', 150, 5, 20, 3, 'Light snack', 0, ?);`,
    now
  );

  // Insert a V10 template with items
  await db.runAsync(
    `INSERT INTO meal_templates (id, title, meal_type, notes, is_favorite, created_at, updated_at)
     VALUES ('tpl-v10-1', 'Breakfast Bowl', 'breakfast', 'Daily bowl', 0, ?, ?);`,
    now,
    now
  );
  await db.runAsync(
    `INSERT INTO meal_template_items (id, template_id, name, quantity, unit, calories, protein, carbs, fats, sort_order)
     VALUES ('tpl-item-1', 'tpl-v10-1', 'Oats', 100, 'g', 389, 16.9, 66.3, 6.9, 0);`,
  );
  await db.runAsync(
    `INSERT INTO meal_template_items (id, template_id, name, quantity, unit, calories, protein, carbs, fats, sort_order)
     VALUES ('tpl-item-2', 'tpl-v10-1', 'Milk', 200, 'ml', 122, 6.8, 9.6, 6.4, 1);`,
  );

  // Run forward migration 11
  await runMigrations(db);

  const applied = await db.getAllAsync<{ version: number; name: string }>(
    'SELECT version, name FROM schema_migrations ORDER BY version ASC;'
  );
  assert.equal(applied.length, 13);
  const mig11 = applied[10];
  assert.equal(mig11.version, 11);
  assert.equal(mig11.name, 'add_meal_template_nutrient_fidelity_and_favorite_repair_v11');

  // Verify favorite repair results
  const meals = await db.getAllAsync<{ id: string; is_favorite: number; notes: string }>(
    'SELECT id, is_favorite, notes FROM meals ORDER BY id ASC;'
  );
  const mealsById = new Map(meals.map((m) => [m.id, m]));

  // Real favorite with prefix stays favorite
  assert.equal(mealsById.get('m-leg-fav')?.is_favorite, 1, 'Real prefix [favorite] must remain favorite');
  assert.equal(mealsById.get('m-sole-fav')?.is_favorite, 1, 'Sole [favorite] marker must remain favorite');

  // False favorites with prose containing [favorite] must be repaired to 0
  assert.equal(mealsById.get('m-prose-fav')?.is_favorite, 0, 'Prose containing [favorite] in middle must be repaired to is_favorite = 0');
  assert.equal(mealsById.get('m-end-fav')?.is_favorite, 0, 'Prose containing [favorite] at end must be repaired to is_favorite = 0');

  // Legitimate user favorite with ordinary notes must remain 1
  assert.equal(mealsById.get('m-legit-fav')?.is_favorite, 1, 'Legitimate user favorite without [favorite] marker must remain 1');

  // Unfavorited meal remains 0
  assert.equal(mealsById.get('m-unfav')?.is_favorite, 0, 'Unfavorited meal must remain 0');

  // Verify backfilled totals on existing template
  const tplRow = await db.getFirstAsync<{
    total_calories: number;
    total_protein: number;
    total_carbs: number;
    total_fat: number;
    nutrition_completeness: string;
  }>("SELECT total_calories, total_protein, total_carbs, total_fat, nutrition_completeness FROM meal_templates WHERE id = 'tpl-v10-1';");

  assert.ok(tplRow);
  assert.equal(tplRow.total_calories, 389 + 122);
  assert.equal(tplRow.total_protein, 23.7);
  assert.equal(tplRow.total_carbs, 75.9);
  assert.equal(tplRow.total_fat, 13.3);
  assert.equal(tplRow.nutrition_completeness, 'complete');
});

test('Migration 11 idempotence: re-running migrations does not fail, alter schema, or duplicate data', async () => {
  const db = await createFreshDb();
  await runMigrations(db);
  await runMigrations(db);

  const applied = await db.getAllAsync<{ version: number }>(
    'SELECT version FROM schema_migrations ORDER BY version ASC;'
  );
  assert.equal(applied.length, 13);
  assert.equal(applied[10].version, 11);
  assert.equal(applied[11].version, 12);
  assert.equal(applied[12].version, 13);
});

// ============================================================================
// 2. TEMPLATE NUTRIENT FIDELITY & ITEMLESS STRUCTURE
// ============================================================================

test('createTemplateFromMeal: itemless calorie-only meal preserves items: [] and explicit unknown macros', () => {
  const calorieOnlyMeal: Meal = {
    id: 'meal-cal-only',
    title: 'Post Workout Shake (Calorie Estimate)',
    date: '2026-11-15',
    time: '18:00',
    mealType: 'snack',
    totalCalories: 450,
    totalProtein: 0,
    totalCarbs: 0,
    totalFat: 0,
    totalFats: 0,
    items: [],
    nutritionCompleteness: 'calories_only',
    proteinKnown: false,
    carbsKnown: false,
    fatKnown: false,
  };

  const template = createTemplateFromMeal(calorieOnlyMeal);

  // Must NOT fabricate a synthetic item
  assert.equal(template.items.length, 0, 'Itemless meal must produce explicit itemless template (items: [])');
  assert.equal(template.totalCalories, 450);
  assert.equal(template.totalProtein, 0);
  assert.equal(template.totalCarbs, 0);
  assert.equal(template.totalFat, 0);
  assert.equal(template.nutritionCompleteness, 'calories_only');
  assert.equal(template.proteinKnown, false);
  assert.equal(template.carbsKnown, false);
  assert.equal(template.fatKnown, false);

  const totals = getMealTemplateTotals(template);
  assert.equal(totals.calories, 450);
  assert.equal(totals.protein, 0);
  assert.equal(totals.carbs, 0);
  assert.equal(totals.fats, 0);
});

test('createMealFromTemplate: logging itemless calorie-only template preserves items: [] and unknown macro status', () => {
  const calorieOnlyTemplate: MealTemplate = {
    id: 'tpl-cal-only',
    title: 'Protein Smoothie Estimate',
    mealType: 'snack',
    notes: 'Rough 450 kcal',
    items: [],
    totalCalories: 450,
    totalProtein: 0,
    totalCarbs: 0,
    totalFat: 0,
    totalFats: 0,
    nutritionCompleteness: 'calories_only',
    proteinKnown: false,
    carbsKnown: false,
    fatKnown: false,
    createdAt: '2026-11-15T12:00:00.000Z',
    updatedAt: '2026-11-15T12:00:00.000Z',
  };

  const loggedMeal = createMealFromTemplate(calorieOnlyTemplate, '2026-11-16', '14:30');

  assert.notEqual(loggedMeal.id, calorieOnlyTemplate.id, 'Logged meal must receive fresh ID');
  assert.equal(loggedMeal.items.length, 0, 'Logged meal must remain itemless without fake items');
  assert.equal(loggedMeal.totalCalories, 450);
  assert.equal(loggedMeal.totalProtein, 0);
  assert.equal(loggedMeal.totalCarbs, 0);
  assert.equal(loggedMeal.totalFat, 0);
  assert.equal(loggedMeal.nutritionCompleteness, 'calories_only');
  assert.equal(loggedMeal.proteinKnown, false, 'Protein must NOT become falsely known');
  assert.equal(loggedMeal.carbsKnown, false, 'Carbs must NOT become falsely known');
  assert.equal(loggedMeal.fatKnown, false, 'Fat must NOT become falsely known');
  assert.equal(loggedMeal.date, '2026-11-16');
  assert.equal(loggedMeal.time, '14:30');
});

test('createTemplateFromMeal: partial macro meal faithfully preserves known/unknown flags', () => {
  const partialMeal: Meal = {
    id: 'meal-partial',
    title: 'Chicken Breast + mystery sauce',
    date: '2026-11-15',
    time: '13:00',
    mealType: 'lunch',
    totalCalories: 350,
    totalProtein: 40,
    totalCarbs: 0,
    totalFat: 0,
    totalFats: 0,
    items: [],
    nutritionCompleteness: 'partial',
    proteinKnown: true,
    carbsKnown: false,
    fatKnown: false,
  };

  const template = createTemplateFromMeal(partialMeal);
  assert.equal(template.items.length, 0);
  assert.equal(template.totalCalories, 350);
  assert.equal(template.totalProtein, 40);
  assert.equal(template.nutritionCompleteness, 'partial');
  assert.equal(template.proteinKnown, true);
  assert.equal(template.carbsKnown, false);
  assert.equal(template.fatKnown, false);

  const loggedMeal = createMealFromTemplate(template, '2026-11-17');
  assert.equal(loggedMeal.items.length, 0);
  assert.equal(loggedMeal.totalCalories, 350);
  assert.equal(loggedMeal.totalProtein, 40);
  assert.equal(loggedMeal.nutritionCompleteness, 'partial');
  assert.equal(loggedMeal.proteinKnown, true);
  assert.equal(loggedMeal.carbsKnown, false);
  assert.equal(loggedMeal.fatKnown, false);
});

test('createTemplateFromMeal: confirmed 0g macro meal (e.g. egg white) stays confirmed 0g and complete', () => {
  const eggWhiteMeal: Meal = {
    id: 'meal-egg-whites',
    title: 'Pure Egg Whites',
    date: '2026-11-15',
    time: '08:00',
    mealType: 'breakfast',
    totalCalories: 52,
    totalProtein: 11,
    totalCarbs: 0.7,
    totalFat: 0,
    totalFats: 0,
    items: [],
    nutritionCompleteness: 'complete',
    proteinKnown: true,
    carbsKnown: true,
    fatKnown: true,
  };

  const template = createTemplateFromMeal(eggWhiteMeal);
  assert.equal(template.nutritionCompleteness, 'complete');
  assert.equal(template.fatKnown, true, 'Confirmed 0g fat must remain fatKnown: true');
  assert.equal(template.totalFat, 0);

  const loggedMeal = createMealFromTemplate(template, '2026-11-18');
  assert.equal(loggedMeal.nutritionCompleteness, 'complete');
  assert.equal(loggedMeal.fatKnown, true);
  assert.equal(loggedMeal.totalFat, 0);
});

// ============================================================================
// 3. SQLITE PERSISTENCE ROUNDTRIP FOR ITEMLESS & COMPLETE TEMPLATES
// ============================================================================

test('SQLite roundtrip: itemless calorie-only template persists and restores all nutrient fields across connection restart', async () => {
  const db = await createFreshDb();
  const repo = new SQLiteMealTemplateRepository(db);

  const template: MealTemplate = normalizeMealTemplate({
    id: 'tpl-snack-quick',
    title: 'Afternoon Snack (Estimate)',
    mealType: 'snack',
    notes: 'Approximately 280 kcal from cafe',
    isFavorite: true,
    items: [],
    totalCalories: 280,
    totalProtein: 0,
    totalCarbs: 0,
    totalFat: 0,
    nutritionCompleteness: 'calories_only',
    proteinKnown: false,
    carbsKnown: false,
    fatKnown: false,
  });

  await repo.createTemplate(template);

  // Reload through a fresh repository instance (simulating restart)
  const freshRepo = new SQLiteMealTemplateRepository(db);
  const loaded = await freshRepo.getTemplateById('tpl-snack-quick');

  assert.ok(loaded);
  assert.equal(loaded.id, 'tpl-snack-quick');
  assert.equal(loaded.title, 'Afternoon Snack (Estimate)');
  assert.equal(loaded.isFavorite, true);
  assert.equal(loaded.items.length, 0, 'Restored template must remain itemless');
  assert.equal(loaded.totalCalories, 280);
  assert.equal(loaded.totalProtein, 0);
  assert.equal(loaded.totalCarbs, 0);
  assert.equal(loaded.totalFat, 0);
  assert.equal(loaded.nutritionCompleteness, 'calories_only');
  assert.equal(loaded.proteinKnown, false);
  assert.equal(loaded.carbsKnown, false);
  assert.equal(loaded.fatKnown, false);

  // Update template
  await freshRepo.updateTemplate({
    ...loaded,
    title: 'Afternoon Snack (Updated)',
    totalCalories: 310,
  });

  const updated = await freshRepo.getTemplateById('tpl-snack-quick');
  assert.ok(updated);
  assert.equal(updated.title, 'Afternoon Snack (Updated)');
  assert.equal(updated.totalCalories, 310);
  assert.equal(updated.items.length, 0);
  assert.equal(updated.proteinKnown, false);
});

test('Template isolation: template storage never pollutes consumed meals query', async () => {
  const db = await createFreshDb();
  const mealRepo = new SQLiteMealRepository(db);
  const templateRepo = new SQLiteMealTemplateRepository(db);

  // Save a template
  const template: MealTemplate = normalizeMealTemplate({
    id: 'tpl-isolated',
    title: 'Steak & Sweet Potato',
    totalCalories: 650,
    totalProtein: 50,
    totalCarbs: 60,
    totalFat: 20,
    items: [],
  });
  await templateRepo.createTemplate(template);

  // Meals query must return empty
  const allMeals = await mealRepo.getAllMeals();
  assert.equal(allMeals.length, 0, 'Templates in meal_templates must never appear in getAllMeals');

  // Daily intake for today must be 0
  const daily = getDailyNutritionSummary(allMeals, '2026-11-15');
  assert.equal(daily.calories, 0, 'Templates must never contribute to daily consumed calories');
});

// ============================================================================
// 4. END-TO-END WORKFLOW: QUICK LOG -> TEMPLATE -> RESTORE -> LOG -> ANALYTICS
// ============================================================================

test('End-to-End Workflow: Quick calorie log -> Save as template -> DB reload -> Log meal -> Accurate diary & weekly trend', async () => {
  const db = await createFreshDb();
  const mealRepo = new SQLiteMealRepository(db);
  const templateRepo = new SQLiteMealTemplateRepository(db);

  // Step 1: User quick-logs a 420 kcal meal with unknown macros on 2026-11-15
  const initialMeal: Meal = normalizeMeal({
    id: 'quick-log-001',
    title: 'Airport Sandwich',
    date: '2026-11-15',
    time: '11:30',
    mealType: 'lunch',
    notes: 'Estimated calories from kiosk',
    items: [],
    totalCalories: 420,
    totalProtein: 0,
    totalCarbs: 0,
    totalFat: 0,
    totalFats: 0,
    nutritionCompleteness: 'calories_only',
    proteinKnown: false,
    carbsKnown: false,
    fatKnown: false,
  });

  await mealRepo.insertMeal(initialMeal);

  // Verify Day 1 intake
  const day1Meals = await mealRepo.getAllMeals();
  assert.equal(day1Meals.length, 1);
  const day1Totals = getDailyNutritionSummary(day1Meals, '2026-11-15');
  assert.equal(day1Totals.calories, 420);
  assert.equal(day1Totals.proteinKnown, false, 'Day 1 protein must be unknown');
  assert.equal(day1Totals.carbsKnown, false, 'Day 1 carbs must be unknown');
  assert.equal(day1Totals.fatsKnown, false, 'Day 1 fat must be unknown');
  assert.equal(day1Totals.hasUnknownMacros, true);

  // Step 2: User saves initialMeal as a template
  const template = createTemplateFromMeal(initialMeal, 'My Quick Airport Sandwich');
  assert.equal(template.items.length, 0);
  assert.equal(template.totalCalories, 420);
  assert.equal(template.nutritionCompleteness, 'calories_only');
  assert.equal(template.proteinKnown, false);

  await templateRepo.createTemplate(template);

  // Verify source meal was not mutated
  const sourceCheck = await mealRepo.getMealById('quick-log-001');
  assert.ok(sourceCheck);
  assert.equal(sourceCheck.id, 'quick-log-001');
  assert.equal(sourceCheck.title, 'Airport Sandwich');
  assert.equal(sourceCheck.totalCalories, 420);

  // Step 3: Simulate app restart by instantiating fresh repos
  const freshMealRepo = new SQLiteMealRepository(db);
  const freshTemplateRepo = new SQLiteMealTemplateRepository(db);

  const restoredTemplate = await freshTemplateRepo.getTemplateById(template.id);
  assert.ok(restoredTemplate);
  assert.equal(restoredTemplate.totalCalories, 420);
  assert.equal(restoredTemplate.items.length, 0);
  assert.equal(restoredTemplate.proteinKnown, false);

  // Step 4: User logs a new meal from the template on Day 2 (2026-11-16)
  const day2Meal = createMealFromTemplate(restoredTemplate, '2026-11-16', '13:00');
  assert.notEqual(day2Meal.id, initialMeal.id);
  assert.notEqual(day2Meal.id, restoredTemplate.id);
  assert.equal(day2Meal.date, '2026-11-16');
  assert.equal(day2Meal.time, '13:00');
  assert.equal(day2Meal.totalCalories, 420);
  assert.equal(day2Meal.items.length, 0);
  assert.equal(day2Meal.nutritionCompleteness, 'calories_only');
  assert.equal(day2Meal.proteinKnown, false, 'Protein must remain unknown in logged meal');
  assert.equal(day2Meal.carbsKnown, false);
  assert.equal(day2Meal.fatKnown, false);

  await freshMealRepo.insertMeal(day2Meal);

  // Step 5: Check daily targets & progress for Day 2
  const allMealsAfter = await freshMealRepo.getAllMeals();
  assert.equal(allMealsAfter.length, 2);

  const day2Totals = getDailyNutritionSummary(allMealsAfter, '2026-11-16');
  assert.equal(day2Totals.calories, 420);
  assert.equal(day2Totals.proteinKnown, false);
  assert.equal(day2Totals.carbsKnown, false);
  assert.equal(day2Totals.fatsKnown, false);
  assert.equal(day2Totals.hasUnknownMacros, true);

  // Target progress check: calories are counted, unknown macros are marked unmeasured
  const effectiveTargets = resolveEffectiveNutritionTargets({
    id: 'user-p',
    name: 'User',
    age: 28,
    weightKg: 75,
    heightCm: 178,
    gender: 'male',
    activityLevel: 'moderate',
    goal: 'maintain',
    targetCalories: 2000,
    targetProtein: 150,
    targetCarbs: 200,
    targetFat: 60,
    calculationOverridden: true,
    attributesConfirmed: true,
    createdAt: '2026-11-01',
    updatedAt: '2026-11-01',
  });

  const targetProgress = calculateNutritionTargetProgress(day2Totals, effectiveTargets);
  assert.equal(targetProgress.calories.consumed, 420);
  assert.equal(targetProgress.calories.remaining, 1580);
  assert.equal(targetProgress.protein.isUnknown, true, 'Protein progress must reflect unmeasured intake');
  assert.equal(targetProgress.carbs.isUnknown, true, 'Carbs progress must reflect unmeasured intake');
  assert.equal(targetProgress.fats.isUnknown, true, 'Fat progress must reflect unmeasured intake');

  // Step 6: Weekly chart days aggregation check
  const weeklyDays = buildWeeklyNutritionChartDays('2026-11-16', allMealsAfter);
  assert.equal(weeklyDays.length, 7);
  const sun = weeklyDays.find((d) => d.date === '2026-11-15');
  const mon = weeklyDays.find((d) => d.date === '2026-11-16');

  assert.ok(sun);
  assert.equal(sun.calories, 420);
  assert.equal(sun.hasLogs, true);

  assert.ok(mon);
  assert.equal(mon.calories, 420);
  assert.equal(mon.hasLogs, true);
});
