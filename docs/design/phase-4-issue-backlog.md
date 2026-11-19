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
- **Status:** RESOLVED (Task 4.4)
- **Location:** `src/screens/ProgressScreen.tsx`, `src/navigation/AppNavigator.tsx`, `src/utils/nutrition.ts`
- **Description:** `ProgressScreen` previously calculated weekly calorie trends from static `progress_entries` table rows rather than actual logged meals.
- **Root Cause:** Historical progress entries were never synchronized with real-time meal aggregations.
- **Impact:** Users who logged meals saw no reflection of their actual daily calorie intake in the progress charts.
- **Resolution & Verification:**
  - Extended `ProgressScreen` to accept `meals?: Meal[]` and derived enriched daily calorie data using pure aggregator `getDailyNutritionSummary(meals, entry.date)`.
  - Passed live `meals` from `AppContext` in `AppNavigator.tsx`.
  - Computed weekly average intake strictly across logged days, displaying `-- kcal` when zero days have logs.
  - Displayed real calories and distinct unlogged day indicators in the Weekly Trend chart while maintaining authoritative weight and workout data from `progress`.
  - Zero SQLite mutation: read-only pure derivation preserving performance and data integrity.
  - Verified by Tests 38, 39, and 40 in `src/__tests__/nutritionAnalyticsAndTargets.test.ts`.
- **Target Task:** Task 4.4

#### ISSUE-NUT-08A: Nutrition Trend Calendar-Day Series Binding & Calorie Fallback Elimination
- **Severity:** P1 (High)
- **Status:** RESOLVED (Task 4.4A)
- **Location:** `src/screens/ProgressScreen.tsx`, `src/utils/nutrition.ts`, `src/utils/date.ts`
- **Description:** Nutrition chart days were previously generated via `progress.map()`, causing nutrition trend days to depend entirely on `progress_entries` existing, omitting meal-logging days if no matching progress entry existed, and falling back to unverified synthetic `entry.calories` when `meals === undefined`.
- **Root Cause:** Binding the nutrition chart series to the progress entries array rather than generating an explicit 7-day local calendar range; unsafe fallback to synthetic prototype calories.
- **Impact:** Empty or sparse `progress_entries` hid real meal history; missing meal data presented synthetic prototype data as real intake.
- **Resolution & Verification:**
  - Implemented `getCalendarDateRange(referenceDate, 7)` and `formatShortWeekday(date, language)` in `src/utils/date.ts` with local calendar date math (leap years, month/year boundaries).
  - Implemented `buildWeeklyNutritionChartDays` and `calculateWeeklyNutritionTrend` in `src/utils/nutrition.ts` generating an explicit 7-day calendar series ending on the live local date.
  - Completely eliminated all fallbacks to `ProgressEntry.calories`. When `meals === undefined`, shows unavailable state (`-- kcal`, "Meal data unavailable").
  - Distinguishes unlogged days (`hasLogs: false`) from recorded zero-calorie meals (`hasLogs: true, calories: 0`).
  - Average intake calculated strictly across logged days only.
  - Implemented Option 1: genuine largest-remainder method (Hamilton-Hare) in `calculateMacroDistribution` with deterministic tie-breaking (Protein, Carbs, Fats) guaranteeing exact 100% sum.
  - Integrated `useLiveLocalDate` for dynamic local midnight rollover and AppState foreground resume.
  - Preserved authoritative workout and weight data from `progress` without synthesizing fake `progress_entries`.
  - Added 35 tests in `src/__tests__/nutritionTrendIntegrityAndCoverage.test.ts` (suite total: 640 tests, line coverage: 92.58%).
- **Target Task:** Task 4.4A

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
- **Status:** RESOLVED (Task 4.3)
- **Location:** `src/screens/AddMealScreen.tsx`, `src/screens/EditMealScreen.tsx`, `src/components/FoodPickerModal.tsx`, `src/components/ManualFoodModal.tsx`
- **Description:** Form fields were constrained to a single food item (`foodName`, `quantity`, `calories`, `protein`, `carbs`, `fats`).
- **Root Cause:** Hardcoded single-item state.
- **Impact:** Users could not log complex meals without creating separate meal entries for each food item.
- **Resolution & Verification:**
  - Implemented multi-food draft state in both `AddMealScreen` and `EditMealScreen` allowing unlimited food items per meal.
  - Integrated `FoodPickerModal` connecting the 158-entry bilingual food catalog and custom foods with serving options, fractional quantities, and live gram mass previews.
  - Provided `ManualFoodModal` for direct nutrient entry alongside catalog foods.
  - Real-time meal calorie and macro totals dynamically sum child items via `calculateMealTotals()`.
  - Atomic persistence to SQLite via `insertMeal` / `updateMeal` preserving snapshots without mutating historical data.
  - Verified by Tests 14–24 in `src/__tests__/multiFoodMealAndDayNavigation.test.ts`.
