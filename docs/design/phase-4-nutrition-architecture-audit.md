# Phase 4 Nutrition Architecture Audit & System Analysis

- **Document Version:** 1.0.0
- **Status:** Approved Architecture Baseline
- **Date:** November 2026
- **Branch:** `dev/phase-4-nutrition`
- **Base Commit:** `7ba790621517cafde2847bdd69001b151e1a46ab` (Merge Phase 3 workout system into main)
- **Target Subsystem:** Nutrition, Meals, Food Catalog, Macro Calculations, and Daily Target Synchronization

---

## 1. Executive Summary & Audit Baseline

Following the successful merge of Phase 3 (Workout System, Active Execution, Rest Timers, and Pre-Migration Provenance Safety) into `main` at commit `7ba7906`, this audit establishes the complete engineering baseline for **Phase 4: Nutrition & Meal Planning**.

This is an **investigative architectural audit**. No production source code, SQLite database schemas, or runtime migrations have been modified during Task 4.0.

### 1.1 Verified Pre-Flight Environment
- **Active Branch:** `dev/phase-4-nutrition` (branched cleanly from `main` at `7ba790621517cafde2847bdd69001b151e1a46ab`)
- **Git Working Tree:** 100% clean
- **Baseline Test Suite:** **388 / 388 automated tests passing** across 24 test suites in 12.8s
- **Code Coverage:** **90.00% line coverage** (`90.00% lines, 80.66% branches, 85.41% functions`)
- **TypeScript Typecheck:** **0 errors** (`tsc --noEmit`)
- **ESLint Quality Gate:** **0 warnings, 0 errors** (`eslint --max-warnings=0`)
- **Expo Doctor:** **20 / 20 health checks passed** (clean dependencies, Expo SDK 58 compatibility)

---

## 2. Architectural Call Path & Write Pattern Audit

### 2.1 The Critical Persistence Flaw: The Whole-Table Wipe Pattern (`saveAllMeals`)
In Phase 3, a major defect in the workout subsystem was identified and eliminated: workouts previously wiped the entire database table on every mutation (`saveWorkouts(state.workouts)` $\rightarrow$ `DELETE FROM workouts`).

The nutrition subsystem **still suffers from this exact fatal anti-pattern**:

```
User Action (Add/Update/Delete Meal)
  │
  ▼
AppContext dispatch({ type: 'addMeal' | 'updateMeal' | 'deleteMeal' })
  │
  ▼
React In-Memory State Mutation (`state.meals`)
  │
  ▼
AppContext useEffect([state.isReady, state.meals])
  │
  ▼
saveMeals(state.meals) in `src/services/mealService.ts`
  │
  ▼
SQLiteMealRepository.saveAllMeals(meals, txn) in `src/db/repositories/mealRepository.ts`
  │
  ├──► PRAGMA foreign_keys = ON;
  ├──► BEGIN EXCLUSIVE TRANSACTION;
  ├──► DELETE FROM meal_items;  <--- ENTIRE CHILD TABLE WIPED!
  ├──► DELETE FROM meals;       <--- ENTIRE PARENT TABLE WIPED!
  ├──► LOOP meals:
  │      INSERT INTO meals (...) VALUES (...)
  │      LOOP items:
  │        INSERT INTO meal_items (...) VALUES (...)
  └──► COMMIT;
```

#### Identified Vulnerabilities of `saveAllMeals`:
1. **Catastrophic Data Loss on Failure:** If an insertion fails halfway through re-inserting (e.g., storage quota exhaustion, constraint violation, app kill/process termination during non-atomic step), all prior meals and meal items are permanently obliterated.
2. **O(N) Write Amplification:** Saving a single 50-calorie snack forces the SQLite engine to delete and re-insert every meal logged since the app was first installed. Over months of logging (hundreds of meals, thousands of food items), this creates noticeable frame drops, battery drain, and storage churn.
3. **Async Race Conditions & Fire-and-Forget Mutations:** In `AppNavigator.tsx`:
   ```typescript
   function saveMeal(meal: Meal) {
     addMeal(meal); // Synchronous dispatch!
     setSelectedMealId(meal.id);
     setActiveTab('meals');
     setActiveScreen('mealDetails');
   }
   ```
   Contrast this with `saveWorkout`:
   ```typescript
   async function saveWorkout(workout: Workout) {
     await addWorkout(workout); // Awaits SQLite insert!
     setSelectedWorkoutId(workout.id);
     setActiveTab('workouts');
     setActiveScreen('workoutDetails');
   }
   ```
   `saveMeal` triggers a state change, immediately transitions the UI to `mealDetails`, and leaves the SQLite persistence to an unawaited `useEffect`. If the write fails, the UI displays the meal as saved, but the database has not recorded it.

