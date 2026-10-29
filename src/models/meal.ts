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
};

export function normalizeMealItem(
  item: Partial<MealItem> & { id: string; quantity: number; calories: number; protein: number; carbs: number }
): MealItem {
  const name = item.foodName || item.name || '';
  const fats = item.fats ?? item.fat ?? 0;
  return {
    ...item,
    foodName: name,
    name,
    fats,
    fat: fats,
  };
}

export function normalizeMeal(
  meal: Partial<Meal> & { id: string; date: string; time: string; items: MealItem[] }
): Meal {
  const title = meal.title || meal.name || '';
  const items = (meal.items || []).map(normalizeMealItem);
  const calories = items.reduce((sum, item) => sum + (Number.isFinite(item.calories) ? item.calories : 0), 0);
  const protein = items.reduce((sum, item) => sum + (Number.isFinite(item.protein) ? item.protein : 0), 0);
  const carbs = items.reduce((sum, item) => sum + (Number.isFinite(item.carbs) ? item.carbs : 0), 0);
  const fats = items.reduce((sum, item) => sum + (Number.isFinite(item.fats) ? item.fats : 0), 0);

  return {
    ...meal,
    title,
    name: title,
    items,
    totalCalories: meal.totalCalories ?? calories,
    totalProtein: meal.totalProtein ?? protein,
    totalCarbs: meal.totalCarbs ?? carbs,
    totalFat: meal.totalFat ?? meal.totalFats ?? fats,
    totalFats: meal.totalFats ?? meal.totalFat ?? fats,
  };
}