- **Target Task:** Task 4.3

#### ISSUE-NUT-12: Absence of Built-in Food Catalog & Portion Scaling
- **Severity:** P2 (Medium)
- **Status:** RESOLVED (Task 4.2)
- **Location:** `src/data/foodCatalog.ts`, `src/models/food.ts`, `src/utils/foodScaling.ts`, `src/utils/foodSearch.ts`, `src/db/repositories/customFoodRepository.ts`
- **Description:** Users previously had to manually enter calories and macros for every single item; there was no searchable catalog or portion scaling.
- **Root Cause:** Only 6 hardcoded food items existed in `seedData.ts`; no production catalog architecture was built.
- **Impact:** High logging friction; users had to look up nutrition values externally.
- **Resolution & Verification:**
  - Implemented 158 verified bilingual food items with USDA FDC and SFDA citations in `src/data/foodCatalog.ts`.
  - Implemented portion scaling engine on pure mass basis with floating precision and display rounding in `src/utils/foodScaling.ts`.
  - Implemented offline bilingual search with Arabic text normalization (alef variants, taa marbuta, diacritics) in `src/utils/foodSearch.ts`.
  - Implemented `SQLiteCustomFoodRepository` and Migration 9 (`add_custom_foods_and_meal_enhancements_v9`).
  - Verified by 35 comprehensive tests in `src/__tests__/foodCatalogAndPortionScaling.test.ts`.
- **Target Task:** Task 4.2

#### ISSUE-NUT-12A: Food Catalog Data Provenance Gaps, Portion Scaling Overflow & Snapshot ID Hardening
- **Severity:** P1 (High)
- **Status:** RESOLVED (Task 4.2A)
- **Location:** `src/data/foodCatalog.ts`, `src/models/food.ts`, `src/utils/foodScaling.ts`
- **Description:** Food catalog entries contained unverified synthetic citation codes (e.g. `SFDA-DATE-001`, `SFDA-RICE-001`) that lacked verification against official databases. In addition, portion scaling calculation functions lacked boundary checks against extreme numerical inputs, non-finite values (`NaN`, `Infinity`), or negative quantities, and `createMealItemSnapshot` used non-monotonic `Date.now() + Math.random()` string keys.
- **Root Cause:** Placeholder data references from mock generation; omission of arithmetic upper bounds and centralized `createId` utility in snapshot creation.
- **Impact:** Misleading data provenance claims for regional foods; potential numerical overflow or NaN propagation in portion scaling; risk of primary key collisions during batch meal item creation.
- **Resolution & Verification:**
  - Audited all 158 food entries item-by-item: categorized 143 as `VERIFIED` (USDA FoodData Central with direct URLs), 6 as `ESTIMATED` (Saudi traditional composite dishes with documented recipe formulations), 9 as `UNVERIFIED` (SFDA staple single foods with synthetic codes awaiting official alphanumeric key mapping), and 0 `MISMATCH`. Published machine-readable audit report in `docs/design/food-catalog-source-audit.md`.
  - Added typed `ProvenanceStatus = 'VERIFIED' | 'ESTIMATED' | 'UNVERIFIED' | 'MISMATCH'` and optional `sourceUrl` / `recipeNotes` to `FoodCatalogEntry`.
  - Hardened portion scaling with `SCALING_LIMITS` enforcing positive finite numbers and strict bounds (`MAX_QUANTITY = 10_000`, `MAX_SERVING_GRAMS = 100_000`, `MAX_TOTAL_GRAMS = 1_000_000`, `MAX_SCALED_CALORIES = 10_000_000`, `MAX_SCALED_MACROS = 1_000_000`).
  - Standardized meal item snapshot IDs on `createId('meal-item')` with monotonic entropy and crypto UUID fallback.
  - Verified by 20 focused tests in `src/__tests__/foodCatalogProvenanceAndScalingSafety.test.ts`.
