import { STORAGE_KEYS } from '../constants/storageKeys';
import type { UserProfile } from '../models/profile';
import { getOptionalJson, setJson } from './storageService';

export async function loadProfile(): Promise<UserProfile | null> {
  return getOptionalJson<UserProfile>(STORAGE_KEYS.profile);
}

export async function saveProfile(profile: UserProfile): Promise<void> {
  await setJson(STORAGE_KEYS.profile, profile);
}
