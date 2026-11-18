import { IDatabase, SchemaMigration } from './types';
import { SCHEMA_V1_SQL } from './schema';
import { MigrationSessionConflictError, SessionValidationError } from '../models/workoutSession';

type ColumnDefinition = { name: string; ddl: string };

async function addMissingColumns(
  db: IDatabase,
  tableName: string,
  columns: ColumnDefinition[]
): Promise<void> {
  const tableInfo = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${tableName});`);
  const existingColumns = new Set(tableInfo.map((col) => col.name));

  for (const col of columns) {
    if (!existingColumns.has(col.name)) {
      await db.execAsync(col.ddl);
    }
  }
}

export const MIGRATIONS: SchemaMigration[] = [
  {
    version: 1,
    name: 'initial_schema_v1',
    up: async (db: IDatabase) => {
      await db.execAsync(SCHEMA_V1_SQL);
    },
  },
  {
    version: 2,
    name: 'add_profile_personalization_v2',
    up: async (db: IDatabase) => {
      await addMissingColumns(db, 'user_profiles', [
        { name: 'age', ddl: 'ALTER TABLE user_profiles ADD COLUMN age INTEGER DEFAULT 28;' },
        { name: 'gender', ddl: "ALTER TABLE user_profiles ADD COLUMN gender TEXT DEFAULT 'unspecified';" },
        { name: 'activity_level', ddl: "ALTER TABLE user_profiles ADD COLUMN activity_level TEXT DEFAULT 'moderately_active';" },
        { name: 'primary_goal', ddl: "ALTER TABLE user_profiles ADD COLUMN primary_goal TEXT DEFAULT 'general_health';" },
        { name: 'target_weight_kg', ddl: 'ALTER TABLE user_profiles ADD COLUMN target_weight_kg REAL DEFAULT 70;' },
        { name: 'weekly_goal_rate', ddl: "ALTER TABLE user_profiles ADD COLUMN weekly_goal_rate TEXT DEFAULT 'moderate';" },
        { name: 'training_experience', ddl: "ALTER TABLE user_profiles ADD COLUMN training_experience TEXT DEFAULT 'beginner';" },
        { name: 'preferred_workout_days', ddl: 'ALTER TABLE user_profiles ADD COLUMN preferred_workout_days INTEGER DEFAULT 4;' },
        { name: 'available_equipment', ddl: `ALTER TABLE user_profiles ADD COLUMN available_equipment TEXT DEFAULT '["bodyweight"]';` },
        { name: 'workout_location', ddl: "ALTER TABLE user_profiles ADD COLUMN workout_location TEXT DEFAULT 'flexible';" },
        { name: 'dietary_preference', ddl: "ALTER TABLE user_profiles ADD COLUMN dietary_preference TEXT DEFAULT 'standard';" },
        { name: 'meals_per_day', ddl: 'ALTER TABLE user_profiles ADD COLUMN meals_per_day INTEGER DEFAULT 3;' },
        { name: 'allergies_restrictions', ddl: `ALTER TABLE user_profiles ADD COLUMN allergies_restrictions TEXT DEFAULT '[]';` },
        { name: 'calculation_overridden', ddl: 'ALTER TABLE user_profiles ADD COLUMN calculation_overridden INTEGER DEFAULT 0;' },
      ]);
    },
  },
  {
    version: 3,
    name: 'add_profile_confirmation_and_bmr_ref_v3',
    up: async (db: IDatabase) => {
      await addMissingColumns(db, 'user_profiles', [
        { name: 'attributes_confirmed', ddl: 'ALTER TABLE user_profiles ADD COLUMN attributes_confirmed INTEGER DEFAULT 0;' },
        { name: 'bmr_biological_reference', ddl: 'ALTER TABLE user_profiles ADD COLUMN bmr_biological_reference TEXT;' },
      ]);
    },
  },
  {
    version: 4,
    name: 'add_workout_exercise_catalog_id_v4',
    up: async (db: IDatabase) => {
      await addMissingColumns(db, 'workout_exercises', [
        { name: 'catalog_id', ddl: 'ALTER TABLE workout_exercises ADD COLUMN catalog_id TEXT;' },
      ]);
    },
  },
  {
    version: 5,
    name: 'add_workout_execution_sessions_v5',
    up: async (db: IDatabase) => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS workout_sessions (
          id TEXT PRIMARY KEY,
          source_workout_id TEXT REFERENCES workouts(id) ON DELETE SET NULL,
          title TEXT NOT NULL,
          status TEXT NOT NULL CHECK(status IN ('active', 'paused', 'completed', 'discarded')),
          started_at TEXT NOT NULL,
          ended_at TEXT,
          accumulated_elapsed_ms INTEGER NOT NULL DEFAULT 0,
          last_resumed_at TEXT,
          notes TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_workout_sessions_status ON workout_sessions(status);
        CREATE INDEX IF NOT EXISTS idx_workout_sessions_started_at ON workout_sessions(started_at);

        CREATE TABLE IF NOT EXISTS workout_session_exercises (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
          source_exercise_id TEXT,
          catalog_id TEXT,
          exercise_name TEXT NOT NULL,
          target_muscles TEXT NOT NULL DEFAULT '[]',
          sort_order INTEGER NOT NULL DEFAULT 0
        );
        CREATE INDEX IF NOT EXISTS idx_workout_session_exercises_session ON workout_session_exercises(session_id);

        CREATE TABLE IF NOT EXISTS workout_sets (
          id TEXT PRIMARY KEY,
          session_exercise_id TEXT NOT NULL REFERENCES workout_session_exercises(id) ON DELETE CASCADE,
          set_number INTEGER NOT NULL,
          planned_reps INTEGER NOT NULL DEFAULT 0,
          actual_reps INTEGER,
          planned_weight_kg REAL NOT NULL DEFAULT 0,
          actual_weight_kg REAL,
          status TEXT NOT NULL CHECK(status IN ('pending', 'completed', 'skipped')),
          completed_at TEXT,
          rpe REAL,
          notes TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_workout_sets_session_ex ON workout_sets(session_exercise_id);
      `);
    },
  },
  {
    version: 6,
    name: 'enforce_single_open_workout_session_v6',
    up: async (db) => {
      const sessionCols = await db.getAllAsync<{ name: string }>(
        `PRAGMA table_info(workout_sessions);`
      );
      const hasRestTarget = sessionCols.some((c) => c.name === 'rest_target_at');
      if (!hasRestTarget) {
        await db.execAsync(
          `ALTER TABLE workout_sessions ADD COLUMN rest_target_at TEXT;`
        );
      }

      const openSessions = await db.getAllAsync<{
        id: string;
        started_at: string;
        updated_at: string;
      }>(
        `SELECT id, started_at, updated_at FROM workout_sessions
         WHERE status IN ('active', 'paused')
         ORDER BY started_at DESC, updated_at DESC;`
      );

      if (openSessions.length > 1) {
        const [, ...older] = openSessions;
        const now = new Date().toISOString();
        for (const old of older) {
          await db.runAsync(
            `UPDATE workout_sessions
             SET status = 'discarded', updated_at = ?
             WHERE id = ?;`,
            now,
            old.id
          );
        }
      }

      await db.execAsync(
        `CREATE UNIQUE INDEX IF NOT EXISTS idx_workout_sessions_single_open
         ON workout_sessions((1)) WHERE status IN ('active', 'paused');`
      );
    },
  },
  {
    version: 7,
    name: 'recover_conflicted_workout_sessions_v7',
    up: async (db) => {
      const sessionCols = await db.getAllAsync<{ name: string }>(
        `PRAGMA table_info(workout_sessions);`
      );
      const hasRecoveryState = sessionCols.some((c) => c.name === 'recovery_state');
      if (!hasRecoveryState) {
        await db.execAsync(
          `ALTER TABLE workout_sessions ADD COLUMN recovery_state TEXT;`
        );
      }

      // Mark sessions that were transitioned by Migration 6 conflict resolution
      // (status = 'discarded' with child exercises and no explicit user deletion)
      // as 'interrupted' so they can be inspected and recovered by the user.
      await db.runAsync(
        `UPDATE workout_sessions
         SET recovery_state = 'interrupted'
         WHERE status = 'discarded' AND (recovery_state IS NULL OR recovery_state = '');`
      );
    },
  },
  {
    version: 8,
    name: 'clarify_session_recovery_provenance_v8',
    up: async (db) => {
      const sessionCols = await db.getAllAsync<{ name: string }>(
        `PRAGMA table_info(workout_sessions);`
      );
      const hasRecoveryState = sessionCols.some((c) => c.name === 'recovery_state');
      if (!hasRecoveryState) {
        await db.execAsync(
          `ALTER TABLE workout_sessions ADD COLUMN recovery_state TEXT;`
        );
      }

      // Mark older retained discarded sessions whose origin is unproven (e.g. from historical Migration 6/7)
      // as 'ambiguous' so they are not falsely represented as confirmed interrupted sessions.
      await db.runAsync(
        `UPDATE workout_sessions
         SET recovery_state = 'ambiguous'
         WHERE status = 'discarded' AND (recovery_state = 'interrupted' OR recovery_state IS NULL OR recovery_state = '');`
      );
    },
  },
  {
    version: 9,
    name: 'add_custom_foods_and_meal_enhancements_v9',
    up: async (db: IDatabase) => {
      // 1. Add meal_type and notes columns to meals table if missing
      await addMissingColumns(db, 'meals', [
        { name: 'meal_type', ddl: 'ALTER TABLE meals ADD COLUMN meal_type TEXT;' },
        { name: 'notes', ddl: 'ALTER TABLE meals ADD COLUMN notes TEXT;' },
      ]);

      // 2. Add catalog_id and portion_unit columns to meal_items table if missing
      await addMissingColumns(db, 'meal_items', [
        { name: 'catalog_id', ddl: 'ALTER TABLE meal_items ADD COLUMN catalog_id TEXT;' },
        { name: 'portion_unit', ddl: 'ALTER TABLE meal_items ADD COLUMN portion_unit TEXT;' },
      ]);

      // 3. Create custom_foods table
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS custom_foods (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          name_ar TEXT,
          calories REAL NOT NULL DEFAULT 0,
          protein REAL NOT NULL DEFAULT 0,
          carbs REAL NOT NULL DEFAULT 0,
          fats REAL NOT NULL DEFAULT 0,
          serving_size REAL NOT NULL DEFAULT 100,
          serving_unit TEXT NOT NULL DEFAULT 'g',
          category TEXT DEFAULT 'custom',
          notes TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);

      // 4. Create performance indexes
      await db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_custom_foods_name ON custom_foods(name);
        CREATE INDEX IF NOT EXISTS idx_meal_items_catalog_id ON meal_items(catalog_id);
      `);
    },
  },
  {
    version: 10,
    name: 'add_meal_templates_and_structured_favorites_v10',
    up: async (db: IDatabase) => {
      // 1. Add structured favorite and nutrient completeness columns to meals
      await addMissingColumns(db, 'meals', [
        { name: 'is_favorite', ddl: 'ALTER TABLE meals ADD COLUMN is_favorite INTEGER NOT NULL DEFAULT 0;' },
        { name: 'nutrition_completeness', ddl: "ALTER TABLE meals ADD COLUMN nutrition_completeness TEXT NOT NULL DEFAULT 'complete';" },
        { name: 'protein_known', ddl: 'ALTER TABLE meals ADD COLUMN protein_known INTEGER NOT NULL DEFAULT 1;' },
        { name: 'carbs_known', ddl: 'ALTER TABLE meals ADD COLUMN carbs_known INTEGER NOT NULL DEFAULT 1;' },
        { name: 'fat_known', ddl: 'ALTER TABLE meals ADD COLUMN fat_known INTEGER NOT NULL DEFAULT 1;' },
      ]);

      // 2. Safe transition for previously encoded [favorite] notes:
      // Mark is_favorite = 1 where notes contain [favorite] without destroying user notes
      await db.runAsync(`
        UPDATE meals
        SET is_favorite = 1
        WHERE notes LIKE '%[favorite]%';
      `);

      // 3. Mark existing itemless meals where all macros are 0 as 'indeterminate'
      // so legacy meals without recorded macros are not falsely assumed to be confirmed 0g
      await db.runAsync(`
        UPDATE meals
        SET nutrition_completeness = 'indeterminate',
            protein_known = 0,
            carbs_known = 0,
            fat_known = 0
        WHERE total_calories > 0
          AND total_protein = 0
          AND total_carbs = 0
          AND total_fat = 0
          AND (SELECT COUNT(*) FROM meal_items WHERE meal_items.meal_id = meals.id) = 0;
      `);

      // 4. Create independent meal_templates and meal_template_items tables
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS meal_templates (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          meal_type TEXT,
          notes TEXT,
          is_favorite INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS meal_template_items (
          id TEXT PRIMARY KEY,
          template_id TEXT NOT NULL REFERENCES meal_templates(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          quantity REAL NOT NULL,
          unit TEXT NOT NULL,
          calories REAL NOT NULL DEFAULT 0,
          protein REAL NOT NULL DEFAULT 0,
          carbs REAL NOT NULL DEFAULT 0,
          fats REAL NOT NULL DEFAULT 0,
          catalog_id TEXT,
          portion_unit TEXT,
          sort_order INTEGER NOT NULL DEFAULT 0
        );

        CREATE INDEX IF NOT EXISTS idx_meal_template_items_template_id ON meal_template_items(template_id);
        CREATE INDEX IF NOT EXISTS idx_meal_templates_favorite ON meal_templates(is_favorite);
        CREATE INDEX IF NOT EXISTS idx_meals_is_favorite ON meals(is_favorite);
      `);
    },
  },
  {
    version: 11,
    name: 'add_meal_template_nutrient_fidelity_and_favorite_repair_v11',
    up: async (db: IDatabase) => {
      // 1. Add nutrient totals and macro completeness columns to meal_templates
      await addMissingColumns(db, 'meal_templates', [
        { name: 'total_calories', ddl: 'ALTER TABLE meal_templates ADD COLUMN total_calories REAL NOT NULL DEFAULT 0;' },
        { name: 'total_protein', ddl: 'ALTER TABLE meal_templates ADD COLUMN total_protein REAL NOT NULL DEFAULT 0;' },
        { name: 'total_carbs', ddl: 'ALTER TABLE meal_templates ADD COLUMN total_carbs REAL NOT NULL DEFAULT 0;' },
        { name: 'total_fat', ddl: 'ALTER TABLE meal_templates ADD COLUMN total_fat REAL NOT NULL DEFAULT 0;' },
        { name: 'nutrition_completeness', ddl: "ALTER TABLE meal_templates ADD COLUMN nutrition_completeness TEXT NOT NULL DEFAULT 'complete';" },
        { name: 'protein_known', ddl: 'ALTER TABLE meal_templates ADD COLUMN protein_known INTEGER NOT NULL DEFAULT 1;' },
        { name: 'carbs_known', ddl: 'ALTER TABLE meal_templates ADD COLUMN carbs_known INTEGER NOT NULL DEFAULT 1;' },
        { name: 'fat_known', ddl: 'ALTER TABLE meal_templates ADD COLUMN fat_known INTEGER NOT NULL DEFAULT 1;' },
      ]);

      // 2. Backfill existing meal_templates nutrient totals from their child items
      await db.runAsync(`
        UPDATE meal_templates
        SET total_calories = (
              SELECT COALESCE(SUM(calories), 0)
              FROM meal_template_items
              WHERE meal_template_items.template_id = meal_templates.id
            ),
            total_protein = (
              SELECT COALESCE(ROUND(SUM(protein), 1), 0)
              FROM meal_template_items
              WHERE meal_template_items.template_id = meal_templates.id
            ),
            total_carbs = (
              SELECT COALESCE(ROUND(SUM(carbs), 1), 0)
              FROM meal_template_items
              WHERE meal_template_items.template_id = meal_templates.id
            ),
            total_fat = (
              SELECT COALESCE(ROUND(SUM(fats), 1), 0)
              FROM meal_template_items
              WHERE meal_template_items.template_id = meal_templates.id
            )
        WHERE (SELECT COUNT(*) FROM meal_template_items WHERE meal_template_items.template_id = meal_templates.id) > 0;
      `);

      // 3. Repair falsely favorited meals from Migration 10 substring matching
      // Distinguish historical marker prefix ([favorite] at start of notes) from legitimate user prose
      await db.runAsync(`
        UPDATE meals
        SET is_favorite = 0
        WHERE is_favorite = 1
          AND notes IS NOT NULL
          AND notes LIKE '%[favorite]%'
          AND TRIM(notes) NOT LIKE '[favorite]%'
          AND TRIM(notes) NOT LIKE '[favorite]';
      `);
    },
  },
  {
    version: 12,
    name: 'add_provenance_and_repair_legacy_templates_v12',
    up: async (db: IDatabase) => {
      // 1. Add favorite_source column to meals
      await addMissingColumns(db, 'meals', [
        {
          name: 'favorite_source',
          ddl: "ALTER TABLE meals ADD COLUMN favorite_source TEXT NOT NULL DEFAULT 'none';",
        },
      ]);

      // 2. Backfill favorite_source provenance on existing meals:
      // a) Historical marker prefix [favorite] at start of notes
      await db.runAsync(`
        UPDATE meals
        SET favorite_source = 'legacy_marker'
        WHERE notes IS NOT NULL
          AND (TRIM(notes) LIKE '[favorite]%' OR TRIM(notes) LIKE '[favorite]');
      `);

      // b) Notes containing [favorite] within legitimate user prose (ambiguous)
      await db.runAsync(`
        UPDATE meals
        SET favorite_source = 'ambiguous'
        WHERE notes IS NOT NULL
          AND notes LIKE '%[favorite]%'
          AND TRIM(notes) NOT LIKE '[favorite]%'
          AND TRIM(notes) NOT LIKE '[favorite]';
      `);

      // c) Explicitly favorited meals without legacy [favorite] marker strings
      await db.runAsync(`
        UPDATE meals
        SET favorite_source = 'explicit'
        WHERE is_favorite = 1
          AND (notes IS NULL OR notes NOT LIKE '%[favorite]%');
      `);

      // 3. Repair V10 legacy templates:
      // Prior to Task 4.5B, calorie-only templates had a synthetic child item and were
      // backfilled in Migration 11 without distinguishing whether 0g macros were measured/confirmed
      // or unmeasured. Mark uncertain templates with total_calories > 0 and 0g macros as indeterminate.
      await db.runAsync(`
        UPDATE meal_templates
        SET nutrition_completeness = 'indeterminate',
            protein_known = 0,
            carbs_known = 0,
            fat_known = 0
        WHERE total_calories > 0
          AND total_protein = 0
          AND total_carbs = 0
          AND total_fat = 0;
      `);

      // 4. Index favorite_source
      await db.runAsync(`
        CREATE INDEX IF NOT EXISTS idx_meals_favorite_source ON meals(favorite_source);
      `);
    },
  },
  {
    version: 13,
    name: 'harden_template_nutrient_fidelity_and_favorite_provenance_v13',
    up: async (db: IDatabase) => {
      // 1. Restore confirmed zero macros for templates with genuine child food items:
      // Migration 12 unconditionally marked all templates with total_calories > 0 and 0g macros
      // as indeterminate. Where genuine child items exist (catalogId present, portion unit,
      // non-generic unit, non-template name, or multiple items), restore confirmed complete macros.
      await db.runAsync(`
        UPDATE meal_templates
        SET nutrition_completeness = 'complete',
            protein_known = 1,
            carbs_known = 1,
            fat_known = 1
        WHERE total_calories > 0
          AND total_protein = 0
          AND total_carbs = 0
          AND total_fat = 0
          AND id IN (
            SELECT DISTINCT t.id
            FROM meal_templates t
            JOIN meal_template_items ti ON ti.template_id = t.id
            WHERE ti.catalog_id IS NOT NULL
               OR ti.portion_unit IS NOT NULL
               OR (ti.unit IS NOT NULL AND LOWER(TRIM(ti.unit)) NOT IN ('serving', ''))
               OR LOWER(TRIM(ti.name)) != LOWER(TRIM(t.title))
               OR (SELECT COUNT(*) FROM meal_template_items WHERE template_id = t.id) > 1
          );
      `);

      // 2. Ensure favorite_source is non-null across all meals
      await db.runAsync(`
        UPDATE meals
        SET favorite_source = 'none'
        WHERE favorite_source IS NULL;
      `);

      // 3. Ensure favorite_source index exists
      await db.runAsync(`
        CREATE INDEX IF NOT EXISTS idx_meals_favorite_source ON meals(favorite_source);
      `);
    },
  },
  {
    version: 14,
    name: 'reconcile_template_unknown_macros_and_preserve_uncertainty_v14',
    up: async (db: IDatabase) => {
      // 1. Reconcile positive-calorie zero-macro templates to honest uncertainty:
      // In caloric physical reality (Atwater 4/4/9), a meal with positive calories
      // cannot contain confirmed 0g protein, 0g carbohydrates, and 0g fat without
      // unmeasured macronutrients. Child item existence (catalog_id, portion_unit)
      // confirms food item existence but does not establish that macronutrients
      // were scientifically measured or verified as zero.
      // Setting completeness to 'complete' fabricates false certainty.
      // Reconcile all templates with total_calories > 0 and 0g across all macros
      // to 'indeterminate' with protein_known = 0, carbs_known = 0, fat_known = 0.
      await db.runAsync(`
        UPDATE meal_templates
        SET nutrition_completeness = 'indeterminate',
            protein_known = 0,
            carbs_known = 0,
            fat_known = 0
        WHERE total_calories > 0
          AND total_protein = 0
          AND total_carbs = 0
          AND total_fat = 0;
      `);
    },
  },
];