- **Target Task:** Task 4.2A

#### ISSUE-NUT-13: Unfiltered Infinite Meal List & Missing Date Navigation
- **Severity:** P2 (Medium)
- **Status:** RESOLVED (Task 4.3)
- **Location:** `src/screens/MealsScreen.tsx`, `src/utils/date.ts`
- **Description:** `MealsScreen` rendered all meals ever logged in a flat list without day-by-day navigation or date filtering.
- **Root Cause:** Missing day navigation component on `MealsScreen`.
- **Impact:** Difficult to review meals logged on previous days or see daily macro totals for past dates.
- **Resolution & Verification:**
  - Added calendar date navigation header with Previous Day, Next Day, and Today buttons using strict local dates (`YYYY-MM-DD`).
  - Added date helper functions `getPreviousCalendarDate()` and `getNextCalendarDate()` handling month rollovers, leap years, and calendar boundaries cleanly.
  - Added daily nutrition summaries dynamically recomputed for the active selected day.
  - Added empty-day state when no meals are logged for the selected date.
  - Verified by Tests 30–35 in `src/__tests__/multiFoodMealAndDayNavigation.test.ts`.
- **Target Task:** Task 4.3

#### ISSUE-NUT-13A: Undated Legacy Meals Attribution, Midnight Rollover & Navigation Continuity
- **Severity:** P1 (High)
- **Status:** RESOLVED (Task 4.3A)
- **Location:** `src/screens/MealsScreen.tsx`, `src/navigation/AppNavigator.tsx`, `src/hooks/useLiveLocalDate.ts`, `src/components/MealCard.tsx`, `src/screens/MealDetailsScreen.tsx`
- **Description:** Undated legacy meals (`!m.date`) were previously matched on every single diary day via `if (!m.date) return true`, polluting dated daily totals. Furthermore, `todayKey` was frozen on initial mount via `useMemo(..., [])`, leading to stale dates across midnight or app resume, and the selected diary date was not preserved across Add/Edit/Delete flows, tab switching, or language switching.
- **Root Cause:** Permissive date fallback in diary filter; static `useMemo` for today's date without lifecycle or midnight listeners; ephemeral local state ownership of `selectedDate` in `MealsScreen`.
- **Impact:** Double-counting undated meal calories on every single day; inaccurate Today/Yesterday labels after midnight; reset of user-selected calendar dates to today upon returning from child screens, switching tabs, or changing language.
- **Resolution & Verification:**
  - Strict date matching in `MealsScreen`: only meals where `m.date.slice(0, 10) === activeDate` are included in the daily list and `dailyTotals`.
  - Dedicated recoverable "Unassigned Date Meals" section rendering undated meals without dates invented in SQLite; user can tap to edit and assign them to a calendar day.
  - Live local date hook (`useLiveLocalDate`) dynamically refreshing on `AppState` resume and scheduling exact midnight rollover timers.
  - Lifted `selectedDiaryDate` ownership to `AppNavigator`, preserving historical date selection across Add/Edit/Delete flows, tab switches, and language changes.
  - If a meal's own date is edited, `selectedDiaryDate` updates to the meal's newly assigned date.
  - Verified by 25 comprehensive tests in `src/__tests__/dailyDiaryDateIntegrity.test.ts`.
- **Target Task:** Task 4.3A

#### ISSUE-NUT-14: Missing Meal Slot Categorization (Breakfast, Lunch, Dinner, Snack)
- **Severity:** P2 (Medium)
- **Status:** RESOLVED (Task 4.3)
- **Location:** `src/models/meal.ts`, `src/screens/MealsScreen.tsx`, `src/screens/AddMealScreen.tsx`, `src/screens/EditMealScreen.tsx`
- **Description:** Meals had no structured category or meal slot property; users had to type "Lunch" into the free-text `title`.
- **Root Cause:** Schema and UI lacked structured meal slot selection.
- **Impact:** Cannot organize UI by standard meal times or distinguish breakfast from dinner.
- **Resolution & Verification:**
  - Leveraged `meals.meal_type` column from Migration 9 supporting `'breakfast' | 'lunch' | 'dinner' | 'snack' | 'other'`.
  - Added meal slot selection chips in `AddMealScreen` and `EditMealScreen` with auto-defaulted meal titles based on selected slot.
  - Grouped `MealsScreen` by meal slot with localized section headers and badges.
  - Fully backward compatible with legacy meals without `meal_type` (rendered under 'Other').
  - Verified by Tests 25–27 in `src/__tests__/multiFoodMealAndDayNavigation.test.ts`.