### 2.2 Granular Repository Methods Exist But Are Bypassed
`SQLiteMealRepository` already implements granular methods:
- `insertMeal(meal: Meal, txn?: IDatabase): Promise<void>`
- `updateMeal(meal: Meal, txn?: IDatabase): Promise<void>`
- `deleteMeal(id: string, txn?: IDatabase): Promise<void>`

However, `AppContext.tsx` bypasses these granular methods entirely during meal creation and updates, delegating everything to the global `useEffect` calling `saveMeals(state.meals)`.

---

## 3. Meal Domain Model Deep-Dive: 20 Architectural Questions

Inspection of `src/models/meal.ts` and related interfaces reveals the answers to all 20 specific domain model questions:

| # | Domain Question | Current Codebase Answer | Architectural Risk & Assessment |
|---|---|---|---|
| 1 | **`name` vs `foodName` in `MealItem`** | Both exist. `normalizeMealItem()` assigns `name = item.foodName \|\| item.name \|\| ''` and writes both properties. In SQLite, the column is named `name`. | Dual naming causes confusion. UI screens (`AddMealScreen`, `MealDetailsScreen`) reference `foodName`, while DB rows and tests reference `name`. Must unify to canonical `foodName` with getter/alias backward compatibility. |
| 2 | **`fats` vs `fat` in `MealItem`** | Both exist. `normalizeMealItem()` assigns `fats = item.fats ?? item.fat ?? 0` and writes both. In SQLite `meal_items`, column is `fats`. In `meals`, column is `total_fat`. | Inconsistent naming across tables and domain models (`fat`, `fats`, `totalFat`, `totalFats`). Must standardize canonical property to `fats` (or `fat`) while maintaining compatibility. |
| 3 | **`MealItem.quantity` semantics** | Stored as a raw `REAL` (number). `unit?: string` is optional and defaults to `'g'`. | `quantity` has **no semantic link** to calories or macros. In `AddMealScreen`, typing `quantity: 2` does not scale calories or macros; the user is expected to compute total calories manually. |
| 4 | **`MealItem` macro values: per-unit or total?** | Values (`calories`, `protein`, `carbs`, `fats`) are stored as **absolute totals for the item**, NOT per-100g and NOT per-unit. | If a user logs 200g of chicken breast, `calories` stores 330, not 165. When the user later edits `quantity` from 200g to 300g, the app has no base values to rescale macros. |
| 5 | **Can `MealItem` exist independently?** | No. In SQLite, `meal_items.meal_id REFERENCES meals(id) ON DELETE CASCADE`. There is no standalone food table. | Cannot save favorite foods, search a persistent food catalog, or log food items without attaching them to a parent `Meal`. |
| 6 | **Serving sizes & portion multipliers** | Not supported. | No concept of standard serving units (`cup`, `piece`, `tbsp`, `scoop`, `can`) or multiplier calculations. |
| 7 | **Micronutrients** | Not supported. | No fields for fiber, sugar, sodium, saturated fat, potassium, vitamins, or minerals. |
| 8 | **Barcode / UPC / EAN identifiers** | Not supported. | No barcode string property in `MealItem` or SQLite schema. |
| 9 | **Food category / group** | Not supported. | No categorization (protein, grains, dairy, produce, beverages). |
| 10 | **Catalog ID reference** | Not supported. | Unlike `workout_exercises` which has `catalog_id` (Migration 4), `meal_items` has **no catalog reference**. |
| 11 | **`Meal.title` vs `Meal.name`** | Both exist. `normalizeMeal()` sets `title` and `name: title`. SQLite column is `title`. | Legacy artifact of earlier prototype code. Must standardize on `title`. |
| 12 | **`Meal.date` format & timezone semantics** | Stored as `YYYY-MM-DD` string. Generated in `AddMealScreen` via `new Date().toISOString().slice(0, 10)`. | **CRITICAL DEFECT:** Uses UTC date rather than local calendar date. Users in UTC+3 (Riyadh, Cairo, Dubai) logging meals after midnight (e.g., 01:00 AM) have their meals recorded under yesterday's date. |
| 13 | **`Meal.time` format** | Generated in `AddMealScreen` via `new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })`. | Non-standardized. Produces locale-dependent strings (e.g., "1:30 PM", "13:30", or Arabic-script digits "٠١:٣٠ ص"). Cannot be sorted lexicographically. Must standardize to 24-hr `HH:mm`. |
| 14 | **Meal type / category (breakfast, lunch, etc.)** | Not supported. | No `meal_type` column. Users simply type the meal name into `title` ("Breakfast"). No ability to group meals by slot or analyze calories by meal slot. |
| 15 | **Notes, photos, mood, hunger level** | Not supported. | SQLite `meals` table has no `notes` column (unlike `workouts` which has `notes TEXT`). |
| 16 | **Maintenance of meal totals** | Computed in `normalizeMeal()` if `items.length > 0`, summing items. Also stored as columns in `meals` table (`total_calories`, `total_protein`, `total_carbs`, `total_fat`). | Redundant storage, but acceptable for fast indexing and date range queries without joining `meal_items`. |
| 17 | **Conflict between explicit totals & items** | `normalizeMeal()` gives precedence to computed sums of items if `items.length > 0`. If `items` is empty, it uses `meal.totalCalories`. | If `meal.totalCalories` was manually edited but `items` were not updated, `normalizeMeal()` silently overwrites the user's explicit total. |
| 18 | **Can a meal have 0 items?** | Schema allows it (`total_calories` can be stored directly). `normalizeMeal` supports it. | `calculateDailyNutrition()` in `nutrition.ts` iterates `meal.items` exclusively! For a 0-item meal, `calculateDailyNutrition` returns 0 calories, ignoring `meal.totalCalories` completely. |
| 19 | **Planned vs Consumed status** | Not supported. | No `status` field. All logged meals are treated as consumed. Cannot create a planned meal plan for tomorrow. |
| 20 | **Recurring / Templated meals** | Not supported. | No template entity, favorite meal flag, or recurring schedule. |

