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

#### ISSUE-NUT-01: Whole-Table Wipe on Every Meal Mutation (`saveAllMeals`) & Nested Transaction Safety
- **Severity:** P0 (Critical)
- **Status:** RESOLVED (Task 4.1 & Hardened in Task 4.1A)
- **Location:** `src/store/AppContext.tsx` (lines 519–537), `src/services/mealService.ts` (lines 31–45), `src/db/repositories/mealRepository.ts` (lines 213–256)
- **Description:** Every addition, update, or deletion of a meal triggered `saveMeals(state.meals)` via a React `useEffect`, which invoked `saveAllMeals`. Furthermore, `mealRepository` invoked `target.withExclusiveTransactionAsync()` even when an outer `txn` was already supplied, creating hazardous nested transactions on real SQLite adapters.
- **Root Cause:** Retained legacy persistence pattern from early prototype phase; lack of explicit outer transaction ownership contract.
- **Impact:**
  - High risk of catastrophic data loss if app terminates, crashes, or runs out of storage mid-transaction.
  - Severe O(N) write amplification and potential deadlock or runtime exceptions under nested transaction calls.
- **Resolution & Verification:**
  - Removed `useEffect` calling `saveMeals(state.meals)` in `AppContext`.
  - Added async `insertMeal`, `updateMeal`, and `deleteMeal` actions to `AppContext` which execute database-first against SQLite before dispatching in-memory state.
  - Explicit transaction ownership contract: if `txn` is supplied, execute queries directly through `txn`; if `txn` is absent, open exactly one exclusive transaction on `this.db`.
  - Atomic parent-child persistence, cascade child item cleanup, and `migration_meta` updates preserved.
  - Verified by 35 tests in `mealLifecycleIntegrity.test.ts` and Tests 15–20 in `mealInputValidationAndTxnHardening.test.ts`.
- **Target Task:** Task 4.1 & Task 4.1A

#### ISSUE-NUT-02: Fire-and-Forget Asynchronous Save in `AppNavigator`
- **Severity:** P0 (Critical)
- **Status:** RESOLVED (Task 4.1)
- **Location:** `src/navigation/AppNavigator.tsx` (lines 255–259)
- **Description:** `saveMeal(meal)` calls `addMeal(meal)` synchronously and immediately navigates to `mealDetails` without awaiting SQLite database write completion.
- **Root Cause:** `addMeal` in `AppContext` returns `void` instead of `Promise<void>`, dispatching to in-memory reducer and relying on an asynchronous `useEffect` hook to persist.
- **Impact:**
  - False positive save indication: user sees details screen even if SQLite insert subsequently fails.
  - Race conditions if user rapidly navigates away or quits app before `useEffect` fires.
- **Resolution & Verification:**
  - Converted `saveMeal` in `AppNavigator.tsx` to async, awaiting `addMeal(meal)` before triggering `navigate('mealDetails')`.
  - Handled save rejections by displaying retryable error states and preserving user draft state without navigation.
  - Verified by Tests 13, 14, and 17 in `mealLifecycleIntegrity.test.ts`.
- **Target Task:** Task 4.1

---

### P1: High Priority Data Integrity & Correctness Defects

#### ISSUE-NUT-03: UTC Date Generation Leading to Local Midnight Boundary Errors & Date Trailing Suffixes
- **Severity:** P1 (High)
- **Status:** RESOLVED (Task 4.1 & Hardened in Task 4.1A)
- **Location:** `src/screens/AddMealScreen.tsx`, `src/screens/MealsScreen.tsx`, `src/utils/nutrition.ts`, `src/models/meal.ts`
- **Description:** New meals were stamped with `date: new Date().toISOString().slice(0, 10)`, and `MealsScreen` filtered today's meals using the same UTC slice. Additionally, dates with trailing suffixes or impossible leap-day dates (e.g. 2026-02-29) were not strictly rejected by domain validation.
- **Root Cause:** Using ISO string UTC representation instead of local calendar date; incomplete leap-year date validation regex.
- **Impact:** For users in timezones east of UTC (e.g., UTC+3 Saudi Arabia, Egypt, UAE), any meal logged after midnight was assigned to the previous calendar day; malformed dates could corrupt database indexing.
- **Resolution & Verification:**
  - Implemented `formatLocalDate(date)` in `src/utils/nutrition.ts` generating `YYYY-MM-DD` using local calendar methods.
  - Implemented `validateMealDate(date)` enforcing exact `YYYY-MM-DD` regex (rejecting trailing suffixes, timestamps, slashes) and full calendar validation (checking leap years for Feb 29).
  - Adopted `formatLocalDate` in `AddMealScreen.tsx`, `EditMealScreen.tsx`, and `MealsScreen.tsx`.
  - Verified by Tests 22 and 23 in `mealLifecycleIntegrity.test.ts` and Tests 12–14 in `mealInputValidationAndTxnHardening.test.ts`.
