import { FoodCatalogEntry, CustomFood, FoodCategory } from '../models/food';
import { FOOD_CATALOG } from '../data/foodCatalog';

/**
 * Normalizes Arabic text for search matching:
 * - Strips diacritics/tashkeel (Fathah, Dammah, Kasrah, Sukun, Shaddah, Tanwin, Superscript Alef).
 * - Strips Tatweel (Kashida).
 * - Normalizes Alef variants: [أإآٱ] -> ا
 * - Normalizes Taa Marbuta: ة -> ه
 * - Normalizes Alif Maqsura: ى -> ي
 */
export function normalizeArabicText(text: string): string {
  if (!text) return '';
  return text
    // Strip Arabic diacritics (harakat / tashkeel) and superscript alef
    .replace(/[\u064B-\u065F\u0670]/g, '')
    // Strip Tatweel
    .replace(/\u0640/g, '')
    // Normalize Alef variants
    .replace(/[أإآٱ]/g, 'ا')
    // Normalize Taa Marbuta to Haa
    .replace(/ة/g, 'ه')
    // Normalize Alif Maqsura to Yaa
    .replace(/ى/g, 'ي')
    .trim();
}

/**
 * Normalizes general search text:
 * Lowercases Latin text, normalizes Arabic text, collapses multiple whitespaces.
 */
export function normalizeSearchText(text: string): string {
  if (!text) return '';
  const lower = text.toLowerCase();
  const normalizedArabic = normalizeArabicText(lower);
  return normalizedArabic.replace(/\s+/g, ' ').trim();
}

export type UnifiedFoodItem =
  | (FoodCatalogEntry & { isCustom?: false })
  | (CustomFood & { isCustom: true });

export interface FoodSearchOptions {
  category?: FoodCategory;
  catalog?: FoodCatalogEntry[];
  customFoods?: CustomFood[];
  limit?: number;
  includeMismatch?: boolean;
}

/**
 * Computes a relevance score for a given item against normalized query tokens.
 * Higher score = more relevant.
 * Returns -1 if no match.
 */
function scoreItem(
  normalizedQuery: string,
  queryTokens: string[],
  nameEn: string,
  nameAr?: string,
  brand?: string
): number {
  const normEn = normalizeSearchText(nameEn);
  const normAr = nameAr ? normalizeSearchText(nameAr) : '';
  const normBrand = brand ? normalizeSearchText(brand) : '';

  // 1. Exact match on full query
  if (normEn === normalizedQuery || normAr === normalizedQuery) {
    return 1000;
  }

  // 2. Starts with query (prefix match)
  if (normEn.startsWith(normalizedQuery) || normAr.startsWith(normalizedQuery)) {
    return 800;
  }

  // 3. Word-boundary / Token prefix match
  const enTokens = normEn.split(' ');
  const arTokens = normAr.split(' ');
  const allTokens = [...enTokens, ...arTokens];

  const anyTokenStartsWith = allTokens.some((t) => t.startsWith(normalizedQuery));
  if (anyTokenStartsWith) {
    return 600;
  }

  // 4. Substring match
  if (normEn.includes(normalizedQuery) || normAr.includes(normalizedQuery)) {
    return 400;
  }

  // 5. Brand match
  if (normBrand && (normBrand.startsWith(normalizedQuery) || normBrand.includes(normalizedQuery))) {
    return 300;
  }

  // 6. Multi-token partial match: all query tokens must match at least one token or substring
  if (queryTokens.length > 1) {
    const fullHaystack = `${normEn} ${normAr} ${normBrand}`;
    const allTokensPresent = queryTokens.every((token) => fullHaystack.includes(token));
    if (allTokensPresent) {
      return 200;
    }
  }

  return -1;
}

/**
 * Offline, bilingual search across food catalog entries.
 */
export function searchFoodCatalog(
  query: string,
  options?: { category?: FoodCategory; catalog?: FoodCatalogEntry[]; limit?: number; includeMismatch?: boolean }
): FoodCatalogEntry[] {
  const catalog = options?.catalog ?? FOOD_CATALOG;
  const category = options?.category;
  const limit = options?.limit ?? 50;
  const includeMismatch = options?.includeMismatch ?? false;

  const normalizedQuery = normalizeSearchText(query);
  const queryTokens = normalizedQuery.split(' ').filter(Boolean);

  let results: { item: FoodCatalogEntry; score: number }[] = [];

  for (const item of catalog) {
    if (category && item.category !== category) {
      continue;
    }

    if (!includeMismatch && item.provenanceStatus === 'MISMATCH') {
      continue;
    }

    if (!normalizedQuery) {
      // Empty query returns all in category (or all up to limit)
      results.push({ item, score: 0 });
      continue;
    }

    const score = scoreItem(normalizedQuery, queryTokens, item.nameEn, item.nameAr);
    if (score >= 0) {
      results.push({ item, score });
    }
  }

  // Sort by score descending, then alphabetically by English name
  results.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.item.nameEn.localeCompare(b.item.nameEn);
  });

  return results.slice(0, limit).map((r) => r.item);
}

/**
 * Unified offline bilingual search across both catalog and custom foods.
 */
export function searchAllFoods(
  query: string,
  options?: FoodSearchOptions
): UnifiedFoodItem[] {
  const catalog = options?.catalog ?? FOOD_CATALOG;
  const customFoods = options?.customFoods ?? [];
  const category = options?.category;
  const limit = options?.limit ?? 50;
  const includeMismatch = options?.includeMismatch ?? false;

  const normalizedQuery = normalizeSearchText(query);
  const queryTokens = normalizedQuery.split(' ').filter(Boolean);

  let results: { item: UnifiedFoodItem; score: number }[] = [];

  // Search catalog
  for (const item of catalog) {
    if (category && item.category !== category) continue;
    if (!includeMismatch && item.provenanceStatus === 'MISMATCH') continue;

    if (!normalizedQuery) {
      results.push({ item: { ...item, isCustom: false }, score: 0 });
      continue;
    }

    const score = scoreItem(normalizedQuery, queryTokens, item.nameEn, item.nameAr);
    if (score >= 0) {
      results.push({ item: { ...item, isCustom: false }, score });
    }
  }

  // Search custom foods
  for (const item of customFoods) {
    if (category && item.category !== category) continue;

    if (!normalizedQuery) {
      // Custom foods with no query get a slight boost or placed alongside
      results.push({ item: { ...item, isCustom: true }, score: 1 });
      continue;
    }

    const score = scoreItem(normalizedQuery, queryTokens, item.name, item.nameAr, item.brand);
    if (score >= 0) {
      // Custom foods get equal score tier but can be distinguished
      results.push({ item: { ...item, isCustom: true }, score: score + 5 });
    }
  }

  // Sort by score descending, then custom foods first on tie, then name
  results.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    const aIsCustom = a.item.isCustom ? 1 : 0;
    const bIsCustom = b.item.isCustom ? 1 : 0;
    if (bIsCustom !== aIsCustom) {
      return bIsCustom - aIsCustom;
    }
    const nameA = 'nameEn' in a.item ? a.item.nameEn : a.item.name;
    const nameB = 'nameEn' in b.item ? b.item.nameEn : b.item.name;
    return nameA.localeCompare(nameB);
  });

  return results.slice(0, limit).map((r) => r.item);
}
