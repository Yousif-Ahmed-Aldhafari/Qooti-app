import type { DailyNutritionSummary, Meal, MealItem, ProgressEntry, Workout } from '../types';
import type { Language } from '../models/settings';
import { formatShortWeekday, getCalendarDateRange } from './date';
import type { EffectiveNutritionTargets, TargetSource, TargetState } from './nutritionTargets';

export function calculateMealTotals(items: MealItem[]): DailyNutritionSummary {
  return (items || []).reduce(
    (totals, item) => {
      const itemFats = safeNumber(item.fats ?? item.fat);
      const newFats = totals.fats + itemFats;
      return {
        calories: totals.calories + safeNumber(item.calories),
        protein: totals.protein + safeNumber(item.protein),
        carbs: totals.carbs + safeNumber(item.carbs),
        fats: newFats,
        fat: newFats,
      };
    },
    { calories: 0, protein: 0, carbs: 0, fats: 0, fat: 0 },
  );
}

export function calculateDailyNutrition(meals: Meal[]): DailyNutritionSummary {
  return (meals || []).reduce(
    (totals, meal) => {
      const mealTotals =
        meal.items && meal.items.length > 0
          ? calculateMealTotals(meal.items)
          : {
              calories: safeNumber(meal.totalCalories),
              protein: safeNumber(meal.totalProtein),
              carbs: safeNumber(meal.totalCarbs),
              fats: safeNumber(meal.totalFat ?? meal.totalFats),
              fat: safeNumber(meal.totalFat ?? meal.totalFats),
            };
      const newFats = totals.fats + mealTotals.fats;
      return {
        calories: totals.calories + mealTotals.calories,
        protein: totals.protein + mealTotals.protein,
        carbs: totals.carbs + mealTotals.carbs,
        fats: newFats,
        fat: newFats,
      };
    },
    { calories: 0, protein: 0, carbs: 0, fats: 0, fat: 0 },
  );
}

export function workoutMinutes(workouts: Workout[]): number {
  return (workouts || []).reduce(
    (sum, workout) => sum + (workout.exercises || []).reduce((total, exercise) => total + safeNumber(exercise.duration), 0),
    0,
  );
}

export function progressRatio(value: number, target: number): number {
  const safeTarget = safeNumber(target);

  if (safeTarget <= 0) {
    return 0;
  }

  return Math.min(1, Math.max(0, safeNumber(value) / safeTarget));
}

export function estimateWeightGainKg(calorieSurplus: number): number {
  const safeSurplus = safeNumber(calorieSurplus);
  return safeSurplus > 0 ? safeSurplus / 7700 : 0;
}

export function formatWeightGainKg(kg: number, unit = 'kg'): string {
  const safeKg = Math.max(safeNumber(kg), 0);
  return safeKg > 0 ? `+${safeKg.toFixed(2)} ${unit}` : `0.00 ${unit}`;
}

