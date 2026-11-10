import { normalizeMeal, type Meal } from '../models/meal';
import { normalizeProfile, type UserProfile } from '../models/profile';
import { normalizeProgressEntry, type ProgressEntry } from '../models/progress';
import { normalizeWorkout, type Workout } from '../models/workout';
import type { SleepEntry, WaterEntry } from '../types';

export const sampleProfile: UserProfile = normalizeProfile({
  id: 'profile-1',
  name: 'Sara Ahmed',
  email: 'sara@qooti.app',
  goal: 'Build strength and keep nutrition consistent',
  avatarInitials: 'SA',
  heightCm: 168,
  weightKg: 64,
  targetCalories: 2200,
  targetProtein: 140,
  targetCarbs: 240,
  targetFats: 70,
  targetFat: 70,
  sleepGoalHours: 8,
  waterGoalLiters: 3,
});

export const sampleMeals: Meal[] = [
  normalizeMeal({
    id: 'meal-1',
    title: 'Power breakfast',
    name: 'Power breakfast',
    time: '08:15',
    date: 'Today',
    items: [
      { id: 'item-1', foodName: 'Greek yogurt bowl', name: 'Greek yogurt bowl', quantity: 1, calories: 320, protein: 28, carbs: 38, fats: 7, fat: 7 },
    ],
  }),
  normalizeMeal({
    id: 'meal-2',
    title: 'Chicken rice plate',
    name: 'Chicken rice plate',
    time: '13:20',
    date: 'Today',
    items: [
      { id: 'item-2', foodName: 'Grilled chicken', name: 'Grilled chicken', quantity: 160, calories: 264, protein: 50, carbs: 0, fats: 6, fat: 6 },
      { id: 'item-3', foodName: 'Basmati rice', name: 'Basmati rice', quantity: 180, calories: 234, protein: 4, carbs: 51, fats: 1, fat: 1 },
    ],
  }),
  normalizeMeal({
    id: 'meal-3',
    title: 'Protein smoothie',
    name: 'Protein smoothie',
    time: '16:45',
    date: 'Today',
    items: [
      { id: 'item-4', foodName: 'Whey and banana', name: 'Whey and banana', quantity: 1, calories: 240, protein: 25, carbs: 31, fats: 3, fat: 3 },
    ],
  }),
];

export const sampleWorkouts: Workout[] = [
  normalizeWorkout({
    id: 'workout-1',
    title: 'Upper body strength',
    name: 'Upper body strength',
    date: 'Today',
    time: '18:00',
    exercises: [
      { id: 'exercise-1', exerciseName: 'Bench press', name: 'Bench press', targetMuscles: ['chest', 'arms'], sets: 4, reps: 8, weight: 60, duration: 20, notes: 'Controlled tempo' },
      { id: 'exercise-2', exerciseName: 'Cable row', name: 'Cable row', targetMuscles: ['back', 'arms'], sets: 3, reps: 12, weight: 45, duration: 15, notes: 'Pause at chest' },
    ],
  }),
  normalizeWorkout({
    id: 'workout-2',
    title: 'Easy run',
    name: 'Easy run',
    date: 'Yesterday',
    time: '07:30',
    exercises: [
      { id: 'exercise-3', exerciseName: 'Outdoor run', name: 'Outdoor run', targetMuscles: ['legs'], sets: 1, reps: 1, weight: 0, duration: 28, notes: 'Zone 2' },
    ],
  }),
];

export const sampleProgress: ProgressEntry[] = [
  normalizeProgressEntry({ id: 'p1', label: 'Mon', date: 'Mon', calories: 1980, workouts: 0, weightKg: 64.8 }),
  normalizeProgressEntry({ id: 'p2', label: 'Tue', date: 'Tue', calories: 2120, workouts: 1, weightKg: 64.7 }),
  normalizeProgressEntry({ id: 'p3', label: 'Wed', date: 'Wed', calories: 2050, workouts: 0, weightKg: 64.5 }),
  normalizeProgressEntry({ id: 'p4', label: 'Thu', date: 'Thu', calories: 2220, workouts: 1, weightKg: 64.4 }),
  normalizeProgressEntry({ id: 'p5', label: 'Fri', date: 'Fri', calories: 1900, workouts: 1, weightKg: 64.2 }),
  normalizeProgressEntry({ id: 'p6', label: 'Sat', date: 'Sat', calories: 2160, workouts: 0, weightKg: 64.1 }),
  normalizeProgressEntry({ id: 'p7', label: 'Sun', date: 'Sun', calories: 2060, workouts: 1, weightKg: 64 }),
];

export const sampleSleepEntries: SleepEntry[] = [
  { id: 'sleep-1', date: 'Today', hours: 6.5 },
  { id: 'sleep-2', date: 'Yesterday', hours: 7.25 },
];

export const sampleWaterEntries: WaterEntry[] = [
  { id: 'water-1', date: 'Today', liters: 1.8 },
  { id: 'water-2', date: 'Yesterday', liters: 2.4 },
];
