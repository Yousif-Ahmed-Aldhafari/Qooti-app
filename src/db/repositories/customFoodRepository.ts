/**
 * SQLite Custom Food Repository.
 * Provides offline persistence for user-created custom foods with strict validation,
 * transaction ownership hardening, and bilingual search.
 */

import { IDatabase, CustomFoodRepository } from '../types';
import { CustomFood, validateCustomFood, FoodValidationError } from '../../models/food';
import { normalizeSearchText } from '../../utils/foodSearch';

interface CustomFoodRow {
  id: string;
  name: string;
  name_ar: string | null;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  serving_size: number;
  serving_unit: string;
  category: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

function mapRowToCustomFood(row: CustomFoodRow): CustomFood {
  return {
    id: row.id,
    name: row.name,
    nameAr: row.name_ar ?? undefined,
    calories: row.calories,
    protein: row.protein,
    carbs: row.carbs,
    fats: row.fats,
    servingSize: row.serving_size,
    servingUnit: row.serving_unit,
    category: row.category ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SQLiteCustomFoodRepository implements CustomFoodRepository {
  constructor(private db: IDatabase) {}

  async getAllCustomFoods(txn?: IDatabase): Promise<CustomFood[]> {
    const client = txn || this.db;
    const rows = await client.getAllAsync<CustomFoodRow>(
      'SELECT * FROM custom_foods ORDER BY name ASC;'
    );
    return rows.map(mapRowToCustomFood);
  }

  async getCustomFoodById(id: string, txn?: IDatabase): Promise<CustomFood | null> {
    if (!id || typeof id !== 'string') return null;
    const client = txn || this.db;
    const row = await client.getFirstAsync<CustomFoodRow>(
      'SELECT * FROM custom_foods WHERE id = ?;',
      id.trim()
    );
    return row ? mapRowToCustomFood(row) : null;
  }

  async insertCustomFood(food: CustomFood, txn?: IDatabase): Promise<void> {
    validateCustomFood(food);
    const now = new Date().toISOString();

    const executeInTxn = async (t: IDatabase): Promise<void> => {
      const existing = await t.getFirstAsync<{ id: string }>(
        'SELECT id FROM custom_foods WHERE id = ?;',
        food.id
      );
      if (existing) {
        throw new FoodValidationError(
          `Cannot insert custom food: Food with id "${food.id}" already exists.`,
          'id'
        );
      }

      await t.runAsync(
        `INSERT INTO custom_foods (
           id, name, name_ar, calories, protein, carbs, fats,
           serving_size, serving_unit, category, notes, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        food.id,
        food.name.trim(),
        food.nameAr ? food.nameAr.trim() : null,
        food.calories,
        food.protein,
        food.carbs,
        food.fats,
        food.servingSize,
        food.servingUnit.trim(),
        food.category ? String(food.category).trim() : 'custom',
        food.notes ? food.notes.trim() : null,
        food.createdAt || now,
        food.updatedAt || now
      );
    };

    if (txn) {
      await executeInTxn(txn);
    } else {
      await this.db.withExclusiveTransactionAsync(executeInTxn);
    }
  }

  async updateCustomFood(food: CustomFood, txn?: IDatabase): Promise<void> {
    validateCustomFood(food);
    const now = new Date().toISOString();

    const executeInTxn = async (t: IDatabase): Promise<void> => {
      const existing = await t.getFirstAsync<{ id: string }>(
        'SELECT id FROM custom_foods WHERE id = ?;',
        food.id
      );
      if (!existing) {
        throw new FoodValidationError(
          `Cannot update custom food: Food with id "${food.id}" not found.`,
          'id'
        );
      }

      await t.runAsync(
        `UPDATE custom_foods SET
           name = ?,
           name_ar = ?,
           calories = ?,
           protein = ?,
           carbs = ?,
           fats = ?,
           serving_size = ?,
           serving_unit = ?,
           category = ?,
           notes = ?,
           updated_at = ?
         WHERE id = ?;`,
        food.name.trim(),
        food.nameAr ? food.nameAr.trim() : null,
        food.calories,
        food.protein,
        food.carbs,
        food.fats,
        food.servingSize,
        food.servingUnit.trim(),
        food.category ? String(food.category).trim() : 'custom',
        food.notes ? food.notes.trim() : null,
        now,
        food.id
      );
    };

    if (txn) {
      await executeInTxn(txn);
    } else {
      await this.db.withExclusiveTransactionAsync(executeInTxn);
    }
  }

  async deleteCustomFood(id: string, txn?: IDatabase): Promise<void> {
    if (!id || typeof id !== 'string' || !id.trim()) {
      throw new FoodValidationError('Cannot delete custom food: A valid id must be provided.', 'id');
    }
    const cleanId = id.trim();

    const executeInTxn = async (t: IDatabase): Promise<void> => {
      const existing = await t.getFirstAsync<{ id: string }>(
        'SELECT id FROM custom_foods WHERE id = ?;',
        cleanId
      );
      if (!existing) {
        throw new FoodValidationError(
          `Cannot delete custom food: Food with id "${cleanId}" not found.`,
          'id'
        );
      }

      // Safe deletion: deletes custom food template only, preserving historical meal snapshots
      await t.runAsync('DELETE FROM custom_foods WHERE id = ?;', cleanId);
    };

    if (txn) {
      await executeInTxn(txn);
    } else {
      await this.db.withExclusiveTransactionAsync(executeInTxn);
    }
  }

  async searchCustomFoods(query: string, txn?: IDatabase): Promise<CustomFood[]> {
    const all = await this.getAllCustomFoods(txn);
    if (!query || typeof query !== 'string' || !query.trim()) {
      return all;
    }
    const normalizedQuery = normalizeSearchText(query);
    return all.filter((f) => {
      const normName = normalizeSearchText(f.name);
      const normNameAr = f.nameAr ? normalizeSearchText(f.nameAr) : '';
      return normName.includes(normalizedQuery) || normNameAr.includes(normalizedQuery);
    });
  }
}
