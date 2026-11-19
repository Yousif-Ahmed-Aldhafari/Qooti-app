/**
 * Pure portion scaling engine for Qooti.
 * Calculates exact macronutrients and calories for food items based on mass (grams)
 * and food-specific serving options without premature rounding.
 */

import { FoodCatalogEntry, ServingOption, CustomFood, FoodValidationError } from '../models/food';
import { MealItem, normalizeMealItem } from '../models/meal';
import { createId } from './id';

export type ScaledNutrients = {
  totalGrams: number;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  fat: number;
  displayCalories: number;
  displayProtein: number;
  displayCarbs: number;
  displayFats: number;
  displayFat: number;
  servingUnitId: string;
  servingUnitNameEn: string;
  servingUnitNameAr: string;
};

export class ScalingValidationError extends FoodValidationError {
  constructor(message: string, field?: string) {
    super(message, field);
    this.name = 'ScalingValidationError';
  }
}

/**
 * Bounds on numerical inputs to prevent arithmetic overflow and irrational values.
 */
export const SCALING_LIMITS = {
  MAX_QUANTITY: 10_000,
  MAX_SERVING_GRAMS: 100_000,
  MAX_TOTAL_GRAMS: 1_000_000,
  MAX_SCALED_CALORIES: 10_000_000,
  MAX_SCALED_MACROS: 1_000_000,
};

/**
 * Rounds a macronutrient value to 1 decimal place for clean display.
 */
export function roundTo1Decimal(val: number): number {
  return Math.round(val * 10) / 10;
}

/**
 * Calculates total mass in grams from a serving option and portion quantity.
 * Supports both (servingOption, quantity) and (quantity, servingOption) argument orders.
 */
export function calculateServingGrams(
  arg1: ServingOption | number,
  arg2: number | ServingOption
): number {
  let servingOption: ServingOption;
  let quantity: number;

  if (typeof arg1 === 'number') {
    quantity = arg1;
    servingOption = arg2 as ServingOption;
  } else {
    servingOption = arg1;
    quantity = arg2 as number;
  }

  if (typeof quantity !== 'number' || !Number.isFinite(quantity) || quantity <= 0) {
    throw new ScalingValidationError(
      'Portion quantity must be a positive finite number.',
      'quantity'
    );
  }
  if (quantity > SCALING_LIMITS.MAX_QUANTITY) {
    throw new ScalingValidationError(
      `Portion quantity cannot exceed ${SCALING_LIMITS.MAX_QUANTITY}.`,
      'quantity'
    );
  }

  if (
    !servingOption ||
    typeof servingOption.grams !== 'number' ||
    !Number.isFinite(servingOption.grams) ||
    servingOption.grams <= 0
  ) {
    throw new ScalingValidationError(
      'Serving option grams must be a positive finite number.',
      'grams'
    );
  }
  if (servingOption.grams > SCALING_LIMITS.MAX_SERVING_GRAMS) {
    throw new ScalingValidationError(
      `Serving option grams cannot exceed ${SCALING_LIMITS.MAX_SERVING_GRAMS}g.`,
      'grams'
    );
  }

  const totalGrams = quantity * servingOption.grams;
  if (
    !Number.isFinite(totalGrams) ||
    totalGrams <= 0 ||
    totalGrams > SCALING_LIMITS.MAX_TOTAL_GRAMS
  ) {
    throw new ScalingValidationError(
      `Calculated total mass must be a finite positive number not exceeding ${SCALING_LIMITS.MAX_TOTAL_GRAMS}g.`,
      'totalGrams'
    );
  }

  return totalGrams;
}

/**
 * Scales catalog entry nutrients by portion quantity and serving unit.
 * Uses exact canonical mass basis: scaledNutrient = nutrientPer100g * totalGrams / 100.
 */
