import type { FoodItem, Meal } from '../models/meal';
import type { Workout } from '../models/workout';
import { getLastSevenDays, isDateInCurrentWeek, isSameDate } from './date';

export type NutritionTotals = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

export function calculateMealTotals(items: FoodItem[]): NutritionTotals {
  return items.reduce<NutritionTotals>(
    (totals, item) => ({
      calories: totals.calories + numeric(item.calories),
      protein: totals.protein + numeric(item.protein),
      carbs: totals.carbs + numeric(item.carbs),
      fat: totals.fat + numeric(item.fat),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

export function nutritionTotalsForMeals(meals: Meal[]): NutritionTotals {
  return meals.reduce<NutritionTotals>(
    (totals, meal) => ({
      calories: totals.calories + numeric(meal.totalCalories),
      protein: totals.protein + numeric(meal.totalProtein),
      carbs: totals.carbs + numeric(meal.totalCarbs),
      fat: totals.fat + numeric(meal.totalFat),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

export function mealsForToday(meals: Meal[]): Meal[] {
  return meals.filter((meal) => isSameDate(meal.date));
}

export function workoutsForToday(workouts: Workout[]): Workout[] {
  return workouts.filter((workout) => isSameDate(workout.date));
}

export function mealsForCurrentWeek(meals: Meal[]): Meal[] {
  return meals.filter((meal) => isDateInCurrentWeek(meal.date));
}

export function workoutsForCurrentWeek(workouts: Workout[]): Workout[] {
  return workouts.filter((workout) => isDateInCurrentWeek(workout.date));
}

export function weeklyMealSummary(meals: Meal[]) {
  return getLastSevenDays().map((date) => {
    const dayMeals = meals.filter((meal) => meal.date === date);
    return {
      date,
      calories: nutritionTotalsForMeals(dayMeals).calories,
      mealCount: dayMeals.length,
    };
  });
}

export function weeklyWorkoutSummary(workouts: Workout[]) {
  return getLastSevenDays().map((date) => ({
    date,
    workoutCount: workouts.filter((workout) => workout.date === date).length,
  }));
}

export function roundNutrition(value: number): number {
  return Math.round(value * 10) / 10;
}

function numeric(value: number): number {
  return Number.isFinite(value) ? value : 0;
}
