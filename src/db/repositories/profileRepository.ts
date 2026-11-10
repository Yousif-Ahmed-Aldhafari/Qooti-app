import { IDatabase, ProfileRepository } from '../types';
import {
  ActivityLevel,
  DietaryPreference,
  Gender,
  PrimaryGoal,
  TrainingExperience,
  UserProfile,
  WeeklyGoalRate,
  WorkoutLocation,
  normalizeProfile,
} from '../../models/profile';

interface UserProfileRow {
  id: string;
  name: string;
  email: string;
  goal: string;
  avatar_initials: string;
  height_cm: number;
  weight_kg: number;
  target_calories: number;
  target_protein: number;
  target_carbs: number;
  target_fats: number;
  sleep_goal_hours: number;
  water_goal_liters: number;
  updated_at: string;

  // Phase 2 / Migration V2 attributes
  age?: number | null;
  gender?: string | null;
  activity_level?: string | null;
  primary_goal?: string | null;
  target_weight_kg?: number | null;
  weekly_goal_rate?: string | null;
  training_experience?: string | null;
  preferred_workout_days?: number | null;
  available_equipment?: string | null;
  workout_location?: string | null;
  dietary_preference?: string | null;
  meals_per_day?: number | null;
  allergies_restrictions?: string | null;
  calculation_overridden?: number | null;
  attributes_confirmed?: number | null;
  bmr_biological_reference?: string | null;
}

export class SQLiteProfileRepository implements ProfileRepository {
  constructor(private db: IDatabase) {}

  async getProfile(): Promise<UserProfile | null> {
    const row = await this.db.getFirstAsync<UserProfileRow>(
      'SELECT * FROM user_profiles ORDER BY updated_at DESC LIMIT 1;'
    );

    if (!row) {
      return null;
    }

    let equipment: string[] | undefined;
    if (row.available_equipment) {
      try {
        const parsed = JSON.parse(row.available_equipment);
        if (Array.isArray(parsed)) {
          equipment = parsed;
        }
      } catch {
        equipment = undefined;
      }
    }

    let allergies: string[] | undefined;
    if (row.allergies_restrictions) {
      try {
        const parsed = JSON.parse(row.allergies_restrictions);
        if (Array.isArray(parsed)) {
          allergies = parsed;
        }
      } catch {
        allergies = undefined;
      }
    }

    return normalizeProfile({
      id: row.id,
      name: row.name,
      email: row.email,
      goal: row.goal,
      avatarInitials: row.avatar_initials,
      heightCm: row.height_cm,
      weightKg: row.weight_kg,
      targetCalories: row.target_calories,
      targetProtein: row.target_protein,
      targetCarbs: row.target_carbs,
      targetFats: row.target_fats,
      sleepGoalHours: row.sleep_goal_hours,
      waterGoalLiters: row.water_goal_liters,
      age: row.age != null ? row.age : undefined,
      gender: (row.gender as Gender) || undefined,
      activityLevel: (row.activity_level as ActivityLevel) || undefined,
      primaryGoal: (row.primary_goal as PrimaryGoal) || undefined,
      targetWeightKg: row.target_weight_kg != null ? row.target_weight_kg : undefined,
      weeklyGoalRate: (row.weekly_goal_rate as WeeklyGoalRate) || undefined,
      trainingExperience: (row.training_experience as TrainingExperience) || undefined,
      preferredWorkoutDays: row.preferred_workout_days != null ? row.preferred_workout_days : undefined,
      availableEquipment: equipment,
      workoutLocationPreference: (row.workout_location as WorkoutLocation) || undefined,
      dietaryPreference: (row.dietary_preference as DietaryPreference) || undefined,
      mealsPerDayPreference: row.meals_per_day != null ? row.meals_per_day : undefined,
      allergiesRestrictions: allergies,
      calculationOverridden: row.calculation_overridden === 1,
      attributesConfirmed: row.attributes_confirmed != null ? row.attributes_confirmed === 1 : undefined,
      bmrBiologicalReference: (row.bmr_biological_reference as 'male' | 'female') || undefined,
    });
  }

