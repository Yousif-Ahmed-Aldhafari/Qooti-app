import { normalizeMeal, type Meal } from '../models/meal';
import { normalizeProfile, type UserProfile } from '../models/profile';
import { normalizeProgressEntry, type ProgressEntry } from '../models/progress';
import { normalizeWorkout, type Workout } from '../models/workout';
import { toDateInputValue } from '../utils/date';
import { calculateMealTotals } from '../utils/health';

function dateOffset(daysAgo: number): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return toDateInputValue(date);
}

function mealWithTotals(meal: Omit<Meal, 'totalCalories' | 'totalProtein' | 'totalCarbs' | 'totalFat' | 'title'> & { name: string; title?: string }): Meal {
  const totals = calculateMealTotals(meal.items);
  return normalizeMeal({
    ...meal,
    title: meal.title || meal.name,
    totalCalories: totals.calories,
    totalProtein: totals.protein,
    totalCarbs: totals.carbs,
    totalFat: totals.fat,
  });
}

export function getSeedMeals(): Meal[] {
  return [
    mealWithTotals({
      id: 'seed-meal-breakfast',
      name: 'Greek yogurt bowl',
      title: 'Greek yogurt bowl',
      date: dateOffset(0),
      time: '08:15',
      items: [
        {
          id: 'seed-food-yogurt',
          foodName: 'Greek yogurt',
          name: 'Greek yogurt',
          quantity: 200,
          unit: 'g',
          calories: 146,
          protein: 20,
          carbs: 8,
          fats: 4,
          fat: 4,
        },
        {
          id: 'seed-food-berries',
          foodName: 'Mixed berries',
          name: 'Mixed berries',
          quantity: 80,
          unit: 'g',
          calories: 45,
          protein: 1,
          carbs: 11,
          fats: 0,
          fat: 0,
        },
      ],
    }),
    mealWithTotals({
      id: 'seed-meal-snack',
      name: 'Protein smoothie',
      title: 'Protein smoothie',
      date: dateOffset(0),
      time: '16:20',
      items: [
        {
          id: 'seed-food-protein',
          foodName: 'Whey protein',
          name: 'Whey protein',
          quantity: 1,
          unit: 'scoop',
          calories: 120,
          protein: 24,
          carbs: 3,
          fats: 2,
          fat: 2,
        },
        {
          id: 'seed-food-banana',
          foodName: 'Banana',
          name: 'Banana',
          quantity: 1,
          unit: 'piece',
          calories: 105,
          protein: 1,
          carbs: 27,
          fats: 0,
          fat: 0,
        },
      ],
    }),
    mealWithTotals({
      id: 'seed-meal-lunch',
      name: 'Chicken rice plate',
      title: 'Chicken rice plate',
      date: dateOffset(0),
      time: '13:10',
      items: [
        {
          id: 'seed-food-chicken',
          foodName: 'Grilled chicken',
          name: 'Grilled chicken',
          quantity: 160,
          unit: 'g',
          calories: 264,
          protein: 50,
          carbs: 0,
          fats: 6,
          fat: 6,
        },
        {
          id: 'seed-food-rice',
          foodName: 'Cooked rice',
          name: 'Cooked rice',
          quantity: 180,
          unit: 'g',
          calories: 234,
          protein: 4,
          carbs: 51,
          fats: 1,
          fat: 1,
        },
      ],
    }),
    mealWithTotals({
      id: 'seed-meal-yesterday',
      name: 'Salmon dinner',
      title: 'Salmon dinner',
      date: dateOffset(1),
      time: '19:30',
      items: [
        {
          id: 'seed-food-salmon',
          foodName: 'Baked salmon',
          name: 'Baked salmon',
          quantity: 150,
          unit: 'g',
          calories: 312,
          protein: 34,
          carbs: 0,
          fats: 18,
          fat: 18,
        },
        {
          id: 'seed-food-potato',
          foodName: 'Sweet potato',
          name: 'Sweet potato',
          quantity: 170,
          unit: 'g',
          calories: 146,
          protein: 3,
          carbs: 34,
          fats: 0,
          fat: 0,
        },
      ],
    }),
  ];
}