- **Target Task:** Task 4.3

#### ISSUE-NUT-17: Repetitive Logging Overhead & Lack of Meal Templates
- **Severity:** P2 (Medium)
- **Status:** RESOLVED (Task 4.5)
- **Location:** `src/models/meal.ts`, `src/components/MealCard.tsx`, `src/screens/MealDetailsScreen.tsx`, `src/components/QuickAddMealModal.tsx`
- **Description:** Users had to re-enter repeated meals manually food-by-food; no quick repeat or standalone calorie logging was available.
- **Root Cause:** Lack of favorite/template flag and quick calorie logging flow.
- **Impact:** High logging fatigue for frequent/daily meals.
- **Resolution & Verification:**
  - Added `isFavorite` and `isTemplate` flags to `Meal` model with SQLite persistence via notes encoding.
  - Added "Log Again Today" repeat meal draft generator in `src/utils/nutrition.ts`.
  - Implemented `QuickAddMealModal.tsx` with strict numeric input validation.
  - Added Favorites filter chip to `MealsScreen.tsx`.
  - Verified by 10 tests in `src/__tests__/mealTemplatesFavoritesAndQuickLog.test.ts`.
- **Target Task:** Task 4.5

#### ISSUE-NUT-17A: Meal Template Coupling, Note Corruption & Unknown Macro Ambiguities
- **Severity:** P1 (High)
- **Status:** RESOLVED (Task 4.5A)
- **Location:** `src/db/migrations.ts`, `src/models/mealTemplate.ts`, `src/db/repositories/mealTemplateRepository.ts`, `src/utils/nutrition.ts`, `src/components/QuickAddMealModal.tsx`
- **Description:** Templates were tied to consumed meals and favorite state was encoded into user notes text via `[favorite]`. In addition, omitted macros were mapped to numeric zero, falsely reporting confirmed zero intake in daily analytics, repeat-meal copied favorite flags, and SQLite failures lacked draft retention.
- **Root Cause:** Reusing notes column for state; lack of dedicated template tables; lack of distinct unknown macronutrient semantics.
- **Impact:** Notes polluted with synthetic metadata; templates accidentally modifying consumed history; false zero-macro intake reporting.
- **Resolution & Verification:**
  - Added Migration 10 creating dedicated `meal_templates` and `meal_template_items` tables and adding structural `is_favorite`, `nutrition_completeness`, `protein_known`, `carbs_known`, `fat_known` columns to `meals`.
  - Implemented `SQLiteMealTemplateRepository` with full CRUD completely decoupled from consumed meals.
  - Granular `toggleMealFavorite` updates favorite status without rewriting child items.
  - Preserved literal user notes without synthetic `[favorite]` tags.
  - Implemented typed `NutritionCompleteness` and macro known flags distinguishing entered 0g from unknown macros across summaries, target progress, and macro distribution.
  - Hardened `QuickAddMealModal` with error banner, draft retention, and unknown macro tracking.
  - Added 12 tests in `src/__tests__/templateIntegrityAndQuickLogHardening.test.ts` (662 total tests passing).
- **Target Task:** Task 4.5A

#### ISSUE-NUT-17B: Synthetic Template Items, Lost Unknown Macros & False Favorites in Migration 10
- **Severity:** P1 (High)
- **Status:** RESOLVED (Task 4.5B)
- **Location:** `src/models/mealTemplate.ts`, `src/db/migrations.ts`, `src/db/repositories/mealTemplateRepository.ts`, `src/db/repositories/mealRepository.ts`, `src/models/meal.ts`
- **Description:** Itemless calorie-only meals converted to templates fabricated a synthetic food item with 0g protein, carbs, and fat, falsely converting unknown macros into confirmed 0g complete intake upon logging. Furthermore, Migration 10 erroneously updated `is_favorite = 1` for meals whose notes contained `[favorite]` in middle-of-text user prose.
- **Root Cause:**
  1. Synthesizing a fake food item when `items.length === 0` instead of supporting explicit itemless templates with direct nutrient totals.
  2. In Migration 10, using unanchored `WHERE notes LIKE '%[favorite]%'` without checking for leading prefix marker.
