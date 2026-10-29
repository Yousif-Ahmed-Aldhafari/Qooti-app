/**
 * Canonical Progress domain model.
 */
export type DailyNutritionSummary = {
  date?: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  fat?: number;
  calorieGoal?: number;
};

export type ProgressEntry = {
  id: string;
  date?: string;
  label?: string;
  calories: number;
  workouts: number;
  weightKg: number;
  steps?: number;
};

export function normalizeProgressEntry(
  entry: Partial<ProgressEntry> & { id: string; calories: number; workouts: number; weightKg: number }
): ProgressEntry {
  return {
    ...entry,
    label: entry.label || entry.date || '',
    date: entry.date || entry.label || '',
    steps: entry.steps ?? 0,
  };
}
