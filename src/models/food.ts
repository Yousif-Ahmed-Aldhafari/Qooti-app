/**
 * Canonical Food Domain Models & Types.
 * Defines FoodCatalogEntry, ServingOption, CustomFood, and validation rules.
 */

export type FoodCategory =
  | 'meat_poultry'
  | 'fish_seafood'
  | 'eggs_dairy'
  | 'grains_breads'
  | 'rice_pasta'
  | 'legumes'
  | 'fruits_vegetables'
  | 'nuts_seeds'
  | 'oils_fats'
  | 'middle_eastern'
  | 'regional_middle_eastern'
  | 'beverages'
  | 'custom';

export type PreparationState = 'raw' | 'cooked' | 'dried' | 'canned' | 'fresh' | 'roasted';

export type ServingOption = {
  id: string; // e.g. 'piece', 'cup', 'tbsp', 'serving', 'g', '100g'
  nameEn: string;
  nameAr: string;
  labelEn?: string;
  labelAr?: string;
  grams: number; // Mass basis in grams
};

export type ProvenanceStatus = 'VERIFIED' | 'ESTIMATED' | 'UNVERIFIED' | 'MISMATCH';

export type FoodCatalogEntry = {
  id: string; // Canonical stable slug (e.g. 'chicken-breast-cooked')
  nameEn: string;
  nameAr: string;
  category: FoodCategory;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatsPer100g: number;
  fatPer100g?: number;
  servingOptions: ServingOption[];
  sourceName: string; // e.g. 'USDA FoodData Central' or 'SFDA'
  sourceReference: string; // e.g. FDC ID or published table code
  sourceUrl?: string;
  source?: string;
  dataVersion: string; // e.g. '1.0.0'
  preparationState?: PreparationState | string;
  provenanceStatus?: ProvenanceStatus;
  recipeNotes?: string;
};