- **Impact:** Falsely reported zero macro intake on logged meals; corrupted favorite classification on user notes mentioning `[favorite]`.
- **Resolution & Verification:**
  - Extended `MealTemplate` domain model and `meal_templates` table to store direct nutrient totals and completeness flags (`nutritionCompleteness`, `proteinKnown`, `carbsKnown`, `fatKnown`).
  - Updated `createTemplateFromMeal` to keep explicit `items: []` for itemless meals without fabricating synthetic food items.
  - Updated `createMealFromTemplate` to preserve itemless structure and completeness flags, never inventing confirmed zeros.
  - Added Migration 11 (`add_meal_template_nutrient_fidelity_and_favorite_repair_v11`) adding totals columns to `meal_templates`, backfilling existing template totals from items, and resetting `is_favorite = 0` on meals where notes contained `[favorite]` in user prose without leading prefix.
  - Hardened note encoding/decoding and repository fallback using anchored regex (`/^\[favorite\](?:\s|$)/i`).
  - Added 9 tests in `src/__tests__/templateNutrientFidelityAndLegacyFavorites.test.ts` (671 total passing tests).
- **Target Task:** Task 4.5B

#### ISSUE-NUT-17C: Legacy Favorite Provenance Ambiguity & Pre-4.5B Calorie-Only Template Repair
- **Severity:** P1 (High)
- **Status:** RESOLVED (Task 4.6)
- **Location:** `src/db/migrations.ts`, `src/db/repositories/mealRepository.ts`, `src/models/meal.ts`, `src/models/mealTemplate.ts`, `src/screens/MealsScreen.tsx`, `src/components/MacroCard.tsx`
- **Description:** Migration 11 cleared `is_favorite` for notes containing `[favorite]` inside user prose. However, if a user had explicitly favorited that meal in Task 4.5A, that choice was cleared with no provenance tracking. In addition, V10 templates created before Task 4.5B retained 0g macros from their synthetic items, displaying as false confirmed 0g instead of unknown/unmeasured.
- **Root Cause:** Lack of favorite provenance tracking (`favorite_source`); ambiguous historical classification between user prose and explicit UI selection; V10 templates lacking `indeterminate` tag.
- **Impact:** Users who explicitly favorited prose-noted meals lost favorites; legacy V10 templates claimed confirmed 0g protein, carbs, and fat.
- **Resolution & Verification:**
  - Added forward Migration 12 (`add_provenance_and_repair_legacy_templates_v12`) adding `favorite_source` column (`legacy_marker`, `ambiguous`, `explicit`, `none`).
  - Backfilled provenance conservatively without destructive data loss; explicit user toggles update `favorite_source = 'explicit'` preventing repeated reclassification.
  - Repaired V10 legacy templates with positive calories and 0g macros to `nutrition_completeness = 'indeterminate'` with unknown macros (`protein_known = 0`, `carbs_known = 0`, `fat_known = 0`).
  - Hardened touch targets across all nutrition UI to meet Android $\ge 48\text{dp}$ and iOS $\ge 44\text{pt}$.
  - Mirrored directional arrows and back navigation dynamically in Arabic RTL; preserved Latin digits (`ar-SA-u-nu-latn`).
  - Added 12 tests in `src/__tests__/crossPlatformA11yAndArabicParity.test.ts` (683 total passing tests).
- **Target Task:** Task 4.6

