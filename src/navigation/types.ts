import type { NavigatorScreenParams } from '@react-navigation/native';

export type MainTabParamList = {
  Home: undefined;
  Meals: undefined;
  Workouts: undefined;
  Progress: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Onboarding: undefined;
  Login: undefined;
  Register: undefined;
  Language: { fromSettings?: boolean } | undefined;
  Settings: undefined;
  Main: NavigatorScreenParams<MainTabParamList> | undefined;
  NutritionSummary: undefined;
  AddEditMeal: { mealId?: string } | undefined;
  MealDetails: { mealId: string };
  FoodSearch: undefined;
  AddExercise: undefined;
  WorkoutDetails: { workoutId: string };
  Profile: undefined;
};
