import { STORAGE_KEYS } from '../constants/storageKeys';
import { getOptionalJson, setJson } from './storageService';
import type { Meal } from '../models/meal';
import { getDatabase } from '../db/database';
import { SQLiteMealRepository } from '../db/repositories/mealRepository';
import { isAsyncStorageMigrated } from '../db/migrationService';

export async function getMealRepository(): Promise<SQLiteMealRepository> {
  const db = await getDatabase();
  return new SQLiteMealRepository(db);
}

export async function loadMeals(): Promise<Meal[] | null> {
  try {
    const db = await getDatabase();
    const isMigrated = await isAsyncStorageMigrated(db);
    const repo = new SQLiteMealRepository(db);
    const meals = await repo.getAllMeals();

    // If SQLite has been migrated or has meals, it is the authoritative store
    if (isMigrated || meals.length > 0) {
      return meals;
    }
  } catch (err) {
    console.warn('[mealService] SQLite read failed, falling back to AsyncStorage:', err);
  }

  // Fallback to AsyncStorage
  return getOptionalJson<Meal[]>(STORAGE_KEYS.meals);
}

export async function saveMeals(meals: Meal[]): Promise<void> {
  try {
    const db = await getDatabase();
    const repo = new SQLiteMealRepository(db);
    await repo.saveAllMeals(meals);
  } catch (err) {
    console.warn('[mealService] SQLite save failed, falling back to AsyncStorage:', err);
  }

  // Preserve AsyncStorage as recovery backup during Phase 1.3
  await setJson(STORAGE_KEYS.meals, meals);
}

export async function insertMeal(meal: Meal): Promise<void> {
  try {
    const repo = await getMealRepository();
    await repo.insertMeal(meal);
  } catch (err) {
    console.warn('[mealService] SQLite insertMeal failed:', err);
  }
}

export async function updateMeal(meal: Meal): Promise<void> {
  try {
    const repo = await getMealRepository();
    await repo.updateMeal(meal);
  } catch (err) {
    console.warn('[mealService] SQLite updateMeal failed:', err);
  }
}

export async function deleteMeal(mealId: string): Promise<void> {
  try {
    const repo = await getMealRepository();
    await repo.deleteMeal(mealId);
  } catch (err) {
    console.warn('[mealService] SQLite deleteMeal failed:', err);
  }
}

export async function getMealById(mealId: string): Promise<Meal | null> {
  try {
    const repo = await getMealRepository();
    return await repo.getMealById(mealId);
  } catch (err) {
    console.warn('[mealService] SQLite getMealById failed:', err);
    return null;
  }
}
