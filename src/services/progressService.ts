import type { ProgressEntry } from '../models/progress';
import { getDatabase } from '../db/database';
import { SQLiteProgressRepository } from '../db/repositories/progressRepository';
import { isAsyncStorageMigrated } from '../db/migrationService';

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

export async function saveProgressEntries(entries: ProgressEntry[]): Promise<void> {
  const db = await getDatabase();
  const repo = new SQLiteProgressRepository(db);

  await db.withExclusiveTransactionAsync(async (txn) => {
    await repo.saveAllProgress(entries, txn);
    const now = new Date().toISOString();
    await txn.runAsync(
      `INSERT INTO migration_meta (key, value, updated_at)
       VALUES ('progress_saved', 'true', ?)
       ON CONFLICT(key) DO UPDATE SET value = 'true', updated_at = excluded.updated_at;`,
      now
    );
  });
}

export async function addProgressEntry(entry: ProgressEntry): Promise<void> {
  const db = await getDatabase();
  const repo = new SQLiteProgressRepository(db);

  await db.withExclusiveTransactionAsync(async (txn) => {
    await repo.addProgress(entry, txn);
    const now = new Date().toISOString();
    await txn.runAsync(
      `INSERT INTO migration_meta (key, value, updated_at)
       VALUES ('progress_saved', 'true', ?)
       ON CONFLICT(key) DO UPDATE SET value = 'true', updated_at = excluded.updated_at;`,
      now
    );
  });
}
