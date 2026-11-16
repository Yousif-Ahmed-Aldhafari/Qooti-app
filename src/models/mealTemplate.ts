import type { Meal, MealItem, MealType } from './meal';
import { createId } from '../utils/id';

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
  totalCalories?: number;
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
  return {
    calories: items.reduce((sum, it) => sum + (it.calories || 0), 0),
    protein: Math.round(items.reduce((sum, it) => sum + (it.protein || 0), 0) * 10) / 10,
    carbs: Math.round(items.reduce((sum, it) => sum + (it.carbs || 0), 0) * 10) / 10,
    fats: Math.round(items.reduce((sum, it) => sum + (it.fats || 0), 0) * 10) / 10,
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
  const totalCalories =
    Number.isFinite(raw.totalCalories) && (raw.totalCalories ?? 0) >= 0
      ? raw.totalCalories!
      : items.reduce((sum, it) => sum + it.calories, 0);

  return {
    id: raw.id || createId('meal-template'),
    title,
    name: title,
    mealType: raw.mealType,
    notes: raw.notes ? raw.notes.trim() : undefined,
    isFavorite: Boolean(raw.isFavorite),
    items,
    totalCalories,
    createdAt: raw.createdAt || now,
    updatedAt: raw.updatedAt || now,
  };
}

/**
 * Creates an independent MealTemplate from an existing Meal.
 * - Generates new template ID and child template item IDs.
 * - Preserves item order, parameters, units, catalog references.
 * - Supports itemless quick-add meals by synthesizing a template item.
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
  } else if ((meal.totalCalories ?? 0) > 0) {
    items = [
      {
        id: createId('template-item'),
        name: title,
        quantity: 1,
        unit: 'serving',
        calories: meal.totalCalories ?? 0,
        protein: meal.totalProtein ?? 0,
        carbs: meal.totalCarbs ?? 0,
        fats: meal.totalFat ?? meal.totalFats ?? 0,
        sortOrder: 0,
      },
    ];
  }

  return normalizeMealTemplate({
    id: createId('meal-template'),
    title,
    name: title,
    mealType: meal.mealType,
    notes: meal.notes ? meal.notes.replace(/^\[favorite\]\s*/, '').trim() : undefined,
    isFavorite: false,
    items,
    createdAt: now,
    updatedAt: now,
  });
}

/**
 * Logs a fresh Meal from a MealTemplate.
 * - Generates fresh meal ID and meal-item IDs.
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

  const totalCalories = items.reduce((sum, it) => sum + it.calories, 0);
  const totalProtein = items.reduce((sum, it) => sum + it.protein, 0);
  const totalCarbs = items.reduce((sum, it) => sum + it.carbs, 0);
  const totalFats = items.reduce((sum, it) => sum + it.fats, 0);

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
    nutritionCompleteness: 'complete',
    proteinKnown: true,
    carbsKnown: true,
    fatKnown: true,
  };
}
