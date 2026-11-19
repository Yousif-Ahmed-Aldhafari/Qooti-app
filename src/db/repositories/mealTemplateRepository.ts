import { IDatabase, MealTemplateRepository } from '../types';
import { MealTemplate, MealTemplateItem, normalizeMealTemplate } from '../../models/mealTemplate';
import { NutritionCompleteness } from '../../models/meal';

interface MealTemplateRow {
  id: string;
  title: string;
  meal_type?: string | null;
  notes?: string | null;
  is_favorite: number;
  total_calories?: number;
  total_protein?: number;
  total_carbs?: number;
  total_fat?: number;
  nutrition_completeness?: string | null;
  protein_known?: number | null;
  carbs_known?: number | null;
  fat_known?: number | null;
  review_status?: string | null;
  created_at: string;
  updated_at: string;
}

interface MealTemplateItemRow {
  id: string;
  template_id: string;
  name: string;
  quantity: number;
  unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  catalog_id?: string | null;
  portion_unit?: string | null;
  sort_order: number;
}

async function getTableColumns(t: IDatabase, tableName: string): Promise<Set<string>> {
  const cols = await t.getAllAsync<{ name: string }>(`PRAGMA table_info(${tableName});`);
  return new Set(cols.map((c) => c.name));
}

export class SQLiteMealTemplateRepository implements MealTemplateRepository {
  constructor(private db: IDatabase) {}

  async getAllTemplates(): Promise<MealTemplate[]> {
    const templateRows = await this.db.getAllAsync<MealTemplateRow>(
      'SELECT * FROM meal_templates ORDER BY is_favorite DESC, updated_at DESC;'
    );
    if (templateRows.length === 0) {
      return [];
    }

    const itemRows = await this.db.getAllAsync<MealTemplateItemRow>(
      'SELECT * FROM meal_template_items ORDER BY sort_order ASC;'
    );

    const itemsByTemplateId = new Map<string, MealTemplateItem[]>();
    for (const item of itemRows) {
      const list = itemsByTemplateId.get(item.template_id) || [];
      list.push({
        id: item.id,
        templateId: item.template_id,
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        calories: item.calories,
        protein: item.protein,
        carbs: item.carbs,
        fats: item.fats,
        catalogId: item.catalog_id ?? undefined,
        portionUnit: item.portion_unit ?? undefined,
        sortOrder: item.sort_order,
      });
      itemsByTemplateId.set(item.template_id, list);
    }

    return templateRows.map((t) => {
      const items = itemsByTemplateId.get(t.id) || [];
      return normalizeMealTemplate({
        id: t.id,
        title: t.title,
        mealType: t.meal_type ?? undefined,
        notes: t.notes ?? undefined,
        isFavorite: t.is_favorite === 1,
        totalCalories: t.total_calories,
        totalProtein: t.total_protein,
        totalCarbs: t.total_carbs,
        totalFat: t.total_fat,
        nutritionCompleteness: (t.nutrition_completeness as NutritionCompleteness) ?? undefined,
        proteinKnown: t.protein_known !== undefined && t.protein_known !== null ? t.protein_known === 1 : undefined,
        carbsKnown: t.carbs_known !== undefined && t.carbs_known !== null ? t.carbs_known === 1 : undefined,
        fatKnown: t.fat_known !== undefined && t.fat_known !== null ? t.fat_known === 1 : undefined,
        reviewStatus: (t.review_status as any) ?? undefined,
        createdAt: t.created_at,
        updatedAt: t.updated_at,
        items,
      });
    });
  }

  async getTemplateById(id: string, txn?: IDatabase): Promise<MealTemplate | null> {
    const db = txn || this.db;
    const templateRow = await db.getFirstAsync<MealTemplateRow>(
      'SELECT * FROM meal_templates WHERE id = ?;',
      id
    );
    if (!templateRow) {
      return null;
    }

    const itemRows = await db.getAllAsync<MealTemplateItemRow>(
      'SELECT * FROM meal_template_items WHERE template_id = ? ORDER BY sort_order ASC;',
      id
    );

    const items: MealTemplateItem[] = itemRows.map((item) => ({
      id: item.id,
      templateId: item.template_id,
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      calories: item.calories,
      protein: item.protein,
      carbs: item.carbs,
      fats: item.fats,
      catalogId: item.catalog_id ?? undefined,
      portionUnit: item.portion_unit ?? undefined,
      sortOrder: item.sort_order,
    }));

    return normalizeMealTemplate({
      id: templateRow.id,
      title: templateRow.title,
      mealType: templateRow.meal_type ?? undefined,
      notes: templateRow.notes ?? undefined,
      isFavorite: templateRow.is_favorite === 1,
      totalCalories: templateRow.total_calories,
      totalProtein: templateRow.total_protein,
      totalCarbs: templateRow.total_carbs,
      totalFat: templateRow.total_fat,
      nutritionCompleteness: (templateRow.nutrition_completeness as NutritionCompleteness) ?? undefined,
      proteinKnown: templateRow.protein_known !== undefined && templateRow.protein_known !== null ? templateRow.protein_known === 1 : undefined,
      carbsKnown: templateRow.carbs_known !== undefined && templateRow.carbs_known !== null ? templateRow.carbs_known === 1 : undefined,
      fatKnown: templateRow.fat_known !== undefined && templateRow.fat_known !== null ? templateRow.fat_known === 1 : undefined,
      reviewStatus: (templateRow.review_status as any) ?? undefined,
      createdAt: templateRow.created_at,
      updatedAt: templateRow.updated_at,
      items,
    });
  }

