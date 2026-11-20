import type { ProgressEntry } from '../models/progress';
import { getDatabase } from '../db/database';
import { SQLiteProgressRepository } from '../db/repositories/progressRepository';
import { isAsyncStorageMigrated } from '../db/migrationService';
import type { IDatabase } from '../db/types';

export async function getProgressRepository(): Promise<SQLiteProgressRepository> {
  const db = await getDatabase();
  return new SQLiteProgressRepository(db);
}

export async function loadProgressEntries(): Promise<ProgressEntry[] | null> {
  const db = await getDatabase();
  const repo = new SQLiteProgressRepository(db);
  const entries = await repo.getAllProgress();

  const isMigrated = await isAsyncStorageMigrated(db);
  const progressSavedRow = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM migration_meta WHERE key = 'progress_saved';"
  );
  const isProgressSaved = progressSavedRow?.value === 'true';

  if (isProgressSaved || isMigrated || entries.length > 0) {
    return entries;
  }

  return null;
}

export async function getProgressEntryById(
  id: string,
  txn?: IDatabase
): Promise<ProgressEntry | null> {
  const db = txn || (await getDatabase());
  const repo = new SQLiteProgressRepository(db);
  return repo.getProgressById(id, txn);
}

export async function insertProgressEntry(
  entry: ProgressEntry,
  txn?: IDatabase
): Promise<void> {
  const execute = async (client: IDatabase) => {
    const repo = new SQLiteProgressRepository(client);
    await repo.insertProgressEntry(entry, client);
    const now = new Date().toISOString();
    await client.runAsync(
      `INSERT INTO migration_meta (key, value, updated_at)
       VALUES ('progress_saved', 'true', ?)
       ON CONFLICT(key) DO UPDATE SET value = 'true', updated_at = excluded.updated_at;`,
      now
    );
  };

  if (txn) {
    await execute(txn);
  } else {
    const db = await getDatabase();
    await db.withExclusiveTransactionAsync(execute);
  }
}

export async function updateProgressEntry(
  entry: ProgressEntry,
  txn?: IDatabase
): Promise<void> {
  const execute = async (client: IDatabase) => {
    const repo = new SQLiteProgressRepository(client);
    await repo.updateProgressEntry(entry, client);
  };

  if (txn) {
    await execute(txn);
  } else {
    const db = await getDatabase();
    await db.withExclusiveTransactionAsync(execute);
  }
}

export async function deleteProgressEntry(
  id: string,
  txn?: IDatabase
): Promise<void> {
  const execute = async (client: IDatabase) => {
    const repo = new SQLiteProgressRepository(client);
    await repo.deleteProgressEntry(id, client);
  };

  if (txn) {
    await execute(txn);
  } else {
    const db = await getDatabase();
    await db.withExclusiveTransactionAsync(execute);
  }
}

export async function saveProgressEntries(
  entries: ProgressEntry[],
  txn?: IDatabase
): Promise<void> {
  const execute = async (client: IDatabase) => {
    const repo = new SQLiteProgressRepository(client);
    await repo.saveAllProgress(entries, client);
    const now = new Date().toISOString();
    await client.runAsync(
      `INSERT INTO migration_meta (key, value, updated_at)
       VALUES ('progress_saved', 'true', ?)
       ON CONFLICT(key) DO UPDATE SET value = 'true', updated_at = excluded.updated_at;`,
      now
    );
  };

  if (txn) {
    await execute(txn);
  } else {
    const db = await getDatabase();
    await db.withExclusiveTransactionAsync(execute);
  }
}

export async function addProgressEntry(
  entry: ProgressEntry,
  txn?: IDatabase
): Promise<void> {
  return insertProgressEntry(entry, txn);
}