---

## 4. SQLite Architecture & Data Integrity Audit

### 4.1 Schema Inspection (Migration 1)
From `src/db/schema.ts`:
```sql
CREATE TABLE IF NOT EXISTS meals (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  total_calories REAL NOT NULL DEFAULT 0,
  total_protein REAL NOT NULL DEFAULT 0,
  total_carbs REAL NOT NULL DEFAULT 0,
  total_fat REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS meal_items (
  id TEXT PRIMARY KEY,
  meal_id TEXT NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity REAL NOT NULL,
  unit TEXT NOT NULL,
  calories REAL NOT NULL DEFAULT 0,
  protein REAL NOT NULL DEFAULT 0,
  carbs REAL NOT NULL DEFAULT 0,
  fats REAL NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_meals_date ON meals(date);
CREATE INDEX IF NOT EXISTS idx_meal_items_meal_id ON meal_items(meal_id);
```

### 4.2 Schema Strengths
1. **Foreign Key Integrity:** `meal_items.meal_id REFERENCES meals(id) ON DELETE CASCADE`.
2. **PRAGMA foreign_keys = ON:** Configured in `database.ts` on connection open.
3. **Targeted Indexes:** Indexes on `meals(date)` and `meal_items(meal_id)` support fast date-filtered queries and parent-child joins.

