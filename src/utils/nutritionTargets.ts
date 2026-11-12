/**
 * Shared Nutrition Target Resolution Layer
 * Authoritative single resolver for effective daily calorie and macronutrient targets.
 * Resolves precedence between custom user overrides and algorithmic recommendations,
 * and handles unconfirmed, unsupported, and conflicting states safely.
 */

import type { UserProfile } from '../models/profile';
import {
  calculateFullRecommendation,
  type ProfileRecommendations,
} from './personalization';

export type TargetState =
  | 'ready'
  | 'unconfirmed'
  | 'unsupported'
  | 'conflicting'
  | 'invalid'
  | 'missing';

export type TargetSource =
  | 'custom_override'
  | 'recommended_estimate'
  | 'unconfirmed_estimate'
  | 'unsupported_adolescent'
  | 'conflicting_constraints'
  | 'fallback_default'
  | 'none';

export type SetupPromptInfo = {
  type: 'unconfirmed' | 'unsupported_adolescent' | 'conflicting_constraints' | 'invalid_custom' | 'missing';
  titleKey: string;
  messageKey: string;
  actionKey?: string;
};

export type EffectiveNutritionTargets = {
  state: TargetState;
  source: TargetSource;
  hasActiveTarget: boolean;
  hasApprovedTarget: boolean;
  isCustomOverride: boolean;
  // Mathematical values: always safe finite positive numbers (safe fallback for progress math)
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  // Raw values: null if state is not authorized (unsupported, conflicting, unconfirmed, missing)
  rawCalories: number | null;
  rawProtein: number | null;
  rawCarbs: number | null;
  rawFats: number | null;
  bmr: number | null;
  tdee: number | null;
  warnings: string[];
  setupPrompt?: SetupPromptInfo;
  recommendation?: ProfileRecommendations;
};

const SAFE_FALLBACK_TARGETS = {
  calories: 2000,
  protein: 140,
  carbs: 200,
  fats: 65,
} as const;

/**
 * Resolves the single authoritative effective nutrition targets for the active profile.
 * Consuming screens (Home, Meals, Progress, Profile) must use this resolver to guarantee
 * consistent numbers and adhere to safety contracts.
 */
