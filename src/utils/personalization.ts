import type {
  ActivityLevel,
  DietaryPreference,
  Gender,
  PrimaryGoal,
  UserProfile,
  WeeklyGoalRate,
} from '../models/profile';

export type ProfileRecommendations = {
  bmr: number;
  tdee: number;
  recommendedCalories: number;
  recommendedProtein: number;
  recommendedCarbs: number;
  recommendedFats: number;
  calorieDelta: number;
  waterIntakeLiters: number;
  sleepHours: number;
};

/**
 * Physical Activity Level (PAL) multipliers for Total Daily Energy Expenditure (TDEE).
 */
export const PAL_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  lightly_active: 1.375,
  moderately_active: 1.55,
  very_active: 1.725,
  extra_active: 1.9,
};

/**
 * Caloric adjustment deltas (kcal/day) by goal and weekly progression rate.
 */
export const GOAL_CALORIE_DELTAS: Record<PrimaryGoal, Record<WeeklyGoalRate, number>> = {
  weight_loss: {
    conservative: -300,
    moderate: -500,
    aggressive: -750,
  },
  muscle_gain: {
    conservative: 200,
    moderate: 350,
    aggressive: 500,
  },
  maintenance: {
    conservative: 0,
    moderate: 0,
    aggressive: 0,
  },
  endurance: {
    conservative: 100,
    moderate: 200,
    aggressive: 350,
  },
  general_health: {
    conservative: 0,
    moderate: 0,
    aggressive: 0,
  },
};

/**
 * Calculates Basal Metabolic Rate (BMR) using the clinically validated Mifflin-St Jeor equation.
 *
 * Men: BMR = 10 * weight (kg) + 6.25 * height (cm) - 5 * age (y) + 5
 * Women: BMR = 10 * weight (kg) + 6.25 * height (cm) - 5 * age (y) - 161
 * Other / Unspecified: BMR = 10 * weight (kg) + 6.25 * height (cm) - 5 * age (y) - 78
 */
export function calculateBMR(
  weightKg: number,
  heightCm: number,
  age: number,
  gender: Gender = 'unspecified'
): number {
  const safeWeight = Math.max(20, Math.min(350, Number.isFinite(weightKg) ? weightKg : 70));
  const safeHeight = Math.max(80, Math.min(260, Number.isFinite(heightCm) ? heightCm : 170));
  const safeAge = Math.max(13, Math.min(120, Number.isFinite(age) ? age : 28));

  const base = 10 * safeWeight + 6.25 * safeHeight - 5 * safeAge;

  let genderOffset: number;
  switch (gender) {
    case 'male':
      genderOffset = 5;
      break;
    case 'female':
      genderOffset = -161;
      break;
    case 'other':
    case 'unspecified':
    default:
      // Midpoint between male (+5) and female (-161)
      genderOffset = -78;
      break;
  }

  return Math.round(base + genderOffset);
}

/**
 * Calculates Total Daily Energy Expenditure (TDEE) from BMR and activity level.
 */
export function calculateTDEE(bmr: number, activityLevel: ActivityLevel = 'moderately_active'): number {
  const safeBmr = Math.max(500, Number.isFinite(bmr) ? bmr : 1600);
  const multiplier = PAL_MULTIPLIERS[activityLevel] ?? PAL_MULTIPLIERS.moderately_active;
  return Math.round(safeBmr * multiplier);
}

/**
 * Calculates recommended daily caloric intake based on TDEE, goal, rate, and physiological safety floors.
 */
export function calculateCaloricTarget(
  tdee: number,
  primaryGoal: PrimaryGoal = 'general_health',
  weeklyGoalRate: WeeklyGoalRate = 'moderate',
  gender: Gender = 'unspecified'
): { target: number; delta: number } {
  const safeTdee = Math.max(800, Number.isFinite(tdee) ? tdee : 2000);
  const delta = GOAL_CALORIE_DELTAS[primaryGoal]?.[weeklyGoalRate] ?? 0;
  const rawTarget = safeTdee + delta;

  // Physiological safety minimums to prevent metabolic slowing and nutrient deficiencies
  const minimumCalorieFloor = gender === 'male' ? 1500 : 1200;
  const finalTarget = Math.max(minimumCalorieFloor, Math.round(rawTarget));

  return {
    target: finalTarget,
    delta: finalTarget - safeTdee,
  };
}

/**
 * Calculates optimal macronutrient distribution based on daily calories, bodyweight, diet style, and goal.
 */
