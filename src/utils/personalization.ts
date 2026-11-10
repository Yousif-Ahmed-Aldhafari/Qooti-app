import type {
  ActivityLevel,
  DietaryPreference,
  Gender,
  PrimaryGoal,
  UserProfile,
  WeeklyGoalRate,
} from '../models/profile';

export type RecommendationStatus =
  | 'eligible'
  | 'unsupported_adolescent'
  | 'unconfirmed_attributes'
  | 'invalid_inputs'
  | 'requires_clinical_supervision'
  | 'impossible_diet_constraints';

export type BMREquation =
  | 'mifflin_st_jeor_male'
  | 'mifflin_st_jeor_female'
  | 'mifflin_st_jeor_midpoint_approximation';

export type EligibilityResult = {
  isEligible: boolean;
  status: RecommendationStatus;
  reason?: string;
  warnings: string[];
  missingFields?: string[];
};

export type MacroTargetResult = {
  protein: number;
  carbs: number;
  fats: number;
  reconciliationDiff: number;
  dietConstraintSatisfied: boolean;
  warning?: string;
};

export type ProfileRecommendations = {
  status: RecommendationStatus;
  isEligible: boolean;
  warnings: string[];
  bmr: number;
  tdee: number;
  recommendedCalories: number;
  recommendedProtein: number;
  recommendedCarbs: number;
  recommendedFats: number;
  calorieDelta: number;
  waterIntakeLiters: number;
  sleepHours: number;
  bmrEquationUsed: BMREquation;
  isEstimate: true;
  macroReconciliationDiff: number;
  requiresProfessionalReview: boolean;
  dietConstraintSatisfied: boolean;
  waterDisclaimer: string;
  sleepDisclaimer: string;
};

/**
 * Physical Activity Level (PAL) multipliers for Total Daily Energy Expenditure (TDEE).
 * Labeled as population-level estimates.
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
 * Evaluates whether a profile is eligible for automated adult personalized calculations.
 * Keeps validation distinct from mathematical calculation.
 */
export function validateProfileEligibility(profile: UserProfile): EligibilityResult {
  const warnings: string[] = [];

  // 1. Adult Eligibility Check (18+)
  if (profile.age !== undefined && profile.age < 18) {
    return {
      isEligible: false,
      status: 'unsupported_adolescent',
      reason:
        'Automated adult caloric and macronutrient recommendations cannot be safely applied to users under 18 years of age. Adolescents require specialist pediatric or clinical guidance, and adult weight-loss deficits must never be automatically calculated.',
      warnings: [
        'Adolescent users require individualized guidance from a qualified pediatric healthcare professional.',
        'Automated weight-loss caloric deficits are disabled for users under 18.',
      ],
    };
  }

  // 2. Validate biometric sanity (positive finite numbers)
  if (
    !Number.isFinite(profile.weightKg) ||
    profile.weightKg <= 0 ||
    !Number.isFinite(profile.heightCm) ||
    profile.heightCm <= 0
  ) {
    return {
      isEligible: false,
      status: 'invalid_inputs',
      reason: 'Weight and height must be positive, finite numbers.',
      warnings: ['Invalid or non-positive biometrics detected.'],
    };
  }

  // 3. Check for unconfirmed attributes
  if (profile.attributesConfirmed !== true) {
    warnings.push(
      'Profile attributes are baseline defaults and have not been confirmed by the user. Recommendations represent preliminary reference estimates.'
    );
  }

  // 4. Check for aggressive adjustments
  if (profile.primaryGoal === 'weight_loss' && profile.weeklyGoalRate === 'aggressive') {
    warnings.push(
      'Aggressive caloric deficits (>500 kcal/day) should be undertaken with professional guidance from a healthcare provider or registered dietitian.'
    );
  }

  return {
    isEligible: true,
    status: profile.attributesConfirmed === false ? 'unconfirmed_attributes' : 'eligible',
    warnings,
  };
}

/**
 * Calculates Basal Metabolic Rate (BMR) using the Mifflin-St Jeor equation.
 *
 * Clinical note:
 * - Men (+5) and Women (-161) formulas are clinically validated adult equations.
 * - For unspecified / other gender without an explicit biological reference choice,
 *   an arithmetic midpoint approximation (-78) is used. This midpoint is an unvalidated
 *   mathematical estimate, not a clinically proven model. Users may optionally supply
 *   an explicit biological reference equation ('male' | 'female').
 * - BMR and derived values are estimates only.
 */
