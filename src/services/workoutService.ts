import { STORAGE_KEYS } from '../constants/storageKeys';
import { getOptionalJson, setJson } from './storageService';
import type { Workout } from '../models/workout';
import { getDatabase } from '../db/database';
import { SQLiteWorkoutRepository } from '../db/repositories/workoutRepository';
import { isAsyncStorageMigrated } from '../db/migrationService';

export async function getWorkoutRepository(): Promise<SQLiteWorkoutRepository> {
  const db = await getDatabase();
  return new SQLiteWorkoutRepository(db);
}

export async function loadWorkouts(): Promise<Workout[] | null> {
  try {
    const db = await getDatabase();
    const isMigrated = await isAsyncStorageMigrated(db);
    const repo = new SQLiteWorkoutRepository(db);
    const workouts = await repo.getAllWorkouts();

    if (isMigrated || workouts.length > 0) {
      return workouts;
    }
  } catch (err) {
    console.warn('[workoutService] SQLite read failed, falling back to AsyncStorage:', err);
  }

  return getOptionalJson<Workout[]>(STORAGE_KEYS.workouts);
}

export async function saveWorkouts(workouts: Workout[]): Promise<void> {
  try {
    const db = await getDatabase();
    const repo = new SQLiteWorkoutRepository(db);
    await repo.saveAllWorkouts(workouts);
  } catch (err) {
    console.warn('[workoutService] SQLite save failed, falling back to AsyncStorage:', err);
  }

  await setJson(STORAGE_KEYS.workouts, workouts);
}

export async function insertWorkout(workout: Workout): Promise<void> {
  try {
    const repo = await getWorkoutRepository();
    await repo.insertWorkout(workout);
  } catch (err) {
    console.warn('[workoutService] SQLite insertWorkout failed:', err);
  }
}

export async function updateWorkout(workout: Workout): Promise<void> {
  try {
    const repo = await getWorkoutRepository();
    await repo.updateWorkout(workout);
  } catch (err) {
    console.warn('[workoutService] SQLite updateWorkout failed:', err);
  }
}

export async function deleteWorkout(workoutId: string): Promise<void> {
  try {
    const repo = await getWorkoutRepository();
    await repo.deleteWorkout(workoutId);
  } catch (err) {
    console.warn('[workoutService] SQLite deleteWorkout failed:', err);
  }
}

export async function getWorkoutById(workoutId: string): Promise<Workout | null> {
  try {
    const repo = await getWorkoutRepository();
    return await repo.getWorkoutById(workoutId);
  } catch (err) {
    console.warn('[workoutService] SQLite getWorkoutById failed:', err);
    return null;
  }
}
