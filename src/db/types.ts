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
  withTransactionAsync<T = void>(task: (txn: IDatabase) => Promise<T>): Promise<T>;
  withExclusiveTransactionAsync<T = void>(task: (txn: IDatabase) => Promise<T>): Promise<T>;
  isInTransactionAsync?(): Promise<boolean>;
  closeAsync(): Promise<void>;
}

export interface SchemaMigration {
  version: number;
  name: string;
  up: (db: IDatabase) => Promise<void>;
}

export type MigrationStatus =
  | 'completed'
  | 'skipped_already_migrated'
  | 'needs_recovery'
  | 'failed_read'
  | 'failed_write'
  | 'failed_corrupt_data';

export type KeyMigrationStatus = 'missing' | 'empty' | 'valid' | 'malformed' | 'read_error';

export interface MigrationSummary {
  status: MigrationStatus;
  alreadyMigrated: boolean;
  migratedMeals: number;
  migratedWorkouts: number;
  migratedProfile: boolean;
  migratedProgressEntries: number;
  migratedSettings: boolean;
  skippedCorruptedRecords: number;
  details: {
    mealsStatus: KeyMigrationStatus;
    workoutsStatus: KeyMigrationStatus;
    profileStatus: KeyMigrationStatus;
    progressStatus: KeyMigrationStatus;
    settingsStatus: KeyMigrationStatus;
  };
  error?: string;
}

export interface MealRepository {
  getAllMeals(): Promise<Meal[]>;
  getMealById(id: string): Promise<Meal | null>;
  insertMeal(meal: Meal, txn?: IDatabase): Promise<void>;
  updateMeal(meal: Meal, txn?: IDatabase): Promise<void>;
  deleteMeal(id: string, txn?: IDatabase): Promise<void>;
  saveAllMeals(meals: Meal[], txn?: IDatabase): Promise<void>;
}

export interface WorkoutRepository {
  getAllWorkouts(): Promise<Workout[]>;
  getWorkoutById(id: string): Promise<Workout | null>;
  insertWorkout(workout: Workout, txn?: IDatabase): Promise<void>;
  updateWorkout(workout: Workout, txn?: IDatabase): Promise<void>;
  deleteWorkout(id: string, txn?: IDatabase): Promise<void>;
  saveAllWorkouts(workouts: Workout[], txn?: IDatabase): Promise<void>;
}

export interface ProfileRepository {
  getProfile(): Promise<UserProfile | null>;
  saveProfile(profile: UserProfile, txn?: IDatabase): Promise<void>;
}

export interface ProgressRepository {
  getAllProgress(): Promise<ProgressEntry[]>;
  addProgress(entry: ProgressEntry, txn?: IDatabase): Promise<void>;
  saveAllProgress(entries: ProgressEntry[], txn?: IDatabase): Promise<void>;
}

export interface SettingsRepository {
  getSettings(): Promise<Settings | null>;
  saveSettings(settings: Settings, txn?: IDatabase): Promise<void>;
}
