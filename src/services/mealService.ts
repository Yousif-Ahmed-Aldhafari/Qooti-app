import { STORAGE_KEYS } from '../constants/storageKeys';
import { getOptionalJson, setJson } from './storageService';
import type { Meal } from '../models/meal';

export async function loadMeals(): Promise<Meal[] | null> {
  return getOptionalJson<Meal[]>(STORAGE_KEYS.meals);
}

export async function saveMeals(meals: Meal[]): Promise<void> {
  await setJson(STORAGE_KEYS.meals, meals);
}