/**
 * Checks for pre-migration conflicts (multiple open sessions) before enforcing single-open-session constraint.
 */
export async function detectPreMigrationSessionConflicts(
  db: IDatabase
): Promise<{ id: string; title: string; startedAt: string; status: string }[]> {
  const tableExists = await db.getFirstAsync<{ count: number }>(
    `SELECT count(*) as count FROM sqlite_master WHERE type='table' AND name='workout_sessions';`
  );
  if (!tableExists || tableExists.count === 0) {
    return [];
  }
  const openSessions = await db.getAllAsync<{
    id: string;
    title: string;
    started_at: string;
    status: string;
  }>(
    `SELECT id, title, started_at, status FROM workout_sessions
     WHERE status IN ('active', 'paused')
     ORDER BY started_at DESC, updated_at DESC;`
  );
  return openSessions.map((s) => ({
    id: s.id,
    title: s.title,
    startedAt: s.started_at,
    status: s.status,
  }));
}

export type PreMigrationSessionAction =
  | 'resume'
  | 'keep_interrupted'
  | 'archive'
  | 'discard';

export type PreMigrationResolution = {
  resumeSessionId?: string;
  actionForOthers?: 'keep_interrupted' | 'archive' | 'discard';
  sessionResolutions?: Record<string, PreMigrationSessionAction>;
};

