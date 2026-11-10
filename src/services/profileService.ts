import type { UserProfile } from '../models/profile';
import { getDatabase } from '../db/database';
import { SQLiteProfileRepository } from '../db/repositories/profileRepository';

export async function getProfileRepository(): Promise<SQLiteProfileRepository> {
  const db = await getDatabase();
  return new SQLiteProfileRepository(db);
}

export async function loadProfile(): Promise<UserProfile | null> {
  const repo = await getProfileRepository();
  return await repo.getProfile();
}

export async function saveProfile(profile: UserProfile): Promise<void> {
  const repo = await getProfileRepository();
  await repo.saveProfile(profile);
}
