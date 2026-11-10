/**
 * Canonical UserProfile domain model.
 */
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
  targetFat?: number;
  sleepGoalHours?: number;
  waterGoalLiters?: number;
};

export function normalizeProfile(
  profile: Partial<UserProfile> & { id: string; name: string; email: string; goal: string }
): UserProfile {
  const fats = profile.targetFats ?? profile.targetFat ?? 65;
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

  return {
    heightCm: 170,
    weightKg: 70,
    targetCalories: 2000,
    targetProtein: 140,
    targetCarbs: 200,
    ...profile,
    avatarInitials: initials,
    targetFats: fats,
    targetFat: fats,
  };
}
