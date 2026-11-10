/**
 * Qooti SQLite Schema Definitions
 * Version 1
 */

export const SCHEMA_V1_SQL = `
-- Schema migrations tracking
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TEXT NOT NULL
);

-- Migration metadata tracking (e.g. AsyncStorage migration state)
CREATE TABLE IF NOT EXISTS migration_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- User Profile
CREATE TABLE IF NOT EXISTS user_profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  goal TEXT NOT NULL,
  avatar_initials TEXT NOT NULL,
  height_cm REAL NOT NULL,
  weight_kg REAL NOT NULL,
  target_calories REAL NOT NULL,
  target_protein REAL NOT NULL,
  target_carbs REAL NOT NULL,
  target_fats REAL NOT NULL,
  sleep_goal_hours REAL NOT NULL,
  water_goal_liters REAL NOT NULL,
  updated_at TEXT NOT NULL
);

-- Meals
CREATE TABLE IF NOT EXISTS meals (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  total_calories REAL NOT NULL DEFAULT 0,
  total_protein REAL NOT NULL DEFAULT 0,
  total_carbs REAL NOT NULL DEFAULT 0,
  total_fat REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

-- Meal Items (1:N relationship with meals)
CREATE TABLE IF NOT EXISTS meal_items (
  id TEXT PRIMARY KEY,
  meal_id TEXT NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity REAL NOT NULL,
  unit TEXT NOT NULL,
  calories REAL NOT NULL DEFAULT 0,
  protein REAL NOT NULL DEFAULT 0,
  carbs REAL NOT NULL DEFAULT 0,
  fats REAL NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- Workouts
CREATE TABLE IF NOT EXISTS workouts (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL
);

-- Workout Exercises (1:N relationship with workouts)
CREATE TABLE IF NOT EXISTS workout_exercises (
  id TEXT PRIMARY KEY,
  workout_id TEXT NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  target_muscles TEXT NOT NULL,
  sets INTEGER NOT NULL DEFAULT 0,
  reps INTEGER NOT NULL DEFAULT 0,
  weight REAL,
  duration REAL,
  notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- Progress Entries
CREATE TABLE IF NOT EXISTS progress_entries (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  label TEXT NOT NULL,
  calories REAL NOT NULL DEFAULT 0,
  workouts REAL NOT NULL DEFAULT 0,
  weight_kg REAL NOT NULL DEFAULT 0,
  steps REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

-- App Settings
CREATE TABLE IF NOT EXISTS app_settings (
  id TEXT PRIMARY KEY,
  selected_language TEXT NOT NULL,
  theme_mode TEXT NOT NULL,
  measurement_units TEXT NOT NULL,
  has_completed_onboarding INTEGER NOT NULL DEFAULT 0,
  is_authenticated INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

-- Performance and lookup indexes
CREATE INDEX IF NOT EXISTS idx_meals_date ON meals(date);
CREATE INDEX IF NOT EXISTS idx_meal_items_meal_id ON meal_items(meal_id);
CREATE INDEX IF NOT EXISTS idx_workouts_date ON workouts(date);
CREATE INDEX IF NOT EXISTS idx_workout_exercises_workout_id ON workout_exercises(workout_id);
CREATE INDEX IF NOT EXISTS idx_progress_entries_date ON progress_entries(date);
`;