- **Target Task:** Task 4.1 & Task 4.1A

#### ISSUE-NUT-04: Non-Standardized Local Time String Formatting
- **Severity:** P1 (High)
- **Status:** RESOLVED (Task 4.1 & Hardened in Task 4.1A)
- **Location:** `src/screens/AddMealScreen.tsx`, `src/screens/EditMealScreen.tsx`, `src/utils/nutrition.ts`, `src/models/meal.ts`
- **Description:** `time` was generated via `new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })`.
- **Root Cause:** Relying on host environment locale formatting for persistent database records.
- **Impact:** Produces inconsistent strings across platforms and locales (e.g., "1:30 PM", "13:30", "٠١:٣٠"), preventing lexicographical sorting and SQL queries.
- **Resolution & Verification:**
  - Implemented `formatLocalTime(date)` standardizing persistent time to 24-hr `HH:mm` format with leading zeros.
  - Added strict time validation in `validateMealTime` supporting 24-hr `HH:mm`, legacy 12-hr with AM/PM, and legacy single-digit hour 24-hr while strictly rejecting invalid times (e.g. `25:00`, `99:99`, `12:60`, `14:00 PM`).
  - Standardized new/edited times to zero-padded `HH:mm` on save.
  - Verified by Tests 21 and 24 in `mealLifecycleIntegrity.test.ts` and Test 21 in `mealInputValidationAndTxnHardening.test.ts`.
- **Target Task:** Task 4.1 & Task 4.1A

#### ISSUE-NUT-05: Collision-Prone Timestamp IDs (`Date.now()`)
- **Severity:** P1 (High)
- **Status:** RESOLVED (Task 4.1)
- **Location:** `src/screens/AddMealScreen.tsx`, `src/screens/EditMealScreen.tsx`
- **Description:** Meal and food item IDs were generated using naive timestamp concatenation (`Date.now()`).
- **Root Cause:** Lack of entropy and monotonic sequence guards.
- **Impact:** Rapid additions or bulk operations could generate identical IDs, violating SQLite primary key constraints.
- **Resolution & Verification:**
  - Standardized on `createId('meal')` and `createId('meal-item')` from `src/utils/id.ts`.
  - Form drafts use `useRef` to maintain stable IDs across validation retries without ID churn.
  - Verified by Tests 16 and 17 in `mealLifecycleIntegrity.test.ts`.
- **Target Task:** Task 4.1

#### ISSUE-NUT-06: Unbounded Numerical Inputs & Negative Value Corruption
- **Severity:** P1 (High)
- **Status:** RESOLVED (Task 4.1 & Hardened in Task 4.1A)
- **Location:** `src/models/meal.ts`, `src/utils/nutrition.ts`, `src/screens/AddMealScreen.tsx`, `src/screens/EditMealScreen.tsx`
- **Description:** `parseInputNumber` and `safeNumber` accepted negative numbers and could return or map non-finite values (such as Infinity or 1e50) to numeric zero or allow corrupted states. Form validation did not consistently distinguish an entered zero from an empty field or reject malformed decimals/scientific notation.
- **Root Cause:** Lack of strict domain validation guards and robust numeric input parsing contract.
- **Impact:** Negative calories or macros could be logged, corrupting daily summaries, progress ratios, and calorie balance calculations; malformed scientific notation or infinite quantities could be saved.
- **Resolution & Verification:**
  - Implemented `parseStrictNutrientInput`, `parseStrictQuantity`, and `parseStrictNutrient` in `src/utils/nutrition.ts`, returning typed `StrictParseResult` with explicit `isEmpty`, `parsedValue`, and typed error codes (`EMPTY`, `INVALID_FORMAT`, `NEGATIVE`, `NOT_POSITIVE`, `TOO_LARGE`).
  - Supported comma `,` and period `.` decimal separators, rejected scientific notation (`1e50`), `NaN`, `Infinity`, `-Infinity`, negative numbers, zero quantities, and unbounded values (>100,000).
  - Preserved raw user typing in UI forms without auto-erasing; displayed localized inline error messages in English and Arabic.
  - Implemented `validateMealItem` and `validateMeal` in `src/models/meal.ts`, throwing typed `MealValidationError` for any violated bounds or non-finite values.
  - Verified by Tests 18, 19, 20 in `mealLifecycleIntegrity.test.ts` and Tests 1–11 in `mealInputValidationAndTxnHardening.test.ts`.
