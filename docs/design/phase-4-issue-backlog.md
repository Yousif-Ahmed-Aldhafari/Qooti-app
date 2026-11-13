# Phase 4 Nutrition Issue Backlog & Defect Inventory

- **Document Version:** 1.0.0
- **Status:** Approved Engineering Backlog
- **Date:** November 2026
- **Subsystem:** Nutrition, Meals, Macro Calculations, Food Catalog & UI

---

## 1. Backlog Severity Taxonomy

- **P0 — Critical / Data Loss:** Bugs or architectural anti-patterns that can cause permanent data loss, database corruption, or fatal app crashes.
- **P1 — High / Data Integrity & Correctness:** Flaws causing incorrect calculations, timezone date shifts, broken user workflows, or unhandled promise rejections.
- **P2 — Medium / Feature Parity & Ergonomics:** Missing standard capabilities (e.g., editing, deletion, multi-food logging, catalog search) compared to the workout subsystem.
- **P3 — Low / Polish & Optimization:** Minor visual inconsistencies, dead code cleanup, or cosmetic improvements.

---

## 2. Comprehensive Issue Backlog

### P0: Critical Architecture & Data Loss Flaws

#### ISSUE-NUT-01: Whole-Table Wipe on Every Meal Mutation (`saveAllMeals`)
- **Severity:** P0 (Critical)
- **Location:** `src/store/AppContext.tsx` (lines 519–537), `src/services/mealService.ts` (lines 31–45), `src/db/repositories/mealRepository.ts` (lines 213–256)
- **Description:** Every addition, update, or deletion of a meal triggers `saveMeals(state.meals)` via a React `useEffect`, which invokes `saveAllMeals`. `saveAllMeals` executes `DELETE FROM meal_items; DELETE FROM meals;` and re-inserts the entire meal history in one batch.
- **Root Cause:** Retained legacy persistence pattern from early prototype phase before granular SQLite repositories were established.
- **Impact:**
  - High risk of catastrophic data loss if app terminates, crashes, or runs out of storage mid-transaction.
  - Severe O(N) write amplification and UI stutter as meal history accumulates.
- **Proposed Remediation:**
  - Deprecate and remove `saveAllMeals` from `AppContext` mutation flow.
  - Transition `AppContext` meal actions (`addMeal`, `updateMeal`, `deleteMeal`) to call granular, atomic repository methods (`insertMeal`, `updateMeal`, `deleteMeal`) asynchronously, mirroring the workout subsystem pattern.
- **Target Task:** Task 4.1

#### ISSUE-NUT-02: Fire-and-Forget Asynchronous Save in `AppNavigator`
- **Severity:** P0 (Critical)
- **Location:** `src/navigation/AppNavigator.tsx` (lines 255–259)
- **Description:** `saveMeal(meal)` calls `addMeal(meal)` synchronously and immediately navigates to `mealDetails` without awaiting SQLite database write completion.
- **Root Cause:** `addMeal` in `AppContext` returns `void` instead of `Promise<void>`, dispatching to in-memory reducer and relying on an asynchronous `useEffect` hook to persist.
- **Impact:**
  - False positive save indication: user sees details screen even if SQLite insert subsequently fails.
  - Race conditions if user rapidly navigates away or quits app before `useEffect` fires.
- **Proposed Remediation:** Make `addMeal` an `async` method in `AppContext` that awaits `insertMeal` in SQLite before dispatching state update, matching `saveWorkout`.
- **Target Task:** Task 4.1

---

### P1: High Priority Data Integrity & Correctness Defects

#### ISSUE-NUT-03: UTC Date Generation Leading to Local Midnight Boundary Errors
- **Severity:** P1 (High)
- **Location:** `src/screens/AddMealScreen.tsx` (line 66), `src/screens/MealsScreen.tsx` (line 35)
- **Description:** New meals are stamped with `date: new Date().toISOString().slice(0, 10)`, and `MealsScreen` filters today's meals using the same UTC slice.
- **Root Cause:** Using ISO string UTC representation instead of local calendar date.
- **Impact:** For users in timezones east of UTC (e.g., UTC+3 Saudi Arabia, Egypt, UAE), any meal logged after midnight (e.g. 00:01 to 02:59) is assigned to the previous calendar day.
- **Proposed Remediation:** Use `toDateKey(new Date())` local calendar date formatter (`YYYY-MM-DD` using local `getFullYear()`, `getMonth() + 1`, and `getDate()`).
- **Target Task:** Task 4.1

