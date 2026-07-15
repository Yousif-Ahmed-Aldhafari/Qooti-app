export type Language = 'en' | 'ar';

export type UserProfile = {
  id: string;
  name: string;
  email: string;
  goal: string;
  avatarInitials: string;
  heightCm: number;
  weightKg: number;
  targetCalories: number;
  targetProtein: number;
  targetCarbs: number;
  targetFats: number;
};

export type MealItem = {
  id: string;
  foodName: string;
  quantity: number;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
};

export type Meal = {
  id: string;
  title: string;
  time: string;
  date: string;
  items: MealItem[];
};

export type DailyNutritionSummary = {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
};

export type Exercise = {
  id: string;
  exerciseName: string;
  targetMuscles?: string[];
  sets: number;
  reps: number;
  weight: number;
  duration: number;
  notes: string;
};

export type Workout = {
  id: string;
  title: string;
  date: string;
  time: string;
  exercises: Exercise[];
};

export type ProgressEntry = {
  id: string;
  label: string;
  calories: number;
  workouts: number;
  weightKg: number;
};

export type TabKey = 'home' | 'meals' | 'workouts' | 'progress' | 'profile';

export type ScreenKey =
  | 'splash'
  | 'onboarding'
  | 'home'
  | 'meals'
  | 'addMeal'
  | 'mealDetails'
  | 'workouts'
  | 'addWorkout'
  | 'workoutDetails'
  | 'progress'
  | 'profile'
  | 'settings';
