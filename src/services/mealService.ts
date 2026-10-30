import type { Meal } from '../models/meal';
import { getDatabase } from '../db/database';
import { SQLiteMealRepository } from '../db/repositories/mealRepository';
import { isAsyncStorageMigrated } from '../db/migrationService';

export async function getMealRepository(): Promise<SQLiteMealRepository> {
  const db = await getDatabase();
  return new SQLiteMealRepository(db);
}

export async function loadMeals(): Promise<Meal[] | null> {
  const db = await getDatabase();
  const repo = new SQLiteMealRepository(db);
  const meals = await repo.getAllMeals();

  const isMigrated = await isAsyncStorageMigrated(db);
  const mealsSavedRow = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM migration_meta WHERE key = 'meals_saved';"
  );
  const isMealsSaved = mealsSavedRow?.value === 'true';

  // If meals were saved, migrated, or exist in SQLite, SQLite is authoritative
  if (isMealsSaved || isMigrated || meals.length > 0) {
    return meals;
  }

  // Uninitialized fresh database
  return null;
}

export async function saveMeals(meals: Meal[]): Promise<void> {
  const db = await getDatabase();
  const repo = new SQLiteMealRepository(db);

  await db.withExclusiveTransactionAsync(async (txn) => {
    await repo.saveAllMeals(meals, txn);
    const now = new Date().toISOString();
    await txn.runAsync(
      `INSERT INTO migration_meta (key, value, updated_at)
       VALUES ('meals_saved', 'true', ?)
       ON CONFLICT(key) DO UPDATE SET value = 'true', updated_at = excluded.updated_at;`,
      now
    );
  });
}

export async function insertMeal(meal: Meal): Promise<void> {
  const db = await getDatabase();
  const repo = new SQLiteMealRepository(db);

  await db.withExclusiveTransactionAsync(async (txn) => {
    await repo.insertMeal(meal, txn);
    const now = new Date().toISOString();
    await txn.runAsync(
      `INSERT INTO migration_meta (key, value, updated_at)
       VALUES ('meals_saved', 'true', ?)
       ON CONFLICT(key) DO UPDATE SET value = 'true', updated_at = excluded.updated_at;`,
      now
    );
  });
}

export async function updateMeal(meal: Meal): Promise<void> {
  const repo = await getMealRepository();
  await repo.updateMeal(meal);
}

export async function deleteMeal(mealId: string): Promise<void> {
  const repo = await getMealRepository();
  await repo.deleteMeal(mealId);
}

export async function getMealById(mealId: string): Promise<Meal | null> {
  const repo = await getMealRepository();
  return await repo.getMealById(mealId);
}