export function getSeedWorkouts(): Workout[] {
  return [
    normalizeWorkout({
      id: 'seed-workout-strength',
      name: 'Upper body strength',
      title: 'Upper body strength',
      date: dateOffset(0),
      time: '18:00',
      notes: 'Felt strong. Keep shoulder warmup.',
      exercises: [
        {
          id: 'seed-exercise-bench',
          exerciseName: 'Bench press',
          name: 'Bench press',
          sets: 4,
          reps: 8,
          weight: 60,
          duration: 0,
          targetMuscles: ['chest', 'arms'],
          notes: 'Controlled tempo',
        },
        {
          id: 'seed-exercise-row',
          exerciseName: 'Cable row',
          name: 'Cable row',
          sets: 3,
          reps: 12,
          weight: 45,
          duration: 0,
          targetMuscles: ['back', 'arms'],
          notes: '',
        },
      ],
    }),
    normalizeWorkout({
      id: 'seed-workout-run',
      name: 'Easy run',
      title: 'Easy run',
      date: dateOffset(2),
      time: '07:20',
      notes: 'Comfortable pace.',
      exercises: [
        {
          id: 'seed-exercise-run',
          exerciseName: 'Outdoor run',
          name: 'Outdoor run',
          sets: 1,
          reps: 1,
          weight: 0,
          duration: 28,
          targetMuscles: ['legs'],
          notes: 'Zone 2',
        },
      ],
    }),
  ];
}

export function getSeedProfile(): UserProfile {
  return normalizeProfile({
    id: 'seed-profile',
    name: 'Sara Ahmed',
    email: 'sara@qooti.app',
    goal: 'Build strength and eat consistently',
    heightCm: 168,
    weightKg: 64,
    targetCalories: 2100,
    targetProtein: 135,
    targetCarbs: 240,
    targetFats: 65,
    targetFat: 65,
    avatarInitials: 'SA',
    sleepGoalHours: 8,
    waterGoalLiters: 3,
  });
}

export function getSeedProgressEntries(): ProgressEntry[] {
  return [
    normalizeProgressEntry({ id: 'progress-6', date: dateOffset(6), label: 'Mon', weightKg: 65.2, calories: 1980, workouts: 0, steps: 7200 }),
    normalizeProgressEntry({ id: 'progress-5', date: dateOffset(5), label: 'Tue', weightKg: 65, calories: 2140, workouts: 1, steps: 8600 }),
    normalizeProgressEntry({ id: 'progress-4', date: dateOffset(4), label: 'Wed', weightKg: 64.8, calories: 2055, workouts: 0, steps: 9100 }),
    normalizeProgressEntry({ id: 'progress-3', date: dateOffset(3), label: 'Thu', weightKg: 64.7, calories: 2200, workouts: 1, steps: 10300 }),
    normalizeProgressEntry({ id: 'progress-2', date: dateOffset(2), label: 'Fri', weightKg: 64.4, calories: 1900, workouts: 1, steps: 6900 }),
    normalizeProgressEntry({ id: 'progress-1', date: dateOffset(1), label: 'Sat', weightKg: 64.2, calories: 2088, workouts: 0, steps: 7800 }),
    normalizeProgressEntry({ id: 'progress-0', date: dateOffset(0), label: 'Sun', weightKg: 64, calories: 1914, workouts: 1, steps: 8400 }),
  ];
}

export function getFoodCatalog() {
  return [
    { id: 'catalog-chicken', name: 'Grilled chicken breast', foodName: 'Grilled chicken breast', calories: 165, protein: 31, carbs: 0, fats: 4, fat: 4, unit: '100 g' },
    { id: 'catalog-rice', name: 'Steamed basmati rice', foodName: 'Steamed basmati rice', calories: 130, protein: 3, carbs: 28, fats: 0, fat: 0, unit: '100 g' },
    { id: 'catalog-eggs', name: 'Boiled eggs', foodName: 'Boiled eggs', calories: 155, protein: 13, carbs: 1, fats: 11, fat: 11, unit: '2 eggs' },
    { id: 'catalog-oats', name: 'Rolled oats', foodName: 'Rolled oats', calories: 150, protein: 5, carbs: 27, fats: 3, fat: 3, unit: '40 g' },
    { id: 'catalog-salmon', name: 'Baked salmon', foodName: 'Baked salmon', calories: 208, protein: 20, carbs: 0, fats: 13, fat: 13, unit: '100 g' },
    { id: 'catalog-dates', name: 'Dates', foodName: 'Dates', calories: 66, protein: 0, carbs: 18, fats: 0, fat: 0, unit: '2 pieces' },
  ];
}
