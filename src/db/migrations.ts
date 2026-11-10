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