/**
 * Calculates confirmed elapsed active duration for a workout session.
 * 
 * Policy:
 * 1. Base accumulated_elapsed_ms is always preserved and non-negative.
 * 2. Paused sessions never accumulate paused time (delta = 0).
 * 3. Active sessions only accumulate confirmed in-session active time up to the last
 *    verified database activity (updated_at). Uncertain offline intervals (between
 *    updated_at and now) are NEVER counted as confirmed workout time.
 * 4. Clock rollbacks are safely bounded by Math.max(0, ...).
 */
export function calculateConfirmedElapsedMs(session: {
  status: string;
  accumulated_elapsed_ms: number;
  last_resumed_at?: string | null;
  started_at: string;
  updated_at: string;
}): number {
  let accumulated = Math.max(0, Number(session.accumulated_elapsed_ms) || 0);

  if (session.status === 'active') {
    const resumeStr = session.last_resumed_at || session.started_at;
    const resumeTime = Date.parse(resumeStr);
    const updateTime = Date.parse(session.updated_at);

    if (!Number.isNaN(resumeTime) && !Number.isNaN(updateTime) && updateTime > resumeTime) {
      // Confirmed active delta up to the last known database update
      const confirmedDelta = Math.max(0, updateTime - resumeTime);
      accumulated = Math.max(0, accumulated + confirmedDelta);
    }
  }

  return Math.max(0, Math.floor(accumulated));
}

