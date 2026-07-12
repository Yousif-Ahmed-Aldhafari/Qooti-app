export type DailyNutritionSummary = {
  date: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  calorieGoal: number;
};

export type ProgressEntry = {
  id: string;
  date: string;
  weightKg: number;
  calories: number;
  workouts: number;
  steps: number;
};