  async saveProfile(profile: UserProfile, txn?: IDatabase): Promise<void> {
    const target = txn || this.db;
    const normalized = normalizeProfile(profile);
    const id = normalized.id || 'user_profile';
    const now = new Date().toISOString();

    const equipmentJson = JSON.stringify(normalized.availableEquipment ?? ['bodyweight']);
    const allergiesJson = JSON.stringify(normalized.allergiesRestrictions ?? []);
    const calculationOverriddenInt = normalized.calculationOverridden ? 1 : 0;
    const attributesConfirmedInt = normalized.attributesConfirmed ? 1 : 0;

    await target.runAsync(
      `INSERT INTO user_profiles (
        id, name, email, goal, avatar_initials, height_cm, weight_kg,
        target_calories, target_protein, target_carbs, target_fats,
        sleep_goal_hours, water_goal_liters,
        age, gender, activity_level, primary_goal, target_weight_kg, weekly_goal_rate,
        training_experience, preferred_workout_days, available_equipment, workout_location,
        dietary_preference, meals_per_day, allergies_restrictions, calculation_overridden,
        attributes_confirmed, bmr_biological_reference,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        email = excluded.email,
        goal = excluded.goal,
        avatar_initials = excluded.avatar_initials,
        height_cm = excluded.height_cm,
        weight_kg = excluded.weight_kg,
        target_calories = excluded.target_calories,
        target_protein = excluded.target_protein,
        target_carbs = excluded.target_carbs,
        target_fats = excluded.target_fats,
        sleep_goal_hours = excluded.sleep_goal_hours,
        water_goal_liters = excluded.water_goal_liters,
        age = excluded.age,
        gender = excluded.gender,
        activity_level = excluded.activity_level,
        primary_goal = excluded.primary_goal,
        target_weight_kg = excluded.target_weight_kg,
        weekly_goal_rate = excluded.weekly_goal_rate,
        training_experience = excluded.training_experience,
        preferred_workout_days = excluded.preferred_workout_days,
        available_equipment = excluded.available_equipment,
        workout_location = excluded.workout_location,
        dietary_preference = excluded.dietary_preference,
        meals_per_day = excluded.meals_per_day,
        allergies_restrictions = excluded.allergies_restrictions,
        calculation_overridden = excluded.calculation_overridden,
        attributes_confirmed = excluded.attributes_confirmed,
        bmr_biological_reference = excluded.bmr_biological_reference,
        updated_at = excluded.updated_at;`,
      id,
      normalized.name ?? '',
      normalized.email ?? '',
      normalized.goal ?? '',
      normalized.avatarInitials ?? '',
      normalized.heightCm ?? 0,
      normalized.weightKg ?? 0,
      normalized.targetCalories ?? 0,
      normalized.targetProtein ?? 0,
      normalized.targetCarbs ?? 0,
      normalized.targetFats ?? 0,
      normalized.sleepGoalHours ?? 0,
      normalized.waterGoalLiters ?? 0,
      normalized.age ?? 28,
      normalized.gender ?? 'unspecified',
      normalized.activityLevel ?? 'moderately_active',
      normalized.primaryGoal ?? 'general_health',
      normalized.targetWeightKg ?? normalized.weightKg ?? 70,
      normalized.weeklyGoalRate ?? 'moderate',
      normalized.trainingExperience ?? 'beginner',
      normalized.preferredWorkoutDays ?? 4,
      equipmentJson,
      normalized.workoutLocationPreference ?? 'flexible',
      normalized.dietaryPreference ?? 'standard',
      normalized.mealsPerDayPreference ?? 3,
      allergiesJson,
      calculationOverriddenInt,
      attributesConfirmedInt,
      normalized.bmrBiologicalReference ?? null,
      now
    );
  }
}