#### ISSUE-NUT-04: Non-Standardized Local Time String Formatting
- **Severity:** P1 (High)
- **Location:** `src/screens/AddMealScreen.tsx` (line 67)
- **Description:** `time` is generated via `new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })`.
- **Root Cause:** Relying on host environment locale formatting for persistent database records.
- **Impact:** Produces inconsistent strings across platforms and locales (e.g., "1:30 PM", "13:30", "٠١:٣٠"), preventing lexicographical sorting and SQL queries.
- **Proposed Remediation:** Standardize persistent meal time to 24-hr `HH:mm` format.
- **Target Task:** Task 4.1

#### ISSUE-NUT-05: Collision-Prone Timestamp IDs (`Date.now()`)
- **Severity:** P1 (High)
- **Location:** `src/screens/AddMealScreen.tsx` (lines 64, 70)
- **Description:** Meal and food item IDs are generated using ``id: `meal-${Date.now()}` `` and ``id: `item-${Date.now()}` ``.
- **Root Cause:** Naive timestamp ID generation without entropy or monotonic counters.
- **Impact:** When multiple items are created or rapid actions occur, IDs can collide, causing primary key constraint violations in SQLite.
- **Proposed Remediation:** Standardize on `createId('meal')` and `createId('meal-item')` from `src/utils/id.ts`.
- **Target Task:** Task 4.1

#### ISSUE-NUT-06: Unbounded Numerical Inputs & Negative Value Corruption
- **Severity:** P1 (High)
- **Location:** `src/utils/nutrition.ts` (lines 64–71), `src/screens/AddMealScreen.tsx` (lines 72–76)
- **Description:** `parseInputNumber` and `safeNumber` accept negative numbers and return non-finite values as 0 without validation or bounding.
- **Root Cause:** Lack of domain validation guards in `models/meal.ts` and input sanitizers.
- **Impact:** Negative calories or macros can be logged, corrupting daily summaries, progress ratios, and calorie deficit/surplus calculations.
- **Proposed Remediation:** Enforce strict domain validation: reject negative numbers, `NaN`, `Infinity`; validate that calories $\ge 0$ and quantities $> 0$.
- **Target Task:** Task 4.1

#### ISSUE-NUT-07: Inconsistency Between `calculateDailyNutrition` and Itemless Meals
- **Severity:** P1 (High)
- **Location:** `src/utils/nutrition.ts` (lines 20–35), `src/models/meal.ts` (lines 47–70)
- **Description:** `normalizeMeal` allows meals with 0 items to maintain explicit `totalCalories`, but `calculateDailyNutrition` calculates daily totals by iterating `meal.items` only.
- **Root Cause:** Disconnected calculation logic between domain normalization and utility functions.
- **Impact:** If a meal is recorded without child items (e.g., quick-logged calories), `calculateDailyNutrition` returns 0 calories, causing daily targets to ignore it.
- **Proposed Remediation:** Update `calculateDailyNutrition` to fall back to `meal.totalCalories` when `meal.items` is empty.
- **Target Task:** Task 4.1

#### ISSUE-NUT-08: Progress Screen Disconnect from Meal History
- **Severity:** P1 (High)
- **Location:** `src/screens/ProgressScreen.tsx` (lines 28–34), `src/db/repositories/progressRepository.ts`
- **Description:** `ProgressScreen` calculates weekly calorie trends from static `progress_entries` table rows rather than actual logged meals.
- **Root Cause:** Historical progress entries were never synchronized with real-time meal aggregations.
- **Impact:** Users who log meals see no reflection of their actual daily calorie intake in the progress charts.
- **Proposed Remediation:** Implement real-time daily nutrition aggregation or automatic `progress_entries` synchronization when meals are added/edited/deleted.
- **Target Task:** Task 4.4

---

### P2: Medium Priority Feature Parity & Ergonomic Gaps

#### ISSUE-NUT-09: Complete Absence of Meal Editing UI & Flow
- **Severity:** P2 (Medium)
- **Location:** `src/screens/MealDetailsScreen.tsx`, `src/navigation/AppNavigator.tsx`, `src/types/index.ts`
- **Description:** There is no `EditMealScreen` in active navigation, no `editMeal` route in `ScreenKey`, and no "Edit" button on `MealDetailsScreen`.
- **Root Cause:** Screen was never built during Phase 1/2.
- **Impact:** Users cannot modify meal titles, times, food items, or quantities.
- **Proposed Remediation:** Create `EditMealScreen.tsx`, register `editMeal` route in `AppNavigator`, and wire edit action to `MealDetailsScreen`.
- **Target Task:** Task 4.1