export function calculateBMR(
  weightKg: number,
  heightCm: number,
  age: number,
  gender: Gender = 'unspecified',
  bmrBiologicalReference?: 'male' | 'female'
): number {
  const safeWeight = Math.max(20, Math.min(350, Number.isFinite(weightKg) && weightKg > 0 ? weightKg : 70));
  const safeHeight = Math.max(80, Math.min(260, Number.isFinite(heightCm) && heightCm > 0 ? heightCm : 170));
  const safeAge = Math.max(13, Math.min(120, Number.isFinite(age) && age > 0 ? age : 28));

  const base = 10 * safeWeight + 6.25 * safeHeight - 5 * safeAge;

  let genderOffset: number;
  if (bmrBiologicalReference === 'male') {
    genderOffset = 5;
  } else if (bmrBiologicalReference === 'female') {
    genderOffset = -161;
  } else {
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
        // Explicitly labeled arithmetic midpoint approximation (-78)
        genderOffset = -78;
        break;
    }
  }

  return Math.round(base + genderOffset);
}

/**
 * Identifies which BMR equation model was utilized.
 */
export function resolveBMREquation(
  gender: Gender = 'unspecified',
  bmrBiologicalReference?: 'male' | 'female'
): BMREquation {
  if (bmrBiologicalReference === 'male' || (!bmrBiologicalReference && gender === 'male')) {
    return 'mifflin_st_jeor_male';
  }
  if (bmrBiologicalReference === 'female' || (!bmrBiologicalReference && gender === 'female')) {
    return 'mifflin_st_jeor_female';
  }
  return 'mifflin_st_jeor_midpoint_approximation';
}

/**
 * Calculates Total Daily Energy Expenditure (TDEE) from BMR estimate and activity level multiplier.
 */
export function calculateTDEE(bmr: number, activityLevel: ActivityLevel = 'moderately_active'): number {
  const safeBmr = Math.max(500, Number.isFinite(bmr) ? bmr : 1600);
  const multiplier = PAL_MULTIPLIERS[activityLevel] ?? PAL_MULTIPLIERS.moderately_active;
  return Math.round(safeBmr * multiplier);
}

/**
 * Calculates recommended daily caloric intake based on TDEE, goal, rate, and clinical guidance thresholds.
 *
 * Note: 1,500 kcal (male) and 1,200 kcal (female) are conventional non-supervised clinical heuristic thresholds,
 * but they are NOT universal safety guarantees against nutritional deficiencies or metabolic adaptation.
 */
export function calculateCaloricTarget(
  tdee: number,
  primaryGoal: PrimaryGoal = 'general_health',
  weeklyGoalRate: WeeklyGoalRate = 'moderate',
  gender: Gender = 'unspecified',
  age?: number
): { target: number; delta: number; requiresProfessionalReview: boolean; warnings: string[] } {
  const warnings: string[] = [];
  const safeTdee = Math.max(800, Number.isFinite(tdee) ? tdee : 2000);

  // Adolescent safety: zero deficit
  if (age !== undefined && age < 18) {
    return {
      target: safeTdee,
      delta: 0,
      requiresProfessionalReview: true,
      warnings: ['Caloric deficit disallowed for users under 18 without specialist guidance.'],
    };
  }

  const delta = GOAL_CALORIE_DELTAS[primaryGoal]?.[weeklyGoalRate] ?? 0;
  const rawTarget = safeTdee + delta;

  // Conventional non-supervised clinical floors
  const minimumCalorieFloor = gender === 'male' ? 1500 : 1200;
  const finalTarget = Math.max(minimumCalorieFloor, Math.round(rawTarget));

  let requiresProfessionalReview = false;
  if (primaryGoal === 'weight_loss' && (weeklyGoalRate === 'aggressive' || Math.abs(delta) > 500)) {
    requiresProfessionalReview = true;
    warnings.push('Aggressive calorie deficit requires professional monitoring.');
  }

  if (rawTarget < minimumCalorieFloor) {
    warnings.push(
      `Calculated target fell below conventional non-supervised threshold (${minimumCalorieFloor} kcal/day). Target was clamped to threshold; clinical supervision is recommended.`
    );
    requiresProfessionalReview = true;
  }

  return {
    target: finalTarget,
    delta: finalTarget - safeTdee,
    requiresProfessionalReview,
    warnings,
  };
}

/**
 * Calculates macronutrient distribution based on daily calories, bodyweight, diet style, and goal.
 *
 * Atwater Energy Factors:
 * - Protein: 4 kcal/g
 * - Carbohydrate: 4 kcal/g
 * - Fat: 9 kcal/g
 *
 * Reconciles macros with total calories within whole-gram integer rounding tolerance (<= 4 kcal).
 * Explicitly flags impossible diet constraints (e.g. high-protein + keto on low calories).
 * Never emits negative carbohydrates.
 */
