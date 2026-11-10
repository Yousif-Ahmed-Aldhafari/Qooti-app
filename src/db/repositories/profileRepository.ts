import { IDatabase, ProfileRepository } from '../types';
import { UserProfile, normalizeProfile } from '../../models/profile';

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
    });
  }

  async saveProfile(profile: UserProfile, txn?: IDatabase): Promise<void> {
    const target = txn || this.db;
    const normalized = normalizeProfile(profile);
    const id = normalized.id || 'user_profile';
    const now = new Date().toISOString();

    await target.runAsync(
      `INSERT INTO user_profiles (
        id, name, email, goal, avatar_initials, height_cm, weight_kg,
        target_calories, target_protein, target_carbs, target_fats,
        sleep_goal_hours, water_goal_liters, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      now
    );
  }
}