#### ISSUE-NUT-10: Complete Absence of Meal Deletion UI
- **Severity:** P2 (Medium)
- **Location:** `src/screens/MealDetailsScreen.tsx`, `src/screens/MealsScreen.tsx`
- **Description:** Users cannot delete meals from either the details screen or the meals list.
- **Root Cause:** Missing UI trigger and deletion confirmation state machine.
- **Impact:** Irreversible meal entry errors cannot be purged by the user.
- **Proposed Remediation:** Add platform-conforming deletion confirmation dialogs to `MealDetailsScreen` and `MealsScreen` with atomic SQLite cascade cleanup.
- **Target Task:** Task 4.1

#### ISSUE-NUT-11: Inability to Add Multiple Foods in `AddMealScreen`
- **Severity:** P2 (Medium)
- **Location:** `src/screens/AddMealScreen.tsx`
- **Description:** Form fields are constrained to a single food item (`foodName`, `quantity`, `calories`, `protein`, `carbs`, `fats`).
- **Root Cause:** Hardcoded single-item state.
- **Impact:** Users cannot log complex meals (e.g. breakfast of 2 eggs, 50g oats, 10g honey) without creating separate meal entries for each food item.
- **Proposed Remediation:** Redesign meal creation flow to allow adding, reordering, and removing multiple food items within a single meal draft.
- **Target Task:** Task 4.3

#### ISSUE-NUT-12: Absence of Built-in Food Catalog & Portion Scaling
- **Severity:** P2 (Medium)
- **Location:** `src/screens/AddMealScreen.tsx`, `src/data/seedData.ts` (lines 252–260)
- **Description:** Users must manually enter calories and macros for every single item; there is no searchable catalog or portion scaling.
- **Root Cause:** Only 6 hardcoded food items exist in `seedData.ts`; no production catalog architecture was built.
- **Impact:** High logging friction; users must look up nutrition values externally.
- **Proposed Remediation:** Implement `foodCatalog.ts` (bilingual English/Arabic, ~150 foods) with standard portion sizes and automatic macro scaling based on quantity.
- **Target Task:** Task 4.2

#### ISSUE-NUT-13: Unfiltered Infinite Meal List & Missing Date Navigation
- **Severity:** P2 (Medium)
- **Location:** `src/screens/MealsScreen.tsx`
- **Description:** `MealsScreen` renders all meals ever logged in a flat list without day-by-day navigation or date filtering.
- **Root Cause:** Missing day picker component on `MealsScreen`.
- **Impact:** Difficult to review meals logged on previous days or see daily macro totals for past dates.
- **Proposed Remediation:** Introduce date selector header (Today, Yesterday, Calendar Day) to filter meals by day and display date-specific macro progress.
- **Target Task:** Task 4.3

#### ISSUE-NUT-14: Missing Meal Slot Categorization (Breakfast, Lunch, Dinner, Snack)
- **Severity:** P2 (Medium)
- **Location:** `src/models/meal.ts`, `src/db/schema.ts`
- **Description:** Meals have no structured category or meal slot property; users must type "Lunch" into the free-text `title`.
- **Root Cause:** Schema lacks `meal_type` column.
- **Impact:** Cannot analyze calorie distribution across meal slots or organize UI by standard meal times.
- **Proposed Remediation:** Introduce `mealType` ('breakfast' | 'lunch' | 'dinner' | 'snack') with backward compatibility for legacy records.
- **Target Task:** Task 4.3

---

### P3: Low Priority Polish & Maintenance Items

#### ISSUE-NUT-15: Orphaned Prototype Screen Files in `src/screens/meals/`
- **Severity:** P3 (Low)
- **Location:** `src/screens/meals/AddEditMealScreen.tsx`, `FoodSearchScreen.tsx`, `MealsListScreen.tsx`, `NutritionSummaryScreen.tsx`
- **Description:** Dead code files importing `@react-navigation/native` not connected to any active route.
- **Root Cause:** Abandoned experiments from early development.
- **Impact:** Code clutter, developer confusion, duplicate filenames.
- **Proposed Remediation:** Safely archive or remove orphaned files during Phase 4 implementation.
- **Target Task:** Task 4.7

#### ISSUE-NUT-16: Naming Redundancies (`name`/`foodName`, `fats`/`fat`, `title`/`name`)
- **Severity:** P3 (Low)
- **Location:** `src/models/meal.ts`
- **Description:** Dual property definitions maintained for backward compatibility.
- **Root Cause:** Iterative schema modifications without normalization consolidation.
- **Impact:** Redundant serialization and type ambiguities.
- **Proposed Remediation:** Consolidate to canonical names (`foodName`, `fats`, `title`) while keeping getter shims for tests.
- **Target Task:** Task 4.1