export type CustomFood = {
  id: string; // Custom food identifier (prefixed with 'cf_' or unique UUID)
  name: string;
  nameAr?: string;
  brand?: string;
  calories: number; // Stored per serving (or per servingSize)
  protein: number;
  carbs: number;
  fats: number;
  servingSize: number; // In grams
  servingUnit: string; // e.g. 'g', 'piece', 'serving', 'cup'
  category?: FoodCategory | string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export class FoodValidationError extends Error {
  constructor(message: string, public readonly field?: string) {
    super(message);
    this.name = 'FoodValidationError';
  }
}

export function validateServingOption(option: ServingOption, foodId?: string): void {
  const prefix = foodId ? `Serving option in food "${foodId}"` : 'Serving option';
  if (!option.id || typeof option.id !== 'string' || !option.id.trim()) {
    throw new FoodValidationError(`${prefix} must have a valid id.`, 'id');
  }
  if (!option.nameEn || typeof option.nameEn !== 'string' || !option.nameEn.trim()) {
    throw new FoodValidationError(`${prefix} must have an English name (nameEn).`, 'nameEn');
  }
  if (!option.nameAr || typeof option.nameAr !== 'string' || !option.nameAr.trim()) {
    throw new FoodValidationError(`${prefix} must have an Arabic name (nameAr).`, 'nameAr');
  }
  if (
    typeof option.grams !== 'number' ||
    !Number.isFinite(option.grams) ||
    option.grams <= 0 ||
    option.grams > 10_000
  ) {
    throw new FoodValidationError(
      `${prefix} grams must be a positive finite number <= 10,000g.`,
      'grams'
    );
  }
}

export function validateFoodCatalogEntry(entry: FoodCatalogEntry): void {
  if (!entry.id || typeof entry.id !== 'string' || !entry.id.trim()) {
    throw new FoodValidationError('Food catalog entry must have a valid non-empty id.', 'id');
  }
  if (!entry.nameEn || typeof entry.nameEn !== 'string' || !entry.nameEn.trim()) {
    throw new FoodValidationError(`Food "${entry.id}" must have an English name (nameEn).`, 'nameEn');
  }
  if (!entry.nameAr || typeof entry.nameAr !== 'string' || !entry.nameAr.trim()) {
    throw new FoodValidationError(`Food "${entry.id}" must have an Arabic name (nameAr).`, 'nameAr');
  }
  if (!entry.category || typeof entry.category !== 'string' || !entry.category.trim()) {
    throw new FoodValidationError(`Food "${entry.id}" must have a valid category.`, 'category');
  }
  if (
    typeof entry.caloriesPer100g !== 'number' ||
    !Number.isFinite(entry.caloriesPer100g) ||
    entry.caloriesPer100g < 0 ||
    entry.caloriesPer100g > 1000
  ) {
    throw new FoodValidationError(
      `Food "${entry.id}" caloriesPer100g must be between 0 and 1000.`,
      'caloriesPer100g'
    );
  }
  if (
    typeof entry.proteinPer100g !== 'number' ||
    !Number.isFinite(entry.proteinPer100g) ||
    entry.proteinPer100g < 0 ||
    entry.proteinPer100g > 100
  ) {
    throw new FoodValidationError(
      `Food "${entry.id}" proteinPer100g must be between 0 and 100g.`,
      'proteinPer100g'
    );
  }
  if (
    typeof entry.carbsPer100g !== 'number' ||
    !Number.isFinite(entry.carbsPer100g) ||
    entry.carbsPer100g < 0 ||
    entry.carbsPer100g > 100
  ) {
    throw new FoodValidationError(
      `Food "${entry.id}" carbsPer100g must be between 0 and 100g.`,
      'carbsPer100g'
    );
  }
  if (
    typeof entry.fatsPer100g !== 'number' ||
    !Number.isFinite(entry.fatsPer100g) ||
    entry.fatsPer100g < 0 ||
    entry.fatsPer100g > 100
  ) {
    throw new FoodValidationError(
      `Food "${entry.id}" fatsPer100g must be between 0 and 100g.`,
      'fatsPer100g'
    );
  }
  if (!Array.isArray(entry.servingOptions) || entry.servingOptions.length === 0) {
    throw new FoodValidationError(
      `Food "${entry.id}" must have at least one serving option.`,
      'servingOptions'
    );
  }
  for (const opt of entry.servingOptions) {
    validateServingOption(opt, entry.id);
  }
  if (!entry.sourceName || typeof entry.sourceName !== 'string' || !entry.sourceName.trim()) {
    throw new FoodValidationError(`Food "${entry.id}" must have a source name.`, 'sourceName');
  }
  if (!entry.sourceReference || typeof entry.sourceReference !== 'string' || !entry.sourceReference.trim()) {
    throw new FoodValidationError(`Food "${entry.id}" must have a source reference.`, 'sourceReference');
  }
  if (!entry.dataVersion || typeof entry.dataVersion !== 'string' || !entry.dataVersion.trim()) {
    throw new FoodValidationError(`Food "${entry.id}" must have a data version.`, 'dataVersion');
  }
}

export function validateCustomFood(food: CustomFood): void {
  if (!food.id || typeof food.id !== 'string' || !food.id.trim()) {
    throw new FoodValidationError('Custom food must have a valid non-empty id.', 'id');
  }
  if (!food.name || typeof food.name !== 'string' || !food.name.trim()) {
    throw new FoodValidationError('Custom food name is required.', 'name');
  }
  if (
    typeof food.calories !== 'number' ||
    !Number.isFinite(food.calories) ||
    food.calories < 0 ||
    food.calories > 100_000
  ) {
    throw new FoodValidationError(
      'Custom food calories must be a valid non-negative number.',
      'calories'
    );
  }
  if (
    typeof food.protein !== 'number' ||
    !Number.isFinite(food.protein) ||
    food.protein < 0 ||
    food.protein > 100_000
  ) {
    throw new FoodValidationError(
      'Custom food protein must be a valid non-negative number.',
      'protein'
    );
  }
  if (
    typeof food.carbs !== 'number' ||
    !Number.isFinite(food.carbs) ||
    food.carbs < 0 ||
    food.carbs > 100_000
  ) {
    throw new FoodValidationError(
      'Custom food carbs must be a valid non-negative number.',
      'carbs'
    );
  }
  if (
    typeof food.fats !== 'number' ||
    !Number.isFinite(food.fats) ||
    food.fats < 0 ||
    food.fats > 100_000
  ) {
    throw new FoodValidationError(
      'Custom food fats must be a valid non-negative number.',
      'fats'
    );
  }
  if (
    typeof food.servingSize !== 'number' ||
    !Number.isFinite(food.servingSize) ||
    food.servingSize <= 0 ||
    food.servingSize > 100_000
  ) {
    throw new FoodValidationError(
      'Custom food serving size must be a positive number.',
      'servingSize'
    );
  }
  if (!food.servingUnit || typeof food.servingUnit !== 'string' || !food.servingUnit.trim()) {
    throw new FoodValidationError('Custom food serving unit is required.', 'servingUnit');
  }
}
