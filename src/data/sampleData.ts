import type { Meal, ProgressEntry, UserProfile, Workout } from '../types';

export const sampleProfile: UserProfile = {
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
};

export const sampleMeals: Meal[] = [
  {
    id: 'meal-1',
    title: 'Power breakfast',
    time: '08:15',
    date: 'Today',
    items: [
      { id: 'item-1', foodName: 'Greek yogurt bowl', quantity: 1, calories: 320, protein: 28, carbs: 38, fats: 7 },
    ],
  },
  {
    id: 'meal-2',
    title: 'Chicken rice plate',
    time: '13:20',
    date: 'Today',
    items: [
      { id: 'item-2', foodName: 'Grilled chicken', quantity: 160, calories: 264, protein: 50, carbs: 0, fats: 6 },
      { id: 'item-3', foodName: 'Basmati rice', quantity: 180, calories: 234, protein: 4, carbs: 51, fats: 1 },
    ],
  },
  {
    id: 'meal-3',
    title: 'Protein smoothie',
    time: '16:45',
    date: 'Today',
    items: [
      { id: 'item-4', foodName: 'Whey and banana', quantity: 1, calories: 240, protein: 25, carbs: 31, fats: 3 },
    ],
  },
];

export const sampleWorkouts: Workout[] = [
  {
    id: 'workout-1',
    title: 'Upper body strength',
    date: 'Today',
    time: '18:00',
    exercises: [
      { id: 'exercise-1', exerciseName: 'Bench press', sets: 4, reps: 8, weight: 60, duration: 20, notes: 'Controlled tempo' },
      { id: 'exercise-2', exerciseName: 'Cable row', sets: 3, reps: 12, weight: 45, duration: 15, notes: 'Pause at chest' },
    ],
  },
  {
    id: 'workout-2',
    title: 'Easy run',
    date: 'Yesterday',
    time: '07:30',
    exercises: [
      { id: 'exercise-3', exerciseName: 'Outdoor run', sets: 1, reps: 1, weight: 0, duration: 28, notes: 'Zone 2' },
    ],
  },
];

export const sampleProgress: ProgressEntry[] = [
  { id: 'p1', label: 'Mon', calories: 1980, workouts: 0, weightKg: 64.8 },
  { id: 'p2', label: 'Tue', calories: 2120, workouts: 1, weightKg: 64.7 },
  { id: 'p3', label: 'Wed', calories: 2050, workouts: 0, weightKg: 64.5 },
  { id: 'p4', label: 'Thu', calories: 2220, workouts: 1, weightKg: 64.4 },
  { id: 'p5', label: 'Fri', calories: 1900, workouts: 1, weightKg: 64.2 },
  { id: 'p6', label: 'Sat', calories: 2160, workouts: 0, weightKg: 64.1 },
  { id: 'p7', label: 'Sun', calories: 2060, workouts: 1, weightKg: 64 },
];
