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
  notes?: string;
};

export class MealValidationError extends Error {
  constructor(message: string, public readonly field?: string) {
    super(message);
    this.name = 'MealValidationError';
  }
}

export function normalizeMealItem(
  item: Partial<MealItem> & { id: string; quantity?: number | string; calories: number; protein: number; carbs: number }
): MealItem {
  const name = item.foodName || item.name || '';
  const fats = item.fats ?? item.fat ?? 0;
  let quantity = typeof item.quantity === 'number' ? item.quantity : parseFloat(String(item.quantity ?? 1));
  if (!Number.isFinite(quantity) || quantity <= 0) {
    quantity = typeof item.quantity === 'number' ? item.quantity : 1;
  }

  return {
    ...item,
    quantity,
    foodName: name,
    name,
    fats,
    fat: fats,
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
  };
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
    quantity = parseFloat(quantity);
  }
  if (typeof quantity !== 'number' || !Number.isFinite(quantity) || quantity <= 0) {
    throw new MealValidationError(`${prefix} quantity must be a positive finite number.`, 'quantity');
  }

  if (typeof item.calories !== 'number' || !Number.isFinite(item.calories) || item.calories < 0) {
    throw new MealValidationError(`${prefix} calories must be a valid non-negative finite number.`, 'calories');
  }

  if (typeof item.protein !== 'number' || !Number.isFinite(item.protein) || item.protein < 0) {
    throw new MealValidationError(`${prefix} protein must be a valid non-negative finite number.`, 'protein');
  }

  if (typeof item.carbs !== 'number' || !Number.isFinite(item.carbs) || item.carbs < 0) {
    throw new MealValidationError(`${prefix} carbs must be a valid non-negative finite number.`, 'carbs');
  }

  const fats = item.fats ?? item.fat;
  if (typeof fats !== 'number' || !Number.isFinite(fats) || fats < 0) {
    throw new MealValidationError(`${prefix} fats must be a valid non-negative finite number.`, 'fats');
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

  if (!meal.date || typeof meal.date !== 'string' || !meal.date.trim()) {
    throw new MealValidationError('Meal date is required.', 'date');
  }

  const trimmedDate = meal.date.trim();
  const datePart = trimmedDate.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}/.test(trimmedDate)) {
    throw new MealValidationError('Meal date must be in YYYY-MM-DD format.', 'date');
  }

  const [yearStr, monthStr, dayStr] = datePart.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);
  const dateObj = new Date(year, month - 1, day);
  if (
    dateObj.getFullYear() !== year ||
    dateObj.getMonth() !== month - 1 ||
    dateObj.getDate() !== day
  ) {
    throw new MealValidationError('Meal date format is invalid.', 'date');
  }

  if (!meal.time || typeof meal.time !== 'string' || !meal.time.trim()) {
    throw new MealValidationError('Meal time is required.', 'time');
  }

  const trimmedTime = meal.time.trim();
  // Support 24-hr HH:mm and 12-hr with AM/PM (e.g. 1:30 PM, 01:30)
  const is24Hr = /^([01]?\d|2[0-3]):[0-5]\d$/.test(trimmedTime);
  const is12Hr = /^(0?[1-9]|1[0-2]):[0-5]\d\s*(AM|PM|am|pm)$/i.test(trimmedTime);
  if (!is24Hr && !is12Hr) {
    throw new MealValidationError('Meal time format is invalid.', 'time');
  }

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
      meal.totalCalories < 0
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
      meal.totalProtein < 0
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
      meal.totalCarbs < 0
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
      totalFats < 0
    ) {
      throw new MealValidationError(
        'Meal total fats must be a valid non-negative finite number.',
        'totalFats'
      );
    }
  }
}