### 4.3 Missing Columns & Limitations
1. **No `notes` Column:** Unlike `workouts(notes)`, `meals` has no notes field.
2. **No `meal_type` Column:** Cannot distinguish breakfast, lunch, dinner, snack.
3. **No `catalog_id` in `meal_items`:** Cannot associate a logged food item with a catalog entry.
4. **No `base_unit` / `base_quantity` in `meal_items`:** Prevents dynamic scaling when quantity changes.
5. **No `is_favorite` or `is_template` Flags:** Prevents quick-logging and templating.

---

## 5. UI & User Interaction Workflow Audit

### 5.1 Current Screen Topology
The active navigation in `src/navigation/AppNavigator.tsx` routes between three meal screens:
1. `meals`: Renders `MealsScreen.tsx` (Tab navigation)
2. `addMeal`: Renders `AddMealScreen.tsx`
3. `mealDetails`: Renders `MealDetailsScreen.tsx`

### 5.2 Identified UI Defects & Gaps

#### 1. Complete Absence of Meal Editing
- There is **no `EditMealScreen`** in active navigation.
- `MealDetailsScreen.tsx` has no "Edit" action button.
- Users cannot fix a typo in meal name, correct an incorrect calorie entry, or adjust portion size.

#### 2. Complete Absence of Meal Deletion UI
- `MealDetailsScreen.tsx` has no "Delete" action button.
- `MealsScreen.tsx` has no swipe-to-delete or context menu for deletion.
- Although `mealRepository.deleteMeal()` and `AppContext.deleteMeal()` exist, **users have no way to delete a meal in the UI**.

#### 3. Single-Food Limitation in `AddMealScreen`
- `AddMealScreen.tsx` renders a form for **exactly one food item** (`foodName`, `quantity`, `calories`, `protein`, `carbs`, `fats`).
- There is no "Add another food" button, no food list, and no way to construct a meal composed of multiple foods (e.g., chicken + rice + salad) in one entry.

#### 4. Orphaned Prototype Screen Files
The repository contains four orphaned screen files in `src/screens/meals/`:
- `src/screens/meals/AddEditMealScreen.tsx`
- `src/screens/meals/FoodSearchScreen.tsx`
- `src/screens/meals/MealsListScreen.tsx`
- `src/screens/meals/NutritionSummaryScreen.tsx`

These files import `@react-navigation/native` and are **not wired into `AppNavigator.tsx`** or any active routes. They represent abandoned experimental code from early development and are not part of the production runtime.

#### 5. Flat, Unfiltered Meal List in `MealsScreen`
- `MealsScreen.tsx` displays all meals across all dates in one flat, infinite vertical list.
- There is no date picker, day-by-day navigation, or pagination.
- The summary card at the top calculates `todayMeals` using `new Date().toISOString().slice(0, 10)` (UTC date), but the list below it renders every meal ever recorded.

---

## 6. Special Attention Areas & Edge Cases

### 6.1 Date & Timezone Semantics (UTC vs Local Calendar Midnight)
In `AddMealScreen.tsx`:
```typescript
date: new Date().toISOString().slice(0, 10), // BUG: UTC date
time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
```
- In timezones east of UTC (e.g. UTC+3 Saudi Arabia/Gulf), local midnight occurs 3 hours before UTC midnight.
- A user logging dinner at 11:30 PM on Nov 13 logs `2026-11-13` in UTC (20:30 UTC).
- A user logging a post-workout snack at 01:15 AM on Nov 14 gets `2026-11-13` because UTC is 22:15 on Nov 13.
- **Fix Required:** Use local calendar date formatting (`formatLocalDate(now)` $\rightarrow$ `YYYY-MM-DD` using local year, month, date) as established in Task 3.4A for workouts (`toDateKey(new Date())`).
- **Time Format Fix:** Standardize to 24-hr `HH:mm` using local hours and minutes padded with leading zeros (`String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')`).

