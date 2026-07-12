export type MealItem = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

export type FoodItem = MealItem;

export type Meal = {
  id: string;
  name: string;
  date: string;
  time: string;
  items: MealItem[];
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
};
