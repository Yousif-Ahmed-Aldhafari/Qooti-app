export type { Language, MeasurementUnits, Settings, ThemeMode } from '../models/settings';
export type { UserProfile } from '../models/profile';
export type { FoodItem, Meal, MealItem } from '../models/meal';
export type { Exercise, Workout } from '../models/workout';
export type { DailyNutritionSummary, ProgressEntry } from '../models/progress';
export type { SleepEntry } from '../models/sleep';
export type { WaterEntry } from '../models/water';

export type TabKey = 'home' | 'meals' | 'workouts' | 'progress' | 'profile';

export type ScreenKey =
  | 'splash'
  | 'onboarding'
  | 'home'
  | 'meals'
  | 'addMeal'
  | 'mealDetails'
  | 'workouts'
  | 'addWorkout'
  | 'workoutDetails'
  | 'progress'
  | 'profile'
  | 'settings';