### 6.2 Meal & Item Identifier Generation
In `AddMealScreen.tsx`:
```typescript
id: `meal-${Date.now()}`,
items: [{ id: `item-${Date.now()}`, ... }]
```
- If a meal and its item are created in the same tick, `Date.now()` produces identical or consecutive timestamps.
- If multiple items were created in a loop, timestamp collisions are guaranteed.
- **Fix Required:** Use `createId('meal')` and `createId('meal-item')` from `src/utils/id.ts`, which leverages `globalThis.crypto.randomUUID()` with monotonic counter fallback.

### 6.3 Numerical Validation & `parseInputNumber`
In `src/utils/nutrition.ts`:
```typescript
export function safeNumber(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

export function parseInputNumber(value: string): number {
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}
```
- Neither function checks for negative numbers or bounds.
- If a user enters `-250` for calories or `-50` for carbs, `parseInputNumber` returns `-250`.
- `calculateMealTotals` and `calculateDailyNutrition` sum these negative numbers, which can lead to negative daily calories or negative progress ratios.
- **Fix Required:** Enforce strict domain validation:
  - Reps/quantities/calories/macros must be $\ge 0$.
  - Reject `NaN`, `Infinity`, and negative inputs.
  - Return bounded, sanitized values with clear UI validation feedback.

### 6.4 Atwater Factor Macro Balancing
The Atwater general factor system states:
$$\text{Calories} \approx (\text{Protein} \times 4) + (\text{Carbohydrates} \times 4) + (\text{Fats} \times 9)$$

- Currently, users can enter arbitrary combinations: e.g., 100g protein, 100g carbs, 50g fat (which yields $(100 \times 4) + (100 \times 4) + (50 \times 9) = 1250\text{ kcal}$), but type `calories: 200`.
- The system stores both numbers without validation or advisory warnings.
- While strict mathematical equality should not block logging (packaged food labels frequently have rounding discrepancies of 5–15%), severe discrepancies (> 50% divergence) indicate typo errors and should trigger an advisory prompt or auto-calculation helper.

---

## 7. Food Database & Catalog Feasibility Analysis

Comparison of the four catalog architectures outlined in Section 12:

| Dimension | Option A: Static Bundled TS/JSON Catalog | Option B: Bundled SQLite Table via Migration | Option C: Hybrid (Static Catalog + Custom Foods Table) | Option D: External API (USDA / Open Food Facts) |
|---|---|---|---|---|
| **Storage Footprint** | Extremely low (~80–150 KB for 200 foods). | Low (~250 KB DB file growth). | Low (~120 KB bundle + minimal user rows). | Zero local catalog storage (network cache only). |
| **Offline Capability** | 100% offline, zero network dependency. | 100% offline, zero network dependency. | 100% offline, zero network dependency. | Fails completely offline; requires network connectivity. |
| **Search Performance** | Instant in-memory filter (< 2ms for 200 items). | Fast indexed SQLite `LIKE` / `FTS5` (< 5ms). | Instant in-memory + local SQLite custom query. | Slow network latency (200ms–2000ms), rate limits. |
| **Maintenance Burden** | Minimal. Version-controlled in Git. | Medium. Requires DDL migrations and seed scripts. | Medium-low. Clear separation of core vs user data. | High. API keys, contract changes, downtime, CORS. |
| **Arabic Localization** | Full bilingual parity (`nameEn`, `nameAr`, localized search). | Full bilingual columns (`name_en`, `name_ar`). | Full bilingual for built-in; user language for custom. | Poor. USDA has no Arabic; Open Food Facts Arabic coverage is sparse and inconsistent. |
| **Migration Risk** | Zero migration risk (static code asset). | Moderate (Migration 9 must populate table safely). | Low (Migration 9 creates empty `custom_foods` table). | Zero schema migration, high integration risk. |

