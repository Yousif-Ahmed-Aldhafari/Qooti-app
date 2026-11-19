import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabaseAsync } from 'expo-sqlite';
import { MIGRATIONS, runMigrations } from '../db/migrations';
import { SQLiteMealTemplateRepository } from '../db/repositories/mealTemplateRepository';
import { createMealFromTemplate } from '../models/mealTemplate';
import { getDailyNutritionSummary } from '../utils/nutrition';
import type { IDatabase } from '../db/types';

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
// Case A: V13 complete, all macros known zero, positive labeled calories
// ============================================================================
test('Case A: V13 complete with all macros known zero and positive calories preserves totals and flags ambiguity under V15', async () => {
  const db = await setupDbUpToVersion(13);
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO meal_templates (
       id, title, meal_type, notes, is_favorite,
       total_calories, total_protein, total_carbs, total_fat,
       nutrition_completeness, protein_known, carbs_known, fat_known,
       created_at, updated_at
     ) VALUES (
       'tpl-v13-case-a', 'Diet Herbal Infusion', 'snack', 'Explicitly 0g macros on label', 1,
       4, 0, 0, 0,
       'complete', 1, 1, 1,
       ?, ?
     );`,
    now,
    now
  );

  await db.runAsync(
    `INSERT INTO meal_template_items (id, template_id, name, quantity, unit, calories, protein, carbs, fats, sort_order)
     VALUES ('ti-a-1', 'tpl-v13-case-a', 'Herbal Tea Bag', 1, 'bag', 4, 0, 0, 0, 0);`
  );

  // Upgrade through V14 and V15
  await runMigrations(db);

  const tplRepo = new SQLiteMealTemplateRepository(db);
  const tpl = await tplRepo.getTemplateById('tpl-v13-case-a');

  assert.ok(tpl);
  // Nutrient totals must remain 100% accurate
  assert.equal(tpl.totalCalories, 4);
  assert.equal(tpl.totalProtein, 0);
  assert.equal(tpl.totalCarbs, 0);
  assert.equal(tpl.totalFat, 0);
  assert.equal(tpl.items.length, 1);

  // Migration 14 overwrote completeness to indeterminate; V15 flags it honestly as ambiguous awaiting review
  assert.equal(tpl.nutritionCompleteness, 'indeterminate');
  assert.equal(tpl.reviewStatus, 'ambiguous');

  // Verify logging after restart
  const logged = createMealFromTemplate(tpl, '2026-11-18', '09:00');
  assert.equal(logged.totalCalories, 4);
  assert.equal(logged.date, '2026-11-18');
  assert.equal(logged.time, '09:00');

  // Daily aggregates preserve exact nutrient values
  const summary = getDailyNutritionSummary([logged], logged.date);
  assert.equal(summary.calories, 4);
  assert.equal(summary.protein, 0);
  assert.equal(summary.carbs, 0);
  assert.equal(summary.fats, 0);
});

// ============================================================================
// Case B: V13 partial, macros missing, positive labeled calories
// ============================================================================
test('Case B: V13 partial with positive labeled calories preserves totals and macro known state', async () => {
  const db = await setupDbUpToVersion(13);
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO meal_templates (
       id, title, meal_type, notes, is_favorite,
       total_calories, total_protein, total_carbs, total_fat,
       nutrition_completeness, protein_known, carbs_known, fat_known,
       created_at, updated_at
     ) VALUES (
       'tpl-v13-case-b', 'Protein Isolate Shot', 'snack', 'Known 25g protein, carbs/fat unlisted', 0,
       110, 25, 0, 0,
       'partial', 1, 0, 0,
       ?, ?
     );`,
    now,
    now
  );

  // Upgrade through V14 and V15
  await runMigrations(db);

  const tplRepo = new SQLiteMealTemplateRepository(db);
  const tpl = await tplRepo.getTemplateById('tpl-v13-case-b');

  assert.ok(tpl);
  // Nutrient totals preserved
  assert.equal(tpl.totalCalories, 110);
  assert.equal(tpl.totalProtein, 25);
  assert.equal(tpl.totalCarbs, 0);
  assert.equal(tpl.totalFat, 0);

  // Partial status is strictly preserved because protein is positive (not affected by V14 blanket rule)
  assert.equal(tpl.nutritionCompleteness, 'partial');
  assert.equal(tpl.proteinKnown, true);
  assert.equal(tpl.carbsKnown, false);
  assert.equal(tpl.fatKnown, false);
  assert.equal(tpl.reviewStatus, 'confirmed');

  // Logging and aggregates
  const logged = createMealFromTemplate(tpl, '2026-11-18', '11:00');
  const summary = getDailyNutritionSummary([logged], logged.date);
  assert.equal(summary.calories, 110);
  assert.equal(summary.protein, 25);
  assert.equal(summary.isPartial, true);
  assert.equal(summary.hasUnknownMacros, true);
});