export function calculateMacroTargets(
  calories: number,
  weightKg: number,
  dietaryPreference: DietaryPreference = 'standard',
  primaryGoal: PrimaryGoal = 'general_health'
): MacroTargetResult {
  const safeCalories = Math.max(800, Number.isFinite(calories) ? calories : 2000);
  const safeWeight = Math.max(30, Number.isFinite(weightKg) && weightKg > 0 ? weightKg : 70);

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

  let proteinGrams = Math.max(50, Math.round(safeWeight * proteinPerKg));
  let proteinKcal = proteinGrams * 4;

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

  let fatGrams = Math.max(30, Math.round((safeCalories * fatKcalPercentage) / 9));
  let fatKcal = fatGrams * 9;

  let dietConstraintSatisfied = true;
  let conflictWarning: string | undefined;

  // 3. Mathematical conflict resolution: Check if Protein + Fat exceeds total calories
  if (proteinKcal + fatKcal > safeCalories) {
    dietConstraintSatisfied = false;
    conflictWarning =
      'The requested combination of caloric intake, body weight, and dietary preferences cannot be mathematically satisfied without exceeding total calories. High protein and fat have been proportionally adjusted, with zero negative carbohydrate.';

    // Keep protein at essential floor, scale fat to fit remaining calories
    const maxAllowedFatKcal = safeCalories - proteinKcal;
    if (maxAllowedFatKcal >= 270) {
      // At least 30g fat
      fatGrams = Math.floor(maxAllowedFatKcal / 9);
      fatKcal = fatGrams * 9;
    } else {
      // Extremely low caloric ceiling: scale both proportionally while guarding safe minimums
      const ratio = safeCalories / (proteinKcal + fatKcal);
      proteinGrams = Math.max(30, Math.round(proteinGrams * ratio));
      proteinKcal = proteinGrams * 4;
      fatGrams = Math.max(20, Math.floor((safeCalories - proteinKcal) / 9));
      fatKcal = fatGrams * 9;
    }
  }

  // 4. Carbohydrate calculation (strictly non-negative)
  let carbsGrams: number;
  if (dietaryPreference === 'keto') {
    // Strictly capped at ~35g or 5% of calories
    carbsGrams = Math.min(35, Math.max(0, Math.round((safeCalories * 0.05) / 4)));
  } else {
    const remainingKcal = safeCalories - (proteinKcal + fatKcal);
    carbsGrams = Math.max(0, Math.round(remainingKcal / 4));
  }

  // 5. Rounding reconciliation: ensure sum of macros matches safeCalories within whole-gram tolerance
  let totalMacroCalories = proteinGrams * 4 + carbsGrams * 4 + fatGrams * 9;
  let reconciliationDiff = Math.abs(safeCalories - totalMacroCalories);

  // For non-keto diets, adjust carbohydrates by 1g if integer rounding discrepancy is 1-4 kcal
  if (dietaryPreference !== 'keto' && reconciliationDiff > 0 && reconciliationDiff <= 4 && carbsGrams > 0) {
    const diff = safeCalories - totalMacroCalories;
    if (diff > 0 && diff >= 3) {
      carbsGrams += 1;
    } else if (diff < 0 && diff <= -3 && carbsGrams > 1) {
      carbsGrams -= 1;
    }
    totalMacroCalories = proteinGrams * 4 + carbsGrams * 4 + fatGrams * 9;
    reconciliationDiff = Math.abs(safeCalories - totalMacroCalories);
  }

  return {
    protein: proteinGrams,
    carbs: carbsGrams,
    fats: fatGrams,
    reconciliationDiff,
    dietConstraintSatisfied,
    warning: conflictWarning,
  };
}

/**
 * Calculates recommended baseline hydration target (liters/day).
 * Labeled as a general reference estimate (35 ml/kg body weight).
 */
export function calculateWaterRecommendation(weightKg: number): number {
  const safeWeight = Math.max(30, Number.isFinite(weightKg) && weightKg > 0 ? weightKg : 70);
  const liters = (safeWeight * 35) / 1000;
  return Math.round(Math.min(4.5, Math.max(2.0, liters)) * 10) / 10;
}

/**
 * Calculates recommended nightly sleep duration (hours).
 * Labeled as a general adult reference estimate based on National Sleep Foundation guidelines.
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
 * Computes full clinically bounded recommendations for a UserProfile.
 * Enforces adult eligibility, transparent equation labeling, and macro reconciliation.
 */