### Architectural Recommendation: **Option C (Hybrid Architecture)**
1. **Core Catalog:** Built-in static TypeScript catalog (`src/data/foodCatalog.ts`) containing ~150–200 common fitness and regional Middle Eastern foods (chicken breast, rice, oats, eggs, dates, labneh, lentils, hummus, olive oil, whey protein). Each entry provides:
   - Stable `catalogId` (slug)
   - `nameEn` and `nameAr`
   - `category` (protein, carb, fat, dairy, produce, snack, beverage)
   - Base 100g nutritional profile (calories, protein, carbs, fats)
   - Standard serving units and conversion multipliers (e.g. `1 piece = 60g`, `1 cup = 240g`, `1 scoop = 30g`)
2. **User Custom Foods:** A new lightweight SQLite table `custom_foods` allowing users to save their own foods, recipes, and custom portion sizes that appear alongside catalog items in search.

---

## 8. Target Integration & Daily Synchronization Audit

### 8.1 Personalization Integration Status
Phase 2 created `resolveEffectiveNutritionTargets(profile)` in `src/utils/nutritionTargets.ts`.
- It accurately resolves caloric and macronutrient targets based on user confirmation status, adult eligibility, Mifflin-St Jeor BMR, and manual user overrides.
- In `HomeScreen.tsx`, `MealsScreen.tsx`, and `ProgressScreen.tsx`, `resolveEffectiveNutritionTargets` is used to display target comparisons.

### 8.2 Discrepancies in Nutrition Aggregation
1. **`calculateMealTotals` vs `calculateDailyNutrition`:**
   - Both reside in `src/utils/nutrition.ts`.
   - `calculateMealTotals` sums `item.fats ?? item.fat`, producing both `fats` and `fat` keys.
   - `calculateDailyNutrition` delegates to `calculateMealTotals(meal.items)`.
   - If a meal has `items: []` but `totalCalories: 600`, `calculateDailyNutrition` produces 0.
2. **Progress Screen Disconnect:**
   - `ProgressScreen.tsx` displays average calories from `progress: ProgressEntry[]`.
   - `progress_entries` in SQLite is **never updated when meals are logged**.
   - As a result, the progress chart shows static seed data rather than real historical meal nutrition!

---

## 9. Security, Privacy & Cross-Platform Accessibility

### 9.1 Local-First Privacy Compliance
- All meal data, nutritional history, and custom foods remain strictly on-device in SQLite (`qooti.db`).
- Zero telemetry, analytics beacons, or remote tracking.

### 9.2 SQL Injection Safety
- All repository operations in `SQLiteMealRepository` utilize parameterized SQL queries (`?` placeholders).
- No string concatenation in SQL queries.

### 9.3 Cross-Platform UX Requirements (HIG & Material Design 3)
- **Touch Target Clearance:** All actionable buttons, food item rows, and edit controls must satisfy $\ge 48\text{dp}$ on Android and $\ge 44\text{pt}$ on iOS.
- **Visual Feedback:** iOS controls use smooth opacity dimming (`activeOpacity={0.7}`); Android controls use `android_ripple={{ color: colors.border }}`.
- **Keyboard Handling:** Forms must wrap in `KeyboardAvoidingView` with `keyboardShouldPersistTaps="handled"` and `keyboardDismissMode`.
- **RTL Symmetrical Parity:** Arabic and English must render symmetrical layouts using `activeRowStyle()`, `activeTextAlign()`, and `activeWritingDirection()`. Latin numerals must be preserved for calorie and macro quantities (`ar-SA-u-nu-latn`).

---

## 10. Audit Conclusion & Phase 4 Strategy

The nutrition subsystem is currently at an MVP prototype stage compared to the mature workout subsystem.
The primary objectives for Phase 4 are:
1. **Eradicate `saveAllMeals`:** Replace whole-table wipe with atomic, granular SQLite operations and sync state management.
2. **Full Meal Lifecycle (Edit/Delete):** Provide robust editing, deletion with cascade safety, and localized confirmation dialogs.
3. **Multi-Food Logging & Portion Scaling:** Enable users to add multiple food items to a single meal, scale portions dynamically, and search a bilingual food catalog.
4. **Timezone & Identity Hardening:** Adopt local calendar dates and collision-resistant monotonic IDs.
5. **Daily Target & Progress Synchronization:** Connect logged meals directly to daily target summaries and progress entries.