export function calculateMacroTargets(
  calories: number,
  weightKg: number,
  dietaryPreference: DietaryPreference = 'standard',
  primaryGoal: PrimaryGoal = 'general_health'
): { protein: number; carbs: number; fats: number } {
  const safeCalories = Math.max(1000, Number.isFinite(calories) ? calories : 2000);
  const safeWeight = Math.max(30, Number.isFinite(weightKg) ? weightKg : 70);

  // 1. Protein determination (g per kg bodyweight)
  let proteinPerKg: number;
  if (dietaryPreference === 'high_protein') {
    proteinPerKg = 2.2;
  } else if (dietaryPreference === 'keto') {
    proteinPerKg = 1.8;
  } else if (primaryGoal === 'muscle_gain' || primaryGoal === 'weight_loss') {
    proteinPerKg = 2.0;
  } else if (primaryGoal === 'endurance') {
    proteinPerKg = 1.8;
  } else {
    proteinPerKg = 1.6;
  }

  let proteinGrams = Math.round(safeWeight * proteinPerKg);
  // Safe bounds: at least 50g protein
  proteinGrams = Math.max(50, proteinGrams);
  const proteinKcal = proteinGrams * 4;

  // 2. Fat determination
  let fatKcalPercentage: number;
  switch (dietaryPreference) {
    case 'keto':
      fatKcalPercentage = 0.7; // 70% fat
      break;
    case 'low_carb':
      fatKcalPercentage = 0.4; // 40% fat
      break;
    case 'mediterranean':
      fatKcalPercentage = 0.35; // 35% healthy fats
      break;
    case 'high_protein':
      fatKcalPercentage = 0.25; // 25% fat
      break;
    case 'standard':
    case 'vegetarian':
    case 'vegan':
    case 'pescatarian':
    default:
      fatKcalPercentage = 0.28; // 28% balanced fat
      break;
  }

  let fatGrams = Math.round((safeCalories * fatKcalPercentage) / 9);
  // Minimum fat floor: 30g/day for essential hormone synthesis
  fatGrams = Math.max(30, fatGrams);
  const fatKcal = fatGrams * 9;

  // 3. Carbohydrate determination (remaining caloric balance)
  const remainingKcal = safeCalories - (proteinKcal + fatKcal);
  let carbsGrams: number;

  if (dietaryPreference === 'keto') {
    // Strictly capped at ~30g or 5% of intake
    carbsGrams = Math.min(35, Math.max(20, Math.round((safeCalories * 0.05) / 4)));
  } else {
    carbsGrams = Math.max(30, Math.round(remainingKcal / 4));
  }

  return {
    protein: proteinGrams,
    carbs: carbsGrams,
    fats: fatGrams,
  };
}

/**
 * Calculates recommended baseline hydration target (liters/day).
 * Rule: 35 ml per kg body weight, with minimum 2.0L and maximum 4.5L.
 */
export function calculateWaterRecommendation(weightKg: number): number {
  const safeWeight = Math.max(30, Number.isFinite(weightKg) ? weightKg : 70);
  const liters = (safeWeight * 35) / 1000;
  return Math.round(Math.min(4.5, Math.max(2.0, liters)) * 10) / 10;
}

/**
 * Calculates recommended nightly sleep duration (hours) based on training demand.
 */
export function calculateSleepRecommendation(activityLevel: ActivityLevel = 'moderately_active'): number {
  switch (activityLevel) {
    case 'extra_active':
    case 'very_active':
      return 8.5;
    case 'moderately_active':
      return 8.0;
    case 'lightly_active':
    case 'sedentary':
    default:
      return 7.5;
  }
}

/**
 * Computes full clinically-backed recommendations for any given UserProfile.
 */
export function calculateFullRecommendation(profile: UserProfile): ProfileRecommendations {
  const bmr = calculateBMR(
    profile.weightKg ?? 70,
    profile.heightCm ?? 170,
    profile.age ?? 28,
    profile.gender ?? 'unspecified'
  );

  const tdee = calculateTDEE(bmr, profile.activityLevel ?? 'moderately_active');

  const { target: recommendedCalories, delta: calorieDelta } = calculateCaloricTarget(
    tdee,
    profile.primaryGoal ?? 'general_health',
    profile.weeklyGoalRate ?? 'moderate',
    profile.gender ?? 'unspecified'
  );

  const { protein, carbs, fats } = calculateMacroTargets(
    recommendedCalories,
    profile.weightKg ?? 70,
    profile.dietaryPreference ?? 'standard',
    profile.primaryGoal ?? 'general_health'
  );

  const waterIntakeLiters = calculateWaterRecommendation(profile.weightKg ?? 70);
  const sleepHours = calculateSleepRecommendation(profile.activityLevel ?? 'moderately_active');

  return {
    bmr,
    tdee,
    recommendedCalories,
    recommendedProtein: protein,
    recommendedCarbs: carbs,
    recommendedFats: fats,
    calorieDelta,
    waterIntakeLiters,
    sleepHours,
  };
}

/**
 * Checks whether user has manually overridden calorie or macro targets from calculated recommendations.
 */
export function isCustomTargetsOverridden(profile: UserProfile): boolean {
  if (profile.calculationOverridden) {
    return true;
  }

  const rec = calculateFullRecommendation(profile);

  // If stored targets differ by more than rounding difference (5 kcal / 2g macros), consider overridden
  const calorieDiff = Math.abs((profile.targetCalories ?? 0) - rec.recommendedCalories);
  const proteinDiff = Math.abs((profile.targetProtein ?? 0) - rec.recommendedProtein);
  const carbsDiff = Math.abs((profile.targetCarbs ?? 0) - rec.recommendedCarbs);
  const fatsDiff = Math.abs((profile.targetFats ?? 0) - rec.recommendedFats);

  return calorieDiff > 10 || proteinDiff > 3 || carbsDiff > 3 || fatsDiff > 3;
}
