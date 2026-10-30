import { IDatabase, MealRepository } from '../types';
import { Meal, MealItem, normalizeMeal, normalizeMealItem } from '../../models/meal';

interface MealRow {
  id: string;
  title: string;
  date: string;
  time: string;
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fat: number;
  created_at: string;
}

interface MealItemRow {
  id: string;
  meal_id: string;
  name: string;
  quantity: number;
  unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  sort_order: number;
}

export class SQLiteMealRepository implements MealRepository {
  constructor(private db: IDatabase) {}

  async getAllMeals(): Promise<Meal[]> {
    const mealRows = await this.db.getAllAsync<MealRow>(
      'SELECT * FROM meals ORDER BY date DESC, created_at DESC;'
    );
    if (mealRows.length === 0) {
      return [];
    }

    const itemRows = await this.db.getAllAsync<MealItemRow>(
      'SELECT * FROM meal_items ORDER BY sort_order ASC;'
    );

    const itemsByMealId = new Map<string, MealItem[]>();
    for (const item of itemRows) {
      const normalizedItem = normalizeMealItem({
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        calories: item.calories,
        protein: item.protein,
        carbs: item.carbs,
        fats: item.fats,
      });

      const list = itemsByMealId.get(item.meal_id) || [];
      list.push(normalizedItem);
      itemsByMealId.set(item.meal_id, list);
    }

    return mealRows.map((m) =>
      normalizeMeal({
        id: m.id,
        title: m.title,
        date: m.date,
        time: m.time,
        totalCalories: m.total_calories,
        totalProtein: m.total_protein,
        totalCarbs: m.total_carbs,
        totalFat: m.total_fat,
        items: itemsByMealId.get(m.id) || [],
      })
    );
  }

  async getMealById(id: string): Promise<Meal | null> {
    const mealRow = await this.db.getFirstAsync<MealRow>(
      'SELECT * FROM meals WHERE id = ?;',
      id
    );
    if (!mealRow) {
      return null;
    }

    const itemRows = await this.db.getAllAsync<MealItemRow>(
      'SELECT * FROM meal_items WHERE meal_id = ? ORDER BY sort_order ASC;',
      id
    );

    const items = itemRows.map((item) =>
      normalizeMealItem({
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        calories: item.calories,
        protein: item.protein,
        carbs: item.carbs,
        fats: item.fats,
      })
    );

    return normalizeMeal({
      id: mealRow.id,
      title: mealRow.title,
      date: mealRow.date,
      time: mealRow.time,
      totalCalories: mealRow.total_calories,
      totalProtein: mealRow.total_protein,
      totalCarbs: mealRow.total_carbs,
      totalFat: mealRow.total_fat,
      items,
    });
  }

  async insertMeal(meal: Meal, txn?: IDatabase): Promise<void> {
    const target = txn || this.db;
    const normalized = normalizeMeal(meal);
    const now = new Date().toISOString();

    await target.withExclusiveTransactionAsync(async (t) => {
      await t.runAsync(
        `INSERT INTO meals (id, title, date, time, total_calories, total_protein, total_carbs, total_fat, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        normalized.id,
        normalized.title,
        normalized.date,
        normalized.time,
        normalized.totalCalories,
        normalized.totalProtein,
        normalized.totalCarbs,
        normalized.totalFat,
        now
      );

      for (let i = 0; i < normalized.items.length; i++) {
        const item = normalizeMealItem(normalized.items[i]);
        await t.runAsync(
          `INSERT INTO meal_items (id, meal_id, name, quantity, unit, calories, protein, carbs, fats, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          item.id,
          normalized.id,
          item.name,
          item.quantity,
          item.unit || 'g',
          item.calories,
          item.protein,
          item.carbs,
          item.fats,
          i
        );
      }
    });
  }

  async updateMeal(meal: Meal, txn?: IDatabase): Promise<void> {
    const target = txn || this.db;
    const normalized = normalizeMeal(meal);

    await target.withExclusiveTransactionAsync(async (t) => {
      await t.runAsync(
        `UPDATE meals SET
           title = ?,
           date = ?,
           time = ?,
           total_calories = ?,
           total_protein = ?,
           total_carbs = ?,
           total_fat = ?
         WHERE id = ?;`,
        normalized.title,
        normalized.date,
        normalized.time,
        normalized.totalCalories,
        normalized.totalProtein,
        normalized.totalCarbs,
        normalized.totalFat,
        normalized.id
      );

      // Re-synchronize child items
      await t.runAsync('DELETE FROM meal_items WHERE meal_id = ?;', normalized.id);

      for (let i = 0; i < normalized.items.length; i++) {
        const item = normalizeMealItem(normalized.items[i]);
        await t.runAsync(
          `INSERT INTO meal_items (id, meal_id, name, quantity, unit, calories, protein, carbs, fats, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          item.id,
          normalized.id,
          item.name,
          item.quantity,
          item.unit || 'g',
          item.calories,
          item.protein,
          item.carbs,
          item.fats,
          i
        );
      }
    });
  }

  async deleteMeal(id: string, txn?: IDatabase): Promise<void> {
    const target = txn || this.db;
    await target.withExclusiveTransactionAsync(async (t) => {
      await t.runAsync('DELETE FROM meal_items WHERE meal_id = ?;', id);
      await t.runAsync('DELETE FROM meals WHERE id = ?;', id);
    });
  }

  async saveAllMeals(meals: Meal[], txn?: IDatabase): Promise<void> {
    const target = txn || this.db;
    const now = new Date().toISOString();

    await target.withExclusiveTransactionAsync(async (t) => {
      await t.runAsync('DELETE FROM meal_items;');
      await t.runAsync('DELETE FROM meals;');

      for (const meal of meals) {
        const normalized = normalizeMeal(meal);
        await t.runAsync(
          `INSERT INTO meals (id, title, date, time, total_calories, total_protein, total_carbs, total_fat, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          normalized.id,
          normalized.title,
          normalized.date,
          normalized.time,
          normalized.totalCalories,
          normalized.totalProtein,
          normalized.totalCarbs,
          normalized.totalFat,
          now
        );

        for (let i = 0; i < normalized.items.length; i++) {
          const item = normalizeMealItem(normalized.items[i]);
          await t.runAsync(
            `INSERT INTO meal_items (id, meal_id, name, quantity, unit, calories, protein, carbs, fats, sort_order)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
            item.id,
            normalized.id,
            item.name,
            item.quantity,
            item.unit || 'g',
            item.calories,
            item.protein,
            item.carbs,
            item.fats,
            i
          );
        }
      }
    });
  }
}
