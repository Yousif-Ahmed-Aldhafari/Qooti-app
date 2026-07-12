import type { DailyNutritionSummary, Meal, MealItem, Workout } from '../types';

export function calculateMealTotals(items: MealItem[]): DailyNutritionSummary {
  return items.reduce(
    (totals, item) => ({
      calories: totals.calories + safeNumber(item.calories),
      protein: totals.protein + safeNumber(item.protein),
      carbs: totals.carbs + safeNumber(item.carbs),
      fats: totals.fats + safeNumber(item.fats),
    }),
    { calories: 0, protein: 0, carbs: 0, fats: 0 },
  );
}

export function calculateDailyNutrition(meals: Meal[]): DailyNutritionSummary {
  return meals.reduce(
    (totals, meal) => {
      const mealTotals = calculateMealTotals(meal.items);
      return {
        calories: totals.calories + mealTotals.calories,
        protein: totals.protein + mealTotals.protein,
        carbs: totals.carbs + mealTotals.carbs,
        fats: totals.fats + mealTotals.fats,
      };
    },
    { calories: 0, protein: 0, carbs: 0, fats: 0 },
  );
}

export function workoutMinutes(workouts: Workout[]): number {
  return workouts.reduce(
    (sum, workout) => sum + workout.exercises.reduce((total, exercise) => total + safeNumber(exercise.duration), 0),
    0,
  );
}

export function progressRatio(value: number, target: number): number {
  if (!target) {
    return 0;
  }

  return Math.min(1, Math.max(0, value / target));
}

export function safeNumber(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

export function parseInputNumber(value: string): number {
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}