#### ISSUE-NUT-17D: Migration 12 Over-Generalization of Indeterminate Templates & Favorite Source Overwrite on Edit
- **Severity:** P1 (High)
- **Status:** RESOLVED (Task 4.6A)
- **Location:** `src/db/migrations.ts`, `src/models/mealTemplate.ts`, `src/db/repositories/mealRepository.ts`, `src/screens/EditMealScreen.tsx`, `src/screens/AddMealScreen.tsx`
- **Description:** Migration 12 unconditionally set `nutrition_completeness = 'indeterminate'` on all templates with `total_calories > 0 AND total_protein = 0 AND total_carbs = 0 AND total_fat = 0`, overwriting genuine templates with confirmed zero macros (such as black coffee or tea with catalogId). Furthermore, updating a meal in `EditMealScreen` previously omitted `favoriteSource` and `isFavorite` on payload, causing `updateMeal` to reset them.
- **Root Cause:** Migration 12 did not inspect `meal_template_items` for catalog identity, multiple items, or portion evidence; `updateMeal` lacked fallback preservation for unpassed favorite metadata.
- **Impact:** Genuine zero-macro food templates were misclassified as indeterminate; editing meal details cleared favorite status and provenance metadata.
- **Resolution & Verification:**
  - Implemented forward-only Migration 13 (`harden_template_nutrient_fidelity_and_favorite_provenance_v13`) leaving Migrations 1–12 completely untouched.
  - Migration 13 restores `nutrition_completeness = 'complete'` and known zero flags (`protein_known = 1`, `carbs_known = 1`, `fat_known = 1`) for templates with verifiable child item evidence (`catalog_id IS NOT NULL`, `portion_unit IS NOT NULL`, unit not generic serving, custom item name, or multiple items).
  - Preserved honest uncertainty (`indeterminate`, unknown macros) for templates lacking child item evidence or matching synthetic footprints.
  - Updated `mealRepository.updateMeal` and `EditMealScreen` to strictly preserve existing `isFavorite`, `favoriteSource`, and macro known flags across edits.
  - Added 25 automated regression and interactive component tests in `src/__tests__/legacyTemplateMigrationSafetyAndAcceptance.test.ts` (708 total passing tests).
- **Target Task:** Task 4.6A

#### ISSUE-NUT-18: False Completeness for Positive-Calorie Zero-Macro Templates & Reconciliation via Migration 14
- **Severity:** P1 (High)
- **Status:** RESOLVED (Task 4.7)
- **Location:** `src/db/migrations.ts`, `src/models/mealTemplate.ts`, `src/models/meal.ts`
- **Description:** In Migration 13, templates with `total_calories > 0 AND total_protein = 0 AND total_carbs = 0 AND total_fat = 0` were unconditionally promoted to `'complete'` with known zero macros if child items had `catalog_id`, `portion_unit`, or `COUNT(*) > 1`. However, child item existence does not establish that macronutrients were scientifically measured. In physical science (Atwater 4/4/9 factors), positive calories cannot consist of confirmed 0g protein, 0g carbohydrates, and 0g fat without unmeasured nutrients. Promoting these to 'complete' fabricated false certainty.
- **Root Cause:** Equating child food existence with complete macro quantification.
- **Impact:** Templates with positive calories and unmeasured macros displayed fabricated 0g protein, carbs, and fat, falsely skewing macro distribution and intake metrics.
- **Resolution & Verification:**
  - Preserved Migrations 1–13 completely immutable.
  - Implemented forward-only Migration 14 (`reconcile_template_unknown_macros_and_preserve_uncertainty_v14`) reconciling all templates with `total_calories > 0` and 0g across all macros to `nutrition_completeness = 'indeterminate'` with `protein_known = 0`, `carbs_known = 0`, `fat_known = 0`.
  - Preserved genuine 0-calorie items (0 kcal, 0g macros) as complete and known zero.
  - Hardened `normalizeMealTemplate` and `normalizeMeal` to safely enforce indeterminate uncertainty on positive calories with 0g macros when explicit completeness is not provided.
  - Added 28 comprehensive automated regression and E2E acceptance tests in `src/__tests__/finalAcceptanceAndFullRegression.test.ts` (736 total passing tests, 90.94% coverage).
- **Target Task:** Task 4.7

