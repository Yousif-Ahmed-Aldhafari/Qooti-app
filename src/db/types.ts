import { Meal, NutritionCompleteness } from '../models/meal';
import { MealTemplate } from '../models/mealTemplate';
import { Workout } from '../models/workout';
import { UserProfile } from '../models/profile';
import { ProgressEntry } from '../models/progress';
import { Settings } from '../models/settings';
import { WorkoutSession, WorkoutSet } from '../models/workoutSession';
import { CustomFood } from '../models/food';

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
  toggleMealFavorite(id: string, isFavorite: boolean, txn?: IDatabase): Promise<void>;
  saveAllMeals(meals: Meal[], txn?: IDatabase): Promise<void>;
}

export interface MealTemplateRepository {
  getAllTemplates(txn?: IDatabase): Promise<MealTemplate[]>;
  getTemplateById(id: string, txn?: IDatabase): Promise<MealTemplate | null>;
  createTemplate(template: MealTemplate, txn?: IDatabase): Promise<MealTemplate>;
  updateTemplate(template: MealTemplate, txn?: IDatabase): Promise<MealTemplate>;
  deleteTemplate(id: string, txn?: IDatabase): Promise<void>;
  toggleTemplateFavorite(id: string, isFavorite: boolean, txn?: IDatabase): Promise<void>;
  reconfirmTemplate(
    id: string,
    completeness: NutritionCompleteness,
    macros?: {
      proteinKnown?: boolean;
      carbsKnown?: boolean;
      fatKnown?: boolean;
      totalCalories?: number;
      totalProtein?: number;
      totalCarbs?: number;
      totalFat?: number;
    },
    txn?: IDatabase
  ): Promise<MealTemplate>;
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

export interface WorkoutSessionRepository {
  createSession(session: WorkoutSession, txn?: IDatabase): Promise<WorkoutSession>;
  getActiveSession(txn?: IDatabase): Promise<WorkoutSession | null>;
  getSessionById(id: string, txn?: IDatabase): Promise<WorkoutSession | null>;
  listSessions(limit?: number, txn?: IDatabase): Promise<WorkoutSession[]>;
  pauseSession(id: string, pausedAt?: string, txn?: IDatabase): Promise<WorkoutSession>;
  resumeSession(id: string, resumedAt?: string, txn?: IDatabase): Promise<WorkoutSession>;
  completeSet(
    setId: string,
    updates: {
      actualReps: number;
      actualWeightKg: number;
      rpe?: number | null;
      notes?: string;
    },
    txn?: IDatabase
  ): Promise<WorkoutSet>;
  updateSet(setId: string, updates: Partial<WorkoutSet>, txn?: IDatabase): Promise<WorkoutSet>;
  skipSet(setId: string, notes?: string, txn?: IDatabase): Promise<WorkoutSet>;
  addSet(
    sessionExerciseId: string,
    plannedReps: number,
    plannedWeightKg: number,
    txn?: IDatabase
  ): Promise<WorkoutSet>;
  completeSession(id: string, notes?: string, completedAt?: string, txn?: IDatabase): Promise<WorkoutSession>;
  discardSession(id: string, txn?: IDatabase): Promise<void>;
  setRestTarget(sessionId: string, restTargetAt: string | null, txn?: IDatabase): Promise<WorkoutSession>;
  listInterruptedSessions(txn?: IDatabase): Promise<WorkoutSession[]>;
  resumeInterruptedSession(
    id: string,
    options?:
      | { currentSessionAction?: 'keep_interrupted' | 'archive' | 'discard' }
      | 'keep_interrupted'
      | 'archive'
      | 'discard',
    txn?: IDatabase
  ): Promise<WorkoutSession>;
  archiveInterruptedSession(
    id: string,
    notes?: string,
    txn?: IDatabase
  ): Promise<WorkoutSession>;
}

export interface CustomFoodRepository {
  getAllCustomFoods(txn?: IDatabase): Promise<CustomFood[]>;
  getCustomFoodById(id: string, txn?: IDatabase): Promise<CustomFood | null>;
  insertCustomFood(food: CustomFood, txn?: IDatabase): Promise<void>;
  updateCustomFood(food: CustomFood, txn?: IDatabase): Promise<void>;
  deleteCustomFood(id: string, txn?: IDatabase): Promise<void>;
  searchCustomFoods(query: string, txn?: IDatabase): Promise<CustomFood[]>;
}