export function safeNumber(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

export interface DailyNutritionSummaryResult {
  date: string;
  mealCount: number;
  loggedFoodCount: number;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  hasLoggedMeals: boolean;
  dataQualityFlags: string[];
}

/**
 * Pure, authoritative daily nutrition aggregator.
 * - Filters strictly by selected local calendar date (YYYY-MM-DD).
 * - Excludes undated and missing-date meals.
 * - Aggregates stored nutrient snapshots without recalculating or re-scaling.
 * - Handles both multi-food items and itemless legacy meals.
 * - Flags invalid numeric values (NaN, Infinity, negative) and sanitizes safely.
 * - Distinguishes between zero measured intake and no logged meals.
 */
export function getDailyNutritionSummary(
  meals: Meal[] | undefined | null,
  selectedDate: string
): DailyNutritionSummaryResult {
  const targetDate = (selectedDate || '').trim();
  const dataQualityFlags: string[] = [];

  function checkAndSanitize(val: unknown, fieldName: string): number {
    if (typeof val !== 'number' || !Number.isFinite(val)) {
      const flag = `INVALID_${fieldName.toUpperCase()}`;
      if (!dataQualityFlags.includes(flag)) {
        dataQualityFlags.push(flag);
      }
      return 0;
    }
    if (val < 0) {
      const flag = `NEGATIVE_${fieldName.toUpperCase()}`;
      if (!dataQualityFlags.includes(flag)) {
        dataQualityFlags.push(flag);
      }
      return 0;
    }
    return val;
  }

  if (!meals || meals.length === 0 || !targetDate) {
    return {
      date: targetDate,
      mealCount: 0,
      loggedFoodCount: 0,
      calories: 0,
      protein: 0,
      carbs: 0,
      fats: 0,
      hasLoggedMeals: false,
      dataQualityFlags,
    };
  }

  // Filter strictly for the active date (excluding undated meals)
  const mealsOnDate = meals.filter((m) => {
    if (!m.date || typeof m.date !== 'string') return false;
    const trimmed = m.date.trim();
    if (!trimmed) return false;
    return trimmed.slice(0, 10) === targetDate;
  });

  if (mealsOnDate.length === 0) {
    return {
      date: targetDate,
      mealCount: 0,
      loggedFoodCount: 0,
      calories: 0,
      protein: 0,
      carbs: 0,
      fats: 0,
      hasLoggedMeals: false,
      dataQualityFlags,
    };
  }

  let totalCalories = 0;
  let totalProtein = 0;
  let totalCarbs = 0;
  let totalFats = 0;
  let loggedFoodCount = 0;

  for (const meal of mealsOnDate) {
    if (meal.items && meal.items.length > 0) {
      loggedFoodCount += meal.items.length;
      for (const item of meal.items) {
        totalCalories += checkAndSanitize(item.calories, 'calories');
        totalProtein += checkAndSanitize(item.protein, 'protein');
        totalCarbs += checkAndSanitize(item.carbs, 'carbs');
        totalFats += checkAndSanitize(item.fats ?? item.fat, 'fats');
      }
    } else {
      // Legacy itemless meal fallback
      const cal = checkAndSanitize(meal.totalCalories, 'calories');
      const prot = checkAndSanitize(meal.totalProtein, 'protein');
      const carb = checkAndSanitize(meal.totalCarbs, 'carbs');
      const fat = checkAndSanitize(meal.totalFat ?? meal.totalFats, 'fats');
      if (cal > 0 || prot > 0 || carb > 0 || fat > 0) {
        loggedFoodCount += 1;
      }
      totalCalories += cal;
      totalProtein += prot;
      totalCarbs += carb;
      totalFats += fat;
    }
  }

  return {
    date: targetDate,
    mealCount: mealsOnDate.length,
    loggedFoodCount,
    calories: totalCalories,
    protein: totalProtein,
    carbs: totalCarbs,
    fats: totalFats,
    hasLoggedMeals: true,
    dataQualityFlags,
  };
}

export interface TargetProgressItem {
  consumed: number;
  target: number | null;
  rawRatio: number | null;
  boundedRatio: number | null;
  isExceeded: boolean;
  isReached: boolean;
  remaining: number | null;
  overage: number | null;
  hasTarget: boolean;
}

export interface NutritionTargetProgress {
  hasActiveTarget: boolean;
  state: TargetState;
  source: TargetSource;
  isCustomOverride: boolean;
  calories: TargetProgressItem;
  protein: TargetProgressItem;
  carbs: TargetProgressItem;
  fats: TargetProgressItem;
}

/**
 * Calculates accessible progress metrics against authoritative nutrition targets.
 * - Returns raw ratios for textual display and bounded (0..1) ratios for visual progress bars.
 * - Respects target authorization states; does NOT fabricate progress when hasActiveTarget is false.
 * - Handles custom overrides where individual macro targets might not be specified.
 * - Exposes neutral, non-judgmental remaining and overage values.
 */
export function calculateNutritionTargetProgress(
  intake: { calories: number; protein: number; carbs: number; fats: number; hasLoggedMeals?: boolean },
  effectiveTargets: EffectiveNutritionTargets
): NutritionTargetProgress {
  const hasActive = effectiveTargets.hasActiveTarget === true;

  function buildProgressItem(consumedVal: number, targetVal: number | null | undefined): TargetProgressItem {
    const consumed = Math.max(0, safeNumber(consumedVal));
    if (!hasActive || targetVal == null || !Number.isFinite(targetVal) || targetVal <= 0) {
      return {
        consumed,
        target: null,
        rawRatio: null,
        boundedRatio: null,
        isExceeded: false,
        isReached: false,
        remaining: null,
        overage: null,
        hasTarget: false,
      };
    }

    const target = targetVal;
    const rawRatio = target > 0 ? consumed / target : null;
    const boundedRatio = rawRatio !== null ? Math.min(1, Math.max(0, rawRatio)) : null;
    const isReached = consumed >= target;
    const isExceeded = consumed > target;
    const remaining = Math.max(0, target - consumed);
    const overage = Math.max(0, consumed - target);

    return {
      consumed,
      target,
      rawRatio,
      boundedRatio,
      isExceeded,
      isReached,
      remaining,
      overage,
      hasTarget: true,
    };
  }

  const calorieTarget = hasActive
    ? (effectiveTargets.rawCalories ?? effectiveTargets.calories)
    : null;

  // In custom override mode, only evaluate macro targets that the user explicitly configured
  const proteinTarget = hasActive
    ? (effectiveTargets.isCustomOverride ? effectiveTargets.rawProtein : (effectiveTargets.rawProtein ?? effectiveTargets.protein))
    : null;

  const carbsTarget = hasActive
    ? (effectiveTargets.isCustomOverride ? effectiveTargets.rawCarbs : (effectiveTargets.rawCarbs ?? effectiveTargets.carbs))
    : null;

  const fatsTarget = hasActive
    ? (effectiveTargets.isCustomOverride ? effectiveTargets.rawFats : (effectiveTargets.rawFats ?? effectiveTargets.fats))
    : null;

  return {
    hasActiveTarget: hasActive,
    state: effectiveTargets.state,
    source: effectiveTargets.source,
    isCustomOverride: effectiveTargets.isCustomOverride,
    calories: buildProgressItem(intake.calories, calorieTarget),
    protein: buildProgressItem(intake.protein, proteinTarget),
    carbs: buildProgressItem(intake.carbs, carbsTarget),
    fats: buildProgressItem(intake.fats, fatsTarget),
  };
}

export interface MacroDistribution {
  proteinKcal: number;
  carbsKcal: number;
  fatsKcal: number;
  totalMacroKcal: number;
  proteinPct: number;
  carbsPct: number;
  fatsPct: number;
  rawProteinPct: number;
  rawCarbsPct: number;
  rawFatsPct: number;
  loggedCalories: number;
  calorieDifference: number;
}

/**
 * Computes macronutrient energy distribution using Atwater general factors:
 * Protein: 4 kcal/g, Carbohydrates: 4 kcal/g, Fats: 9 kcal/g.
 * - Handles zero macro-energy safely (all percentages 0).
 * - Ensures integer percentages sum cleanly to 100% when total macro energy > 0.
 * - Preserves independence between logged food calories and derived macro calories.
 */
export function calculateMacroDistribution(intake: {
  protein: number;
  carbs: number;
  fats: number;
  calories?: number;
}): MacroDistribution {
  const protGrams = Math.max(0, safeNumber(intake.protein));
  const carbGrams = Math.max(0, safeNumber(intake.carbs));
  const fatGrams = Math.max(0, safeNumber(intake.fats));
  const loggedCal = Math.max(0, safeNumber(intake.calories));

  const proteinKcal = protGrams * 4;
  const carbsKcal = carbGrams * 4;
  const fatsKcal = fatGrams * 9;
  const totalMacroKcal = proteinKcal + carbsKcal + fatsKcal;

  if (totalMacroKcal <= 0) {
    return {
      proteinKcal: 0,
      carbsKcal: 0,
      fatsKcal: 0,
      totalMacroKcal: 0,
      proteinPct: 0,
      carbsPct: 0,
      fatsPct: 0,
      rawProteinPct: 0,
      rawCarbsPct: 0,
      rawFatsPct: 0,
      loggedCalories: loggedCal,
      calorieDifference: loggedCal,
    };
  }

  const rawProteinPct = (proteinKcal / totalMacroKcal) * 100;
  const rawCarbsPct = (carbsKcal / totalMacroKcal) * 100;
  const rawFatsPct = (fatsKcal / totalMacroKcal) * 100;

  // Genuine largest-remainder method (Hamilton-Hare method)
  // 1. Take integer floor of each raw percentage
  const floorP = Math.floor(rawProteinPct);
  const floorC = Math.floor(rawCarbsPct);
  const floorF = Math.floor(rawFatsPct);

  // 2. Compute fractional remainders
  const remainderP = rawProteinPct - floorP;
  const remainderC = rawCarbsPct - floorC;
  const remainderF = rawFatsPct - floorF;

  // 3. Compute unassigned percentage points
  const assigned = floorP + floorC + floorF;
  let unassignedPoints = 100 - assigned;

  // 4. Distribute unassigned points by descending fractional remainder
  // Deterministic tie-breaking priority: Protein (1), Carbs (2), Fats (3)
  const items = [
    { key: 'protein', remainder: remainderP, order: 1 },
    { key: 'carbs', remainder: remainderC, order: 2 },
    { key: 'fats', remainder: remainderF, order: 3 },
  ];

  items.sort((a, b) => {
    const diff = b.remainder - a.remainder;
    if (Math.abs(diff) > 1e-9) {
      return diff;
    }
    return a.order - b.order;
  });

  const finalPercentages: Record<string, number> = {
    protein: floorP,
    carbs: floorC,
    fats: floorF,
  };

  for (let i = 0; i < items.length && unassignedPoints > 0; i++) {
    finalPercentages[items[i].key] += 1;
    unassignedPoints -= 1;
  }

  const p = finalPercentages.protein;
  const c = finalPercentages.carbs;
  const f = finalPercentages.fats;

  return {
    proteinKcal,
    carbsKcal,
    fatsKcal,
    totalMacroKcal,
    proteinPct: Math.max(0, p),
    carbsPct: Math.max(0, c),
    fatsPct: Math.max(0, f),
    rawProteinPct,
    rawCarbsPct,
    rawFatsPct,
    loggedCalories: loggedCal,
    calorieDifference: loggedCal - totalMacroKcal,
  };
}

/**
 * Canonical model for a single calendar day in the 7-day nutrition trend chart.
 */
export interface NutritionChartDay {
  date: string; // YYYY-MM-DD
  label: string; // Localized short weekday e.g. 'Mon', 'Tue' or 'الإثنين'
  calories: number; // Real aggregated meal intake calories (0 if unlogged or 0 kcal logged)
  hasLogs: boolean; // True if >= 1 meal was logged on this calendar date
  isUnavailable: boolean; // True if meal history is unavailable (meals === undefined)
  progressEntry?: ProgressEntry; // Original progress entry matching this date, if any
}

/**
 * Summary metrics computed strictly over the 7-day nutrition chart days.
 */
export interface WeeklyNutritionTrendSummary {
  days: NutritionChartDay[];
  averageCalories: number | null; // Average intake strictly across days with logged meals
  loggedDaysCount: number;
  totalCalories: number;
  isUnavailable: boolean;
  maxCalories: number;
}

/**
 * Builds an explicit, testable 7-day calendar series ending on the specified reference date.
 * - Always generates 7 consecutive local calendar days using date helpers (never UTC slicing).
 * - Aggregates persisted meals independently for each date without requiring progress_entries.
 * - Distinguishes unlogged days (hasLogs: false) from days with recorded zero calories (hasLogs: true, calories: 0).
 * - Excludes undated legacy meals (date: '') without mutating or deleting them.
 * - Preserves itemless legacy meal totals via getDailyNutritionSummary.
 * - Never double-scales food snapshots.
 * - Leaves authoritative workout and weight data in original progressEntries intact.
 */
export function buildWeeklyNutritionChartDays(
  referenceDate: string,
  meals: Meal[] | undefined,
  progressEntries: ProgressEntry[] = [],
  language: Language = 'en'
): NutritionChartDay[] {
  const dates = getCalendarDateRange(referenceDate, 7);
  const isUnavailable = meals === undefined;

  return dates.map((dateStr) => {
    const label = formatShortWeekday(dateStr, language);
    const matchingProgress = progressEntries.find(
      (p) => p.date === dateStr || p.label === dateStr
    );

    if (isUnavailable) {
      return {
        date: dateStr,
        label: matchingProgress?.label || label,
        calories: 0,
        hasLogs: false,
        isUnavailable: true,
        progressEntry: matchingProgress,
      };
    }

    const summary = getDailyNutritionSummary(meals, dateStr);
    const hasLogs = summary.hasLoggedMeals;
    const calories = hasLogs ? summary.calories : 0;

    return {
      date: dateStr,
      label: matchingProgress?.label || label,
      calories,
      hasLogs,
      isUnavailable: false,
      progressEntry: matchingProgress,
    };
  });
}

/**
 * Computes weekly trend summary strictly from authoritative chart days.
 * - Calculates average intake ONLY across days where hasLogs === true.
 * - Distinguishes unlogged days from recorded 0.
 * - Returns averageCalories: null when no days have logs or when meal data is unavailable.
 */
export function calculateWeeklyNutritionTrend(
  days: NutritionChartDay[]
): WeeklyNutritionTrendSummary {
  const isUnavailable = days.length > 0 && days.every((d) => d.isUnavailable);
  if (isUnavailable) {
    return {
      days,
      averageCalories: null,
      loggedDaysCount: 0,
      totalCalories: 0,
      isUnavailable: true,
      maxCalories: 1,
    };
  }

  const loggedDays = days.filter((d) => d.hasLogs);
  const totalCalories = loggedDays.reduce((sum, d) => sum + d.calories, 0);
  const averageCalories = loggedDays.length > 0 ? Math.round(totalCalories / loggedDays.length) : null;
  const maxCalories = Math.max(...days.map((d) => d.calories), 1);

  return {
    days,
    averageCalories,
    loggedDaysCount: loggedDays.length,
    totalCalories,
    isUnavailable: false,
    maxCalories,
  };
}

export interface StrictParseResult {
  isValid: boolean;
  value: number;
  isEmpty: boolean;
  error?: 'EMPTY' | 'INVALID_CHARACTERS' | 'INVALID_DECIMAL' | 'OVERFLOW' | 'NEGATIVE' | 'ZERO' | 'NON_FINITE';
  errorMessageKey?: string;
  defaultMessage?: string;
}

export interface StrictParseOptions {
  allowEmpty?: boolean;
  defaultValue?: number;
  allowZero?: boolean;
  max?: number;
}

/**
 * Strict parser for nutrient inputs and quantities.
 * - Rejects NaN, Infinity, -Infinity.
 * - Rejects non-numeric characters, scientific notation (e.g. 1e50), extra signs, and malformed decimals.
 * - Supports both '.' and ',' as decimal separators.
 * - Enforces non-negative values and bounds checking.
 * - Distinguishes between empty fields and explicit 0.
 */
export function parseStrictNutrientInput(
  input: string | number | undefined | null,
  options: StrictParseOptions = {}
): StrictParseResult {
  const {
    allowEmpty = false,
    defaultValue = 0,
    allowZero = true,
    max = 100_000,
  } = options;

  if (input === undefined || input === null) {
    if (allowEmpty) {
      return { isValid: true, value: defaultValue, isEmpty: true };
    }
    return {
      isValid: false,
      value: 0,
      isEmpty: true,
      error: 'EMPTY',
      errorMessageKey: 'common.requiredMessage',
      defaultMessage: 'Required',
    };
  }

  const str = typeof input === 'number' ? String(input) : String(input).trim();

  if (str === '') {
    if (allowEmpty) {
      return { isValid: true, value: defaultValue, isEmpty: true };
    }
    return {
      isValid: false,
      value: 0,
      isEmpty: true,
      error: 'EMPTY',
      errorMessageKey: 'common.requiredMessage',
      defaultMessage: 'Required',
    };
  }

  // Reject literal "Infinity", "-Infinity", "NaN" (case-insensitive)
  const lower = str.toLowerCase();
  if (lower.includes('infinity') || lower === 'nan') {
    return {
      isValid: false,
      value: 0,
      isEmpty: false,
      error: 'NON_FINITE',
      errorMessageKey: 'common.invalidNumber',
      defaultMessage: 'Invalid number',
    };
  }

  // Strictly enforce decimal format with either '.' or ',' as separator.
  // Rejects scientific notation (e.g. 1e50), extra signs, mixed letters, malformed decimals.
  const decimalRegex = /^[+-]?((\d+([.,]\d+)?)|([.,]\d+))$/;
  if (!decimalRegex.test(str)) {
    return {
      isValid: false,
      value: 0,
      isEmpty: false,
      error: 'INVALID_CHARACTERS',
      errorMessageKey: 'common.invalidNumber',
      defaultMessage: 'Invalid number',
    };
  }

  const normalizedStr = str.replace(',', '.');
  const num = Number(normalizedStr);

  if (!Number.isFinite(num) || Number.isNaN(num)) {
    return {
      isValid: false,
      value: 0,
      isEmpty: false,
      error: 'NON_FINITE',
      errorMessageKey: 'common.invalidNumber',
      defaultMessage: 'Invalid number',
    };
  }

  if (num < 0) {
    return {
      isValid: false,
      value: num,
      isEmpty: false,
      error: 'NEGATIVE',
      errorMessageKey: 'common.cannotBeNegative',
      defaultMessage: 'Cannot be negative',
    };
  }

  if (!allowZero && num === 0) {
    return {
      isValid: false,
      value: 0,
      isEmpty: false,
      error: 'ZERO',
      errorMessageKey: 'common.mustBePositive',
      defaultMessage: 'Must be greater than 0',
    };
  }

  if (num > max) {
    return {
      isValid: false,
      value: num,
      isEmpty: false,
      error: 'OVERFLOW',
      errorMessageKey: 'common.valueTooLarge',
      defaultMessage: 'Value is too large',
    };
  }

  return {
    isValid: true,
    value: num,
    isEmpty: false,
  };
}

/**
 * Strict parser for food quantity (must be > 0, cannot be empty).
 */
export function parseStrictQuantity(input: string | number | undefined | null): StrictParseResult {
  return parseStrictNutrientInput(input, {
    allowEmpty: false,
    allowZero: false,
    max: 100_000,
  });
}

/**
 * Strict parser for nutrient macros and calories (can be 0, can default to 0 if empty).
 */
export function parseStrictNutrient(
  input: string | number | undefined | null,
  options?: { allowEmpty?: boolean; max?: number }
): StrictParseResult {
  return parseStrictNutrientInput(input, {
    allowEmpty: options?.allowEmpty ?? true,
    defaultValue: 0,
    allowZero: true,
    max: options?.max ?? 100_000,
  });
}

export function parseInputNumber(value: string): number {
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Formats a Date object to YYYY-MM-DD using local calendar date.
 * Avoids UTC boundary shifts in UTC+3 or other non-UTC timezones.
 */
export function formatLocalDate(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Formats a Date object to 24-hr HH:mm format using local hours and minutes.
 */
export function formatLocalTime(date: Date = new Date()): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
