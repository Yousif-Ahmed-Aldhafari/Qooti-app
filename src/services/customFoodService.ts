/**
 * Custom Food Service.
 * Business logic layer for managing user-created custom foods.
 */

import { CustomFoodRepository, IDatabase } from '../db/types';
import { CustomFood, validateCustomFood } from '../models/food';

export async function getCustomFoodsService(
  repo: CustomFoodRepository,
  txn?: IDatabase
): Promise<CustomFood[]> {
  return repo.getAllCustomFoods(txn);
}

export async function getCustomFoodByIdService(
  id: string,
  repo: CustomFoodRepository,
  txn?: IDatabase
): Promise<CustomFood | null> {
  return repo.getCustomFoodById(id, txn);
}

export async function createCustomFoodService(
  food: CustomFood,
  repo: CustomFoodRepository,
  txn?: IDatabase
): Promise<void> {
  validateCustomFood(food);
  await repo.insertCustomFood(food, txn);
}

export async function updateCustomFoodService(
  food: CustomFood,
  repo: CustomFoodRepository,
  txn?: IDatabase
): Promise<void> {
  validateCustomFood(food);
  await repo.updateCustomFood(food, txn);
}

export async function deleteCustomFoodService(
  id: string,
  repo: CustomFoodRepository,
  txn?: IDatabase
): Promise<void> {
  await repo.deleteCustomFood(id, txn);
}

export async function searchCustomFoodsService(
  query: string,
  repo: CustomFoodRepository,
  txn?: IDatabase
): Promise<CustomFood[]> {
  return repo.searchCustomFoods(query, txn);
}