- **Target Task:** Task 4.1 & Task 4.1A

#### ISSUE-NUT-07: Inconsistency Between `calculateDailyNutrition` and Itemless Meals
- **Severity:** P1 (High)
- **Status:** RESOLVED (Task 4.1)
- **Location:** `src/utils/nutrition.ts`, `src/models/meal.ts`
- **Description:** `normalizeMeal` allows meals with 0 items to maintain explicit `totalCalories`, but `calculateDailyNutrition` calculated daily totals by iterating `meal.items` only.
- **Root Cause:** Disconnected calculation logic between domain normalization and utility functions.
- **Impact:** If a meal was recorded without child items (e.g., quick-logged calories), `calculateDailyNutrition` returned 0 calories, causing daily targets to ignore it.
- **Resolution & Verification:**
  - Updated `calculateDailyNutrition` to fall back to `meal.totalCalories`, `meal.totalProtein`, `meal.totalCarbs`, and `meal.totalFat` when `meal.items` is empty.
  - Verified by Tests 25 and 26 in `mealLifecycleIntegrity.test.ts`.
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
- **Status:** RESOLVED (Task 4.1)
- **Location:** `src/screens/EditMealScreen.tsx`, `src/screens/MealDetailsScreen.tsx`, `src/navigation/AppNavigator.tsx`, `src/types/index.ts`
- **Description:** There was no `EditMealScreen` in active navigation, no `editMeal` route in `ScreenKey`, and no "Edit" button on `MealDetailsScreen`.
- **Root Cause:** Screen was never built during Phase 1/2.
- **Impact:** Users could not modify meal titles, times, food items, or quantities.
- **Resolution & Verification:**
  - Built `EditMealScreen.tsx` supporting multi-item editing, individual food addition/removal, dirty state confirmation on cancel/back, and inline validation.
  - Added `'editMeal'` to `ScreenKey` in `src/types/index.ts` and wired active route in `AppNavigator.tsx` with proper hardware back handling.
  - Added header "Edit" button to `MealDetailsScreen.tsx`.
  - Verified by Tests 4, 5, 6, 27, 28, 29, 30 in `mealLifecycleIntegrity.test.ts`.
- **Target Task:** Task 4.1

#### ISSUE-NUT-10: Complete Absence of Meal Deletion UI
- **Severity:** P2 (Medium)
- **Status:** RESOLVED (Task 4.1)
- **Location:** `src/screens/MealDetailsScreen.tsx`, `src/navigation/AppNavigator.tsx`, `src/db/repositories/mealRepository.ts`
- **Description:** Users could not delete meals from either the details screen or the meals list.
- **Root Cause:** Missing UI trigger and deletion confirmation state machine.
- **Impact:** Irreversible meal entry errors could not be purged by the user.
- **Resolution & Verification:**
  - Implemented 2-step destructive confirmation alert in `MealDetailsScreen.tsx`.
  - Implemented full `MealDeleteState` machine (`idle` -> `confirming` -> `deleting` -> `success` / `error`) with safe fallback navigation to `meals`.
  - Atomic SQLite deletion with cascading cleanup of `meal_items` and zero orphaned rows.
  - Verified by Tests 7, 8, 9, 10, 11, 12, 31, 32, 33, 34 in `mealLifecycleIntegrity.test.ts`.
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
- **Status:** RESOLVED (Task 4.1)
- **Location:** `src/models/meal.ts`
- **Description:** Dual property definitions maintained for backward compatibility.
- **Root Cause:** Iterative schema modifications without normalization consolidation.
- **Impact:** Redundant serialization and type ambiguities.
- **Resolution & Verification:**
  - Hardened `normalizeMeal` and `normalizeMealItem` in `src/models/meal.ts` to canonicalize properties while retaining non-destructive getter compatibility.
  - Verified by baseline tests and new tests in `mealLifecycleIntegrity.test.ts`.
- **Target Task:** Task 4.1
