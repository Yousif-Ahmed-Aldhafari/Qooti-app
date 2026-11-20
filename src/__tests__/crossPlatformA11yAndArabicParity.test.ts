import test from 'node:test';
import assert from 'node:assert/strict';

import { openDatabaseAsync } from './mocks/expo-sqlite';
import { MIGRATIONS, runMigrations } from '../db/migrations';
import { SQLiteMealRepository } from '../db/repositories/mealRepository';
import { SQLiteMealTemplateRepository } from '../db/repositories/mealTemplateRepository';
import { normalizeMeal, type Meal } from '../models/meal';
import {
  createMealFromTemplate,
  createTemplateFromMeal,
  type MealTemplate,
} from '../models/mealTemplate';
import { formatDisplayDate } from '../utils/date';
import { formatLocalDate, formatLocalTime } from '../utils/nutrition';
import { MIN_TOUCH_TARGET, getMinTouchTarget, calculateHitSlop } from '../utils/touchFeedback';
import { activeRowStyle, activeTextAlign, activeWritingDirection, setActiveLanguage } from '../utils/rtl';
import { translate } from '../i18n';

async function setupDbUpToVersion(targetVersion: number) {
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
// 1. MIGRATION 12: PROVENANCE TRACKING & REPAIR OF LEGACY TEMPLATES
// ============================================================================

test('Task 4.6 - Test 1: Migration 11 -> 12 upgrade adds favorite_source and accurately backfills provenance', async () => {
  const db = await setupDbUpToVersion(11);

  const now = new Date().toISOString();

  // Seed meals at V11 state
  // 1. Meal with [favorite] prefix
  await db.runAsync(
    `INSERT INTO meals (id, title, date, time, total_calories, total_protein, total_carbs, total_fat, notes, is_favorite, nutrition_completeness, protein_known, carbs_known, fat_known, created_at)
     VALUES ('m-marker', 'Oatmeal & Berries', '2026-11-18', '08:00', 350, 15, 60, 5, '[favorite] Morning staple', 1, 'complete', 1, 1, 1, ?);`,
    now
  );

  // 2. Meal with [favorite] inside prose (cleared by migration 11)
  await db.runAsync(
    `INSERT INTO meals (id, title, date, time, total_calories, total_protein, total_carbs, total_fat, notes, is_favorite, nutrition_completeness, protein_known, carbs_known, fat_known, created_at)
     VALUES ('m-ambig', 'Snack Bar', '2026-11-18', '15:00', 210, 10, 25, 8, 'My [favorite] afternoon snack', 0, 'complete', 1, 1, 1, ?);`,
    now
  );

  // 3. Explicitly favorited meal without [favorite] text
  await db.runAsync(
    `INSERT INTO meals (id, title, date, time, total_calories, total_protein, total_carbs, total_fat, notes, is_favorite, nutrition_completeness, protein_known, carbs_known, fat_known, created_at)
     VALUES ('m-explicit', 'Grilled Chicken Salad', '2026-11-18', '12:30', 450, 42, 12, 14, 'Healthy lunch', 1, 'complete', 1, 1, 1, ?);`,
    now
  );

  // 4. Regular un-favorited meal
  await db.runAsync(
    `INSERT INTO meals (id, title, date, time, total_calories, total_protein, total_carbs, total_fat, notes, is_favorite, nutrition_completeness, protein_known, carbs_known, fat_known, created_at)
     VALUES ('m-none', 'Apple & Almonds', '2026-11-18', '16:00', 180, 4, 22, 9, 'Quick snack', 0, 'complete', 1, 1, 1, ?);`,
    now
  );

  // Run forward Migration 12
  await runMigrations(db);

  const mealRows = await db.getAllAsync<{ id: string; is_favorite: number; favorite_source: string }>(
    `SELECT id, is_favorite, favorite_source FROM meals ORDER BY id ASC;`
  );
  const mealsById = new Map(mealRows.map((r) => [r.id, r]));

  // m-marker: prefix marker classified as legacy_marker
  assert.equal(mealsById.get('m-marker')?.is_favorite, 1);
  assert.equal(mealsById.get('m-marker')?.favorite_source, 'legacy_marker');

  // m-ambig: prose note containing [favorite] classified as ambiguous
  assert.equal(mealsById.get('m-ambig')?.is_favorite, 0);
  assert.equal(mealsById.get('m-ambig')?.favorite_source, 'ambiguous');

  // m-explicit: user favorited without marker classified as explicit
  assert.equal(mealsById.get('m-explicit')?.is_favorite, 1);
  assert.equal(mealsById.get('m-explicit')?.favorite_source, 'explicit');

  // m-none: regular meal classified as none
  assert.equal(mealsById.get('m-none')?.is_favorite, 0);
  assert.equal(mealsById.get('m-none')?.favorite_source, 'none');
});

test('Task 4.6 - Test 2: Migration 12 repairs V10 legacy synthetic templates to indeterminate with unknown macros', async () => {
  const db = await setupDbUpToVersion(11);
  const now = new Date().toISOString();

  // 1. V10 legacy template created before Task 4.5B with positive calories and 0g macros
  await db.runAsync(
    `INSERT INTO meal_templates (
       id, title, meal_type, notes, is_favorite,
       total_calories, total_protein, total_carbs, total_fat,
       nutrition_completeness, protein_known, carbs_known, fat_known,
       created_at, updated_at
     ) VALUES (
       'tpl-v10-cal-only', 'Pre-Workout Snack', 'snack', 'Quick energy', 0,
       300, 0, 0, 0,
       'complete', 1, 1, 1,
       ?, ?
     );`,
    now,
    now
  );

  // 2. Real template with confirmed 0g macros (e.g. pure zero-calorie electrolyte drink)
  await db.runAsync(
    `INSERT INTO meal_templates (
       id, title, meal_type, notes, is_favorite,
       total_calories, total_protein, total_carbs, total_fat,
       nutrition_completeness, protein_known, carbs_known, fat_known,
       created_at, updated_at
     ) VALUES (
       'tpl-real-zero', 'Black Coffee', 'snack', 'No sugar', 0,
       0, 0, 0, 0,
       'complete', 1, 1, 1,
       ?, ?
     );`,
    now,
    now
  );

  // 3. Real template with known positive macros
  await db.runAsync(
    `INSERT INTO meal_templates (
       id, title, meal_type, notes, is_favorite,
       total_calories, total_protein, total_carbs, total_fat,
       nutrition_completeness, protein_known, carbs_known, fat_known,
       created_at, updated_at
     ) VALUES (
       'tpl-real-macros', 'Steak & Rice', 'dinner', 'Post-lift meal', 1,
       650, 45, 60, 20,
       'complete', 1, 1, 1,
       ?, ?
     );`,
    now,
    now
  );

  // Run forward Migration 12
  await runMigrations(db);

  const tplRepo = new SQLiteMealTemplateRepository(db);
  const allTemplates = await tplRepo.getAllTemplates();
  const tplById = new Map(allTemplates.map((t) => [t.id, t]));

  const repaired = tplById.get('tpl-v10-cal-only');
  assert.ok(repaired);
  assert.equal(repaired.totalCalories, 300);
  assert.equal(repaired.nutritionCompleteness, 'indeterminate');
  assert.equal(repaired.proteinKnown, false);
  assert.equal(repaired.carbsKnown, false);
  assert.equal(repaired.fatKnown, false);

  const zeroCal = tplById.get('tpl-real-zero');
  assert.ok(zeroCal);
  assert.equal(zeroCal.totalCalories, 0);
  assert.equal(zeroCal.nutritionCompleteness, 'complete');

  const realMacros = tplById.get('tpl-real-macros');
  assert.ok(realMacros);
  assert.equal(realMacros.totalCalories, 650);
  assert.equal(realMacros.totalProtein, 45);
  assert.equal(realMacros.nutritionCompleteness, 'complete');
  assert.equal(realMacros.proteinKnown, true);
});

test('Task 4.6 - Test 3: Fresh V0 -> 12 installation creates complete schema and is idempotent', async () => {
  const db = await openDatabaseAsync(':memory:');
  await db.execAsync('PRAGMA foreign_keys = ON;');
  await runMigrations(db);

  const migrations = await db.getAllAsync<{ version: number; name: string }>(
    `SELECT version, name FROM schema_migrations ORDER BY version ASC;`
  );
  assert.equal(migrations.length, 16);
  assert.equal(migrations[11].version, 12);
  assert.equal(migrations[11].name, 'add_provenance_and_repair_legacy_templates_v12');
  assert.equal(migrations[12].version, 13);
  assert.equal(migrations[12].name, 'harden_template_nutrient_fidelity_and_favorite_provenance_v13');
  assert.equal(migrations[13].version, 14);
  assert.equal(migrations[13].name, 'reconcile_template_unknown_macros_and_preserve_uncertainty_v14');
  assert.equal(migrations[14].version, 15);
  assert.equal(migrations[14].name, 'add_meal_template_review_status_and_reconcile_ambiguity_v15');
  assert.equal(migrations[15].version, 16);
  assert.equal(migrations[15].name, 'add_body_tracking_and_biometrics_v16');

  // Verify favorite_source column exists on meals
  const mealCols = await db.getAllAsync<{ name: string }>('PRAGMA table_info(meals);');
  assert.ok(mealCols.some((c) => c.name === 'favorite_source'));

  // Repeat migration is strictly idempotent
  await runMigrations(db);
  await runMigrations(db);

  const repeated = await db.getAllAsync<{ version: number }>(
    `SELECT version FROM schema_migrations ORDER BY version ASC;`
  );
  assert.equal(repeated.length, 16);
});

// ============================================================================
// 2. REPOSITORY & USER ACTION PROVENANCE RESOLUTION
// ============================================================================

test('Task 4.6 - Test 4: User toggling meal favorite sets favorite_source to explicit and resolves ambiguity', async () => {
  const db = await setupDbUpToVersion(12);
  const mealRepo = new SQLiteMealRepository(db);

  const ambiguousMeal: Meal = {
    id: 'meal-ambig-toggle',
    title: 'Protein Smoothie',
    date: '2026-11-18',
    time: '09:00',
    totalCalories: 250,
    totalProtein: 25,
    totalCarbs: 20,
    totalFat: 5,
    notes: 'A [favorite] smoothie recipe',
    isFavorite: false,
    favoriteSource: 'ambiguous',
    items: [],
  };

  await mealRepo.insertMeal(ambiguousMeal);

  let loaded = await mealRepo.getMealById('meal-ambig-toggle');
  assert.ok(loaded);
  assert.equal(loaded.isFavorite, false);
  assert.equal(loaded.favoriteSource, 'ambiguous');

  // User explicitly favorites this meal
  await mealRepo.toggleMealFavorite('meal-ambig-toggle', true);

  loaded = await mealRepo.getMealById('meal-ambig-toggle');
  assert.ok(loaded);
  assert.equal(loaded.isFavorite, true);
  assert.equal(loaded.favoriteSource, 'explicit', 'Explicit user action sets favorite_source to explicit');

  // User un-favorites the meal
  await mealRepo.toggleMealFavorite('meal-ambig-toggle', false);

  loaded = await mealRepo.getMealById('meal-ambig-toggle');
  assert.ok(loaded);
  assert.equal(loaded.isFavorite, false);
  assert.equal(loaded.favoriteSource, 'none', 'Unfavoriting sets favorite_source to none, preventing regression');
});

// ============================================================================
// 3. ITEMLESS & INDETERMINATE TEMPLATE TO MEAL LOGGING
// ============================================================================

test('Task 4.6 - Test 5: createMealFromTemplate faithfully preserves indeterminate macro unknown flags', () => {
  const indeterminateTemplate: MealTemplate = {
    id: 'tpl-indet-1',
    title: 'V10 Legacy Quick-Log',
    totalCalories: 450,
    totalProtein: 0,
    totalCarbs: 0,
    totalFat: 0,
    items: [],
    nutritionCompleteness: 'indeterminate',
    proteinKnown: false,
    carbsKnown: false,
    fatKnown: false,
    createdAt: '2026-11-18T00:00:00.000Z',
    updatedAt: '2026-11-18T00:00:00.000Z',
  };

  const loggedMeal = createMealFromTemplate(indeterminateTemplate, '2026-11-18', '12:00');

  assert.equal(loggedMeal.title, 'V10 Legacy Quick-Log');
  assert.equal(loggedMeal.totalCalories, 450);
  assert.equal(loggedMeal.totalProtein, 0);
  assert.equal(loggedMeal.nutritionCompleteness, 'indeterminate');
  assert.equal(loggedMeal.proteinKnown, false, 'Unknown protein must not be converted to confirmed 0g');
  assert.equal(loggedMeal.carbsKnown, false, 'Unknown carbs must not be converted to confirmed 0g');
  assert.equal(loggedMeal.fatKnown, false, 'Unknown fat must not be converted to confirmed 0g');
  assert.equal(loggedMeal.items.length, 0, 'No fake items must be synthesized');
});

test('Task 4.6 - Test 6: createTemplateFromMeal preserves indeterminate meal state without claiming confirmed 0g', () => {
  const mealWithIndeterminate: Meal = {
    id: 'meal-indet-source',
    title: 'Estimated Restaurant Meal',
    date: '2026-11-18',
    time: '19:00',
    totalCalories: 750,
    totalProtein: 0,
    totalCarbs: 0,
    totalFat: 0,
    nutritionCompleteness: 'indeterminate',
    proteinKnown: false,
    carbsKnown: false,
    fatKnown: false,
    items: [],
  };

  const template = createTemplateFromMeal(mealWithIndeterminate, 'Restaurant Template');

  assert.equal(template.title, 'Restaurant Template');
  assert.equal(template.totalCalories, 750);
  assert.equal(template.nutritionCompleteness, 'indeterminate');
  assert.equal(template.proteinKnown, false);
  assert.equal(template.carbsKnown, false);
  assert.equal(template.fatKnown, false);
  assert.equal(template.items.length, 0);
});

// ============================================================================
// 4. TOUCH TARGETS & PLATFORM STANDARDS (ANDROID >= 48dp, iOS >= 44pt)
// ============================================================================

test('Task 4.6 - Test 7: Standard touch targets enforce Android >= 48dp and iOS >= 44pt', () => {
  assert.equal(MIN_TOUCH_TARGET.android, 48);
  assert.equal(MIN_TOUCH_TARGET.ios, 44);

  assert.equal(getMinTouchTarget('android'), 48);
  assert.equal(getMinTouchTarget('ios'), 44);

  // calculateHitSlop expands smaller elements to platform target
  const androidSlop = calculateHitSlop(36, 36, 'android');
  assert.ok(androidSlop);
  assert.equal(36 + (androidSlop.top || 0) + (androidSlop.bottom || 0), 48);
  assert.equal(36 + (androidSlop.left || 0) + (androidSlop.right || 0), 48);

  const iosSlop = calculateHitSlop(36, 36, 'ios');
  assert.ok(iosSlop);
  assert.equal(36 + (iosSlop.top || 0) + (iosSlop.bottom || 0), 44);
  assert.equal(36 + (iosSlop.left || 0) + (iosSlop.right || 0), 44);

  // Elements already meeting or exceeding target require no hitSlop
  assert.equal(calculateHitSlop(48, 48, 'android'), undefined);
  assert.equal(calculateHitSlop(44, 44, 'ios'), undefined);
});

// ============================================================================
// 5. BILINGUAL PARITY, RTL SYMMETRY & LATIN NUMERALS
// ============================================================================

test('Task 4.6 - Test 8: Directional layout helpers flip row direction and text alignment', () => {
  // English (LTR)
  setActiveLanguage('en');
  const ltrRow = activeRowStyle();
  assert.equal(ltrRow.flexDirection, 'row');

  const ltrAlign = activeTextAlign();
  assert.equal(ltrAlign, 'left');

  const ltrWritingDir = activeWritingDirection();
  assert.equal(ltrWritingDir, 'ltr');

  // Arabic (RTL)
  setActiveLanguage('ar');
  const rtlRow = activeRowStyle();
  assert.equal(rtlRow.flexDirection, 'row-reverse');

  const rtlAlign = activeTextAlign();
  assert.equal(rtlAlign, 'right');

  const rtlWritingDir = activeWritingDirection();
  assert.equal(rtlWritingDir, 'rtl');

  // Restore English default
  setActiveLanguage('en');
});

test('Task 4.6 - Test 9: Arabic date formatting preserves Latin numerals (ar-SA-u-nu-latn)', () => {
  const sampleDate = '2026-11-18';
  const formattedAr = formatDisplayDate(sampleDate, 'ar');
  const formattedEn = formatDisplayDate(sampleDate, 'en');

  // Must contain Latin digits (18), never eastern Arabic numerals (١٨)
  assert.match(formattedAr, /18/, 'Arabic date must preserve Latin day digits');
  assert.doesNotMatch(formattedAr, /[٠-٩]/, 'Arabic date must not contain Eastern Arabic digits');

  assert.match(formattedEn, /18/);
});

test('Task 4.6 - Test 10: Nutrition and meal translations resolve with complete Arabic parity', () => {
  const keys = [
    'meals.title',
    'meals.subtitle',
    'meals.allMeals',
    'meals.favorites',
    'meals.templates',
    'meals.unknownMacro',
    'meals.caloriesOnlyNotice',
    'meals.partialMacrosNotice',
    'meals.indeterminateNotice',
    'meals.logFromTemplate',
    'meals.deleteTemplate',
    'meals.previousDay',
    'meals.nextDay',
    'meals.today',
    'foodPicker.title',
    'foodPicker.searchPlaceholder',
    'foodPicker.customBadge',
    'foodPicker.verifiedBadge',
    'foodPicker.estimatedBadge',
    'foodPicker.unverifiedBadge',
  ];

  for (const key of keys) {
    const enVal = translate('en', key);
    const arVal = translate('ar', key);

    assert.ok(enVal && enVal !== key, `Key "${key}" missing in English`);
    assert.ok(arVal && arVal !== key, `Key "${key}" missing in Arabic`);
  }
});

// ============================================================================
// 6. DIARY DATE NAVIGATION PERSISTENCE & FAULT RESILIENCE
// ============================================================================

test('Task 4.6 - Test 11: formatLocalDate and formatLocalTime produce strict ISO formats', () => {
  const date = new Date(2026, 10, 18, 14, 30, 0);
  const localDate = formatLocalDate(date);
  const localTime = formatLocalTime(date);

  assert.equal(localDate, '2026-11-18');
  assert.equal(localTime, '14:30');
});

test('Task 4.6 - Test 12: Atomic rollback on failed meal insert leaves database intact and clean', async () => {
  const db = await setupDbUpToVersion(12);
  const mealRepo = new SQLiteMealRepository(db);

  const initialMeals = await mealRepo.getAllMeals();
  assert.equal(initialMeals.length, 0);

  // Attempt to insert a meal with invalid data that fails inside transaction
  try {
    await db.withExclusiveTransactionAsync(async (txn) => {
      await mealRepo.insertMeal(
        normalizeMeal({
          id: 'meal-rollback-1',
          title: 'Tentative Meal',
          date: '2026-11-18',
          time: '12:00',
          totalCalories: 300,
          totalProtein: 20,
          totalCarbs: 30,
          totalFat: 10,
          items: [],
        }),
        txn
      );

      // Force an error to simulate mid-transaction failure
      throw new Error('Simulated network / disk write fault');
    });
  } catch {
    // Expected failure
  }

  // Database must remain completely clean with zero partial writes
  const mealsAfter = await mealRepo.getAllMeals();
  assert.equal(mealsAfter.length, 0);
});
