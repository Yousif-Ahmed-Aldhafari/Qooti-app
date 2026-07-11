import { STORAGE_KEYS } from '../constants/storageKeys';
import { getOptionalJson, setJson } from './storageService';
import type { Workout } from '../models/workout';

export async function loadWorkouts(): Promise<Workout[] | null> {
  return getOptionalJson<Workout[]>(STORAGE_KEYS.workouts);
}

export async function saveWorkouts(workouts: Workout[]): Promise<void> {
  await setJson(STORAGE_KEYS.workouts, workouts);
}