// ============================================================================
// Case C: V13 indeterminate, macros unknown
// ============================================================================
test('Case C: V13 indeterminate template preserves unknown status and totals without record deletion', async () => {
  const db = await setupDbUpToVersion(13);
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO meal_templates (
       id, title, meal_type, notes, is_favorite,
       total_calories, total_protein, total_carbs, total_fat,
       nutrition_completeness, protein_known, carbs_known, fat_known,
       created_at, updated_at
     ) VALUES (
       'tpl-v13-case-c', 'Mystery Catered Snack', 'snack', 'Estimated calories only', 0,
       220, 0, 0, 0,
       'indeterminate', 0, 0, 0,
       ?, ?
     );`,
    now,
    now
  );

  // Upgrade through V14 and V15
  await runMigrations(db);

  const tplRepo = new SQLiteMealTemplateRepository(db);
  const tpl = await tplRepo.getTemplateById('tpl-v13-case-c');

  assert.ok(tpl);
  assert.equal(tpl.totalCalories, 220);
  assert.equal(tpl.nutritionCompleteness, 'indeterminate');
  assert.equal(tpl.proteinKnown, false);
  assert.equal(tpl.carbsKnown, false);
  assert.equal(tpl.fatKnown, false);
  assert.equal(tpl.reviewStatus, 'ambiguous');
});

// ============================================================================
// Case D: V13 calories-only template
// ============================================================================
test('Case D: V13 calories-only template preserves totals and unknown macros without deletion', async () => {
  const db = await setupDbUpToVersion(13);
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO meal_templates (
       id, title, meal_type, notes, is_favorite,
       total_calories, total_protein, total_carbs, total_fat,
       nutrition_completeness, protein_known, carbs_known, fat_known,
       created_at, updated_at
     ) VALUES (
       'tpl-v13-case-d', 'Quick Calorie Template', 'lunch', 'Quick logged calories', 0,
       450, 0, 0, 0,
       'calories_only', 0, 0, 0,
       ?, ?
     );`,
    now,
    now
  );

  // Upgrade through V14 and V15
  await runMigrations(db);

  const tplRepo = new SQLiteMealTemplateRepository(db);
  const tpl = await tplRepo.getTemplateById('tpl-v13-case-d');

  assert.ok(tpl);
  assert.equal(tpl.totalCalories, 450);
  // Macros remain unknown (never converted to confirmed zeros)
  assert.equal(tpl.proteinKnown, false);
  assert.equal(tpl.carbsKnown, false);
  assert.equal(tpl.fatKnown, false);
  assert.equal(tpl.items.length, 0);

  // Logging works cleanly
  const logged = createMealFromTemplate(tpl, '2026-11-18', '13:00');
  assert.equal(logged.totalCalories, 450);
  assert.equal(logged.items.length, 0);
  const summary = getDailyNutritionSummary([logged], logged.date);
  assert.equal(summary.calories, 450);
  assert.equal(summary.hasUnknownMacros, true);
});

