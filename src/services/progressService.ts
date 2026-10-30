import { STORAGE_KEYS } from '../constants/storageKeys';
import type { ProgressEntry } from '../models/progress';
import { getOptionalJson, setJson } from './storageService';
import { getDatabase } from '../db/database';
import { SQLiteProgressRepository } from '../db/repositories/progressRepository';
import { isAsyncStorageMigrated } from '../db/migrationService';

export async function getProgressRepository(): Promise<SQLiteProgressRepository> {
  const db = await getDatabase();
  return new SQLiteProgressRepository(db);
}

export async function loadProgressEntries(): Promise<ProgressEntry[] | null> {
  try {
    const db = await getDatabase();
    const isMigrated = await isAsyncStorageMigrated(db);
    const repo = new SQLiteProgressRepository(db);
    const entries = await repo.getAllProgress();

    if (isMigrated || entries.length > 0) {
      return entries;
    }
  } catch (err) {
    console.warn('[progressService] SQLite read failed, falling back to AsyncStorage:', err);
  }

  return getOptionalJson<ProgressEntry[]>(STORAGE_KEYS.progress);
}

export async function saveProgressEntries(entries: ProgressEntry[]): Promise<void> {
  try {
    const db = await getDatabase();
    const repo = new SQLiteProgressRepository(db);
    await repo.saveAllProgress(entries);
  } catch (err) {
    console.warn('[progressService] SQLite save failed, falling back to AsyncStorage:', err);
  }

  await setJson(STORAGE_KEYS.progress, entries);
}

export async function addProgressEntry(entry: ProgressEntry): Promise<void> {
  try {
    const repo = await getProgressRepository();
    await repo.addProgress(entry);
  } catch (err) {
    console.warn('[progressService] SQLite addProgressEntry failed:', err);
  }
}
