import { getDatabase } from '../db/database';
import { SQLiteMealTemplateRepository } from '../db/repositories/mealTemplateRepository';
import type { MealTemplate } from '../models/mealTemplate';

export async function getMealTemplateRepository(): Promise<SQLiteMealTemplateRepository> {
  const db = await getDatabase();
  return new SQLiteMealTemplateRepository(db);
}

export async function loadMealTemplates(): Promise<MealTemplate[]> {
  const repo = await getMealTemplateRepository();
  return await repo.getAllTemplates();
}

export async function getMealTemplateById(id: string): Promise<MealTemplate | null> {
  const repo = await getMealTemplateRepository();
  return await repo.getTemplateById(id);
}

export async function insertMealTemplate(template: MealTemplate): Promise<MealTemplate> {
  const repo = await getMealTemplateRepository();
  return await repo.createTemplate(template);
}

export async function updateMealTemplate(template: MealTemplate): Promise<MealTemplate> {
  const repo = await getMealTemplateRepository();
  return await repo.updateTemplate(template);
}

export async function deleteMealTemplate(id: string): Promise<void> {
  const repo = await getMealTemplateRepository();
  await repo.deleteTemplate(id);
}

export async function toggleMealTemplateFavorite(id: string, isFavorite: boolean): Promise<void> {
  const repo = await getMealTemplateRepository();
  await repo.toggleTemplateFavorite(id, isFavorite);
}