/**
 * Reconciles pre-migration session conflicts safely under user direction.
 * Keeps at most one selected session open while safely setting other open sessions to
 * a recoverable non-completed disposition ('keep_interrupted'), archiving as completed
 * if explicitly chosen ('archive'), or permanently deleting if explicitly chosen ('discard').
 */
export async function reconcilePreMigrationConflicts(
  db: IDatabase,
  resolution: PreMigrationResolution
): Promise<void> {
  await db.withExclusiveTransactionAsync(async (client) => {
    const sessionCols = await client.getAllAsync<{ name: string }>(
      `PRAGMA table_info(workout_sessions);`
    );
    const hasRestTarget = sessionCols.some((c) => c.name === 'rest_target_at');
    const hasRecoveryState = sessionCols.some((c) => c.name === 'recovery_state');
    const hasLastResumedAt = sessionCols.some((c) => c.name === 'last_resumed_at');
    const hasAccumulated = sessionCols.some((c) => c.name === 'accumulated_elapsed_ms');
    const hasEndedAt = sessionCols.some((c) => c.name === 'ended_at');

    if (!hasRecoveryState) {
      await client.execAsync(`ALTER TABLE workout_sessions ADD COLUMN recovery_state TEXT;`);
    }

    const openSessions = await client.getAllAsync<{
      id: string;
      status: string;
      started_at: string;
      ended_at: string | null;
      accumulated_elapsed_ms: number;
      last_resumed_at: string | null;
      updated_at: string;
      notes: string | null;
    }>(
      `SELECT id, status, started_at,
              ${hasEndedAt ? 'ended_at' : 'NULL as ended_at'},
              ${hasAccumulated ? 'accumulated_elapsed_ms' : '0 as accumulated_elapsed_ms'},
              ${hasLastResumedAt ? 'last_resumed_at' : 'NULL as last_resumed_at'},
              updated_at,
              notes
       FROM workout_sessions
       WHERE status IN ('active', 'paused');`
    );

    if (openSessions.length === 0) {
      return;
    }

    if (resolution.resumeSessionId) {
      const exists = openSessions.some((s) => s.id === resolution.resumeSessionId);
      if (!exists) {
        throw new SessionValidationError(
          `Selected session "${resolution.resumeSessionId}" not found among open sessions.`,
          'resumeSessionId'
        );
      }
    }

    // Verify at most one session is designated to resume
    let resumeCount = 0;
    if (resolution.sessionResolutions) {
      for (const [id, act] of Object.entries(resolution.sessionResolutions)) {
        if (act === 'resume') {
          resumeCount++;
          if (!openSessions.some((s) => s.id === id)) {
            throw new SessionValidationError(
              `Session "${id}" in sessionResolutions not found among open sessions.`,
              'sessionResolutions'
            );
          }
        }
      }
    } else if (resolution.resumeSessionId) {
      resumeCount = 1;
    }

    if (resumeCount > 1) {
      throw new SessionValidationError(
        'At most one session can be resumed simultaneously.',
        'resumeSessionId'
      );
    }

    const now = new Date().toISOString();

    for (const s of openSessions) {
      let action: PreMigrationSessionAction;
      if (resolution.sessionResolutions && resolution.sessionResolutions[s.id]) {
        action = resolution.sessionResolutions[s.id];
      } else if (resolution.resumeSessionId) {
        action = s.id === resolution.resumeSessionId
          ? 'resume'
          : (resolution.actionForOthers ?? 'keep_interrupted');
      } else {
        action = resolution.actionForOthers ?? 'keep_interrupted';
      }

      const confirmedElapsed = calculateConfirmedElapsedMs(s);

      if (action === 'resume') {
        if (hasRestTarget) {
          await client.runAsync(
            `UPDATE workout_sessions
             SET status = 'active', recovery_state = 'recovered',
                 accumulated_elapsed_ms = ?, last_resumed_at = ?, rest_target_at = NULL, updated_at = ?
             WHERE id = ?;`,
            confirmedElapsed,
            now,
            now,
            s.id
          );
        } else {
          await client.runAsync(
            `UPDATE workout_sessions
             SET status = 'active', recovery_state = 'recovered',
                 accumulated_elapsed_ms = ?, last_resumed_at = ?, updated_at = ?
             WHERE id = ?;`,
            confirmedElapsed,
            now,
            now,
            s.id
          );
        }
      } else if (action === 'discard') {
        await client.runAsync(`DELETE FROM workout_sessions WHERE id = ?;`, s.id);
      } else if (action === 'archive') {
        // User explicitly chose to archive/complete to history
        const endedAt = s.ended_at || s.updated_at || now;
        if (hasRestTarget) {
          await client.runAsync(
            `UPDATE workout_sessions
             SET status = 'completed', recovery_state = 'archived', ended_at = ?,
                 accumulated_elapsed_ms = ?, last_resumed_at = NULL, rest_target_at = NULL, updated_at = ?
             WHERE id = ?;`,
            endedAt,
            confirmedElapsed,
            now,
            s.id
          );
        } else {
          await client.runAsync(
            `UPDATE workout_sessions
             SET status = 'completed', recovery_state = 'archived', ended_at = ?,
                 accumulated_elapsed_ms = ?, last_resumed_at = NULL, updated_at = ?
             WHERE id = ?;`,
            endedAt,
            confirmedElapsed,
            now,
            s.id
          );
        }
      } else {
        // action === 'keep_interrupted' (safe default!)
        // Preserves the session as recoverable without falsely marking it completed
        if (hasRestTarget) {
          await client.runAsync(
            `UPDATE workout_sessions
             SET status = 'discarded', recovery_state = 'interrupted',
                 accumulated_elapsed_ms = ?, last_resumed_at = NULL, rest_target_at = NULL, updated_at = ?
             WHERE id = ?;`,
            confirmedElapsed,
            now,
            s.id
          );
        } else {
          await client.runAsync(
            `UPDATE workout_sessions
             SET status = 'discarded', recovery_state = 'interrupted',
                 accumulated_elapsed_ms = ?, last_resumed_at = NULL, updated_at = ?
             WHERE id = ?;`,
            confirmedElapsed,
            now,
            s.id
          );
        }
      }
    }
  });
}

/**
 * Initializes migration tracking and executes any pending schema migrations in sequence.
 */
export async function runMigrations(
  db: IDatabase,
  options: { strictConflictCheck?: boolean } = { strictConflictCheck: true }
): Promise<void> {
  // Ensure schema_migrations table exists
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  // Query existing applied migrations
  const appliedRows = await db.getAllAsync<{ version: number }>(
    'SELECT version FROM schema_migrations ORDER BY version ASC;'
  );
  const appliedVersions = new Set(appliedRows.map((r) => r.version));

  // If strictConflictCheck is active (default true) and migration 6 has not run yet, check for conflicts
  const shouldCheckStrict = options.strictConflictCheck !== false;
  if (shouldCheckStrict && !appliedVersions.has(6)) {
    const conflicts = await detectPreMigrationSessionConflicts(db);
    if (conflicts.length > 1) {
      throw new MigrationSessionConflictError(
        `Found ${conflicts.length} conflicting open workout sessions. Resolve conflicts before enforcing single-open-session invariant.`,
        conflicts
      );
    }
  }

  // Run pending migrations in ascending order
  for (const migration of MIGRATIONS) {
    if (!appliedVersions.has(migration.version)) {
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
}
