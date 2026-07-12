import { STORAGE_KEYS } from '../constants/storageKeys';
import type { ProgressEntry } from '../models/progress';
import { getOptionalJson, setJson } from './storageService';

export async function loadProgressEntries(): Promise<ProgressEntry[] | null> {
  return getOptionalJson<ProgressEntry[]>(STORAGE_KEYS.progress);
}

export async function saveProgressEntries(entries: ProgressEntry[]): Promise<void> {
  await setJson(STORAGE_KEYS.progress, entries);
}
