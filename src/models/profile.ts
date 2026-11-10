/**
 * Canonical UserProfile domain model.
 * Extended in Phase 2 for personalization, biometric calculation, and fitness preferences.
 */

export type Gender = 'male' | 'female' | 'other' | 'unspecified';

export type ActivityLevel =
  | 'sedentary'
  | 'lightly_active'
  | 'moderately_active'
  | 'very_active'
  | 'extra_active';

export type PrimaryGoal =
  | 'weight_loss'
  | 'muscle_gain'
  | 'maintenance'
  | 'endurance'
  | 'general_health';

export type WeeklyGoalRate =
  | 'conservative'
  | 'moderate'
  | 'aggressive';

export type TrainingExperience =
  | 'beginner'
  | 'intermediate'
  | 'advanced';

export type WorkoutLocation =
  | 'home'
  | 'gym'
  | 'outdoor'
  | 'flexible';

export type DietaryPreference =
  | 'standard'
  | 'high_protein'
  | 'low_carb'
  | 'keto'
  | 'vegetarian'
  | 'vegan'
  | 'pescatarian'
  | 'mediterranean';

export type UserProfile = {
  // Baseline (V1)
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
  targetFat?: number;
  sleepGoalHours?: number;
  waterGoalLiters?: number;

  // Personalization Extensions (Phase 2 / V2)
  age?: number;
  gender?: Gender;
  activityLevel?: ActivityLevel;
  primaryGoal?: PrimaryGoal;
  targetWeightKg?: number;
  weeklyGoalRate?: WeeklyGoalRate;
  trainingExperience?: TrainingExperience;
  preferredWorkoutDays?: number;
  availableEquipment?: string[];
  workoutLocationPreference?: WorkoutLocation;
  dietaryPreference?: DietaryPreference;
  mealsPerDayPreference?: number;
  allergiesRestrictions?: string[];
  calculationOverridden?: boolean;
};

export const DEFAULT_PROFILE_ATTRIBUTES = {
  heightCm: 170,
  weightKg: 70,
  targetCalories: 2000,
  targetProtein: 140,
  targetCarbs: 200,
  targetFats: 65,
  sleepGoalHours: 8,
  waterGoalLiters: 3,
  age: 28,
  gender: 'unspecified' as Gender,
  activityLevel: 'moderately_active' as ActivityLevel,
  primaryGoal: 'general_health' as PrimaryGoal,
  targetWeightKg: 70,
  weeklyGoalRate: 'moderate' as WeeklyGoalRate,
  trainingExperience: 'beginner' as TrainingExperience,
  preferredWorkoutDays: 4,
  availableEquipment: ['bodyweight'] as string[],
  workoutLocationPreference: 'flexible' as WorkoutLocation,
  dietaryPreference: 'standard' as DietaryPreference,
  mealsPerDayPreference: 3,
  allergiesRestrictions: [] as string[],
  calculationOverridden: false,
};

export function normalizeProfile(
  profile: Partial<UserProfile> & { id: string; name: string; email: string; goal: string }
): UserProfile {
  const fats = profile.targetFats ?? profile.targetFat ?? DEFAULT_PROFILE_ATTRIBUTES.targetFats;
  const initials =
    profile.avatarInitials ||
    profile.name
      .split(' ')
      .map((part) => part[0])
      .filter(Boolean)
      .join('')
      .slice(0, 2)
      .toUpperCase() ||
    'U';

  const weight = profile.weightKg ?? DEFAULT_PROFILE_ATTRIBUTES.weightKg;

  return {
    ...DEFAULT_PROFILE_ATTRIBUTES,
    ...profile,
    heightCm: profile.heightCm ?? DEFAULT_PROFILE_ATTRIBUTES.heightCm,
    weightKg: weight,
    targetWeightKg: profile.targetWeightKg ?? weight,
    targetCalories: profile.targetCalories ?? DEFAULT_PROFILE_ATTRIBUTES.targetCalories,
    targetProtein: profile.targetProtein ?? DEFAULT_PROFILE_ATTRIBUTES.targetProtein,
    targetCarbs: profile.targetCarbs ?? DEFAULT_PROFILE_ATTRIBUTES.targetCarbs,
    avatarInitials: initials,
    targetFats: fats,
    targetFat: fats,
    sleepGoalHours: profile.sleepGoalHours ?? DEFAULT_PROFILE_ATTRIBUTES.sleepGoalHours,
    waterGoalLiters: profile.waterGoalLiters ?? DEFAULT_PROFILE_ATTRIBUTES.waterGoalLiters,
    age: profile.age ?? DEFAULT_PROFILE_ATTRIBUTES.age,
    gender: profile.gender ?? DEFAULT_PROFILE_ATTRIBUTES.gender,
    activityLevel: profile.activityLevel ?? DEFAULT_PROFILE_ATTRIBUTES.activityLevel,
    primaryGoal: profile.primaryGoal ?? DEFAULT_PROFILE_ATTRIBUTES.primaryGoal,
    weeklyGoalRate: profile.weeklyGoalRate ?? DEFAULT_PROFILE_ATTRIBUTES.weeklyGoalRate,
    trainingExperience: profile.trainingExperience ?? DEFAULT_PROFILE_ATTRIBUTES.trainingExperience,
    preferredWorkoutDays: profile.preferredWorkoutDays ?? DEFAULT_PROFILE_ATTRIBUTES.preferredWorkoutDays,
    availableEquipment: Array.isArray(profile.availableEquipment)
      ? profile.availableEquipment
      : DEFAULT_PROFILE_ATTRIBUTES.availableEquipment,
    workoutLocationPreference: profile.workoutLocationPreference ?? DEFAULT_PROFILE_ATTRIBUTES.workoutLocationPreference,
    dietaryPreference: profile.dietaryPreference ?? DEFAULT_PROFILE_ATTRIBUTES.dietaryPreference,
    mealsPerDayPreference: profile.mealsPerDayPreference ?? DEFAULT_PROFILE_ATTRIBUTES.mealsPerDayPreference,
    allergiesRestrictions: Array.isArray(profile.allergiesRestrictions)
      ? profile.allergiesRestrictions
      : DEFAULT_PROFILE_ATTRIBUTES.allergiesRestrictions,
    calculationOverridden: profile.calculationOverridden ?? DEFAULT_PROFILE_ATTRIBUTES.calculationOverridden,
  };
}
