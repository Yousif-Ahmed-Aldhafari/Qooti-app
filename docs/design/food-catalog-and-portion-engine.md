# Qooti Food Catalog & Portion Scaling Engine Architecture (Task 4.2)

## 1. Overview
The Food Catalog and Portion Scaling subsystem provides an offline-first, culturally authentic, bilingual (Arabic and English) nutrition database for Qooti. It supports strict macronutrient scaling based on physical portion mass, custom food creation, independent meal snapshot preservation, and SQLite Migration 9 enhancements.

---

## 2. Data Provenance & Catalog Design

### 2.1 Sources
All 158 verified entries in `src/data/foodCatalog.ts` are derived from authoritative, peer-reviewed databases:
1. **USDA FoodData Central (FDC):** Foundation and SR Legacy entries for standard international whole foods, meats, seafood, grains, and produce.
2. **Saudi Food and Drug Authority (SFDA):** Gulf and Middle Eastern regional foods database (dates, kabsa, mandi, hummus, falafel, labneh, shawarma, etc.).

### 2.2 Nutritional Basis
- **Canonical Mass Basis:** Every food catalog entry defines nutrients per **100 grams of edible portion** (`caloriesPer100g`, `proteinPer100g`, `carbsPer100g`, `fatsPer100g`).
- **Preparation States:** Food states are strictly differentiated by preparation method (`raw`, `cooked`, `fresh`, `dried`, `canned`, `roasted`). Cooked versions account for water absorption/loss and fat retention (e.g. cooked rice has ~130 kcal/100g vs raw rice at 365 kcal/100g due to hydration).
- **Physical Density Multipliers:** Serving options avoid universal cup assumptions. Serving weights are food-specific (e.g., 1 cup dry rolled oats = 80g; 1 cup raw white rice = 185g; 1 cup whole milk = 244g).

### 2.3 Provenance Classification & Verification Audit (Task 4.2A)
Every catalog entry is audited and explicitly tagged with a `provenanceStatus` (`VERIFIED`, `ESTIMATED`, `UNVERIFIED`, `MISMATCH`), optional `sourceUrl`, and `recipeNotes` where applicable:
1. **VERIFIED (143 items / 90.5%):** Exact match against authoritative public datasets (USDA FoodData Central Foundation Foods / SR Legacy), with direct URL link `https://fdc.nal.usda.gov/food-details/<fdcId>/nutrients`.
2. **ESTIMATED (6 items / 3.8%):** Regional mixed composite traditional dishes (e.g. Kabsa, Mandi, Saleeg, Sayadieh, Jareesh, Machboos) derived from the Saudi Food Composition Tables (SFCT) published by the National Nutrition Committee (NNC) of the SFDA. Documented standard composite recipe proportions and cooking hydration factors are provided in `recipeNotes`.
3. **UNVERIFIED (9 items / 5.7%):** Regional single-ingredient staple foods (e.g. dates, labneh, Arabic flatbread, cardamom coffee) referencing placeholder codes (`SFDA-DATE-001`, `SFDA-RICE-001`, etc.) awaiting official SFDA alphanumeric dataset keys. Transparently flagged as `UNVERIFIED` and excluded from verified-source metrics until key mapping is confirmed.
4. **MISMATCH (0 items / 0.0%):** Zero conflicting or incompatible nutrient profiles.

The complete item-by-item verification audit is published in [food-catalog-source-audit.md](file:///mnt/samsungSSD/Projects/Qooti-app/docs/design/food-catalog-source-audit.md).

---

## 3. Portion Scaling Engine

Pure mass-basis calculation functions in `src/utils/foodScaling.ts`:
1. `calculateServingGrams(servingOption, quantity)`:
   $$\text{totalGrams} = \text{servingOption.grams} \times \text{quantity}$$
2. `scaleFoodNutrients(entry, quantity, servingUnit)`:
   $$\text{scaledNutrient} = \frac{\text{nutrientPer100g} \times \text{totalGrams}}{100}$$
3. `scaleCustomFoodNutrients(customFood, quantity)`:
   Scales custom food nutrients per serving size cleanly without rounding drift.
4. **Scaling Limits & Overflow Safety (Task 4.2A):**
   - Strictly bounded by `SCALING_LIMITS`:
     - `MAX_QUANTITY`: 10,000
     - `MAX_SERVING_GRAMS`: 100,000 g
     - `MAX_TOTAL_GRAMS`: 1,000,000 g
     - `MAX_SCALED_CALORIES`: 10,000,000 kcal
     - `MAX_SCALED_MACROS`: 1,000,000 g
   - Rejects zero, negative, NaN, Infinity, and non-finite quantities or serving sizes.
   - Throws descriptive errors for unsupported serving units.
5. **Precision and Rounding Policy:**
   - Pure floating-point math during calculation.
   - Snapshot display rounding: Calories rounded to nearest whole integer (`Math.round`), macronutrients rounded to 1 decimal place (`roundTo1Decimal`).

---

## 4. Historical Snapshot Preservation Policy

- **Logged Meals are Immutable Snapshots:** When a meal item is added from the catalog or custom foods via `createMealItemSnapshot` or `createCustomFoodMealItemSnapshot`, all nutrients are copied into the `meal_items` row.
- **Monotonic Snapshot Identifier Safety (Task 4.2A):** Snapshot items use `createId('meal-item')` from `src/utils/id.ts`, guaranteeing collision resistance and monotonic ordering across all meal entries (replacing naive timestamp/random concatenation).
- **Modification Immunity:** Subsequent edits, renamings, or deletions of custom foods or catalog definitions never alter historical `meal_items` records.
- **Relational Integrity:** `meals` cascades to `meal_items` on deletion. Custom foods exist independently in `custom_foods` table and do not hold foreign key locks on historical meals.

---

## 5. Offline Search & Text Normalization

Pure offline bilingual search in `src/utils/foodSearch.ts`:
- **Arabic Text Normalization:**
  - Strips diacritics/tashkeel (`Fathah`, `Dammah`, `Kasrah`, `Sukun`, `Shaddah`, `Tanwin`).
  - Strips Tatweel (kashida).
  - Normalizes Alef forms (`أ`, `إ`, `آ`, `ٱ` $\rightarrow$ `ا`).
  - Normalizes Taa Marbuta (`ة` $\rightarrow$ `ه`).
  - Normalizes Alif Maqsura (`ى` $\rightarrow$ `ي`).
- **Matching & Ranking:**
  - Exact match $\rightarrow$ Prefix match $\rightarrow$ Token match $\rightarrow$ Substring match.
  - Category filtering across all 10 food categories.

---

## 6. SQLite Migration 9 (`add_custom_foods_and_meal_enhancements_v9`)

- **Meals Table:** Added `meal_type` (TEXT) and `notes` (TEXT).
- **Meal Items Table:** Added `catalog_id` (TEXT) and `portion_unit` (TEXT).
- **Custom Foods Table:**
  ```sql
  CREATE TABLE IF NOT EXISTS custom_foods (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    name_ar TEXT,
    calories REAL NOT NULL DEFAULT 0,
    protein REAL NOT NULL DEFAULT 0,
    carbs REAL NOT NULL DEFAULT 0,
    fats REAL NOT NULL DEFAULT 0,
    serving_size REAL NOT NULL DEFAULT 100,
    serving_unit TEXT NOT NULL DEFAULT 'g',
    category TEXT DEFAULT 'custom',
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_custom_foods_name ON custom_foods(name);
  CREATE INDEX IF NOT EXISTS idx_custom_foods_category ON custom_foods(category);
  ```
