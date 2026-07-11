import type { Meal } from '../models/meal';
import type { Workout } from '../models/workout';
import { toDateInputValue } from '../utils/date';
import { calculateMealTotals } from '../utils/health';

function dateOffset(daysAgo: number): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return toDateInputValue(date);
}

function mealWithTotals(meal: Omit<Meal, 'totalCalories' | 'totalProtein' | 'totalCarbs' | 'totalFat'>): Meal {
  const totals = calculateMealTotals(meal.items);
  return {
    ...meal,
    totalCalories: totals.calories,
    totalProtein: totals.protein,
    totalCarbs: totals.carbs,
    totalFat: totals.fat,
  };
}

export function getSeedMeals(): Meal[] {
  return [
    mealWithTotals({
      id: 'seed-meal-breakfast',
      name: 'Greek yogurt bowl',
      date: dateOffset(0),
      time: '08:15',
      items: [
        {
          id: 'seed-food-yogurt',
          name: 'Greek yogurt',
          quantity: 200,
          unit: 'g',
          calories: 146,
          protein: 20,
          carbs: 8,
          fat: 4,
        },
        {
          id: 'seed-food-berries',
          name: 'Mixed berries',
          quantity: 80,
          unit: 'g',
          calories: 45,
          protein: 1,
          carbs: 11,
          fat: 0,
        },
      ],
    }),
    mealWithTotals({
      id: 'seed-meal-lunch',
      name: 'Chicken rice plate',
      date: dateOffset(0),
      time: '13:10',
      items: [
        {
          id: 'seed-food-chicken',
          name: 'Grilled chicken',
          quantity: 160,
          unit: 'g',
          calories: 264,
          protein: 50,
          carbs: 0,
          fat: 6,
        },
        {
          id: 'seed-food-rice',
          name: 'Cooked rice',
          quantity: 180,
          unit: 'g',
          calories: 234,
          protein: 4,
          carbs: 51,
          fat: 1,
        },
      ],
    }),
    mealWithTotals({
      id: 'seed-meal-yesterday',
      name: 'Salmon dinner',
      date: dateOffset(1),
      time: '19:30',
      items: [
        {
          id: 'seed-food-salmon',
          name: 'Baked salmon',
          quantity: 150,
          unit: 'g',
          calories: 312,
          protein: 34,
          carbs: 0,
          fat: 18,
        },
        {
          id: 'seed-food-potato',
          name: 'Sweet potato',
          quantity: 170,
          unit: 'g',
          calories: 146,
          protein: 3,
          carbs: 34,
          fat: 0,
        },
      ],
    }),
  ];
}

export function getSeedWorkouts(): Workout[] {
  return [
    {
      id: 'seed-workout-strength',
      name: 'Upper body strength',
      date: dateOffset(0),
      time: '18:00',
      notes: 'Felt strong. Keep shoulder warmup.',
      exercises: [
        {
          id: 'seed-exercise-bench',
          name: 'Bench press',
          sets: 4,
          reps: 8,
          weight: 60,
          duration: 0,
          notes: 'Controlled tempo',
        },
        {
          id: 'seed-exercise-row',
          name: 'Cable row',
          sets: 3,
          reps: 12,
          weight: 45,
          duration: 0,
          notes: '',
        },
      ],
    },
    {
      id: 'seed-workout-run',
      name: 'Easy run',
      date: dateOffset(2),
      time: '07:20',
      notes: 'Comfortable pace.',
      exercises: [
        {
          id: 'seed-exercise-run',
          name: 'Outdoor run',
          sets: 1,
          reps: 1,
          weight: 0,
          duration: 28,
          notes: 'Zone 2',
        },
      ],
    },
  ];
}