// ============================================================================
// Case E: V14 previously affected complete template
// ============================================================================
test('Case E: V14 previously affected template has preserved totals and explicit ambiguous review status', async () => {
  const db = await setupDbUpToVersion(14);
  const now = new Date().toISOString();

  // In a V14 database, Migration 14 set this previously complete template to indeterminate
  await db.runAsync(
    `INSERT INTO meal_templates (
       id, title, meal_type, notes, is_favorite,
       total_calories, total_protein, total_carbs, total_fat,
       nutrition_completeness, protein_known, carbs_known, fat_known,
       created_at, updated_at
     ) VALUES (
       'tpl-v14-case-e', 'Black Coffee Espresso', 'breakfast', 'Historical complete template downgraded in V14', 1,
       3, 0, 0, 0,
       'indeterminate', 0, 0, 0,
       ?, ?
     );`,
    now,
    now
  );
  await db.runAsync(
    `INSERT INTO meal_template_items (id, template_id, name, quantity, unit, calories, protein, carbs, fats, sort_order)
     VALUES ('ti-e-1', 'tpl-v14-case-e', 'Espresso Shot', 1, 'shot', 3, 0, 0, 0, 0);`
  );

  // Run Migration 15
  await runMigrations(db);

  const tplRepo = new SQLiteMealTemplateRepository(db);
  const tpl = await tplRepo.getTemplateById('tpl-v14-case-e');

  assert.ok(tpl);
  assert.equal(tpl.totalCalories, 3);
  assert.equal(tpl.totalProtein, 0);
  assert.equal(tpl.totalCarbs, 0);
  assert.equal(tpl.totalFat, 0);

  // Limitation: Previous 'complete' metadata cannot be reconstructed from SQL columns alone
  // without guessing; V15 flags it as 'ambiguous' awaiting user review
  assert.equal(tpl.reviewStatus, 'ambiguous');
  assert.equal(tpl.nutritionCompleteness, 'indeterminate');
});

// ============================================================================
// Case F: V14 previously affected partial template
// ============================================================================
test('Case F: V14 previously affected partial template with 0g recorded macros preserves totals and flags ambiguity', async () => {
  const db = await setupDbUpToVersion(14);
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO meal_templates (
       id, title, meal_type, notes, is_favorite,
       total_calories, total_protein, total_carbs, total_fat,
       nutrition_completeness, protein_known, carbs_known, fat_known,
       created_at, updated_at
     ) VALUES (
       'tpl-v14-case-f', 'Energy Shot Partial', 'snack', 'Partial macros previously', 0,
       15, 0, 0, 0,
       'indeterminate', 0, 0, 0,
       ?, ?
     );`,
    now,
    now
  );

  // Upgrade to V15
  await runMigrations(db);

  const tplRepo = new SQLiteMealTemplateRepository(db);
  const tpl = await tplRepo.getTemplateById('tpl-v14-case-f');

  assert.ok(tpl);
  assert.equal(tpl.totalCalories, 15);
  assert.equal(tpl.reviewStatus, 'ambiguous');
  assert.equal(tpl.nutritionCompleteness, 'indeterminate');
});

// ============================================================================
// Case G: V14 previously affected synthetic template
// ============================================================================
test('Case G: V14 synthetic template preserves totals and remains ambiguous without false promotion', async () => {
  const db = await setupDbUpToVersion(14);
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO meal_templates (
       id, title, meal_type, notes, is_favorite,
       total_calories, total_protein, total_carbs, total_fat,
       nutrition_completeness, protein_known, carbs_known, fat_known,
       created_at, updated_at
     ) VALUES (
       'tpl-v14-case-g', 'V10 Legacy Synthetic Template', 'snack', 'Originally had synthetic item', 0,
       300, 0, 0, 0,
       'indeterminate', 0, 0, 0,
       ?, ?
     );`,
    now,
    now
  );
  await db.runAsync(
    `INSERT INTO meal_template_items (id, template_id, name, quantity, unit, calories, protein, carbs, fats, sort_order)
     VALUES ('ti-g-1', 'tpl-v14-case-g', 'V10 Legacy Synthetic Template', 1, 'serving', 300, 0, 0, 0, 0);`
  );

  await runMigrations(db);

  const tplRepo = new SQLiteMealTemplateRepository(db);
  const tpl = await tplRepo.getTemplateById('tpl-v14-case-g');

  assert.ok(tpl);
  assert.equal(tpl.totalCalories, 300);
  // Must NOT be promoted automatically to complete based on synthetic item
  assert.equal(tpl.nutritionCompleteness, 'indeterminate');
  assert.equal(tpl.proteinKnown, false);
  assert.equal(tpl.carbsKnown, false);
  assert.equal(tpl.fatKnown, false);
  assert.equal(tpl.reviewStatus, 'ambiguous');
});

