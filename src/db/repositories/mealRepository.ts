import { IDatabase, MealRepository } from '../types';
import { Meal, MealItem, normalizeMeal, normalizeMealItem, validateMeal } from '../../models/meal';

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
  meal_type?: string | null;
  notes?: string | null;
  is_favorite?: number;
  nutrition_completeness?: string | null;
  protein_known?: number | null;
  carbs_known?: number | null;
  fat_known?: number | null;
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
  catalog_id?: string | null;
  portion_unit?: string | null;
}

async function getTableColumns(t: IDatabase, tableName: string): Promise<Set<string>> {
  const cols = await t.getAllAsync<{ name: string }>(`PRAGMA table_info(${tableName});`);
  return new Set(cols.map((c) => c.name));
}

export function encodeMealNotes(notes?: string, isFavorite?: boolean): string | null {
  const clean = notes ? notes.replace(/\[favorite\]\s*/g, '').trim() : '';
  if (isFavorite) {
    return clean ? `[favorite] ${clean}` : '[favorite]';
  }
  return clean || null;
}

export function decodeMealNotes(notes?: string | null): { cleanNotes?: string; isFavorite: boolean } {
  if (!notes) return { isFavorite: false };
  const isFavorite = notes.includes('[favorite]');
  const clean = notes.replace(/\[favorite\]\s*/g, '').trim();
  return {
    cleanNotes: clean || undefined,
    isFavorite,
  };
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
        catalogId: item.catalog_id ?? undefined,
        portionUnit: item.portion_unit ?? undefined,
      });

      const list = itemsByMealId.get(item.meal_id) || [];
      list.push(normalizedItem);
      itemsByMealId.set(item.meal_id, list);
    }

    return mealRows.map((m) => {
      const isFavorite = m.is_favorite !== undefined && m.is_favorite !== null
        ? m.is_favorite === 1
        : Boolean(m.notes && m.notes.includes('[favorite]'));

      const cleanNotes = m.notes
        ? (m.notes.startsWith('[favorite] ') ? m.notes.slice(11).trim() : (m.notes === '[favorite]' ? undefined : m.notes))
        : undefined;

      const items = itemsByMealId.get(m.id) || [];
      const completeness = (m.nutrition_completeness as any) || (
        items.length > 0 ? 'complete' :
        ((m.total_calories > 0 && m.total_protein === 0 && m.total_carbs === 0 && m.total_fat === 0) ? 'indeterminate' : 'complete')
      );

      const proteinKnown = m.protein_known !== undefined && m.protein_known !== null
        ? m.protein_known === 1
        : completeness !== 'calories_only' && completeness !== 'indeterminate';

      const carbsKnown = m.carbs_known !== undefined && m.carbs_known !== null
        ? m.carbs_known === 1
        : completeness !== 'calories_only' && completeness !== 'indeterminate';

      const fatKnown = m.fat_known !== undefined && m.fat_known !== null
        ? m.fat_known === 1
        : completeness !== 'calories_only' && completeness !== 'indeterminate';

      return normalizeMeal({
        id: m.id,
        title: m.title,
        date: m.date,
        time: m.time,
        totalCalories: m.total_calories,
        totalProtein: m.total_protein,
        totalCarbs: m.total_carbs,
        totalFat: m.total_fat,
        mealType: m.meal_type ?? undefined,
        notes: cleanNotes,
        isFavorite,
        nutritionCompleteness: completeness,
        proteinKnown,
        carbsKnown,
        fatKnown,
        items,
      });
    });
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
        catalogId: item.catalog_id ?? undefined,
        portionUnit: item.portion_unit ?? undefined,
      })
    );

    const isFavorite = mealRow.is_favorite !== undefined && mealRow.is_favorite !== null
      ? mealRow.is_favorite === 1
      : Boolean(mealRow.notes && mealRow.notes.includes('[favorite]'));

    const cleanNotes = mealRow.notes
      ? (mealRow.notes.startsWith('[favorite] ') ? mealRow.notes.slice(11).trim() : (mealRow.notes === '[favorite]' ? undefined : mealRow.notes))
      : undefined;

    const completeness = (mealRow.nutrition_completeness as any) || (
      items.length > 0 ? 'complete' :
      ((mealRow.total_calories > 0 && mealRow.total_protein === 0 && mealRow.total_carbs === 0 && mealRow.total_fat === 0) ? 'indeterminate' : 'complete')
    );

    const proteinKnown = mealRow.protein_known !== undefined && mealRow.protein_known !== null
      ? mealRow.protein_known === 1
      : completeness !== 'calories_only' && completeness !== 'indeterminate';

    const carbsKnown = mealRow.carbs_known !== undefined && mealRow.carbs_known !== null
      ? mealRow.carbs_known === 1
      : completeness !== 'calories_only' && completeness !== 'indeterminate';

    const fatKnown = mealRow.fat_known !== undefined && mealRow.fat_known !== null
      ? mealRow.fat_known === 1
      : completeness !== 'calories_only' && completeness !== 'indeterminate';

    return normalizeMeal({
      id: mealRow.id,
      title: mealRow.title,
      date: mealRow.date,
      time: mealRow.time,
      totalCalories: mealRow.total_calories,
      totalProtein: mealRow.total_protein,
      totalCarbs: mealRow.total_carbs,
      totalFat: mealRow.total_fat,
      mealType: mealRow.meal_type ?? undefined,
      notes: cleanNotes,
      isFavorite,
      nutritionCompleteness: completeness,
      proteinKnown,
      carbsKnown,
      fatKnown,
      items,
    });
  }

  async insertMeal(meal: Meal, txn?: IDatabase): Promise<void> {
    const normalized = normalizeMeal(meal);
    validateMeal(normalized);
    const now = new Date().toISOString();

    const executeInTxn = async (t: IDatabase): Promise<void> => {
      const existing = await t.getFirstAsync<{ id: string }>(
        'SELECT id FROM meals WHERE id = ?;',
        normalized.id
      );
      if (existing) {
        throw new Error(`Cannot insert meal: Meal with id "${normalized.id}" already exists.`);
      }

      const mealCols = await getTableColumns(t, 'meals');
      const itemCols = await getTableColumns(t, 'meal_items');
      const hasCompleteness = mealCols.has('nutrition_completeness');
      const hasFavorite = mealCols.has('is_favorite');

      if (hasCompleteness && hasFavorite) {
        await t.runAsync(
          `INSERT INTO meals (id, title, date, time, total_calories, total_protein, total_carbs, total_fat, meal_type, notes, is_favorite, nutrition_completeness, protein_known, carbs_known, fat_known, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          normalized.id,
          normalized.title,
          normalized.date,
          normalized.time,
          normalized.totalCalories,
          normalized.totalProtein,
          normalized.totalCarbs,
          normalized.totalFat,
          normalized.mealType ?? null,
          normalized.notes ?? null,
          normalized.isFavorite ? 1 : 0,
          normalized.nutritionCompleteness ?? 'complete',
          normalized.proteinKnown !== false ? 1 : 0,
          normalized.carbsKnown !== false ? 1 : 0,
          normalized.fatKnown !== false ? 1 : 0,
          now
        );
      } else if (mealCols.has('meal_type') && mealCols.has('notes')) {
        await t.runAsync(
          `INSERT INTO meals (id, title, date, time, total_calories, total_protein, total_carbs, total_fat, meal_type, notes, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          normalized.id,
          normalized.title,
          normalized.date,
          normalized.time,
          normalized.totalCalories,
          normalized.totalProtein,
          normalized.totalCarbs,
          normalized.totalFat,
          normalized.mealType ?? null,
          normalized.notes ?? null,
          now
        );
      } else {
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
      }

      for (let i = 0; i < normalized.items.length; i++) {
        const item = normalizeMealItem(normalized.items[i]);
        if (itemCols.has('catalog_id') && itemCols.has('portion_unit')) {
          await t.runAsync(
            `INSERT INTO meal_items (id, meal_id, name, quantity, unit, calories, protein, carbs, fats, sort_order, catalog_id, portion_unit)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
            item.id,
            normalized.id,
            item.name,
            item.quantity,
            item.unit || 'g',
            item.calories,
            item.protein,
            item.carbs,
            item.fats,
            i,
            item.catalogId ?? null,
            item.portionUnit ?? null
          );
        } else {
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
    };

    if (txn) {
      await executeInTxn(txn);
    } else {
      await this.db.withExclusiveTransactionAsync(executeInTxn);
    }
  }

  async updateMeal(meal: Meal, txn?: IDatabase): Promise<void> {
    const normalized = normalizeMeal(meal);
    validateMeal(normalized);

    const executeInTxn = async (t: IDatabase): Promise<void> => {
      const existing = await t.getFirstAsync<{ id: string; created_at: string }>(
        'SELECT id, created_at FROM meals WHERE id = ?;',
        normalized.id
      );
      if (!existing) {
        throw new Error(`Cannot update meal: Meal with id "${normalized.id}" not found.`);
      }

      const mealCols = await getTableColumns(t, 'meals');
      const itemCols = await getTableColumns(t, 'meal_items');
      const hasCompleteness = mealCols.has('nutrition_completeness');
      const hasFavorite = mealCols.has('is_favorite');

      if (hasCompleteness && hasFavorite) {
        await t.runAsync(
          `UPDATE meals SET
             title = ?,
             date = ?,
             time = ?,
             total_calories = ?,
             total_protein = ?,
             total_carbs = ?,
             total_fat = ?,
             meal_type = ?,
             notes = ?,
             is_favorite = ?,
             nutrition_completeness = ?,
             protein_known = ?,
             carbs_known = ?,
             fat_known = ?
           WHERE id = ?;`,
          normalized.title,
          normalized.date,
          normalized.time,
          normalized.totalCalories,
          normalized.totalProtein,
          normalized.totalCarbs,
          normalized.totalFat,
          normalized.mealType ?? null,
          normalized.notes ?? null,
          normalized.isFavorite ? 1 : 0,
          normalized.nutritionCompleteness ?? 'complete',
          normalized.proteinKnown !== false ? 1 : 0,
          normalized.carbsKnown !== false ? 1 : 0,
          normalized.fatKnown !== false ? 1 : 0,
          normalized.id
        );
      } else if (mealCols.has('meal_type') && mealCols.has('notes')) {
        await t.runAsync(
          `UPDATE meals SET
             title = ?,
             date = ?,
             time = ?,
             total_calories = ?,
             total_protein = ?,
             total_carbs = ?,
             total_fat = ?,
             meal_type = ?,
             notes = ?
           WHERE id = ?;`,
          normalized.title,
          normalized.date,
          normalized.time,
          normalized.totalCalories,
          normalized.totalProtein,
          normalized.totalCarbs,
          normalized.totalFat,
          normalized.mealType ?? null,
          normalized.notes ?? null,
          normalized.id
        );
      } else {
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
      }

      // Re-synchronize child items atomically
      await t.runAsync('DELETE FROM meal_items WHERE meal_id = ?;', normalized.id);

      for (let i = 0; i < normalized.items.length; i++) {
        const item = normalizeMealItem(normalized.items[i]);
        if (itemCols.has('catalog_id') && itemCols.has('portion_unit')) {
          await t.runAsync(
            `INSERT INTO meal_items (id, meal_id, name, quantity, unit, calories, protein, carbs, fats, sort_order, catalog_id, portion_unit)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
            item.id,
            normalized.id,
            item.name,
            item.quantity,
            item.unit || 'g',
            item.calories,
            item.protein,
            item.carbs,
            item.fats,
            i,
            item.catalogId ?? null,
            item.portionUnit ?? null
          );
        } else {
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
    };

    if (txn) {
      await executeInTxn(txn);
    } else {
      await this.db.withExclusiveTransactionAsync(executeInTxn);
    }
  }

  async deleteMeal(id: string, txn?: IDatabase): Promise<void> {
    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      throw new Error('Cannot delete meal: A valid meal id must be provided.');
    }
    const cleanId = id.trim();

    const executeInTxn = async (t: IDatabase): Promise<void> => {
      const existing = await t.getFirstAsync<{ id: string }>(
        'SELECT id FROM meals WHERE id = ?;',
        cleanId
      );
      if (!existing) {
        throw new Error(`Cannot delete meal: Meal with id "${cleanId}" not found.`);
      }

      await t.runAsync('DELETE FROM meal_items WHERE meal_id = ?;', cleanId);
      await t.runAsync('DELETE FROM meals WHERE id = ?;', cleanId);
    };

    if (txn) {
      await executeInTxn(txn);
    } else {
      await this.db.withExclusiveTransactionAsync(executeInTxn);
    }
  }

  async toggleMealFavorite(id: string, isFavorite: boolean, txn?: IDatabase): Promise<void> {
    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      throw new Error('Cannot toggle favorite: A valid meal id must be provided.');
    }
    const cleanId = id.trim();

    const executeInTxn = async (t: IDatabase): Promise<void> => {
      const mealCols = await getTableColumns(t, 'meals');
      if (mealCols.has('is_favorite')) {
        await t.runAsync(
          'UPDATE meals SET is_favorite = ? WHERE id = ?;',
          isFavorite ? 1 : 0,
          cleanId
        );
      } else {
        const row = await t.getFirstAsync<MealRow>('SELECT notes FROM meals WHERE id = ?;', cleanId);
        if (row) {
          const clean = row.notes ? row.notes.replace(/\[favorite\]\s*/g, '').trim() : '';
          const newNotes = isFavorite ? (clean ? `[favorite] ${clean}` : '[favorite]') : (clean || null);
          await t.runAsync('UPDATE meals SET notes = ? WHERE id = ?;', newNotes, cleanId);
        }
      }
    };

    if (txn) {
      await executeInTxn(txn);
    } else {
      await this.db.withExclusiveTransactionAsync(executeInTxn);
    }
  }

  /**
   * Retained exclusively for initial backward-compatible seed/migration hydration.
   * MUST NEVER be invoked by runtime application CRUD mutations.
   */
  async saveAllMeals(meals: Meal[], txn?: IDatabase): Promise<void> {
    const now = new Date().toISOString();

    const executeInTxn = async (t: IDatabase): Promise<void> => {
      await t.runAsync('DELETE FROM meal_items;');
      await t.runAsync('DELETE FROM meals;');

      const mealCols = await getTableColumns(t, 'meals');
      const itemCols = await getTableColumns(t, 'meal_items');

      for (const meal of meals) {
        const normalized = normalizeMeal(meal);
        if (mealCols.has('meal_type') && mealCols.has('notes')) {
          await t.runAsync(
            `INSERT INTO meals (id, title, date, time, total_calories, total_protein, total_carbs, total_fat, meal_type, notes, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
            normalized.id,
            normalized.title,
            normalized.date,
            normalized.time,
            normalized.totalCalories,
            normalized.totalProtein,
            normalized.totalCarbs,
            normalized.totalFat,
            normalized.mealType ?? null,
            normalized.notes ?? null,
            now
          );
        } else {
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
        }

        for (let i = 0; i < normalized.items.length; i++) {
          const item = normalizeMealItem(normalized.items[i]);
          if (itemCols.has('catalog_id') && itemCols.has('portion_unit')) {
            await t.runAsync(
              `INSERT INTO meal_items (id, meal_id, name, quantity, unit, calories, protein, carbs, fats, sort_order, catalog_id, portion_unit)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
              item.id,
              normalized.id,
              item.name,
              item.quantity,
              item.unit || 'g',
              item.calories,
              item.protein,
              item.carbs,
              item.fats,
              i,
              item.catalogId ?? null,
              item.portionUnit ?? null
            );
          } else {
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
      }
    };

    if (txn) {
      await executeInTxn(txn);
    } else {
      await this.db.withExclusiveTransactionAsync(executeInTxn);
    }
  }
}
