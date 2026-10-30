import type { Workout } from '../models/workout';
import { getDatabase } from '../db/database';
import { SQLiteWorkoutRepository } from '../db/repositories/workoutRepository';
import { isAsyncStorageMigrated } from '../db/migrationService';

export async function getWorkoutRepository(): Promise<SQLiteWorkoutRepository> {
  const db = await getDatabase();
  return new SQLiteWorkoutRepository(db);
}

export async function loadWorkouts(): Promise<Workout[] | null> {
  const db = await getDatabase();
  const repo = new SQLiteWorkoutRepository(db);
  const workouts = await repo.getAllWorkouts();

  const isMigrated = await isAsyncStorageMigrated(db);
  const workoutsSavedRow = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM migration_meta WHERE key = 'workouts_saved';"
  );
  const isWorkoutsSaved = workoutsSavedRow?.value === 'true';

  if (isWorkoutsSaved || isMigrated || workouts.length > 0) {
    return workouts;
  }

  return null;
}

export async function saveWorkouts(workouts: Workout[]): Promise<void> {
  const db = await getDatabase();
  const repo = new SQLiteWorkoutRepository(db);

  await db.withExclusiveTransactionAsync(async (txn) => {
    await repo.saveAllWorkouts(workouts, txn);
    const now = new Date().toISOString();
    await txn.runAsync(
      `INSERT INTO migration_meta (key, value, updated_at)
       VALUES ('workouts_saved', 'true', ?)
       ON CONFLICT(key) DO UPDATE SET value = 'true', updated_at = excluded.updated_at;`,
      now
    );
  });
}

export async function insertWorkout(workout: Workout): Promise<void> {
  const db = await getDatabase();
  const repo = new SQLiteWorkoutRepository(db);

  await db.withExclusiveTransactionAsync(async (txn) => {
    await repo.insertWorkout(workout, txn);
    const now = new Date().toISOString();
    await txn.runAsync(
      `INSERT INTO migration_meta (key, value, updated_at)
       VALUES ('workouts_saved', 'true', ?)
       ON CONFLICT(key) DO UPDATE SET value = 'true', updated_at = excluded.updated_at;`,
      now
    );
  });
}

export async function updateWorkout(workout: Workout): Promise<void> {
  const repo = await getWorkoutRepository();
  await repo.updateWorkout(workout);
}

export async function deleteWorkout(workoutId: string): Promise<void> {
  const repo = await getWorkoutRepository();
  await repo.deleteWorkout(workoutId);
}

export async function getWorkoutById(workoutId: string): Promise<Workout | null> {
  const repo = await getWorkoutRepository();
  return await repo.getWorkoutById(workoutId);
}