  async createTemplate(template: MealTemplate, txn?: IDatabase): Promise<MealTemplate> {
    const normalized = normalizeMealTemplate(template);

    const operation = async (t: IDatabase) => {
      const cols = await getTableColumns(t, 'meal_templates');
      const hasTotals = cols.has('total_calories');
      const hasReviewStatus = cols.has('review_status');

      if (hasTotals) {
        if (hasReviewStatus) {
          await t.runAsync(
            `INSERT INTO meal_templates (
              id, title, meal_type, notes, is_favorite,
              total_calories, total_protein, total_carbs, total_fat,
              nutrition_completeness, protein_known, carbs_known, fat_known,
              review_status, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
            normalized.id,
            normalized.title,
            normalized.mealType ?? null,
            normalized.notes ?? null,
            normalized.isFavorite ? 1 : 0,
            normalized.totalCalories,
            normalized.totalProtein ?? 0,
            normalized.totalCarbs ?? 0,
            normalized.totalFat ?? 0,
            normalized.nutritionCompleteness ?? 'complete',
            normalized.proteinKnown !== false ? 1 : 0,
            normalized.carbsKnown !== false ? 1 : 0,
            normalized.fatKnown !== false ? 1 : 0,
            normalized.reviewStatus ?? 'confirmed',
            normalized.createdAt,
            normalized.updatedAt
          );
        } else {
          await t.runAsync(
            `INSERT INTO meal_templates (
              id, title, meal_type, notes, is_favorite,
              total_calories, total_protein, total_carbs, total_fat,
              nutrition_completeness, protein_known, carbs_known, fat_known,
              created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
            normalized.id,
            normalized.title,
            normalized.mealType ?? null,
            normalized.notes ?? null,
            normalized.isFavorite ? 1 : 0,
            normalized.totalCalories,
            normalized.totalProtein ?? 0,
            normalized.totalCarbs ?? 0,
            normalized.totalFat ?? 0,
            normalized.nutritionCompleteness ?? 'complete',
            normalized.proteinKnown !== false ? 1 : 0,
            normalized.carbsKnown !== false ? 1 : 0,
            normalized.fatKnown !== false ? 1 : 0,
            normalized.createdAt,
            normalized.updatedAt
          );
        }
      } else {
        await t.runAsync(
          `INSERT INTO meal_templates (id, title, meal_type, notes, is_favorite, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?);`,
          normalized.id,
          normalized.title,
          normalized.mealType ?? null,
          normalized.notes ?? null,
          normalized.isFavorite ? 1 : 0,
          normalized.createdAt,
          normalized.updatedAt
        );
      }

      for (let i = 0; i < normalized.items.length; i++) {
        const item = normalized.items[i];
        await t.runAsync(
          `INSERT INTO meal_template_items (id, template_id, name, quantity, unit, calories, protein, carbs, fats, catalog_id, portion_unit, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          item.id,
          normalized.id,
          item.name,
          item.quantity,
          item.unit,
          item.calories,
          item.protein,
          item.carbs,
          item.fats,
          item.catalogId ?? null,
          item.portionUnit ?? null,
          item.sortOrder ?? i
        );
      }
    };

    if (txn) {
      await operation(txn);
    } else {
      await this.db.withExclusiveTransactionAsync(operation);
    }

    return normalized;
  }

  async updateTemplate(template: MealTemplate, txn?: IDatabase): Promise<MealTemplate> {
    const normalized = normalizeMealTemplate({
      ...template,
      updatedAt: new Date().toISOString(),
    });

    const operation = async (t: IDatabase) => {
      const cols = await getTableColumns(t, 'meal_templates');
      const hasTotals = cols.has('total_calories');
      const hasReviewStatus = cols.has('review_status');

      if (hasTotals) {
        if (hasReviewStatus) {
          await t.runAsync(
            `UPDATE meal_templates
             SET title = ?, meal_type = ?, notes = ?, is_favorite = ?,
                 total_calories = ?, total_protein = ?, total_carbs = ?, total_fat = ?,
                 nutrition_completeness = ?, protein_known = ?, carbs_known = ?, fat_known = ?,
                 review_status = ?, updated_at = ?
             WHERE id = ?;`,
            normalized.title,
            normalized.mealType ?? null,
            normalized.notes ?? null,
            normalized.isFavorite ? 1 : 0,
            normalized.totalCalories,
            normalized.totalProtein ?? 0,
            normalized.totalCarbs ?? 0,
            normalized.totalFat ?? 0,
            normalized.nutritionCompleteness ?? 'complete',
            normalized.proteinKnown !== false ? 1 : 0,
            normalized.carbsKnown !== false ? 1 : 0,
            normalized.fatKnown !== false ? 1 : 0,
            normalized.reviewStatus ?? 'confirmed',
            normalized.updatedAt,
            normalized.id
          );
        } else {
          await t.runAsync(
            `UPDATE meal_templates
             SET title = ?, meal_type = ?, notes = ?, is_favorite = ?,
                 total_calories = ?, total_protein = ?, total_carbs = ?, total_fat = ?,
                 nutrition_completeness = ?, protein_known = ?, carbs_known = ?, fat_known = ?,
                 updated_at = ?
             WHERE id = ?;`,
            normalized.title,
            normalized.mealType ?? null,
            normalized.notes ?? null,
            normalized.isFavorite ? 1 : 0,
            normalized.totalCalories,
            normalized.totalProtein ?? 0,
            normalized.totalCarbs ?? 0,
            normalized.totalFat ?? 0,
            normalized.nutritionCompleteness ?? 'complete',
            normalized.proteinKnown !== false ? 1 : 0,
            normalized.carbsKnown !== false ? 1 : 0,
            normalized.fatKnown !== false ? 1 : 0,
            normalized.updatedAt,
            normalized.id
          );
        }
      } else {
        await t.runAsync(
          `UPDATE meal_templates
           SET title = ?, meal_type = ?, notes = ?, is_favorite = ?, updated_at = ?
           WHERE id = ?;`,
          normalized.title,
          normalized.mealType ?? null,
          normalized.notes ?? null,
          normalized.isFavorite ? 1 : 0,
          normalized.updatedAt,
          normalized.id
        );
      }

      // Replace child items atomically
      await t.runAsync('DELETE FROM meal_template_items WHERE template_id = ?;', normalized.id);

      for (let i = 0; i < normalized.items.length; i++) {
        const item = normalized.items[i];
        await t.runAsync(
          `INSERT INTO meal_template_items (id, template_id, name, quantity, unit, calories, protein, carbs, fats, catalog_id, portion_unit, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          item.id,
          normalized.id,
          item.name,
          item.quantity,
          item.unit,
          item.calories,
          item.protein,
          item.carbs,
          item.fats,
          item.catalogId ?? null,
          item.portionUnit ?? null,
          item.sortOrder ?? i
        );
      }
    };

    if (txn) {
      await operation(txn);
    } else {
      await this.db.withExclusiveTransactionAsync(operation);
    }

    return normalized;
  }

  async deleteTemplate(id: string, txn?: IDatabase): Promise<void> {
    const operation = async (t: IDatabase) => {
      await t.runAsync('DELETE FROM meal_template_items WHERE template_id = ?;', id);
      await t.runAsync('DELETE FROM meal_templates WHERE id = ?;', id);
    };

    if (txn) {
      await operation(txn);
    } else {
      await this.db.withExclusiveTransactionAsync(operation);
    }
  }

  async toggleTemplateFavorite(id: string, isFavorite: boolean, txn?: IDatabase): Promise<void> {
    const now = new Date().toISOString();
    const operation = async (t: IDatabase) => {
      await t.runAsync(
        'UPDATE meal_templates SET is_favorite = ?, updated_at = ? WHERE id = ?;',
        isFavorite ? 1 : 0,
        now,
        id
      );
    };

    if (txn) {
      await operation(txn);
    } else {
      await this.db.withExclusiveTransactionAsync(operation);
    }
  }

  async reconfirmTemplate(
    id: string,
    completeness: NutritionCompleteness,
    macros?: {
      proteinKnown?: boolean;
      carbsKnown?: boolean;
      fatKnown?: boolean;
      totalCalories?: number;
      totalProtein?: number;
      totalCarbs?: number;
      totalFat?: number;
      items?: MealTemplateItem[];
    },
    txn?: IDatabase
  ): Promise<MealTemplate> {
    const existing = await this.getTemplateById(id, txn);
    if (!existing) {
      throw new Error(`Template not found: ${id}`);
    }

    const isMultiItem = existing.items && existing.items.length > 1;
    let items = existing.items || [];

    const hasAggregateEdits =
      (macros?.totalCalories !== undefined && macros.totalCalories !== existing.totalCalories) ||
      (macros?.totalProtein !== undefined && macros.totalProtein !== existing.totalProtein) ||
      (macros?.totalCarbs !== undefined && macros.totalCarbs !== existing.totalCarbs) ||
      (macros?.totalFat !== undefined && macros.totalFat !== existing.totalFat);

    if (isMultiItem) {
      if (macros?.items && macros.items.length > 0) {
        if (macros.items.length !== existing.items.length) {
          throw new Error('Item count mismatch: per-item corrections must include all existing items.');
        }
        items = macros.items.map((it, idx) => {
          const orig = existing.items[idx];
          return {
            ...orig,
            name: it.name || orig.name,
            quantity: it.quantity > 0 ? it.quantity : orig.quantity,
            unit: it.unit || orig.unit,
            calories: Math.max(0, it.calories !== undefined ? it.calories : orig.calories),
            protein: Math.max(0, it.protein !== undefined ? it.protein : orig.protein),
            carbs: Math.max(0, it.carbs !== undefined ? it.carbs : orig.carbs),
            fats: Math.max(0, it.fats !== undefined ? it.fats : (it as any).fat !== undefined ? (it as any).fat : orig.fats),
          };
        });
      } else if (hasAggregateEdits) {
        throw new Error(
          'Aggregate nutrient corrections are not supported for multi-item templates without item breakdown. Please provide per-item corrections.'
        );
      }
    } else if (existing.items && existing.items.length === 1) {
      if (macros?.items && macros.items.length === 1) {
        const it = macros.items[0];
        const orig = existing.items[0];
        items = [
          {
            ...orig,
            name: it.name || orig.name,
            quantity: it.quantity > 0 ? it.quantity : orig.quantity,
            unit: it.unit || orig.unit,
            calories: Math.max(0, it.calories !== undefined ? it.calories : orig.calories),
            protein: Math.max(0, it.protein !== undefined ? it.protein : orig.protein),
            carbs: Math.max(0, it.carbs !== undefined ? it.carbs : orig.carbs),
            fats: Math.max(0, it.fats !== undefined ? it.fats : (it as any).fat !== undefined ? (it as any).fat : orig.fats),
          },
        ];
      } else if (hasAggregateEdits || macros?.totalCalories !== undefined) {
        const orig = existing.items[0];
        items = [
          {
            ...orig,
            calories: macros?.totalCalories !== undefined ? macros.totalCalories : orig.calories,
            protein: macros?.totalProtein !== undefined ? macros.totalProtein : orig.protein,
            carbs: macros?.totalCarbs !== undefined ? macros.totalCarbs : orig.carbs,
            fats: macros?.totalFat !== undefined ? macros.totalFat : orig.fats,
          },
        ];
      }
    }

    let computedCalories = macros?.totalCalories !== undefined ? macros.totalCalories : existing.totalCalories;
    let computedProtein = macros?.totalProtein !== undefined ? macros.totalProtein : existing.totalProtein;
    let computedCarbs = macros?.totalCarbs !== undefined ? macros.totalCarbs : existing.totalCarbs;
    let computedFat = macros?.totalFat !== undefined ? macros.totalFat : existing.totalFat;

    if (items.length > 0) {
      computedCalories = items.reduce((sum, it) => sum + it.calories, 0);
      computedProtein = Math.round(items.reduce((sum, it) => sum + it.protein, 0) * 10) / 10;
      computedCarbs = Math.round(items.reduce((sum, it) => sum + it.carbs, 0) * 10) / 10;
      computedFat = Math.round(items.reduce((sum, it) => sum + it.fats, 0) * 10) / 10;
    }

    const updated = normalizeMealTemplate({
      ...existing,
      items,
      totalCalories: computedCalories,
      totalProtein: computedProtein,
      totalCarbs: computedCarbs,
      totalFat: computedFat,
      nutritionCompleteness: completeness,
      proteinKnown: macros?.proteinKnown !== undefined ? macros.proteinKnown : (completeness === 'complete'),
      carbsKnown: macros?.carbsKnown !== undefined ? macros.carbsKnown : (completeness === 'complete'),
      fatKnown: macros?.fatKnown !== undefined ? macros.fatKnown : (completeness === 'complete'),
      reviewStatus: 'confirmed',
      updatedAt: new Date().toISOString(),
    });

    return this.updateTemplate(updated, txn);
  }
}
