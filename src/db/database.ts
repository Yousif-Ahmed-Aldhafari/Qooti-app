import * as SQLite from 'expo-sqlite';
import { IDatabase } from './types';
import { runMigrations } from './migrations';

export const DATABASE_NAME = 'qooti.db';

let dbInstance: IDatabase | null = null;
let initPromise: Promise<IDatabase> | null = null;

/**
 * Opens or returns the active database connection.
 * Configures PRAGMAs (foreign keys and WAL) and runs pending migrations.
 */
export async function getDatabase(): Promise<IDatabase> {
  if (dbInstance) {
    return dbInstance;
  }
  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    try {
      const db = await SQLite.openDatabaseAsync(DATABASE_NAME);

      // Wrap in IDatabase interface
      const dbAdapter: IDatabase = {
        execAsync: (source) => db.execAsync(source),
        runAsync: (source, ...params) => db.runAsync(source, ...params),
        getFirstAsync: (source, ...params) => db.getFirstAsync(source, ...params),
        getAllAsync: (source, ...params) => db.getAllAsync(source, ...params),
        withTransactionAsync: (task) => db.withTransactionAsync(task),
        closeAsync: () => db.closeAsync(),
      };

      // Enable foreign keys and write-ahead logging
      await dbAdapter.execAsync('PRAGMA foreign_keys = ON;');
      try {
        await dbAdapter.execAsync('PRAGMA journal_mode = WAL;');
      } catch (err) {
        // Some SQLite environments (e.g. web/in-memory) do not support WAL mode
        console.warn('[db] WAL pragma skipped:', err);
      }

      // Run versioned schema migrations
      await runMigrations(dbAdapter);

      dbInstance = dbAdapter;
      return dbAdapter;
    } finally {
      initPromise = null;
    }
  })();

  return initPromise;
}

/**
 * Closes the active database connection and resets the singleton instance.
 */
export async function closeDatabase(): Promise<void> {
  if (dbInstance) {
    await dbInstance.closeAsync();
    dbInstance = null;
  }
}

/**
 * For test injection or resetting the database connection reference.
 */
export function setDatabaseInstance(db: IDatabase | null): void {
  dbInstance = db;
  initPromise = null;
}