#### ISSUE-NUT-19: Migration 14 Blanket Rule, Historical Metadata Ambiguity & User Reconfirmation Path via Migration 15
- **Severity:** P1 (High)
- **Status:** RESOLVED (Task 4.7A)
- **Location:** `src/db/migrations.ts`, `src/models/mealTemplate.ts`, `src/db/repositories/mealTemplateRepository.ts`, `src/services/mealTemplateService.ts`, `src/screens/MealsScreen.tsx`
- **Description:** Migration 14 applied a blanket heuristic rule overwriting all templates with `total_calories > 0 AND total_protein = 0 AND total_carbs = 0 AND total_fat = 0` to `indeterminate`, erasing user-entered known-zero records (e.g. black coffee, herbal tea, diet soda) where 0g was explicitly recorded from product labels. Because Migration 14 permanently overwrote these columns on existing databases without retaining original flags, original values could not be scientifically recovered via heuristic inference (such as food name matching or child item counts) without repeating Migration 13's defect.
- **Root Cause:** Blanket database mutation in Migration 14 without preserving provenance or providing a user-driven reconfirmation pathway.
- **Impact:** Irreversible alteration of nutrient completeness on existing databases; inability to distinguish genuinely unmeasured macro records from user-confirmed zero-macro records.
- **Resolution & Verification:**
  - Preserved Migrations 1–14 strictly immutable and forward-only.
  - Implemented forward-only Migration 15 (`add_meal_template_review_status_and_reconcile_ambiguity_v15`).
  - Added `review_status TEXT NOT NULL DEFAULT 'confirmed'` column and index `idx_meal_templates_review_status` to `meal_templates`.
  - Flags positive-calorie zero-macro records affected by Migration 14 as `review_status = 'ambiguous'`, transparently declaring historical uncertainty without inventing data.
  - Provided `reconfirmTemplate` in `SQLiteMealTemplateRepository` and `reconfirmMealTemplate` in `mealTemplateService` allowing users to review and reconfirm macro completeness.
  - Added bilingual review indicator in `MealsScreen` notifying users of templates requiring macro reconfirmation.
  - Created 13 focused regression and lifecycle tests in `src/__tests__/templateMigrationFidelityAndAmbiguityReconciliation.test.ts` covering Cases A through J, idempotency, transaction rollback, and full repository lifecycle (749 total passing tests, 90.79% coverage).
- **Target Task:** Task 4.7A

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

#### ISSUE-NUT-19: Migration 14 Blanket Rule, Historical Metadata Ambiguity & User Reconfirmation Path via Migration 15
- **Severity:** P1 (High)
- **Status:** RESOLVED (Task 4.7A)
- **Location:** `src/db/migrations.ts`, `src/models/mealTemplate.ts`, `src/db/repositories/mealTemplateRepository.ts`, `src/services/mealTemplateService.ts`, `src/screens/MealsScreen.tsx`
- **Description:** Migration 14 applied a blanket heuristic rule overwriting all templates with `total_calories > 0 AND total_protein = 0 AND total_carbs = 0 AND total_fat = 0` to `indeterminate`, erasing user-entered known-zero records (e.g. black coffee, herbal tea, diet soda) where 0g was explicitly recorded from product labels. Because Migration 14 permanently overwrote these columns on existing databases without retaining original flags, original values could not be scientifically recovered via heuristic inference (such as food name matching or child item counts) without repeating Migration 13's defect.
- **Root Cause:** Blanket database mutation in Migration 14 without preserving provenance or providing a user-driven reconfirmation pathway.
- **Impact:** Irreversible alteration of nutrient completeness on existing databases; inability to distinguish genuinely unmeasured macro records from user-confirmed zero-macro records.
- **Resolution & Verification:**
  - Preserved Migrations 1–14 strictly immutable and forward-only.
  - Implemented forward-only Migration 15 (`add_meal_template_review_status_and_reconcile_ambiguity_v15`).
  - Added `review_status TEXT NOT NULL DEFAULT 'confirmed'` column and index `idx_meal_templates_review_status` to `meal_templates`.
  - Flags positive-calorie zero-macro records affected by Migration 14 as `review_status = 'ambiguous'`, transparently declaring historical uncertainty without inventing data.
  - Provided `reconfirmTemplate` in `SQLiteMealTemplateRepository` and `reconfirmMealTemplate` in `mealTemplateService` allowing users to review and reconfirm macro completeness.
  - Added bilingual review indicator in `MealsScreen` notifying users of templates requiring macro reconfirmation.
  - Created 13 focused regression and lifecycle tests in `src/__tests__/templateMigrationFidelityAndAmbiguityReconciliation.test.ts` covering Cases A through J, idempotency, transaction rollback, and full repository lifecycle (749 total passing tests, 90.79% coverage).
- **Target Task:** Task 4.7A

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