// ============================================================================
// Case H: Known nonzero macro templates
// ============================================================================
test('Case H: Known nonzero macro templates remain complete, confirmed, and completely untouched', async () => {
  const db = await setupDbUpToVersion(13);
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO meal_templates (
       id, title, meal_type, notes, is_favorite,
       total_calories, total_protein, total_carbs, total_fat,
       nutrition_completeness, protein_known, carbs_known, fat_known,
       created_at, updated_at
     ) VALUES (
       'tpl-case-h', 'Chicken and Sweet Potato', 'dinner', 'Standard bodybuilding staple', 1,
       480, 45, 52, 8,
       'complete', 1, 1, 1,
       ?, ?
     );`,
    now,
    now
  );
  await db.runAsync(
    `INSERT INTO meal_template_items (id, template_id, name, quantity, unit, calories, protein, carbs, fats, sort_order)
     VALUES ('ti-h-1', 'tpl-case-h', 'Chicken Breast', 200, 'g', 330, 45, 0, 7, 0);`
  );
  await db.runAsync(
    `INSERT INTO meal_template_items (id, template_id, name, quantity, unit, calories, protein, carbs, fats, sort_order)
     VALUES ('ti-h-2', 'tpl-case-h', 'Sweet Potato', 150, 'g', 150, 0, 52, 1, 1);`
  );

  // Upgrade through V14 and V15
  await runMigrations(db);

  const tplRepo = new SQLiteMealTemplateRepository(db);
  const tpl = await tplRepo.getTemplateById('tpl-case-h');

  assert.ok(tpl);
  assert.equal(tpl.totalCalories, 480);
  assert.equal(tpl.totalProtein, 45);
  assert.equal(tpl.totalCarbs, 52);
  assert.equal(tpl.totalFat, 8);
  assert.equal(tpl.nutritionCompleteness, 'complete');
  assert.equal(tpl.proteinKnown, true);
  assert.equal(tpl.carbsKnown, true);
  assert.equal(tpl.fatKnown, true);
  assert.equal(tpl.reviewStatus, 'confirmed');

  // Logging and aggregates
  const logged = createMealFromTemplate(tpl, '2026-11-18', '19:30');
  const summary = getDailyNutritionSummary([logged], logged.date);
  assert.equal(summary.calories, 480);
  assert.equal(summary.protein, 45);
  assert.equal(summary.carbs, 52);
  assert.equal(summary.fats, 8);
  assert.equal(summary.hasUnknownMacros, false);
});

// ============================================================================
// Case I: Zero-calorie, zero-macro complete templates
// ============================================================================
test('Case I: Zero-calorie, zero-macro complete templates remain complete, known-zero, and confirmed', async () => {
  const db = await setupDbUpToVersion(13);
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO meal_templates (
       id, title, meal_type, notes, is_favorite,
       total_calories, total_protein, total_carbs, total_fat,
       nutrition_completeness, protein_known, carbs_known, fat_known,
       created_at, updated_at
     ) VALUES (
       'tpl-case-i', 'Pure Spring Water', 'snack', 'Natural mineral water', 1,
       0, 0, 0, 0,
       'complete', 1, 1, 1,
       ?, ?
     );`,
    now,
    now
  );
  await db.runAsync(
    `INSERT INTO meal_template_items (id, template_id, name, quantity, unit, calories, protein, carbs, fats, sort_order)
     VALUES ('ti-i-1', 'tpl-case-i', 'Spring Water', 1, 'bottle', 0, 0, 0, 0, 0);`
  );

  // Upgrade through V14 and V15
  await runMigrations(db);

  const tplRepo = new SQLiteMealTemplateRepository(db);
  const tpl = await tplRepo.getTemplateById('tpl-case-i');

  assert.ok(tpl);
  assert.equal(tpl.totalCalories, 0);
  assert.equal(tpl.totalProtein, 0);
  assert.equal(tpl.totalCarbs, 0);
  assert.equal(tpl.totalFat, 0);
  assert.equal(tpl.nutritionCompleteness, 'complete');
  assert.equal(tpl.proteinKnown, true);
  assert.equal(tpl.carbsKnown, true);
  assert.equal(tpl.fatKnown, true);
  assert.equal(tpl.reviewStatus, 'confirmed');

  // Logging works cleanly
  const logged = createMealFromTemplate(tpl, '2026-11-18', '08:00');
  assert.equal(logged.totalCalories, 0);
  assert.equal(logged.proteinKnown, true);
  assert.equal(logged.carbsKnown, true);
  assert.equal(logged.fatKnown, true);
});

