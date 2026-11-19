import type { Meal, MealItem, MealType, NutritionCompleteness } from './meal';
import { createId } from '../utils/id';

export type { NutritionCompleteness };

export interface MealTemplateItem {
  id: string;
  templateId?: string;
  name: string;
  quantity: number;
  unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  catalogId?: string;
  portionUnit?: string;
  sortOrder?: number;
}

export interface MealTemplate {
  id: string;
  title: string;
  name?: string;
  mealType?: MealType | string;
  notes?: string;
  isFavorite?: boolean;
  items: MealTemplateItem[];
  totalCalories: number;
  totalProtein?: number;
  totalCarbs?: number;
  totalFat?: number;
  totalFats?: number;
  nutritionCompleteness?: NutritionCompleteness;
  proteinKnown?: boolean;
  carbsKnown?: boolean;
  fatKnown?: boolean;
  reviewStatus?: 'confirmed' | 'ambiguous';
  createdAt: string;
  updatedAt: string;
}

export function getMealTemplateTotals(template: MealTemplate): {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
} {
  const items = template.items || [];
  if (items.length > 0) {
    return {
      calories: items.reduce((sum, it) => sum + (it.calories || 0), 0),
      protein: Math.round(items.reduce((sum, it) => sum + (it.protein || 0), 0) * 10) / 10,
      carbs: Math.round(items.reduce((sum, it) => sum + (it.carbs || 0), 0) * 10) / 10,
      fats: Math.round(items.reduce((sum, it) => sum + (it.fats || 0), 0) * 10) / 10,
    };
  }
  return {
    calories: Math.round(template.totalCalories || 0),
    protein: Math.round((template.totalProtein || 0) * 10) / 10,
    carbs: Math.round((template.totalCarbs || 0) * 10) / 10,
    fats: Math.round(((template.totalFat ?? template.totalFats) || 0) * 10) / 10,
  };
}

export function normalizeMealTemplateItem(raw: Partial<MealTemplateItem>): MealTemplateItem {
  const calories = Number.isFinite(raw.calories) && (raw.calories ?? 0) >= 0 ? raw.calories! : 0;
  const protein = Number.isFinite(raw.protein) && (raw.protein ?? 0) >= 0 ? raw.protein! : 0;
  const carbs = Number.isFinite(raw.carbs) && (raw.carbs ?? 0) >= 0 ? raw.carbs! : 0;
  const fats = Number.isFinite(raw.fats) && (raw.fats ?? 0) >= 0 ? raw.fats! : 0;

  return {
    id: raw.id || createId('template-item'),
    templateId: raw.templateId,
    name: (raw.name || '').trim(),
    quantity: Number.isFinite(raw.quantity) && (raw.quantity ?? 0) > 0 ? raw.quantity! : 1,
    unit: (raw.unit || 'g').trim(),
    calories: Math.round(calories),
    protein: Math.round(protein * 10) / 10,
    carbs: Math.round(carbs * 10) / 10,
    fats: Math.round(fats * 10) / 10,
    catalogId: raw.catalogId,
    portionUnit: raw.portionUnit,
    sortOrder: raw.sortOrder ?? 0,
  };
}

export function normalizeMealTemplate(raw: Partial<MealTemplate>): MealTemplate {
  const now = new Date().toISOString();
  const items = (raw.items || []).map((item, index) =>
    normalizeMealTemplateItem({
      ...item,
      sortOrder: item.sortOrder ?? index,
    })
  );

  const title = (raw.title || raw.name || '').trim();
  const hasItems = items.length > 0;

  const computedCalories = items.reduce((sum, it) => sum + it.calories, 0);
  const computedProtein = Math.round(items.reduce((sum, it) => sum + it.protein, 0) * 10) / 10;
  const computedCarbs = Math.round(items.reduce((sum, it) => sum + it.carbs, 0) * 10) / 10;
  const computedFats = Math.round(items.reduce((sum, it) => sum + it.fats, 0) * 10) / 10;

  const totalCalories = hasItems
    ? computedCalories
    : (Number.isFinite(raw.totalCalories) && (raw.totalCalories ?? 0) >= 0 ? raw.totalCalories! : 0);

  const totalProtein = hasItems
    ? computedProtein
    : (Number.isFinite(raw.totalProtein) && (raw.totalProtein ?? 0) >= 0 ? raw.totalProtein! : 0);

  const totalCarbs = hasItems
    ? computedCarbs
    : (Number.isFinite(raw.totalCarbs) && (raw.totalCarbs ?? 0) >= 0 ? raw.totalCarbs! : 0);

  const totalFat = hasItems
    ? computedFats
    : (Number.isFinite(raw.totalFat) && (raw.totalFat ?? 0) >= 0
        ? raw.totalFat!
        : (Number.isFinite(raw.totalFats) && (raw.totalFats ?? 0) >= 0 ? raw.totalFats! : 0));

  let defaultCompleteness: NutritionCompleteness = 'complete';
  if (raw.nutritionCompleteness) {
    defaultCompleteness = raw.nutritionCompleteness;
  } else if (
    totalCalories > 0 &&
    totalProtein === 0 &&
    totalCarbs === 0 &&
    totalFat === 0
  ) {
    defaultCompleteness = 'indeterminate';
  }

  const isUnknownMacros = defaultCompleteness === 'calories_only' || defaultCompleteness === 'indeterminate';

  const proteinKnown = raw.proteinKnown !== undefined
    ? Boolean(raw.proteinKnown)
    : !isUnknownMacros;

  const carbsKnown = raw.carbsKnown !== undefined
    ? Boolean(raw.carbsKnown)
    : !isUnknownMacros;

  const fatKnown = raw.fatKnown !== undefined
    ? Boolean(raw.fatKnown)
    : !isUnknownMacros;

  return {
    id: raw.id || createId('meal-template'),
    title,
    name: title,
    mealType: raw.mealType,
    notes: raw.notes ? raw.notes.trim() : undefined,
    isFavorite: Boolean(raw.isFavorite),
    items,
    totalCalories,
    totalProtein,
    totalCarbs,
    totalFat,
    totalFats: totalFat,
    nutritionCompleteness: defaultCompleteness,
    proteinKnown,
    carbsKnown,
    fatKnown,
    reviewStatus: raw.reviewStatus ?? (
      defaultCompleteness === 'indeterminate' && totalCalories > 0 && totalProtein === 0 && totalCarbs === 0 && totalFat === 0 && !raw.nutritionCompleteness
        ? 'ambiguous'
        : 'confirmed'
    ),
    createdAt: raw.createdAt || now,
    updatedAt: raw.updatedAt || now,
  };
}