export function scaleFoodNutrients(
  entry: FoodCatalogEntry,
  quantity: number,
  servingUnitOrOption?: string | ServingOption
): ScaledNutrients {
  if (typeof quantity !== 'number' || !Number.isFinite(quantity) || quantity <= 0) {
    throw new ScalingValidationError(
      'Quantity must be a positive finite number.',
      'quantity'
    );
  }
  if (quantity > SCALING_LIMITS.MAX_QUANTITY) {
    throw new ScalingValidationError(
      `Quantity cannot exceed ${SCALING_LIMITS.MAX_QUANTITY}.`,
      'quantity'
    );
  }

  // Find matching serving option or default to grams
  let servingOption: ServingOption;
  if (typeof servingUnitOrOption === 'object' && servingUnitOrOption !== null && 'grams' in servingUnitOrOption) {
    servingOption = servingUnitOrOption;
  } else {
    const servingUnitId = servingUnitOrOption;
    if (
      !servingUnitId ||
      servingUnitId === 'g' ||
      servingUnitId === 'gram' ||
      servingUnitId === 'grams' ||
      servingUnitId === '100g'
    ) {
      const found = entry.servingOptions.find((opt) => opt.id === servingUnitId);
      if (found) {
        servingOption = found;
      } else if (servingUnitId === '100g') {
        servingOption = { id: '100g', nameEn: '100 grams', nameAr: '100 غرام', grams: 100 };
      } else {
        // Direct grams basis: 1g
        servingOption = { id: 'g', nameEn: 'Grams', nameAr: 'غرام', grams: 1 };
      }
    } else {
      const found = entry.servingOptions.find((opt) => opt.id === servingUnitId);
      if (!found) {
        throw new ScalingValidationError(
          `Serving unit "${servingUnitId}" is not supported for food "${entry.nameEn}".`,
          'servingUnitId'
        );
      }
      servingOption = found;
    }
  }

  const totalGrams = calculateServingGrams(servingOption, quantity);
  const factor = totalGrams / 100;

  // Pure mass basis scaling without premature rounding
  const calories = entry.caloriesPer100g * factor;
  const protein = entry.proteinPer100g * factor;
  const carbs = entry.carbsPer100g * factor;
  const fats = entry.fatsPer100g * factor;

  if (!Number.isFinite(calories) || calories < 0 || calories > SCALING_LIMITS.MAX_SCALED_CALORIES) {
    throw new ScalingValidationError(
      'Scaled calories calculation exceeded allowable bounds or resulted in non-finite value.',
      'calories'
    );
  }
  if (!Number.isFinite(protein) || protein < 0 || protein > SCALING_LIMITS.MAX_SCALED_MACROS) {
    throw new ScalingValidationError(
      'Scaled protein calculation exceeded allowable bounds or resulted in non-finite value.',
      'protein'
    );
  }
  if (!Number.isFinite(carbs) || carbs < 0 || carbs > SCALING_LIMITS.MAX_SCALED_MACROS) {
    throw new ScalingValidationError(
      'Scaled carbs calculation exceeded allowable bounds or resulted in non-finite value.',
      'carbs'
    );
  }
  if (!Number.isFinite(fats) || fats < 0 || fats > SCALING_LIMITS.MAX_SCALED_MACROS) {
    throw new ScalingValidationError(
      'Scaled fats calculation exceeded allowable bounds or resulted in non-finite value.',
      'fats'
    );
  }

  return {
    totalGrams,
    calories,
    protein,
    carbs,
    fats,
    fat: fats,
    displayCalories: Math.round(calories),
    displayProtein: roundTo1Decimal(protein),
    displayCarbs: roundTo1Decimal(carbs),
    displayFats: roundTo1Decimal(fats),
    displayFat: roundTo1Decimal(fats),
    servingUnitId: servingOption.id,
    servingUnitNameEn: servingOption.nameEn,
    servingUnitNameAr: servingOption.nameAr,
  };
}

/**
 * Scales custom food nutrients by portion quantity.
 */
export function scaleCustomFoodNutrients(
  customFood: CustomFood,
  quantity: number
): ScaledNutrients {
  if (typeof quantity !== 'number' || !Number.isFinite(quantity) || quantity <= 0) {
    throw new ScalingValidationError(
      'Quantity must be a positive finite number.',
      'quantity'
    );
  }
  if (quantity > SCALING_LIMITS.MAX_QUANTITY) {
    throw new ScalingValidationError(
      `Quantity cannot exceed ${SCALING_LIMITS.MAX_QUANTITY}.`,
      'quantity'
    );
  }

  if (
    typeof customFood.servingSize !== 'number' ||
    !Number.isFinite(customFood.servingSize) ||
    customFood.servingSize <= 0 ||
    customFood.servingSize > SCALING_LIMITS.MAX_SERVING_GRAMS
  ) {
    throw new ScalingValidationError(
      'Custom food serving size must be a positive finite number within limits.',
      'servingSize'
    );
  }

  const totalGrams = quantity * customFood.servingSize;
  const calories = customFood.calories * quantity;
  const protein = customFood.protein * quantity;
  const carbs = customFood.carbs * quantity;
  const fats = customFood.fats * quantity;

  if (
    !Number.isFinite(totalGrams) ||
    totalGrams > SCALING_LIMITS.MAX_TOTAL_GRAMS ||
    !Number.isFinite(calories) ||
    calories > SCALING_LIMITS.MAX_SCALED_CALORIES ||
    !Number.isFinite(protein) ||
    protein > SCALING_LIMITS.MAX_SCALED_MACROS ||
    !Number.isFinite(carbs) ||
    carbs > SCALING_LIMITS.MAX_SCALED_MACROS ||
    !Number.isFinite(fats) ||
    fats > SCALING_LIMITS.MAX_SCALED_MACROS
  ) {
    throw new ScalingValidationError(
      'Custom food scaled results exceeded allowable numerical bounds.',
      'overflow'
    );
  }

  return {
    totalGrams,
    calories,
    protein,
    carbs,
    fats,
    fat: fats,
    displayCalories: Math.round(calories),
    displayProtein: roundTo1Decimal(protein),
    displayCarbs: roundTo1Decimal(carbs),
    displayFats: roundTo1Decimal(fats),
    displayFat: roundTo1Decimal(fats),
    servingUnitId: customFood.servingUnit || 'serving',
    servingUnitNameEn: customFood.servingUnit || 'serving',
    servingUnitNameAr: customFood.servingUnit || 'حصة',
  };
}