export function resolveEffectiveNutritionTargets(
  profile?: UserProfile | null
): EffectiveNutritionTargets {
  // 1. Missing or undefined profile
  if (!profile) {
    return {
      state: 'missing',
      source: 'none',
      hasActiveTarget: false,
      hasApprovedTarget: false,
      isCustomOverride: false,
      calories: SAFE_FALLBACK_TARGETS.calories,
      protein: SAFE_FALLBACK_TARGETS.protein,
      carbs: SAFE_FALLBACK_TARGETS.carbs,
      fats: SAFE_FALLBACK_TARGETS.fats,
      rawCalories: null,
      rawProtein: null,
      rawCarbs: null,
      rawFats: null,
      bmr: null,
      tdee: null,
      warnings: ['No user profile loaded'],
      setupPrompt: {
        type: 'missing',
        titleKey: 'personalization.unconfirmedTitle',
        messageKey: 'targets.unconfirmedPrompt',
        actionKey: 'targets.setupAction',
      },
    };
  }

  // 2. Custom Target Override takes precedence when enabled
  if (profile.calculationOverridden === true) {
    const rawCal = profile.targetCalories;
    const isValidCalories = Number.isFinite(rawCal) && rawCal > 0;

    if (!isValidCalories) {
      return {
        state: 'invalid',
        source: 'custom_override',
        hasActiveTarget: false,
        hasApprovedTarget: false,
        isCustomOverride: true,
        calories: SAFE_FALLBACK_TARGETS.calories,
        protein: SAFE_FALLBACK_TARGETS.protein,
        carbs: SAFE_FALLBACK_TARGETS.carbs,
        fats: SAFE_FALLBACK_TARGETS.fats,
        rawCalories: null,
        rawProtein: null,
        rawCarbs: null,
        rawFats: null,
        bmr: null,
        tdee: null,
        warnings: ['Custom calorie target must be a positive numerical value'],
        setupPrompt: {
          type: 'invalid_custom',
          titleKey: 'personalization.customOverrideBadge',
          messageKey: 'targets.unconfirmedPrompt',
          actionKey: 'personalization.editAttributes',
        },
      };
    }

    const backgroundRec = calculateFullRecommendation(profile);

    const rawProt = profile.targetProtein;
    const rawCarbs = profile.targetCarbs;
    const rawFats = profile.targetFats ?? profile.targetFat;

    const hasValidProt = Number.isFinite(rawProt) && rawProt >= 0;
    const hasValidCarbs = Number.isFinite(rawCarbs) && rawCarbs >= 0;
    const hasValidFats = Number.isFinite(rawFats) && rawFats >= 0;

    const warnings: string[] = [];
    if (rawCal < 1200) {
      warnings.push('Custom calorie target is below recommended physiological safety floor (1200 kcal/day).');
    } else if (rawCal > 6000) {
      warnings.push('Custom calorie target exceeds standard daily expenditure ranges.');
    }

    if (!hasValidProt || !hasValidCarbs || !hasValidFats) {
      warnings.push('Some individual macronutrient targets were missing; estimated from dietary guidelines.');
    }

    const resolvedProtein = hasValidProt
      ? Math.round(rawProt)
      : (backgroundRec.recommendedProtein ?? SAFE_FALLBACK_TARGETS.protein);
    const resolvedCarbs = hasValidCarbs
      ? Math.round(rawCarbs)
      : (backgroundRec.recommendedCarbs ?? SAFE_FALLBACK_TARGETS.carbs);
    const resolvedFats = hasValidFats
      ? Math.round(rawFats)
      : (backgroundRec.recommendedFats ?? SAFE_FALLBACK_TARGETS.fats);

    return {
      state: 'ready',
      source: 'custom_override',
      hasActiveTarget: true,
      hasApprovedTarget: true,
      isCustomOverride: true,
      calories: Math.round(rawCal),
      protein: resolvedProtein,
      carbs: resolvedCarbs,
      fats: resolvedFats,
      rawCalories: Math.round(rawCal),
      rawProtein: hasValidProt ? Math.round(rawProt) : null,
      rawCarbs: hasValidCarbs ? Math.round(rawCarbs) : null,
      rawFats: hasValidFats ? Math.round(rawFats) : null,
      bmr: backgroundRec.bmr,
      tdee: backgroundRec.tdee,
      warnings,
      recommendation: backgroundRec,
    };
  }

  // 3. Algorithmic Recommendation Resolution
  const rec = calculateFullRecommendation(profile);

  // 3A. Adolescent Profile (< 18 years): strictly unsupported
  if (rec.status === 'unsupported_adolescent' || (profile.age !== undefined && profile.age < 18)) {
    return {
      state: 'unsupported',
      source: 'unsupported_adolescent',
      hasActiveTarget: false,
      hasApprovedTarget: false,
      isCustomOverride: false,
      calories: SAFE_FALLBACK_TARGETS.calories,
      protein: SAFE_FALLBACK_TARGETS.protein,
      carbs: SAFE_FALLBACK_TARGETS.carbs,
      fats: SAFE_FALLBACK_TARGETS.fats,
      rawCalories: null,
      rawProtein: null,
      rawCarbs: null,
      rawFats: null,
      bmr: null,
      tdee: null,
      warnings: rec.professionalReviewReasons,
      setupPrompt: {
        type: 'unsupported_adolescent',
        titleKey: 'personalization.unsupportedTitle',
        messageKey: 'personalization.unsupportedAdolescent',
      },
      recommendation: rec,
    };
  }

  // 3B. Conflicting Dietary Constraints
  if (rec.status === 'impossible_diet_constraints' || !rec.dietConstraintSatisfied) {
    return {
      state: 'conflicting',
      source: 'conflicting_constraints',
      hasActiveTarget: false,
      hasApprovedTarget: false,
      isCustomOverride: false,
      calories: SAFE_FALLBACK_TARGETS.calories,
      protein: SAFE_FALLBACK_TARGETS.protein,
      carbs: SAFE_FALLBACK_TARGETS.carbs,
      fats: SAFE_FALLBACK_TARGETS.fats,
      rawCalories: null,
      rawProtein: null,
      rawCarbs: null,
      rawFats: null,
      bmr: rec.bmr,
      tdee: rec.tdee,
      warnings: rec.warnings,
      setupPrompt: {
        type: 'conflicting_constraints',
        titleKey: 'personalization.conflictingConstraintsTitle',
        messageKey: 'personalization.conflictingConstraintsNotice',
        actionKey: 'personalization.editAttributes',
      },
      recommendation: rec,
    };
  }

  // 3C. Unconfirmed Attributes
  if (rec.status === 'unconfirmed_attributes' || profile.attributesConfirmed !== true) {
    return {
      state: 'unconfirmed',
      source: 'unconfirmed_estimate',
      hasActiveTarget: false,
      hasApprovedTarget: false,
      isCustomOverride: false,
      calories: SAFE_FALLBACK_TARGETS.calories,
      protein: SAFE_FALLBACK_TARGETS.protein,
      carbs: SAFE_FALLBACK_TARGETS.carbs,
      fats: SAFE_FALLBACK_TARGETS.fats,
      rawCalories: null,
      rawProtein: null,
      rawCarbs: null,
      rawFats: null,
      bmr: rec.bmr,
      tdee: rec.tdee,
      warnings: rec.warnings,
      setupPrompt: {
        type: 'unconfirmed',
        titleKey: 'personalization.unconfirmedTitle',
        messageKey: 'personalization.unconfirmedNotice',
        actionKey: 'personalization.editAttributes',
      },
      recommendation: rec,
    };
  }

  // 3D. Fully Approved and Eligible Recommendation
  if (rec.hasApprovedTarget && rec.recommendedCalories !== null) {
    return {
      state: 'ready',
      source: 'recommended_estimate',
      hasActiveTarget: true,
      hasApprovedTarget: true,
      isCustomOverride: false,
      calories: rec.recommendedCalories,
      protein: rec.recommendedProtein ?? SAFE_FALLBACK_TARGETS.protein,
      carbs: rec.recommendedCarbs ?? SAFE_FALLBACK_TARGETS.carbs,
      fats: rec.recommendedFats ?? SAFE_FALLBACK_TARGETS.fats,
      rawCalories: rec.recommendedCalories,
      rawProtein: rec.recommendedProtein,
      rawCarbs: rec.recommendedCarbs,
      rawFats: rec.recommendedFats,
      bmr: rec.bmr,
      tdee: rec.tdee,
      warnings: rec.warnings,
      recommendation: rec,
    };
  }

  // Fallback for unexpected edge cases
  return {
    state: 'invalid',
    source: 'fallback_default',
    hasActiveTarget: false,
    hasApprovedTarget: false,
    isCustomOverride: false,
    calories: SAFE_FALLBACK_TARGETS.calories,
    protein: SAFE_FALLBACK_TARGETS.protein,
    carbs: SAFE_FALLBACK_TARGETS.carbs,
    fats: SAFE_FALLBACK_TARGETS.fats,
    rawCalories: null,
    rawProtein: null,
    rawCarbs: null,
    rawFats: null,
    bmr: null,
    tdee: null,
    warnings: ['Unable to calculate valid nutrition targets'],
    setupPrompt: {
      type: 'unconfirmed',
      titleKey: 'personalization.unconfirmedTitle',
      messageKey: 'targets.unconfirmedPrompt',
      actionKey: 'personalization.editAttributes',
    },
    recommendation: rec,
  };
}
