import type { FoodItem, Meal } from '../models/meal';
import type { DailyNutritionSummary } from '../models/progress';
import type { UserProfile } from '../models/profile';
import type { Workout } from '../models/workout';
import { getLastSevenDays, isDateInCurrentWeek, isSameDate } from './date';

export type NutritionTotals = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

export function calculateMealTotals(items: FoodItem[]): NutritionTotals {
  return (items || []).reduce<NutritionTotals>(
    (totals, item) => ({
      calories: totals.calories + numeric(item.calories),
      protein: totals.protein + numeric(item.protein),
      carbs: totals.carbs + numeric(item.carbs),
      fat: totals.fat + numeric(item.fat ?? item.fats),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

export function nutritionTotalsForMeals(meals: Meal[]): NutritionTotals {
  return (meals || []).reduce<NutritionTotals>(
    (totals, meal) => {
      const itemTotals = meal.items && meal.items.length ? calculateMealTotals(meal.items) : { calories: 0, protein: 0, carbs: 0, fat: 0 };
      return {
        calories: totals.calories + numeric(meal.totalCalories ?? itemTotals.calories),
        protein: totals.protein + numeric(meal.totalProtein ?? itemTotals.protein),
        carbs: totals.carbs + numeric(meal.totalCarbs ?? itemTotals.carbs),
        fat: totals.fat + numeric(meal.totalFat ?? meal.totalFats ?? itemTotals.fat),
      };
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

export function mealsForToday(meals: Meal[]): Meal[] {
  return (meals || []).filter((meal) => isSameDate(meal.date));
}

export function workoutsForToday(workouts: Workout[]): Workout[] {
  return (workouts || []).filter((workout) => isSameDate(workout.date));
}

export function mealsForCurrentWeek(meals: Meal[]): Meal[] {
  return (meals || []).filter((meal) => isDateInCurrentWeek(meal.date));
}

export function workoutsForCurrentWeek(workouts: Workout[]): Workout[] {
  return (workouts || []).filter((workout) => isDateInCurrentWeek(workout.date));
}

export function weeklyMealSummary(meals: Meal[]) {
  return getLastSevenDays().map((date) => {
    const dayMeals = (meals || []).filter((meal) => meal.date === date);
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
    workoutCount: (workouts || []).filter((workout) => workout.date === date).length,
  }));
}

export function dailyNutritionSummary(
  meals: Meal[],
  profile: UserProfile,
  date = new Date(),
): DailyNutritionSummary {
  const day = date.toISOString().slice(0, 10);
  const totals = nutritionTotalsForMeals((meals || []).filter((meal) => meal.date === day));

  return {
    date: day,
    calories: totals.calories,
    protein: totals.protein,
    carbs: totals.carbs,
    fat: totals.fat,
    fats: totals.fat,
    calorieGoal: profile.targetCalories,
  };
}

export function macroProgress(value: number, goal: number): number {
  if (!goal) {
    return 0;
  }

  return Math.min(1, Math.max(0, value / goal));
}

export function workoutDuration(workout: Workout): number {
  return (workout.exercises || []).reduce((total, exercise) => total + numeric(exercise.duration), 0);
}

export function weeklyWorkoutMinutes(workouts: Workout[]): number {
  return workoutsForCurrentWeek(workouts).reduce((total, workout) => total + workoutDuration(workout), 0);
}

export function totalSets(workout: Workout): number {
  return (workout.exercises || []).reduce((total, exercise) => total + numeric(exercise.sets), 0);
}

export function roundNutrition(value: number): number {
  return Math.round(value * 10) / 10;
}

function numeric(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}
