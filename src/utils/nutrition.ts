import type { DailyNutritionSummary, Meal, MealItem, Workout } from '../types';

export function calculateMealTotals(items: MealItem[]): DailyNutritionSummary {
  return (items || []).reduce(
    (totals, item) => {
      const itemFats = safeNumber(item.fats ?? item.fat);
      const newFats = totals.fats + itemFats;
      return {
        calories: totals.calories + safeNumber(item.calories),
        protein: totals.protein + safeNumber(item.protein),
        carbs: totals.carbs + safeNumber(item.carbs),
        fats: newFats,
        fat: newFats,
      };
    },
    { calories: 0, protein: 0, carbs: 0, fats: 0, fat: 0 },
  );
}

export function calculateDailyNutrition(meals: Meal[]): DailyNutritionSummary {
  return (meals || []).reduce(
    (totals, meal) => {
      const mealTotals =
        meal.items && meal.items.length > 0
          ? calculateMealTotals(meal.items)
          : {
              calories: safeNumber(meal.totalCalories),
              protein: safeNumber(meal.totalProtein),
              carbs: safeNumber(meal.totalCarbs),
              fats: safeNumber(meal.totalFat ?? meal.totalFats),
              fat: safeNumber(meal.totalFat ?? meal.totalFats),
            };
      const newFats = totals.fats + mealTotals.fats;
      return {
        calories: totals.calories + mealTotals.calories,
        protein: totals.protein + mealTotals.protein,
        carbs: totals.carbs + mealTotals.carbs,
        fats: newFats,
        fat: newFats,
      };
    },
    { calories: 0, protein: 0, carbs: 0, fats: 0, fat: 0 },
  );
}

export function workoutMinutes(workouts: Workout[]): number {
  return (workouts || []).reduce(
    (sum, workout) => sum + (workout.exercises || []).reduce((total, exercise) => total + safeNumber(exercise.duration), 0),
    0,
  );
}

export function progressRatio(value: number, target: number): number {
  const safeTarget = safeNumber(target);

  if (safeTarget <= 0) {
    return 0;
  }

  return Math.min(1, Math.max(0, safeNumber(value) / safeTarget));
}

export function estimateWeightGainKg(calorieSurplus: number): number {
  const safeSurplus = safeNumber(calorieSurplus);
  return safeSurplus > 0 ? safeSurplus / 7700 : 0;
}

export function formatWeightGainKg(kg: number, unit = 'kg'): string {
  const safeKg = Math.max(safeNumber(kg), 0);
  return safeKg > 0 ? `+${safeKg.toFixed(2)} ${unit}` : `0.00 ${unit}`;
}

export function safeNumber(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

export function parseInputNumber(value: string): number {
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Formats a Date object to YYYY-MM-DD using local calendar date.
 * Avoids UTC boundary shifts in UTC+3 or other non-UTC timezones.
 */
export function formatLocalDate(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Formats a Date object to 24-hr HH:mm format using local hours and minutes.
 */
export function formatLocalTime(date: Date = new Date()): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