// ============================================================================
// Case J: User-corrected completeness state
// ============================================================================
test('Case J: User reconfirms ambiguous template and corrected state is 100% preserved without regression', async () => {
  const db = await setupDbUpToVersion(15);
  const now = new Date().toISOString();

  // Insert ambiguous template in V15
  await db.runAsync(
    `INSERT INTO meal_templates (
       id, title, meal_type, notes, is_favorite,
       total_calories, total_protein, total_carbs, total_fat,
       nutrition_completeness, protein_known, carbs_known, fat_known,
       review_status, created_at, updated_at
     ) VALUES (
       'tpl-case-j', 'Reviewed Green Tea', 'snack', 'Verified 0g macros by user', 0,
       2, 0, 0, 0,
       'indeterminate', 0, 0, 0,
       'ambiguous', ?, ?
     );`,
    now,
    now
  );

  const tplRepo = new SQLiteMealTemplateRepository(db);

  // User explicitly reviews and reconfirms template as complete with known zeros
  const reconfirmed = await tplRepo.reconfirmTemplate('tpl-case-j', 'complete', {
    proteinKnown: true,
    carbsKnown: true,
    fatKnown: true,
  });

  assert.equal(reconfirmed.nutritionCompleteness, 'complete');
  assert.equal(reconfirmed.proteinKnown, true);
  assert.equal(reconfirmed.carbsKnown, true);
  assert.equal(reconfirmed.fatKnown, true);
  assert.equal(reconfirmed.reviewStatus, 'confirmed');

  // Verify reload from SQLite
  const loaded = await tplRepo.getTemplateById('tpl-case-j');
  assert.ok(loaded);
  assert.equal(loaded.nutritionCompleteness, 'complete');
  assert.equal(loaded.proteinKnown, true);
  assert.equal(loaded.carbsKnown, true);
  assert.equal(loaded.fatKnown, true);
  assert.equal(loaded.reviewStatus, 'confirmed');

  // Re-running migrations or simulated restart must NEVER downgrade this user-confirmed state
  await runMigrations(db);

  const reloadedAfterMigration = await tplRepo.getTemplateById('tpl-case-j');
  assert.ok(reloadedAfterMigration);
  assert.equal(reloadedAfterMigration.nutritionCompleteness, 'complete');
  assert.equal(reloadedAfterMigration.proteinKnown, true);
  assert.equal(reloadedAfterMigration.carbsKnown, true);
  assert.equal(reloadedAfterMigration.fatKnown, true);
  assert.equal(reloadedAfterMigration.reviewStatus, 'confirmed');

  // Log meal from reconfirmed template
  const logged = createMealFromTemplate(reloadedAfterMigration, '2026-11-18', '15:00');
  assert.equal(logged.totalCalories, 2);
  assert.equal(logged.nutritionCompleteness, 'complete');
  assert.equal(logged.proteinKnown, true);
  assert.equal(logged.carbsKnown, true);
  assert.equal(logged.fatKnown, true);

  const summary = getDailyNutritionSummary([logged], logged.date);
  assert.equal(summary.calories, 2);
  assert.equal(summary.protein, 0);
  assert.equal(summary.carbs, 0);
  assert.equal(summary.fats, 0);
  assert.equal(summary.hasUnknownMacros, false);
});

