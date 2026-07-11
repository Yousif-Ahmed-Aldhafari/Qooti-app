import type { NavigatorScreenParams } from '@react-navigation/native';

export type MainTabParamList = {
  Dashboard: undefined;
  Meals: undefined;
  Workouts: undefined;
  History: undefined;
  Settings: undefined;
};

export type RootStackParamList = {
  Onboarding: undefined;
  Language: { fromSettings?: boolean } | undefined;
  Main: NavigatorScreenParams<MainTabParamList> | undefined;
  AddEditMeal: { mealId?: string } | undefined;
  MealDetails: { mealId: string };
  AddEditWorkout: { workoutId?: string } | undefined;
  WorkoutDetails: { workoutId: string };
};