export function calculateFullRecommendation(profile: UserProfile): ProfileRecommendations {
  const eligibility = validateProfileEligibility(profile);
  const warnings = [...eligibility.warnings];

  const waterDisclaimer =
    'Hydration recommendations are general reference estimates (35 ml/kg). Fluid requirements vary based on sweating, climate, physical activity, medications, and renal or cardiovascular health. Individuals with medical fluid restrictions must follow their physician’s guidance.';
  const sleepDisclaimer =
    'Sleep recommendations are general adult guidelines (7–9 hours per National Sleep Foundation). Recovery demands vary with training volume and life stress.';

  // If user is an adolescent, do not calculate adult caloric deficit!
  if (eligibility.status === 'unsupported_adolescent') {
    return {
      status: 'unsupported_adolescent',
      isEligible: false,
      warnings,
      bmr: 0,
      tdee: 0,
      recommendedCalories: profile.targetCalories ?? 2000,
      recommendedProtein: profile.targetProtein ?? 140,
      recommendedCarbs: profile.targetCarbs ?? 200,
      recommendedFats: profile.targetFats ?? 65,
      calorieDelta: 0,
      waterIntakeLiters: calculateWaterRecommendation(profile.weightKg ?? 70),
      sleepHours: calculateSleepRecommendation(profile.activityLevel ?? 'moderately_active'),
      bmrEquationUsed: resolveBMREquation(profile.gender, profile.bmrBiologicalReference),
      isEstimate: true,
      macroReconciliationDiff: 0,
      requiresProfessionalReview: true,
      dietConstraintSatisfied: true,
      waterDisclaimer,
      sleepDisclaimer,
    };
  }

  const bmrEquationUsed = resolveBMREquation(profile.gender, profile.bmrBiologicalReference);
  if (bmrEquationUsed === 'mifflin_st_jeor_midpoint_approximation') {
    warnings.push(
      'BMR uses an unvalidated arithmetic midpoint approximation (-78) for unspecified/other biological parameters. For higher accuracy, an explicit biological reference equation may be selected.'
    );
  }

  const bmr = calculateBMR(
    profile.weightKg ?? 70,
    profile.heightCm ?? 170,
    profile.age ?? 28,
    profile.gender ?? 'unspecified',
    profile.bmrBiologicalReference
  );

  const tdee = calculateTDEE(bmr, profile.activityLevel ?? 'moderately_active');

  const caloricResult = calculateCaloricTarget(
    tdee,
    profile.primaryGoal ?? 'general_health',
    profile.weeklyGoalRate ?? 'moderate',
    profile.gender ?? 'unspecified',
    profile.age
  );

  if (caloricResult.warnings.length > 0) {
    warnings.push(...caloricResult.warnings);
  }

  const macroResult = calculateMacroTargets(
    caloricResult.target,
    profile.weightKg ?? 70,
    profile.dietaryPreference ?? 'standard',
    profile.primaryGoal ?? 'general_health'
  );

  if (macroResult.warning) {
    warnings.push(macroResult.warning);
  }

  const waterIntakeLiters = calculateWaterRecommendation(profile.weightKg ?? 70);
  const sleepHours = calculateSleepRecommendation(profile.activityLevel ?? 'moderately_active');

  return {
    status: eligibility.status,
    isEligible: eligibility.isEligible,
    warnings,
    bmr,
    tdee,
    recommendedCalories: caloricResult.target,
    recommendedProtein: macroResult.protein,
    recommendedCarbs: macroResult.carbs,
    recommendedFats: macroResult.fats,
    calorieDelta: caloricResult.delta,
    waterIntakeLiters,
    sleepHours,
    bmrEquationUsed,
    isEstimate: true,
    macroReconciliationDiff: macroResult.reconciliationDiff,
    requiresProfessionalReview: caloricResult.requiresProfessionalReview || !macroResult.dietConstraintSatisfied,
    dietConstraintSatisfied: macroResult.dietConstraintSatisfied,
    waterDisclaimer,
    sleepDisclaimer,
  };
}

/**
 * Checks whether user has manually overridden calorie or macro targets from calculated recommendations.
 * Prevents automated silent overwrites of user-configured targets.
 */
export function isCustomTargetsOverridden(profile: UserProfile): boolean {
  if (profile.calculationOverridden) {
    return true;
  }

  const rec = calculateFullRecommendation(profile);

  // If user is ineligible (e.g. adolescent), do not consider overridden based on adult calculator
  if (!rec.isEligible) {
    return false;
  }

  // If stored targets differ by more than rounding tolerance (10 kcal / 3g macros), consider overridden
  const calorieDiff = Math.abs((profile.targetCalories ?? 0) - rec.recommendedCalories);
  const proteinDiff = Math.abs((profile.targetProtein ?? 0) - rec.recommendedProtein);
  const carbsDiff = Math.abs((profile.targetCarbs ?? 0) - rec.recommendedCarbs);
  const fatsDiff = Math.abs((profile.targetFats ?? 0) - rec.recommendedFats);

  return calorieDiff > 10 || proteinDiff > 3 || carbsDiff > 3 || fatsDiff > 3;
}
