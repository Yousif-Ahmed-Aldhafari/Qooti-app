import { IDatabase, SchemaMigration } from './types';
import { SCHEMA_V1_SQL } from './schema';

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
      // Check existing columns to ensure safe, idempotent migration
      const tableInfo = await db.getAllAsync<{ name: string }>('PRAGMA table_info(user_profiles);');
      const existingColumns = new Set(tableInfo.map((col) => col.name));

      const newColumns: { name: string; ddl: string }[] = [
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
      ];

      for (const col of newColumns) {
        if (!existingColumns.has(col.name)) {
          await db.execAsync(col.ddl);
        }
      }
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
