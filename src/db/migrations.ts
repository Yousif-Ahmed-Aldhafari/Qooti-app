import { IDatabase, SchemaMigration } from './types';
import { SCHEMA_V1_SQL } from './schema';

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
];

/**
 * Initializes migration tracking and executes any pending schema migrations in sequence.
 */
export async function runMigrations(db: IDatabase): Promise<void> {
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