/**
 * Creates an independent MealTemplate from an existing Meal.
 * - Generates new template ID and child template item IDs.
 * - Preserves item order, parameters, units, catalog references.
 * - Retains explicit itemless structure (items: []) without fabricating synthetic food items.
 * - Preserves nutrient completeness, macro known flags, and exact nutrient totals.
 * - Does not mutate source meal and does not affect historical logs.
 */
export function createTemplateFromMeal(meal: Meal, titleOverride?: string): MealTemplate {
  const now = new Date().toISOString();
  const title = (titleOverride || meal.title || meal.name || 'Saved Template').trim();

  let items: MealTemplateItem[] = [];
  if (meal.items && meal.items.length > 0) {
    items = meal.items.map((item, index) => ({
      id: createId('template-item'),
      name: item.foodName || item.name || '',
      quantity: item.quantity,
      unit: item.unit || 'g',
      calories: item.calories,
      protein: item.protein,
      carbs: item.carbs,
      fats: item.fats ?? item.fat ?? 0,
      catalogId: item.catalogId,
      portionUnit: item.portionUnit,
      sortOrder: index,
    }));
  }

  const cleanNotes = meal.notes ? meal.notes.replace(/^\[favorite\]\s*/i, '').trim() : undefined;

  return normalizeMealTemplate({
    id: createId('meal-template'),
    title,
    name: title,
    mealType: meal.mealType,
    notes: cleanNotes || undefined,
    isFavorite: false,
    items,
    totalCalories: meal.totalCalories ?? 0,
    totalProtein: meal.totalProtein ?? 0,
    totalCarbs: meal.totalCarbs ?? 0,
    totalFat: meal.totalFat ?? meal.totalFats ?? 0,
    totalFats: meal.totalFats ?? meal.totalFat ?? 0,
    nutritionCompleteness: meal.nutritionCompleteness ?? (items.length > 0 ? 'complete' : 'calories_only'),
    proteinKnown: meal.proteinKnown,
    carbsKnown: meal.carbsKnown,
    fatKnown: meal.fatKnown,
    reviewStatus: meal.nutritionCompleteness === 'indeterminate' && (meal.totalCalories ?? 0) > 0 ? 'ambiguous' : 'confirmed',
    createdAt: now,
    updatedAt: now,
  });
}

/**
 * Logs a fresh Meal from a MealTemplate.
 * - Generates fresh meal ID and meal-item IDs.
 * - Preserves itemless structure if template is itemless (no fake items created).
 * - Faithfully preserves nutrient completeness and macro known/unknown flags.
 * - Sets target date and time.
 * - Template itself is NOT consumed, altered, or deleted.
 */
export function createMealFromTemplate(
  template: MealTemplate,
  targetDate: string,
  targetTime?: string
): Meal {
  const now = new Date();
  const time = targetTime || `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const hasItems = (template.items || []).length > 0;
  const items: MealItem[] = (template.items || []).map((tItem) => ({
    id: createId('meal-item'),
    foodName: tItem.name,
    name: tItem.name,
    quantity: tItem.quantity,
    unit: tItem.unit,
    calories: tItem.calories,
    protein: tItem.protein,
    carbs: tItem.carbs,
    fats: tItem.fats,
    fat: tItem.fats,
    catalogId: tItem.catalogId,
    portionUnit: tItem.portionUnit,
  }));

  const totalCalories = hasItems
    ? items.reduce((sum, it) => sum + it.calories, 0)
    : (template.totalCalories ?? 0);
  const totalProtein = hasItems
    ? items.reduce((sum, it) => sum + it.protein, 0)
    : (template.totalProtein ?? 0);
  const totalCarbs = hasItems
    ? items.reduce((sum, it) => sum + it.carbs, 0)
    : (template.totalCarbs ?? 0);
  const totalFats = hasItems
    ? items.reduce((sum, it) => sum + it.fats, 0)
    : (template.totalFat ?? template.totalFats ?? 0);

  const completeness = template.nutritionCompleteness ?? (hasItems ? 'complete' : 'calories_only');

  return {
    id: createId('meal'),
    title: template.title,
    name: template.title,
    date: targetDate,
    time,
    mealType: template.mealType,
    notes: template.notes,
    items,
    totalCalories,
    totalProtein,
    totalCarbs,
    totalFat: totalFats,
    totalFats,
    isFavorite: false,
    isTemplate: false,
    nutritionCompleteness: completeness,
    proteinKnown: template.proteinKnown !== undefined
      ? template.proteinKnown
      : (completeness !== 'calories_only' && completeness !== 'indeterminate'),
    carbsKnown: template.carbsKnown !== undefined
      ? template.carbsKnown
      : (completeness !== 'calories_only' && completeness !== 'indeterminate'),
    fatKnown: template.fatKnown !== undefined
      ? template.fatKnown
      : (completeness !== 'calories_only' && completeness !== 'indeterminate'),
  };
}
