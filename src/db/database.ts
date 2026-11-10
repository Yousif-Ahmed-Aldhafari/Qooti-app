import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';
import { IDatabase } from './types';
import { runMigrations } from './migrations';

export const DATABASE_NAME = 'qooti.db';

let dbInstance: IDatabase | null = null;
let initPromise: Promise<IDatabase> | null = null;

function wrapDatabase(rawDb: any): IDatabase {
  const adapter: IDatabase = {
    execAsync: (source) => rawDb.execAsync(source),
    runAsync: (source, ...params) => rawDb.runAsync(source, ...params),
    getFirstAsync: (source, ...params) => rawDb.getFirstAsync(source, ...params),
    getAllAsync: (source, ...params) => rawDb.getAllAsync(source, ...params),
    isInTransactionAsync: async () => {
      if (typeof rawDb.isInTransactionAsync === 'function') {
        return await rawDb.isInTransactionAsync();
      }
      return false;
    },
    withTransactionAsync: async <T = void>(task: (txn: IDatabase) => Promise<T>): Promise<T> => {
      const inTxn = typeof rawDb.isInTransactionAsync === 'function' ? await rawDb.isInTransactionAsync() : false;
      if (inTxn) {
        return await task(adapter);
      }

      let result: T;
      await rawDb.withTransactionAsync(async () => {
        result = await task(adapter);
      });
      return result!;
    },
    withExclusiveTransactionAsync: async <T = void>(task: (txn: IDatabase) => Promise<T>): Promise<T> => {
      const inTxn = typeof rawDb.isInTransactionAsync === 'function' ? await rawDb.isInTransactionAsync() : false;
      if (inTxn) {
        return await task(adapter);
      }

      if (Platform?.OS !== 'web' && typeof rawDb.withExclusiveTransactionAsync === 'function') {
        let result: T;
        await rawDb.withExclusiveTransactionAsync(async (txn: any) => {
          result = await task(wrapDatabase(txn));
        });
        return result!;
      }

      // Web or fallback
      let result: T;
      await rawDb.withTransactionAsync(async () => {
        result = await task(adapter);
      });
      return result!;
    },
    closeAsync: () => rawDb.closeAsync(),
  };

  return adapter;
}

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
      const rawDb = await SQLite.openDatabaseAsync(DATABASE_NAME);
      const dbAdapter = wrapDatabase(rawDb);

      // Enable foreign keys
      await dbAdapter.execAsync('PRAGMA foreign_keys = ON;');

      // Enable WAL mode where supported
      if (Platform?.OS !== 'web') {
        try {
          await dbAdapter.execAsync('PRAGMA journal_mode = WAL;');
        } catch (err) {
          console.warn('[db] WAL pragma skipped:', err);
        }
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