/**
 * Creates an immutable logged MealItem snapshot from a catalog entry and portion selection.
 * Note: meal item nutrients represent the complete, absolute consumed portion snapshot.
 * Total meal calories = sum(item.calories), avoiding accidental double-multiplication.
 * Supports both createMealItemSnapshot(id, entry, quantity, servingUnitId, lang)
 * and createMealItemSnapshot(entry, quantity, servingUnitId, lang).
 */
export function createMealItemSnapshot(
  arg1: string | FoodCatalogEntry,
  arg2: FoodCatalogEntry | number,
  arg3?: number | string | ServingOption,
  arg4?: string | ServingOption,
  arg5: 'en' | 'ar' = 'en'
): MealItem {
  let id: string;
  let entry: FoodCatalogEntry;
  let quantity: number;
  let servingUnitId: string | ServingOption | undefined;
  let preferredLanguage: 'en' | 'ar' = 'en';

  if (typeof arg1 === 'string') {
    id = arg1.trim();
    entry = arg2 as FoodCatalogEntry;
    quantity = arg3 as number;
    servingUnitId = arg4;
    preferredLanguage = arg5;
  } else {
    entry = arg1 as FoodCatalogEntry;
    quantity = arg2 as number;
    servingUnitId = arg3 as string | ServingOption;
    preferredLanguage = (typeof arg4 === 'string' && (arg4 === 'en' || arg4 === 'ar') ? arg4 : 'en');
    id = '';
  }

  if (!id) {
    id = createId('meal-item');
  }

  const scaled = scaleFoodNutrients(entry, quantity, servingUnitId);
  const name = preferredLanguage === 'ar' ? entry.nameAr : entry.nameEn;
  const unitId = typeof servingUnitId === 'object' && servingUnitId !== null && 'id' in servingUnitId ? servingUnitId.id : (servingUnitId || 'g');

  return normalizeMealItem({
    id,
    foodName: name,
    name,
    quantity,
    unit: preferredLanguage === 'ar' ? scaled.servingUnitNameAr : scaled.servingUnitNameEn,
    calories: scaled.displayCalories,
    protein: scaled.displayProtein,
    carbs: scaled.displayCarbs,
    fats: scaled.displayFats,
    fat: scaled.displayFats,
    catalogId: entry.id,
    portionUnit: unitId,
  });
}

/**
 * Creates an immutable logged MealItem snapshot from a custom food.
 * Supports both createCustomFoodMealItemSnapshot(id, customFood, quantity, lang)
 * and createCustomFoodMealItemSnapshot(customFood, quantity, servingUnit, lang).
 */
export function createCustomFoodMealItemSnapshot(
  arg1: string | CustomFood,
  arg2: CustomFood | number,
  arg3?: number | string,
  arg4?: string | 'en' | 'ar',
  arg5: 'en' | 'ar' = 'en'
): MealItem {
  let id: string;
  let customFood: CustomFood;
  let quantity: number;
  let preferredLanguage: 'en' | 'ar' = 'en';

  if (typeof arg1 === 'string') {
    id = arg1.trim();
    customFood = arg2 as CustomFood;
    quantity = arg3 as number;
    preferredLanguage = (typeof arg4 === 'string' && (arg4 === 'en' || arg4 === 'ar') ? arg4 : 'en');
  } else {
    customFood = arg1 as CustomFood;
    quantity = arg2 as number;
    preferredLanguage = (typeof arg4 === 'string' && (arg4 === 'en' || arg4 === 'ar') ? arg4 : (typeof arg3 === 'string' && (arg3 === 'en' || arg3 === 'ar') ? arg3 : 'en'));
    id = '';
  }

  if (!id) {
    id = createId('meal-item');
  }

  const scaled = scaleCustomFoodNutrients(customFood, quantity);
  const name = preferredLanguage === 'ar' && customFood.nameAr ? customFood.nameAr : customFood.name;

  return normalizeMealItem({
    id,
    foodName: name,
    name,
    quantity,
    unit: preferredLanguage === 'ar' ? scaled.servingUnitNameAr : scaled.servingUnitNameEn,
    calories: scaled.displayCalories,
    protein: scaled.displayProtein,
    carbs: scaled.displayCarbs,
    fats: scaled.displayFats,
    fat: scaled.displayFats,
    portionUnit: customFood.servingUnit,
  });
}