// ============================================================================
// Idempotence & Rollback Integrity
// ============================================================================
test('Migration 15: Repeat execution is strictly idempotent with 15 recorded migrations', async () => {
  const db = await openDatabaseAsync(':memory:');
  await db.execAsync('PRAGMA foreign_keys = ON;');
  await runMigrations(db);
  await runMigrations(db);
  await runMigrations(db);

  const applied = await db.getAllAsync<{ version: number; name: string }>(
    'SELECT version, name FROM schema_migrations ORDER BY version ASC;'
  );
  assert.equal(applied.length, 15);
  assert.equal(applied[14].version, 15);
  assert.equal(applied[14].name, 'add_meal_template_review_status_and_reconcile_ambiguity_v15');
});

test('Migration 15: Transaction failure rolls back completely leaving database at prior valid state', async () => {
  const db = await setupDbUpToVersion(14);
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO meal_templates (
       id, title, total_calories, total_protein, total_carbs, total_fat,
       nutrition_completeness, protein_known, carbs_known, fat_known,
       created_at, updated_at
     ) VALUES ('tpl-rollback-test', 'Rollback Target', 50, 0, 0, 0, 'indeterminate', 0, 0, 0, ?, ?);`,
    now,
    now
  );

  // Simulate an intentional failure during a migration step
  const badMigration = {
    version: 99,
    name: 'failing_migration_test',
    up: async (t: IDatabase) => {
      await t.runAsync("UPDATE meal_templates SET notes = 'mutated' WHERE id = 'tpl-rollback-test';");
      throw new Error('Simulated disk I/O failure during migration');
    },
  };

  await assert.rejects(async () => {
    await db.withTransactionAsync(async () => {
      await badMigration.up(db);
    });
  }, /Simulated disk I\/O failure/);

  // Assert target template remains in its previous valid state
  const tplRow = await db.getFirstAsync<{ notes: string | null }>(
    "SELECT notes FROM meal_templates WHERE id = 'tpl-rollback-test';"
  );
  assert.equal(tplRow?.notes, null, 'Mutated notes must be rolled back on transaction failure');
});

test('Repository & Service: getAllTemplates, createTemplate, updateTemplate, and reconfirmTemplate coverage', async () => {
  const db = await setupDbUpToVersion(15);
  const repo = new SQLiteMealTemplateRepository(db);
  const now = new Date().toISOString();

  // 1. Create a template with ambiguous status explicitly
  const created = await repo.createTemplate({
    id: 'tpl-repo-test-1',
    title: 'Ambiguous Pre-workout',
    totalCalories: 150,
    totalProtein: 0,
    totalCarbs: 0,
    totalFat: 0,
    nutritionCompleteness: 'indeterminate',
    proteinKnown: false,
    carbsKnown: false,
    fatKnown: false,
    reviewStatus: 'ambiguous',
    items: [],
    createdAt: now,
    updatedAt: now,
  });
  assert.equal(created.reviewStatus, 'ambiguous');

  // 2. Fetch via getAllTemplates and verify reviewStatus is populated
  const all = await repo.getAllTemplates();
  const fetched = all.find((t) => t.id === 'tpl-repo-test-1');
  assert.ok(fetched);
  assert.equal(fetched.reviewStatus, 'ambiguous');

  // 3. Update template and verify updateTemplate roundtrip
  const updated = await repo.updateTemplate({
    ...fetched,
    title: 'Ambiguous Pre-workout Renamed',
  });
  assert.equal(updated.title, 'Ambiguous Pre-workout Renamed');
  assert.equal(updated.reviewStatus, 'ambiguous');

  // 4. Reconfirm nonexistent template throws
  await assert.rejects(
    async () => repo.reconfirmTemplate('non-existent-id', 'complete'),
    /Template not found: non-existent-id/
  );

  // 5. Reconfirm via repo
  const confirmed = await repo.reconfirmTemplate('tpl-repo-test-1', 'complete', {
    proteinKnown: true,
    carbsKnown: true,
    fatKnown: true,
  });
  assert.equal(confirmed.reviewStatus, 'confirmed');
  assert.equal(confirmed.nutritionCompleteness, 'complete');
  assert.equal(confirmed.proteinKnown, true);
});
