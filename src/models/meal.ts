import { parseStrictQuantity } from '../utils/nutrition';

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'other';

/**
 * Canonical Meal domain model.
 */
export type MealItem = {
  id: string;
  foodName: string;
  name?: string;
  quantity: number;
  unit?: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  fat?: number;
  catalogId?: string;
  portionUnit?: string;
};

export type FoodItem = MealItem;

export type Meal = {
  id: string;
  title: string;
  name?: string;
  date: string;
  time: string;
  items: MealItem[];
  totalCalories?: number;
  totalProtein?: number;
  totalCarbs?: number;
  totalFat?: number;
  totalFats?: number;
  mealType?: MealType | string;
  notes?: string;
  isFavorite?: boolean;
  isTemplate?: boolean;
};

export class MealValidationError extends Error {
  constructor(message: string, public readonly field?: string) {
    super(message);
    this.name = 'MealValidationError';
  }
}

export function normalizeMealItem(
  item: Omit<Partial<MealItem>, 'quantity'> & { id: string; quantity?: number | string; calories: number; protein: number; carbs: number }
): MealItem {
  const name = item.foodName || item.name || '';
  const fats = item.fats ?? item.fat ?? 0;
  let unit = item.unit;
  let portionUnit = item.portionUnit;
  let quantity: number;

  if (typeof item.quantity === 'number') {
    if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
      throw new MealValidationError(
        `Meal item quantity "${item.quantity}" is invalid. Quantity must be a valid positive number.`,
        'quantity'
      );
    }
    quantity = item.quantity;
  } else if (typeof item.quantity === 'string') {
    const trimmed = item.quantity.trim();
    if (trimmed === '') {
      throw new MealValidationError('Meal item quantity cannot be empty.', 'quantity');
    }
    const strictParsed = parseStrictQuantity(trimmed);
    if (strictParsed.isValid) {
      quantity = strictParsed.value;
    } else {
      // Support legacy strings with separated unit (e.g. "1 scoop", "100 g", "2 pieces")
      const legacyMatch = trimmed.match(/^([+-]?(?:(?:\d+([.,]\d+)?)|([.,]\d+)))\s+([a-zA-Z\u0600-\u06FF]+)$/);
      if (legacyMatch) {
        const numPart = legacyMatch[1];
        const unitPart = legacyMatch[4];
        const parsedNum = parseStrictQuantity(numPart);
        if (parsedNum.isValid && unitPart) {
          quantity = parsedNum.value;
          if (!unit) {
            unit = unitPart;
          }
          if (!portionUnit) {
            portionUnit = unitPart;
          }
        } else {
          throw new MealValidationError(
            `Meal item quantity "${item.quantity}" is invalid. Quantity must be a valid positive number.`,
            'quantity'
          );
        }
      } else {
        throw new MealValidationError(
          `Meal item quantity "${item.quantity}" is invalid. Quantity must be a valid positive number.`,
          'quantity'
        );
      }
    }
  } else if (item.quantity === undefined || item.quantity === null) {
    quantity = 1;
  } else {
    throw new MealValidationError('Meal item quantity must be a valid positive number.', 'quantity');
  }

  return {
    ...item,
    quantity,
    unit,
    foodName: name,
    name,
    fats,
    fat: fats,
    catalogId: item.catalogId,
    portionUnit,
  };
}

export function normalizeMeal(
  meal: Partial<Meal> & { id: string; date: string; time: string; items: MealItem[] }
): Meal {
  const rawTitle = meal.title !== undefined ? meal.title : (meal.name ?? '');
  const title = typeof rawTitle === 'string' ? rawTitle : '';
  const items = (meal.items || []).map(normalizeMealItem);
  const computedCalories = items.reduce((sum, item) => sum + (Number.isFinite(item.calories) ? item.calories : 0), 0);
  const computedProtein = items.reduce((sum, item) => sum + (Number.isFinite(item.protein) ? item.protein : 0), 0);
  const computedCarbs = items.reduce((sum, item) => sum + (Number.isFinite(item.carbs) ? item.carbs : 0), 0);
  const computedFats = items.reduce((sum, item) => sum + (Number.isFinite(item.fats) ? item.fats : 0), 0);

  const hasItems = items.length > 0;

  return {
    ...meal,
    title,
    name: title,
    items,
    totalCalories: hasItems ? computedCalories : (meal.totalCalories ?? computedCalories),
    totalProtein: hasItems ? computedProtein : (meal.totalProtein ?? computedProtein),
    totalCarbs: hasItems ? computedCarbs : (meal.totalCarbs ?? computedCarbs),
    totalFat: hasItems ? computedFats : (meal.totalFat ?? meal.totalFats ?? computedFats),
    totalFats: hasItems ? computedFats : (meal.totalFats ?? meal.totalFat ?? computedFats),
    mealType: meal.mealType,
    notes: meal.notes,
    isFavorite: Boolean(meal.isFavorite || (meal.notes && meal.notes.includes('[favorite]'))),
    isTemplate: Boolean(meal.isTemplate || meal.isFavorite || (meal.notes && meal.notes.includes('[favorite]'))),
  };
}

