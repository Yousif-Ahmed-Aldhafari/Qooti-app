import { Meal } from '../models/meal';
import { Workout } from '../models/workout';
import { UserProfile } from '../models/profile';
import { ProgressEntry } from '../models/progress';
import { Settings } from '../models/settings';

/**
 * Standard interface for SQLite Database instance, compatible with expo-sqlite.
 */
export interface IDatabase {
  execAsync(source: string): Promise<void>;
  runAsync(source: string, ...params: any[]): Promise<{ lastInsertRowId: number; changes: number }>;
  getFirstAsync<T = any>(source: string, ...params: any[]): Promise<T | null>;
  getAllAsync<T = any>(source: string, ...params: any[]): Promise<T[]>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
  closeAsync(): Promise<void>;
}

export interface SchemaMigration {
  version: number;
  name: string;
  up: (db: IDatabase) => Promise<void>;
}

export interface MigrationSummary {
  alreadyMigrated: boolean;
  migratedMeals: number;
  migratedWorkouts: number;
  migratedProfile: boolean;
  migratedProgressEntries: number;
  migratedSettings: boolean;
}

export interface MealRepository {
  getAllMeals(): Promise<Meal[]>;
  getMealById(id: string): Promise<Meal | null>;
  insertMeal(meal: Meal): Promise<void>;
  updateMeal(meal: Meal): Promise<void>;
  deleteMeal(id: string): Promise<void>;
  saveAllMeals(meals: Meal[]): Promise<void>;
}

export interface WorkoutRepository {
  getAllWorkouts(): Promise<Workout[]>;
  getWorkoutById(id: string): Promise<Workout | null>;
  insertWorkout(workout: Workout): Promise<void>;
  updateWorkout(workout: Workout): Promise<void>;
  deleteWorkout(id: string): Promise<void>;
  saveAllWorkouts(workouts: Workout[]): Promise<void>;
}

export interface ProfileRepository {
  getProfile(): Promise<UserProfile | null>;
  saveProfile(profile: UserProfile): Promise<void>;
}

export interface ProgressRepository {
  getAllProgress(): Promise<ProgressEntry[]>;
  addProgress(entry: ProgressEntry): Promise<void>;
  saveAllProgress(entries: ProgressEntry[]): Promise<void>;
}

export interface SettingsRepository {
  getSettings(): Promise<Settings | null>;
  saveSettings(settings: Settings): Promise<void>;
}
