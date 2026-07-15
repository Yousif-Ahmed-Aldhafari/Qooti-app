export type UserProfile = {
  id: string;
  name: string;
  email: string;
  goal: string;
  heightCm: number;
  weightKg: number;
  targetCalories: number;
  targetProtein: number;
  targetCarbs: number;
  targetFat: number;
  sleepGoalHours?: number;
  waterGoalLiters?: number;
};