/**
 * Strictly validates a meal date string.
 * Must be in exact YYYY-MM-DD format (no trailing characters, timestamps, or suffixes).
 * Validates real calendar bounds including leap-year February rules.
 */
export function validateMealDate(dateStr: string): void {
  if (!dateStr || typeof dateStr !== 'string') {
    throw new MealValidationError('Meal date is required.', 'date');
  }

  // Strictly enforce exact YYYY-MM-DD format (no trailing characters, whitespace, timestamps, or suffixes)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new MealValidationError('Meal date must be in exact YYYY-MM-DD format.', 'date');
  }

  const [yStr, mStr, dStr] = dateStr.split('-');
  const year = parseInt(yStr, 10);
  const month = parseInt(mStr, 10);
  const day = parseInt(dStr, 10);

  if (month < 1 || month > 12) {
    throw new MealValidationError('Meal date month must be between 01 and 12.', 'date');
  }

  const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
  const daysInMonths = [31, isLeapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const maxDays = daysInMonths[month - 1];

  if (day < 1 || day > maxDays) {
    if (month === 2 && day === 29 && !isLeapYear) {
      throw new MealValidationError(`February ${year} is not a leap year and only has 28 days.`, 'date');
    }
    throw new MealValidationError(`Meal date day must be between 01 and ${maxDays} for month ${month}.`, 'date');
  }

  const dateObj = new Date(year, month - 1, day);
  if (
    dateObj.getFullYear() !== year ||
    dateObj.getMonth() !== month - 1 ||
    dateObj.getDate() !== day
  ) {
    throw new MealValidationError('Meal date is invalid or does not exist.', 'date');
  }
}

/**
 * Validates a meal time string against supported formats:
 * 1. Standard 24-hr zero-padded HH:mm (e.g. 08:30, 14:00, 00:00)
 * 2. Documented legacy single-digit hour 24-hr H:mm (e.g. 8:30)
 * 3. Documented legacy 12-hr with AM/PM (e.g. 1:30 PM, 08:30 am)
 */
export function validateMealTime(timeStr: string): void {
  if (!timeStr || typeof timeStr !== 'string' || !timeStr.trim()) {
    throw new MealValidationError('Meal time is required.', 'time');
  }

  const trimmed = timeStr.trim();
  const is24Hr = /^([01]\d|2[0-3]):[0-5]\d$/.test(trimmed);
  const isLegacy24Hr = /^[0-9]:[0-5]\d$/.test(trimmed);
  const isLegacy12Hr = /^(0?[1-9]|1[0-2]):[0-5]\d\s*(AM|PM|am|pm)$/i.test(trimmed);

  if (!is24Hr && !isLegacy24Hr && !isLegacy12Hr) {
    throw new MealValidationError('Meal time format is invalid.', 'time');
  }
}

/**
 * Validates a meal item domain object strictly without silent numerical coercion.
 */
