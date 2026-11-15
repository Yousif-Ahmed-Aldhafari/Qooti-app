import type { DailyNutritionSummary, Meal, MealItem, Workout } from '../types';

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