export function validateMealItem(item: MealItem, index?: number): void {
  const prefix = index !== undefined ? `Food item #${index + 1}` : 'Food item';

  if (!item.id || typeof item.id !== 'string' || !item.id.trim()) {
    throw new MealValidationError(`${prefix} must have a valid non-empty id.`, 'id');
  }

  const name = item.foodName || item.name || '';
  if (typeof name !== 'string' || !name.trim()) {
    throw new MealValidationError(`${prefix} name is required.`, 'foodName');
  }

  let quantity = item.quantity;
  if (typeof quantity === 'string') {
    const parseResult = parseStrictQuantity(quantity);
    if (!parseResult.isValid) {
      throw new MealValidationError(`${prefix} quantity must be a positive finite number.`, 'quantity');
    }
    quantity = parseResult.value;
  }
  if (typeof quantity !== 'number' || !Number.isFinite(quantity) || quantity <= 0 || quantity > 100_000) {
    throw new MealValidationError(`${prefix} quantity must be a positive finite number.`, 'quantity');
  }

  if (typeof item.calories !== 'number' || !Number.isFinite(item.calories) || item.calories < 0 || item.calories > 100_000) {
    throw new MealValidationError(`${prefix} calories must be a valid non-negative finite number.`, 'calories');
  }

  if (typeof item.protein !== 'number' || !Number.isFinite(item.protein) || item.protein < 0 || item.protein > 100_000) {
    throw new MealValidationError(`${prefix} protein must be a valid non-negative finite number.`, 'protein');
  }

  if (typeof item.carbs !== 'number' || !Number.isFinite(item.carbs) || item.carbs < 0 || item.carbs > 100_000) {
    throw new MealValidationError(`${prefix} carbs must be a valid non-negative finite number.`, 'carbs');
  }

  const fats = item.fats ?? item.fat;
  if (typeof fats !== 'number' || !Number.isFinite(fats) || fats < 0 || fats > 100_000) {
    throw new MealValidationError(`${prefix} fats must be a valid non-negative finite number.`, 'fats');
  }

  if (item.catalogId !== undefined && item.catalogId !== null) {
    if (typeof item.catalogId !== 'string' || !item.catalogId.trim()) {
      throw new MealValidationError(`${prefix} catalogId must be a valid non-empty string.`, 'catalogId');
    }
  }

  if (item.portionUnit !== undefined && item.portionUnit !== null) {
    if (typeof item.portionUnit !== 'string' || !item.portionUnit.trim()) {
      throw new MealValidationError(`${prefix} portionUnit must be a valid non-empty string.`, 'portionUnit');
    }
  }
}

/**
 * Validates a meal domain object before persistence.
 * Safe empty-meal behavior: meals with 0 items are supported if explicit totals are non-negative.
 */
export function validateMeal(meal: Meal): void {
  if (!meal.id || typeof meal.id !== 'string' || !meal.id.trim()) {
    throw new MealValidationError('Meal must have a valid non-empty id.', 'id');
  }

  const title = meal.title || meal.name || '';
  if (typeof title !== 'string' || !title.trim()) {
    throw new MealValidationError('Meal title is required.', 'title');
  }

  validateMealDate(meal.date);
  validateMealTime(meal.time);

  if (!Array.isArray(meal.items)) {
    throw new MealValidationError('Meal items must be an array.', 'items');
  }

  const seenIds = new Set<string>();
  for (let i = 0; i < meal.items.length; i++) {
    const item = meal.items[i];
    validateMealItem(item, i);
    if (seenIds.has(item.id)) {
      throw new MealValidationError(
        `Duplicate food item id detected: "${item.id}".`,
        'items'
      );
    }
    seenIds.add(item.id);
  }

  if (meal.totalCalories !== undefined) {
    if (
      typeof meal.totalCalories !== 'number' ||
      !Number.isFinite(meal.totalCalories) ||
      meal.totalCalories < 0 ||
      meal.totalCalories > 100_000
    ) {
      throw new MealValidationError(
        'Meal total calories must be a valid non-negative finite number.',
        'totalCalories'
      );
    }
  }

  if (meal.totalProtein !== undefined) {
    if (
      typeof meal.totalProtein !== 'number' ||
      !Number.isFinite(meal.totalProtein) ||
      meal.totalProtein < 0 ||
      meal.totalProtein > 100_000
    ) {
      throw new MealValidationError(
        'Meal total protein must be a valid non-negative finite number.',
        'totalProtein'
      );
    }
  }

  if (meal.totalCarbs !== undefined) {
    if (
      typeof meal.totalCarbs !== 'number' ||
      !Number.isFinite(meal.totalCarbs) ||
      meal.totalCarbs < 0 ||
      meal.totalCarbs > 100_000
    ) {
      throw new MealValidationError(
        'Meal total carbs must be a valid non-negative finite number.',
        'totalCarbs'
      );
    }
  }

  const totalFats = meal.totalFat ?? meal.totalFats;
  if (totalFats !== undefined) {
    if (
      typeof totalFats !== 'number' ||
      !Number.isFinite(totalFats) ||
      totalFats < 0 ||
      totalFats > 100_000
    ) {
      throw new MealValidationError(
        'Meal total fats must be a valid non-negative finite number.',
        'totalFats'
      );
    }
  }
}
