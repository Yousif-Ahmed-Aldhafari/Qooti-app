# Phase 4 Implementation Plan: Nutrition & Meal Planning Architecture

- **Document Version:** 1.0.0
- **Status:** Approved Engineering Roadmap
- **Date:** November 2026
- **Target Branch:** `dev/phase-4-nutrition`
- **Estimated Scope:** 7 Engineering Tasks (Task 4.1 to Task 4.7)

---

## 1. Phase 4 Architecture Objectives

1. **Eliminate Persistence Hazards:** Eradicate the `saveAllMeals` whole-table wipe pattern in favor of atomic, granular SQLite operations (`insertMeal`, `updateMeal`, `deleteMeal`).
2. **Complete Meal Lifecycle:** Deliver robust meal editing, multi-food composition, and safe deletion with transactional cascade integrity.
3. **Bilingual Food Catalog & Portion Scaling:** Implement a static bilingual catalog (~150+ foods) with regional Middle Eastern nutrition profiles and automated macro scaling.
4. **Timezone & Identity Hardening:** Resolve UTC date shifts with local calendar dates and replace timestamp IDs with monotonic UUIDs.
5. **Daily Target & Progress Synchronization:** Connect logged nutrition to daily targets and historical weekly trend analytics.
6. **Cross-Platform UX & A11y Parity:** Maintain Apple HIG and Android Material Design 3 guidelines, RTL/LTR symmetry, and 100% data preservation.

---

## 2. Detailed Task Breakdown

```
[ Task 4.0: Nutrition Architecture Audit & Blueprint ] ────────► (COMPLETE)
       │
       ▼
[ Task 4.1: Meal Lifecycle Integrity, Granular Persistence & Editing ] ──► (COMPLETE - 423 Tests)
       │
       ▼
[ Task 4.1A: Meal Input Validation & Transaction Ownership Hardening ] ──► (COMPLETE - 445 Tests)
       │
       ▼
[ Task 4.2: Bilingual Food Catalog & Portion Scaling Engine ] ──► (COMPLETE - 480 Tests)
       │
       ▼
[ Task 4.2A: Food Data Provenance & Portion Scaling Safety ] ──► (COMPLETE - 500 Tests)
       │
       ▼
[ Task 4.3: Multi-Food Meal Creation, Search UX & Day Navigation ] ──► (COMPLETE - 540 Tests)
       │
       ▼
[ Task 4.3A: Daily Diary Date Integrity & Navigation Hardening ] ──► (COMPLETE - 565 Tests)
       │
       ▼
[ Task 4.4: Nutrition Analytics, Daily Targets & Macro Distribution ] ──► (COMPLETE - 605 Tests)
       │
       ▼
[ Task 4.4A: Nutrition Trend Integrity & Coverage Hardening ] ──► (COMPLETE - 640 Tests)
       │
       ▼
[ Task 4.5: Meal Templates, Favorites & Quick-Log ] ──► (COMPLETE - 650 Tests)
       │
       ▼
[ Task 4.5A: Template Integrity, Unknown Macros & Quick-Log Hardening ] ──► (COMPLETE - 662 Tests)
       │
       ▼
[ Task 4.5B: Template Nutrient Fidelity & Legacy Favorites ] ──► (COMPLETE - 671 Tests)
       │
       ▼
[ Task 4.6: Cross-Platform UI/UX, A11y & Arabic Parity Hardening ] ──► (COMPLETE - 683 Tests)
       │
       ▼
[ Task 4.6A: Legacy Template Migration Safety & Acceptance Hardening ] ──► (COMPLETE - 708 Tests)
       │
       ▼
[ Task 4.7: Final Acceptance, Full Regression & Merge Readiness ] ──► (COMPLETE - 736 Tests)
       │
       ▼
[ Task 4.7A: Final Migration Fidelity & Acceptance Corrections ] ──► (COMPLETE - 749 Tests)
       │
       ▼
[ Task 4.7 Closeout: Template Macro Review Flow & Final Closeout ] ──► (COMPLETE - 759 Tests)
       │
       ▼
[ Task 4.7 Final Fix: Nutrient Integrity, Multi-Item Protection & Strict Parsing ] ──► (COMPLETE - 764 Tests)
       │
       ▼
[ Task 4.7 Data Preservation Fix: Unknown Macro Nutrient Preservation & Hardening ] ──► (COMPLETE - 773 Tests)
```

---

### Task 4.1: Meal Lifecycle Integrity, Granular Persistence & Editing [COMPLETED]
- **Status:** COMPLETED
- **Objective:** Fix P0 and P1 persistence defects; introduce granular async repository methods in `AppContext`; implement `EditMealScreen` and safe meal deletion.
- **Pre-conditions:** Task 4.0 audit complete; 388 baseline tests passing.
- **Outcome Metrics:** 423 total passing tests (+35 new tests in `mealLifecycleIntegrity.test.ts`), 0 failures, 0 skipped, 0 TypeScript errors, 0 ESLint warnings, 20/20 expo-doctor checks passing.
- **Technical Specifications:**
  1. **Eradicate `saveAllMeals` in AppContext:**
     - Replace `saveMeals(state.meals)` effect with direct async calls to `insertMealService(meal)`, `updateMealService(meal)`, and `deleteMealService(mealId)`.
     - Deprecate `saveAllMeals` in `SQLiteMealRepository` and `mealService`.
  2. **Domain Model Hardening (`src/models/meal.ts`):**
     - Add `validateMeal(meal)` and `validateMealItem(item)` enforcing non-negative numbers, non-empty names, finite calories/macros, and local date formats.
     - Enforce `createId('meal')` and `createId('meal-item')` from `src/utils/id.ts`.
  3. **Local Date & Time Formatting:**
     - Replace UTC `toISOString().slice(0, 10)` with local `toDateKey(date)`.
     - Standardize `time` to 24-hr `HH:mm`.
  4. **Edit Meal Flow:**
     - Create `src/screens/EditMealScreen.tsx`.
     - Register `editMeal` in `ScreenKey` (`src/types/index.ts`) and `AppNavigator.tsx`.
     - Add "Edit" button on `MealDetailsScreen.tsx` with navigation handshake.
  5. **Delete Meal Flow:**
     - Implement deletion confirmation dialog on `MealDetailsScreen.tsx` and `MealsScreen.tsx`.
     - State machine: `idle` $\rightarrow$ `confirming` $\rightarrow$ `deleting` $\rightarrow$ `success` / `error`.
     - Ensure atomic SQLite delete with cascade cleanup of child items.
- **Files Affected:**
  - `src/models/meal.ts`
  - `src/utils/nutrition.ts`
  - `src/store/AppContext.tsx`
  - `src/services/mealService.ts`
  - `src/db/repositories/mealRepository.ts`
  - `src/navigation/AppNavigator.tsx`
  - `src/screens/AddMealScreen.tsx`
  - `src/screens/EditMealScreen.tsx` (new)
  - `src/screens/MealDetailsScreen.tsx`
  - `src/types/index.ts`
  - `src/i18n/en.ts`, `src/i18n/ar.ts`
- **Automated Test Requirements:**
  - Granular insert, update, delete tests verifying no whole-table deletion.
  - Strict validation tests rejecting negative calories, NaN, invalid dates.
  - UTC vs local calendar date boundary regression tests.
  - Deletion rollback and cascade verification tests.
- **Success Criteria:** Zero `saveAllMeals` invocations during logging; full CRUD operational in UI; all 388 baseline tests + new tests passing.

---

### Task 4.1A: Meal Input Validation & Transaction Ownership Hardening [COMPLETED]
- **Status:** COMPLETED
- **Objective:** Harden numeric nutrient input parsing, date/time contracts, and repository transaction ownership without expanding feature scope or altering schema.
- **Pre-conditions:** Task 4.1 completed; 423 baseline tests passing.
- **Outcome Metrics:** 445 total passing tests (+22 new tests in `mealInputValidationAndTxnHardening.test.ts`), 0 failures, 0 skipped, 89.74% overall line coverage, 99.04% `mealRepository.ts` line coverage, 0 TypeScript errors, 0 ESLint warnings, 20/20 expo-doctor checks passing.
- **Technical Specifications:**
  1. **Strict UI Nutrient & Quantity Parsing (`src/utils/nutrition.ts`):**
     - Implemented `parseStrictNutrientInput`, `parseStrictQuantity`, and `parseStrictNutrient` returning typed `StrictParseResult` with explicit `isEmpty`, `parsedValue`, and typed error codes.
     - Support both `.` and `,` as decimal separators.
     - Reject non-finite values (`NaN`, `Infinity`, `-Infinity`, scientific notation `1e50`), negative quantities/macros, zero quantities, and unbounded inputs ($> 100,000$).
     - Distinguish empty input from entered zero.
     - Added localized error strings in English and Arabic (`cannotBeNegative`, `mustBePositive`, `valueTooLarge`, `invalidNumber`, `invalidDate`, `invalidTime`).
  2. **Exact Date and Time Contract (`src/models/meal.ts`):**
     - Exact `YYYY-MM-DD` date validation rejecting trailing whitespace, timestamps, slashes, and impossible leap-day dates (e.g. 2026-02-29 rejected, 2024-02-29 accepted).
     - Standardized 24-hr `HH:mm` format for persistent records while maintaining backward-compatible read support for legacy formats.
  3. **Repository Transaction Ownership (`src/db/repositories/mealRepository.ts`):**
     - In `insertMeal`, `updateMeal`, `deleteMeal`, and `saveAllMeals`, if caller provides an active transaction `txn`, execute queries directly on `txn` without invoking `target.withExclusiveTransactionAsync()`.
     - When `txn` is absent, open exactly one exclusive transaction on `this.db`.
  4. **UI Validation & State Preservation:**
     - `AddMealScreen` and `EditMealScreen` validate fields on-the-fly and upon submit, preserving raw typed input and preventing navigation/submission when validation fails.
- **Files Affected:**
  - `src/i18n/en.ts`, `src/i18n/ar.ts`
  - `src/utils/nutrition.ts`
  - `src/models/meal.ts`
  - `src/db/repositories/mealRepository.ts`
  - `src/screens/AddMealScreen.tsx`
  - `src/screens/EditMealScreen.tsx`
  - `src/__tests__/dailyNutritionTargets.test.ts`
  - `src/__tests__/targetIntegrityAcceptance.test.ts`
  - `src/__tests__/mealInputValidationAndTxnHardening.test.ts` (new)
- **Success Criteria:** All 445 tests passing; clean static analysis; safe SQLite transactions.

---

### Task 4.2: Bilingual Food Catalog & Portion Scaling Engine
- **Objective:** Build built-in bilingual food database (~150+ foods), custom foods database schema, portion scaling calculations, and bilingual offline search.
- **Pre-conditions:** Task 4.1 & Task 4.1A completed; 445 baseline tests passing.
- **Outcome Metrics:** 480 total passing tests (+35 new tests in `foodCatalogAndPortionScaling.test.ts`), 0 failures, 0 skipped, 91.82% overall line coverage, 0 TypeScript errors, 0 ESLint warnings, 20/20 expo-doctor checks passing.
- **Status:** COMPLETED
- **Technical Specifications:**
  1. **Bilingual Food Catalog (`src/data/foodCatalog.ts`):**
     - 158 verified foods across 10 categories with `id` (slug), `nameEn`, `nameAr`, `category`, base 100g nutritional profile (calories, protein, carbs, fats), and citations to USDA FoodData Central and SFDA.
     - Food-specific serving options avoiding universal cup assumptions (e.g. 1 cup oats = 80g; 1 cup raw rice = 185g; 1 cup milk = 244g).
     - Distinct entries for raw vs. cooked preparation states (`chicken-breast-raw` vs `chicken-breast-cooked`, `rice-white-raw` vs `rice-white-cooked`).
  2. **Portion Scaling Engine (`src/utils/foodScaling.ts`):**
     - Pure mass-basis calculation: $\text{scaledNutrient} = \text{nutrientPer100g} \times \text{totalGrams} / 100$.
     - Retains high floating-point precision until snapshot generation; rounds calories to integer and macros to 1 decimal place.
     - Immutable meal item snapshot policy: logging a meal copies absolute nutrient values into `meal_items`, decoupling logged history from future custom food or catalog changes.
  3. **Custom Foods (`src/models/food.ts`, `src/db/repositories/customFoodRepository.ts`):**
     - Offline custom foods repository with transaction ownership hardening and duplicate ID guards.
  4. **Offline Search & Normalization (`src/utils/foodSearch.ts`):**
     - Arabic normalization (stripping diacritics/tashkeel, normalizing alef variants [أإآٱ] -> ا, taa marbuta ة -> ه, alif maqsura ى -> ي).
     - Deterministic token and substring matching with category filtering.
  5. **SQLite Migration 9 (`add_custom_foods_and_meal_enhancements_v9`):**
     - Created `custom_foods` table with indexes on `name` and `category`.
     - Added `meal_type` and `notes` to `meals`.
     - Added `catalog_id` and `portion_unit` to `meal_items`.
- **Files Affected:**
  - `src/models/food.ts` (new)
  - `src/data/foodCatalog.ts` (new)
  - `src/utils/foodScaling.ts` (new)
  - `src/utils/foodSearch.ts` (new)
  - `src/db/repositories/customFoodRepository.ts` (new)
  - `src/services/customFoodService.ts` (new)
  - `src/db/migrations.ts`
  - `src/db/repositories/mealRepository.ts`
  - `src/db/types.ts`
  - `src/models/meal.ts`
  - `src/__tests__/foodCatalogAndPortionScaling.test.ts` (new)
  - `docs/design/food-catalog-and-portion-engine.md` (new)
- **Automated Test Requirements:**
  - 35 criteria in `src/__tests__/foodCatalogAndPortionScaling.test.ts` verified.
- **Success Criteria:** Clean catalog resolution for 158 items; bidirectional scaling accuracy; zero migration errors.

---

### Task 4.2A: Food Data Provenance & Portion Scaling Safety [COMPLETED]
- **Status:** COMPLETED
- **Objective:** Verify the authenticity, accuracy, and traceability of Qooti's 158 catalog food records; classify provenance without inventing references; harden portion scaling against overflow and non-finite values; and standardize monotonic snapshot IDs.
- **Pre-conditions:** Task 4.2 completed; 480 baseline tests passing.
- **Outcome Metrics:** 500 total passing tests (+20 new tests in `foodCatalogProvenanceAndScalingSafety.test.ts`), 0 failures, 0 skipped, 92.27% overall line coverage, 0 TypeScript errors, 0 ESLint warnings, 20/20 expo-doctor checks passing.
- **Technical Specifications:**
  1. **Food Catalog Provenance Audit (`src/data/foodCatalog.ts`, `src/models/food.ts`, `docs/design/food-catalog-source-audit.md`):**
     - Audited all 158 foods item-by-item against official databases.
     - Added typed `ProvenanceStatus` (`VERIFIED` | `ESTIMATED` | `UNVERIFIED` | `MISMATCH`) to food models.
     - 143 verified foods (USDA FoodData Central Foundation and SR Legacy) with direct URLs.
     - 6 estimated composite regional dishes (SFDA / SFCT) with documented recipe formulations.
     - 9 unverified single staple foods with transparent placeholder disclaimer.
     - 0 mismatches.
     - Generated machine-readable audit catalog in `docs/design/food-catalog-source-audit.md`.
  2. **Portion Scaling Arithmetic Safety (`src/utils/foodScaling.ts`):**
     - Enforced `SCALING_LIMITS` (`MAX_QUANTITY = 10_000`, `MAX_SERVING_GRAMS = 100_000`, `MAX_TOTAL_GRAMS = 1_000_000`, `MAX_SCALED_CALORIES = 10_000_000`, `MAX_SCALED_MACROS = 1_000_000`).
     - Hardened `calculateServingGrams`, `scaleFoodNutrients`, and `scaleCustomFoodNutrients` against non-finite values (`NaN`, `Infinity`, `-Infinity`), negative quantities, and zero quantities.
     - Thrown descriptive errors on unsupported serving units.
  3. **Snapshot Monotonic ID Safety (`src/utils/foodScaling.ts`):**
     - Replaced naive string concatenation (`Date.now() + Math.random()`) in `createMealItemSnapshot` and `createCustomFoodMealItemSnapshot` with `createId('meal-item')`.
- **Files Affected:**
  - `src/models/food.ts`
  - `src/data/foodCatalog.ts`
  - `src/utils/foodScaling.ts`
  - `docs/design/food-catalog-source-audit.md` (new)
  - `src/__tests__/foodCatalogProvenanceAndScalingSafety.test.ts` (new)
  - `docs/design/food-catalog-and-portion-engine.md`
- **Automated Test Requirements:**
  - 20 criteria in `src/__tests__/foodCatalogProvenanceAndScalingSafety.test.ts` verified.
- **Success Criteria:** 100% of 158 foods cataloged with explicit provenance status; zero scaling overflow; 500 passing tests.

---

### Task 4.3: Multi-Food Meal Creation, Search UX & Day Navigation [COMPLETED]
- **Status:** COMPLETED
- **Objective:** Connect the bilingual food catalog and portion-scaling engine to real user-facing meal logging; support multi-food creation and editing drafts; add bilingual food picker with portion selectors and manual item entry; implement day-by-day calendar navigation and meal slot organization.
- **Pre-conditions:** Task 4.2 and Task 4.2A completed and verified; 500 baseline tests passing.
- **Outcome Metrics:** 540 total passing tests (+40 new tests in `multiFoodMealAndDayNavigation.test.ts`), 0 failures, 0 skipped, 0 TypeScript errors, 0 ESLint warnings, 92.41% line coverage, 20/20 expo-doctor checks passing.
- **Technical Specifications:**
  1. **Multi-Food Meal Creation & Editing (`AddMealScreen`, `EditMealScreen`):**
     - Dynamic multi-food items list supporting adding, removing, and reordering items without caps.
     - Live updating meal totals card (calories, protein, carbs, fats) recomputed via `calculateMealTotals()`.
     - Preserves historical snapshots and item IDs without truncation or mutation.
     - Atomic SQLite transactions via `insertMeal` and `updateMeal`.
  2. **Food Picker Modal (`FoodPickerModal.tsx`):**
     - Fast debounced bilingual search over 158 catalog foods and custom foods.
     - Arabic normalization handling tashkeel, alef variants, and taa marbuta.
     - Category filter chips and provenance badges (`VERIFIED`, `ESTIMATED`, `UNVERIFIED`).
     - Portion selector with serving options (e.g. cup, large, 100g, grams) and strict fractional quantity parsing.
     - Manual food fallback via `ManualFoodModal.tsx`.
  3. **Meals Screen Day Navigation (`MealsScreen.tsx`):**
     - Date navigation header: Previous Day, Next Day, Today button.
     - Strict local calendar date filtering (`YYYY-MM-DD`) across midnight and month/leap-year boundaries.
     - Day-specific calorie totals and target comparison.
     - Meal slot grouping: Breakfast, Lunch, Dinner, Snack, Other.
- **Files Affected:**
  - `src/components/FoodPickerModal.tsx` (new)
  - `src/components/ManualFoodModal.tsx` (new)
  - `src/screens/AddMealScreen.tsx` (updated)
  - `src/screens/EditMealScreen.tsx` (updated)
  - `src/screens/MealsScreen.tsx` (updated)
  - `src/screens/MealDetailsScreen.tsx` (updated)
  - `src/navigation/AppNavigator.tsx` (updated)
  - `src/utils/foodSearch.ts` (updated)
  - `src/services/customFoodService.ts` (updated)
  - `src/db/index.ts` (updated)
  - `src/utils/date.ts` (updated)
  - `src/i18n/en.ts` & `src/i18n/ar.ts` (updated)
  - `src/__tests__/multiFoodMealAndDayNavigation.test.ts` (new - 40 tests)
- **Success Criteria:** Verified multi-food meal logging, portion scaling, bilingual search, date navigation, and backward compatibility. All 540 tests passing.

---

### Task 4.3A: Daily Diary Date Integrity & Navigation Hardening [COMPLETED]
- **Status:** COMPLETED
- **Objective:** Eliminate undated legacy meal leakage across diary days, prevent daily totals distortion, implement live local-day midnight rollover with AppState resume listeners, and preserve selected diary date navigation state across Add/Edit/Delete flows, language changes, and tab switches.
- **Pre-conditions:** Task 4.3 completed and verified; 540 baseline tests passing.
- **Outcome Metrics:** 565 total passing tests (+25 new tests in `dailyDiaryDateIntegrity.test.ts`), 0 failures, 0 skipped, 0 TypeScript errors, 0 ESLint warnings, 92.24% line coverage, 20/20 expo-doctor checks passing.
- **Technical Specifications:**
  1. **Strict Diary Date Matching & Undated Meal Recovery:**
     - `MealsScreen` strictly filters `selectedDateMeals` requiring `m.date.slice(0, 10) === activeDate`.
     - Completely eliminates `if (!m.date) return true` leak that was double-counting undated meals on every day.
     - Separates undated meals into dedicated, recoverable "Unassigned Date Meals" section with count badge and `MealCard` list.
     - Allows assigning valid calendar date via editing without inventing synthetic dates in SQLite.
     - `dailyTotals` strictly computes over `selectedDateMeals`, ensuring zero calorie inflation.
  2. **Live Local-Day Rollover (`useLiveLocalDate.ts`):**
     - Hook listens to `AppState` transitions to `'active'` to refresh `todayKey` upon resume.
     - Schedules precise timeout for next local midnight via `getMsUntilNextMidnight()` with safe 50ms buffer.
     - Automatically updates Today / Yesterday / Tomorrow labels and Today jump button.
     - Preserves user's manually selected historical date even after midnight rollover.
  3. **Selected-Date Navigation Continuity (`AppNavigator.tsx`):**
     - Lifted `selectedDiaryDate` state to `AppNavigator`.
     - Preserved across opening/saving Add Meal, opening/canceling/saving Edit Meal, and deleting meals.
     - If a meal's own date is edited, `selectedDiaryDate` automatically updates to the meal's newly assigned date.
     - Preserved across EN/AR language switches and tab navigation without resetting to today.
- **Files Affected:**
  - `src/hooks/useLiveLocalDate.ts` (new)
  - `src/screens/MealsScreen.tsx` (updated)
  - `src/navigation/AppNavigator.tsx` (updated)
  - `src/components/MealCard.tsx` (updated)
  - `src/screens/MealDetailsScreen.tsx` (updated)
  - `src/i18n/en.ts` & `src/i18n/ar.ts` (updated)
  - `src/__tests__/dailyDiaryDateIntegrity.test.ts` (new - 25 tests)
- **Success Criteria:** Zero undated meal leakage; live midnight rollover; persistent selected diary date across all flows; 565 passing tests.

---

### Task 4.4: Nutrition Analytics, Daily Targets & Macro Distribution [COMPLETED]
- **Status:** COMPLETED
- **Objective:** Synchronize logged meals with daily personalization targets, compute Atwater-based macronutrient distributions, display non-judgmental adherence metrics, and integrate real daily nutrition intake into the Progress Screen weekly trends.
- **Pre-conditions:** Task 4.3 and Task 4.3A completed and verified; 565 baseline tests passing.
- **Outcome Metrics:** 605 total passing tests (+40 new tests in `nutritionAnalyticsAndTargets.test.ts`), 0 failures, 0 skipped, 0 TypeScript errors, 0 ESLint warnings, 88.76% line coverage, 20/20 expo-doctor checks passing.
- **Technical Specifications:**
  1. **Daily Nutrition Aggregation (`getDailyNutritionSummary` in `src/utils/nutrition.ts`):**
     - Pure functional aggregation over `Meal[]` for specified calendar date (`YYYY-MM-DD`).
     - Strict date boundary isolation; excludes undated legacy meals (`date: ''`) without mutating or dropping them.
     - Preserves itemless meal totals fallback when child items are absent.
     - Counts total distinct meals and total food items logged.
     - Sanitizes non-finite or negative numbers (`NaN`, `Infinity`, `< 0`), flagging invalid numbers via `hasInvalidNutrients` while preserving stored snapshots.
  2. **Authoritative Target Integration & Adherence Engine (`calculateNutritionTargetProgress` in `src/utils/nutrition.ts`):**
     - Reuses authoritative `resolveEffectiveNutritionTargets(profile)` without redundant target logic.
     - Honors all target statuses (`ready`, `unconfirmed`, `unsupported`, `conflicting`, `invalid`, `missing`).
     - Never presents fallback targets (`SAFE_FALLBACK_TARGETS`) as confirmed goals when `hasActiveTarget === false`.
     - Computes raw ratio and visually bounded progress ratio ($[0, 1.0]$) for UI bars.
     - Computes non-judgmental adherence values: `remainingCalories`, `overTargetCalories`, `isTargetReached`, and macro progress items.
     - Handles custom overrides where individual macro targets are unconfigured (`null`).
  3. **Macronutrient Energy Distribution (`calculateMacroDistribution` in `src/utils/nutrition.ts`):**
     - Computes macro energy using Atwater factors: Protein $4\text{ kcal/g}$, Carbs $4\text{ kcal/g}$, Fats $9\text{ kcal/g}$.
     - Normalizes integer percentages to sum strictly to $100\%$ using the largest-remainder method.
     - Handles zero total macro energy safely ($0\% / 0\% / 0\%$) without division by zero.
     - Keeps logged label calories independent from macro-derived energy estimates.
  4. **Macro Distribution UI Component (`src/components/MacroDistributionBar.tsx`):**
     - Multi-segment horizontal pill bar (Protein: Purple, Carbs: Primary Green, Fats: Orange).
     - Individual macro breakdown chips with localized gram, kcal, and integer percentage badges.
     - Explanatory footnote referencing standard $4/4/9\text{ kcal/g}$ conversion.
     - Full VoiceOver/TalkBack accessibility labels and RTL/LTR layout mirroring.
  5. **Daily Nutrition Dashboard in `MealsScreen.tsx`:**
     - Replaced basic summary with comprehensive Daily Nutrition Dashboard card.
     - Hero calorie section displaying consumed vs target, calorie progress bar, and status badge (`Over target`, `Remaining`, `Target reached`).
     - Actionable profile setup banners for `unconfirmed`, `unsupported`, and `conflicting` target states.
     - Responsive macro grid (`MacroCard`s) and embedded `MacroDistributionBar`.
     - Friendly empty-day card with quick "Add Food" action when no meals are logged.
  6. **Progress Screen Live Meal Aggregation (`src/screens/ProgressScreen.tsx`):**
     - Accepts optional `meals?: Meal[]` prop, connected via `AppNavigator.tsx`.
     - Derives real daily calorie consumption for each day of the week using `getDailyNutritionSummary`.
     - Averages weekly calories strictly across logged days, displaying `-- kcal` when unlogged.
     - Renders real calorie heights and distinct unlogged placeholders in Weekly Trend chart.
     - Preserves authoritative weight and workout days unchanged from `progress` models.
- **Files Affected:**
  - `src/utils/nutrition.ts` (updated)
  - `src/components/MacroDistributionBar.tsx` (new)
  - `src/screens/MealsScreen.tsx` (updated)
  - `src/screens/ProgressScreen.tsx` (updated)
  - `src/navigation/AppNavigator.tsx` (updated)
  - `src/context/BottomNavContext.tsx` (updated)
  - `src/i18n/en.ts` & `src/i18n/ar.ts` (updated)
  - `src/__tests__/mocks/react-native.ts` (updated)
  - `src/__tests__/mocks/vector-icons.ts` (new)
  - `src/__tests__/mocks/expo-blur.ts` (new)
  - `tsconfig.test.json` (updated)
  - `src/__tests__/nutritionAnalyticsAndTargets.test.ts` (new - 40 tests)
- **Success Criteria:** Verified pure read-only analytics, target adherence calculation, 100% macro distribution normalization, Progress screen real-meal aggregation, and dual-platform UI parity. All 605 tests passing.

---

### Task 4.4A: Nutrition Trend Integrity & Coverage Hardening [COMPLETED]
- **Status:** COMPLETED
- **Objective:** Fix 7-day nutrition trend generation to bind to a pure local calendar-day series rather than progress_entries; eliminate unverified fallback to synthetic `ProgressEntry.calories`; implement Option 1 genuine largest-remainder macro distribution rounding; restore component-level test coverage (recovering from 88.76% to 92.58% line coverage); and verify midnight rollover and AppState resume.
- **Pre-conditions:** Task 4.4 completed and verified; 605 baseline tests passing.
- **Outcome Metrics:** 640 total passing tests (+35 new tests in `nutritionTrendIntegrityAndCoverage.test.ts`), 0 failures, 0 skipped, 0 TypeScript errors, 0 ESLint warnings, 92.58% line coverage, 20/20 expo-doctor checks passing.
- **Technical Specifications:**
  1. **Pure Calendar-Day Series:**
     - Implemented `getCalendarDateRange(referenceDate, 7)` in `src/utils/date.ts` handling month/year rollovers and leap years.
     - Implemented `formatShortWeekday(date, language)` generating short localized weekday labels (`Mon`, `Tue` or `الإثنين`).
  2. **Pure Trend Aggregator (`buildWeeklyNutritionChartDays` & `calculateWeeklyNutritionTrend`):**
     - Generates 7 explicit local calendar dates ending on `activeReferenceDate`.
     - Aggregates meals independently for each date without requiring matching `progress_entries`.
     - Strictly separates unlogged days (`hasLogs: false`) from days with recorded zero calories (`hasLogs: true, calories: 0`).
     - Averages intake strictly across logged days only (`-- kcal` if no days logged).
  3. **Eradication of Synthetic Calorie Fallbacks:**
     - Removed unsafe fallback to `ProgressEntry.calories`. When `meals === undefined`, shows explicit unavailable state (`-- kcal`, "Meal data unavailable" note).
     - Authoritative workout days and weight metrics preserved from original `progress_entries` without synthesizing fake rows.
  4. **Option 1 Largest-Remainder Macro Distribution Rounding:**
     - Replaced proportional adjustment with the genuine Hamilton-Hare largest-remainder method in `calculateMacroDistribution`.
     - Floors raw percentages, distributes remaining points by fractional remainders descending, with deterministic tie-breaking (Protein, Carbs, Fats).
     - Non-negative integer percentages strictly sum to 100% for positive macro energy (0/0/0 for zero macro energy).
  5. **Dynamic Rollover & Lifecycle Refresh:**
     - Integrated `useLiveLocalDate` in `ProgressScreen` for automated local midnight rollover and AppState foreground resume.
  6. **Meaningful Rendered Component Tests & Coverage Recovery:**
     - Added React Native component tests executing `ProgressScreen`, `MealsScreen`, and `MacroDistributionBar` across all states (empty, unavailable, logged zero, unconfirmed targets, RTL Arabic, dark/light themes).
     - Coverage recovered from 88.76% to 92.58% (`MealsScreen`: 89.00%, `ProgressScreen`: 98.79%, `nutrition.ts`: 94.82%).
- **Files Affected:**
  - `src/utils/date.ts` (updated)
  - `src/utils/nutrition.ts` (updated)
  - `src/screens/ProgressScreen.tsx` (updated)
  - `src/navigation/AppNavigator.tsx` (updated)
  - `src/i18n/en.ts` & `src/i18n/ar.ts` (updated)
  - `src/__tests__/mocks/react-native.ts` (updated)
  - `src/__tests__/nutritionTrendIntegrityAndCoverage.test.ts` (new - 35 tests)
- **Success Criteria:** Independent 7-day calendar series; zero synthetic calorie fallback; Hamilton-Hare macro rounding; 640 passing tests with 92.58% line coverage.

---

### Task 4.5: Meal Templates, Favorites & Quick-Log [COMPLETED]
- **Status:** COMPLETED
- **Objective:** Allow users to save favorite meals as templates, repeat past meals with 1 tap, and quickly log standalone calories.
- **Pre-conditions:** Task 4.4 and Task 4.4A completed and verified; 640 baseline tests passing.
- **Outcome Metrics:** 650 total passing tests (+10 new tests in `mealTemplatesFavoritesAndQuickLog.test.ts`), 0 failures, 0 skipped, 92.21% overall line coverage, 0 TypeScript errors, 0 ESLint warnings, 20/20 expo-doctor checks passing.
- **Technical Specifications:**
  1. **Meal Templates & Favorites:**
     - Mark meal as favorite or template (`isFavorite`, `isTemplate` on `Meal` model).
     - Persist favorite status cleanly in SQLite through `mealRepository.ts` note encoding/decoding without destructive schema migration.
     - "Repeat Meal" / "Log Again" action in `MealDetailsScreen` via `createRepeatedMealDraft` copying items with fresh IDs into today's log without mutating source meal.
     - Star badge and indicator on `MealCard` and `MealDetailsScreen`.
     - Filter tabs in `MealsScreen` ("All Meals" vs "Favorites") for instant access to favorite templates.
  2. **Quick-Add Calorie Entry:**
     - `QuickAddMealModal.tsx` for logging calories and optional macros directly without child item breakdown.
     - Strict numeric input validation via `parseStrictNutrientInput` rejecting NaN, Infinity, negative values, and non-numerics.
     - Seamless integration into `calculateDailyNutrition`, `getDailyNutritionSummary`, and `calculateMacroDistribution`.
     - "Quick Add" action button in `MealsScreen` header.
- **Files Affected:**
  - `src/models/meal.ts`
  - `src/db/repositories/mealRepository.ts`
  - `src/utils/nutrition.ts`
  - `src/components/MealCard.tsx`
  - `src/components/QuickAddMealModal.tsx` (new)
  - `src/screens/MealDetailsScreen.tsx`
  - `src/screens/MealsScreen.tsx`
  - `src/navigation/AppNavigator.tsx`
  - `src/i18n/en.ts` & `src/i18n/ar.ts`
  - `src/__tests__/mealTemplatesFavoritesAndQuickLog.test.ts` (new)
- **Automated Test Requirements:**
  - Repeat meal flow creating fresh IDs and persisting correctly without mutating source meal.
  - Quick-add itemless meal calculation and daily summary aggregation.
  - Component static rendering in English and Arabic.
- **Success Criteria:** 1-tap meal repetition with ID isolation; quick calorie logging without breaking macro analytics; full bilingual parity.

---

### Task 4.5A: Template Integrity, Unknown Macros & Quick-Log Hardening [COMPLETED]
- **Status:** COMPLETED
- **Objective:** Separate meal templates from consumed meals into dedicated SQLite tables; remove `[favorite]` tags from notes; introduce explicit unknown macronutrient semantics; harden quick-add error recovery; provide safe repeat-meal workflows.
- **Pre-conditions:** Task 4.5 completed and verified; 650 baseline tests passing.
- **Outcome Metrics:** 662 total passing tests (+12 new tests in `templateIntegrityAndQuickLogHardening.test.ts`), 0 failures, 0 skipped, 91.56% overall line coverage, 0 TypeScript errors, 0 ESLint warnings, 20/20 expo-doctor checks passing.
- **Technical Specifications:**
  1. **Independent Persistent Meal Templates (Migration 10):**
     - Separate tables: `meal_templates` and `meal_template_items` with foreign keys and cascade delete.
     - Full CRUD via `SQLiteMealTemplateRepository`: `createTemplate`, `getTemplateById`, `getAllTemplates`, `updateTemplate`, `deleteTemplate`, `toggleTemplateFavorite`.
     - Templates exist completely independent of consumed meals (do not contribute to consumed calories, deleting meal does not delete template, and vice versa).
     - Support converting itemless quick-add meals to templates while preserving nutrient totals.
  2. **Safe Favorite Management & Clean Notes:**
     - Structural `is_favorite` column added to `meals` via Migration 10.
     - Legacy `[favorite]` notes migrated non-destructively to `is_favorite = 1`, preserving note text.
     - Granular `toggleMealFavorite(id, isFavorite)` executes single `UPDATE meals SET is_favorite = ?` without rewriting child meal items.
     - Literal user notes containing `[favorite]` are preserved without truncation or synthetic prefixing.
  3. **Unknown Macronutrient & Completeness Semantics:**
     - `NutritionCompleteness` type: `'complete' | 'partial' | 'calories_only' | 'indeterminate'`.
     - Explicit known flags: `proteinKnown`, `carbsKnown`, `fatKnown`.
     - Distinguishes entered numeric 0 (confirmed zero) from omitted/unknown macros.
     - `getDailyNutritionSummary`, target progress, and `calculateMacroDistribution` flag `hasUnknownMacros` and `isPartial` without assuming 0g.
  4. **Safe Repeat-Meal Workflows:**
     - `createRepeatedMealDraft` generates fresh IDs, defaults to `isFavorite: false` and `isTemplate: false`, strips legacy `[favorite]` note prefix, and preserves unknown macro flags.
  5. **Quick-Add Error Recovery:**
     - `QuickAddMealModal` marks omitted macros as unknown and explicit 0 as known.
     - SQLite save failures caught with localized banner, preserving draft inputs and preventing double-submit.
- **Files Affected:**
  - `src/db/migrations.ts` (Migration 10)
  - `src/db/types.ts`
  - `src/db/repositories/mealRepository.ts`
  - `src/models/meal.ts`
  - `src/models/mealTemplate.ts` (new)
  - `src/db/repositories/mealTemplateRepository.ts` (new)
  - `src/services/mealService.ts`
  - `src/services/mealTemplateService.ts` (new)
  - `src/utils/nutrition.ts`
  - `src/components/QuickAddMealModal.tsx`
  - `src/screens/MealDetailsScreen.tsx`
  - `src/screens/MealsScreen.tsx`
  - `src/store/AppContext.tsx`
  - `src/navigation/AppNavigator.tsx`
  - `src/i18n/en.ts` & `src/i18n/ar.ts`
  - `src/__tests__/templateIntegrityAndQuickLogHardening.test.ts` (new)
- **Success Criteria:** Independent template lifecycle; uncorrupted notes; explicit unknown macro semantics; 662 passing tests.

---

### Task 4.5B: Template Nutrient Fidelity & Legacy Favorites [COMPLETED]
- **Status:** COMPLETED
- **Objective:** Eliminate synthetic food items for itemless calorie-only templates, maintain explicit unknown macronutrient semantics and completeness across template creation and logging, and repair false favorites caused by Migration 10 substring matching on user prose.
- **Pre-conditions:** Task 4.5A completed and verified; 662 baseline tests passing.
- **Outcome Metrics:** 671 total passing tests (+9 new tests in `templateNutrientFidelityAndLegacyFavorites.test.ts`), 0 failures, 0 skipped, 91.48% overall line coverage, 0 TypeScript errors, 0 ESLint warnings, 20/20 expo-doctor checks passing.
- **Technical Specifications:**
  1. **Template Nutrient Fidelity & Itemless Structure:**
     - `MealTemplate` domain model and SQLite table extended with nutrient totals and completeness flags: `totalCalories`, `totalProtein`, `totalCarbs`, `totalFat`, `totalFats`, `nutritionCompleteness`, `proteinKnown`, `carbsKnown`, `fatKnown`.
     - `createTemplateFromMeal` maintains explicit `items: []` for itemless meals without fabricating synthetic food items.
     - `createMealFromTemplate` logs itemless meals preserving `items: []`, original nutrient totals, and completeness flags without inventing confirmed zeros.
     - `getMealTemplateTotals` returns stored totals directly when `template.items.length === 0`.
  2. **Migration 11 (`add_meal_template_nutrient_fidelity_and_favorite_repair_v11`):**
     - Forward-only version 11 migration adds missing nutrient totals and completeness columns to `meal_templates`.
     - Backfills totals for existing templates from child `meal_template_items`.
     - Repairs legacy favorite misclassifications where `notes LIKE '%[favorite]%'` set `is_favorite = 1` for user prose in the middle or end of notes, resetting them to `is_favorite = 0` while strictly preserving legitimate prefix markers (`[favorite]` at start of notes) and direct user favorites.
  3. **Repository & Decoding Hardening:**
     - `SQLiteMealTemplateRepository` saves, updates, and restores new nutrient and completeness columns.
     - `decodeMealNotes` and `encodeMealNotes` use anchored regex (`/^\[favorite\](?:\s|$)/i`) preventing corruption of user prose containing `[favorite]`.
- **Files Affected:**
  - `src/db/migrations.ts` (Migration 11)
  - `src/models/mealTemplate.ts`
  - `src/models/meal.ts`
  - `src/db/repositories/mealTemplateRepository.ts`
  - `src/db/repositories/mealRepository.ts`
  - `src/__tests__/templateNutrientFidelityAndLegacyFavorites.test.ts` (new)
- **Success Criteria:** Zero synthetic food items for itemless templates; preserved unknown macro semantics; repaired legacy favorites; 671 passing tests.

---

### Task 4.6: Cross-Platform UI/UX, A11y & Arabic Parity Hardening [COMPLETED]
- **Status:** COMPLETED
- **Objective:** Audit and harden all nutrition screens for Apple HIG, Android Material 3, accessibility, and RTL layout symmetry; resolve legacy favorite provenance and V10 template repair via Migration 12.
- **Pre-conditions:** Task 4.5B completed and verified (671 tests).
- **Outcome Metrics:** 683 passing automated tests (+12 substantive regression tests in `crossPlatformA11yAndArabicParity.test.ts`), 91.56% line coverage, 0 TypeScript errors, 0 ESLint warnings, 20/20 Expo Doctor checks.
- **Technical Specifications:**
  1. **Migration 12 (`add_provenance_and_repair_legacy_templates_v12`):**
     - Added `favorite_source` column to `meals` (`legacy_marker`, `ambiguous`, `explicit`, `none`).
     - Backfilled provenance safely without repeated reclassification.
     - Repaired V10 legacy synthetic templates with positive calories and 0g macros to `nutrition_completeness = 'indeterminate'` with unknown macros (`protein_known = 0`, `carbs_known = 0`, `fat_known = 0`).
  2. **Touch Target Sizing:**
     - Enforced $\ge 48\text{dp}$ on Android and $\ge 44\text{pt}$ on iOS across date nav arrows, filter chips, template delete buttons, food item reorder/delete steppers, modal close buttons, and category chips.
  3. **Touch Feedback:**
     - Android: `android_ripple` feedback on date navigation arrows, template delete buttons, and filter chips.
     - iOS: Smooth opacity feedback (`activeOpacity={0.7}`) without dual-firing.
  4. **Accessibility (VoiceOver & TalkBack):**
     - Screen reader announcements and labels on navigation arrows, filter chips, delete buttons, and macro cards.
     - MacroCard renders `—` (dash) without false unit claiming for unknown macros.
  5. **Bidirectional Symmetry (RTL / LTR):**
     - Icon mirroring: `chevron-back` / `chevron-forward` and modal back arrows flip directions dynamically in RTL mode.
     - Preserved Latin numerals (`ar-SA-u-nu-latn`) in date formatting and measurement values.
- **Files Affected:**
  - `src/db/migrations.ts` (Migration 12)
  - `src/db/repositories/mealRepository.ts`
  - `src/models/meal.ts`
  - `src/models/mealTemplate.ts`
  - `src/screens/MealsScreen.tsx`
  - `src/screens/AddMealScreen.tsx`
  - `src/screens/EditMealScreen.tsx`
  - `src/screens/MealDetailsScreen.tsx`
  - `src/components/MacroCard.tsx`
  - `src/components/FoodPickerModal.tsx`
  - `src/components/ManualFoodModal.tsx`
  - `src/components/QuickAddMealModal.tsx`
  - `src/__tests__/crossPlatformA11yAndArabicParity.test.ts`
- **Success Criteria:** 100% visual symmetry in Arabic and English; verified minimum touch targets; clean test suite pass at 683 tests.

---

### Task 4.6A: Legacy Template Migration Safety & Acceptance Hardening [COMPLETED]
- **Status:** COMPLETED
- **Objective:** Eliminate Migration 12 over-generalization defect, implement forward-only Migration 13 restoring confirmed zero macros for templates with genuine child food items while preserving honest uncertainty on indeterminate itemless records, protect favorite provenance and macro completeness across meal edits, and establish interactive component acceptance evidence.
- **Pre-conditions:** Task 4.6 completed and verified (683 tests).
- **Outcome Metrics:** 708 passing automated tests (+25 substantive tests in `legacyTemplateMigrationSafetyAndAcceptance.test.ts`), 90.86% overall line coverage, 0 TypeScript errors, 0 ESLint warnings, 20/20 Expo Doctor checks.
- **Technical Specifications:**
  1. **Forward-Only Migration 13 (`harden_template_nutrient_fidelity_and_favorite_provenance_v13`):**
     - Migrations 1–12 left completely untouched and immutable.
     - Checks templates with `total_calories > 0 AND total_protein = 0 AND total_carbs = 0 AND total_fat = 0`: if genuine child item evidence exists (`catalog_id IS NOT NULL`, `portion_unit IS NOT NULL`, unit not generic serving, non-template item name, or multiple items), restores `nutrition_completeness = 'complete'`, `protein_known = 1`, `carbs_known = 1`, `fat_known = 1`.
     - Preserves `indeterminate` with unknown macros for itemless templates or single items matching synthetic footprints without concrete evidence.
     - Ensures all meals have valid non-null `favorite_source` (`DEFAULT 'none'`) and index `idx_meals_favorite_source`.
  2. **Domain Models & Repositories Resilience:**
     - `normalizeMealTemplate`: defaults `nutrition_completeness` to `complete` when items exist; only falls back to `indeterminate` for itemless positive-calorie/0g-macro records.
     - `mealRepository.updateMeal`: preserves existing `is_favorite`, `favorite_source`, `nutrition_completeness`, and macro known flags from SQLite if omitted from the update payload.
     - `EditMealScreen`: explicitly retains `isFavorite`, `favoriteSource`, `nutritionCompleteness`, and macro known flags in the updated meal payload.
     - `AddMealScreen`: explicitly initializes clean defaults (`isFavorite: false`, `favoriteSource: 'none'`).
  3. **Regression & Upgrade Matrix (20 Database State Tests):**
     - Verified upgrades across V9->V13, V10->V13, V11->V13, V12->V13, and fresh V0->V13.
     - Validated synthetic vs genuine single-food zero-macro templates, itemless templates, known zeros, partial macros, restart persistence, and transactional rollback.
  4. **Interactive Component Acceptance (5 Interactive Tests):**
     - Component callback execution, modal dismissals, accessible validation messages, and touch target compliance verified across `MealsScreen`, `FoodPickerModal`, `ManualFoodModal`, `QuickAddMealModal`, and `MacroCard`.
- **Files Affected:**
  - `src/db/migrations.ts` (Migration 13 added)
  - `src/models/mealTemplate.ts`
  - `src/db/repositories/mealRepository.ts`
  - `src/screens/EditMealScreen.tsx`
  - `src/screens/AddMealScreen.tsx`
  - `src/__tests__/legacyTemplateMigrationSafetyAndAcceptance.test.ts` (new)
  - 9 existing migration test files updated with Migration 13 assertions
- **Success Criteria:** Zero false certainty; confirmed zeros faithfully restored where evidence exists; uncorrupted favorite provenance on edit; 708 tests passing.

---

### Task 4.7: Final Acceptance, Full Regression & Merge Readiness Audit [COMPLETED]
- **Status:** COMPLETED
- **Objective:** Perform comprehensive final acceptance of the complete Phase 4 Nutrition System, eliminate false macro completeness on positive-calorie templates via forward-only Migration 14, verify all 28 canonical end-to-end user journeys, and establish verified merge readiness.
- **Pre-conditions:** Tasks 4.1 through 4.6A completed and verified (708 baseline tests passing).
- **Outcome Metrics:** 736 total passing automated tests (+28 substantive regression and E2E acceptance tests in `finalAcceptanceAndFullRegression.test.ts`), 90.94% overall line coverage, 0 TypeScript errors, 0 ESLint warnings, 20/20 Expo Doctor checks passing.
- **Technical Specifications:**
  1. **Forward-Only Migration 14 (`reconcile_template_unknown_macros_and_preserve_uncertainty_v14`):**
     - Migrations 1–13 preserved completely immutable.
     - Reconciles positive-calorie templates with 0g across all macros to `nutrition_completeness = 'indeterminate'` with unknown macros (`protein_known = 0`, `carbs_known = 0`, `fat_known = 0`), preserving honest uncertainty where nutrients were unmeasured.
     - Preserves genuine 0-calorie items (e.g. spring water: 0 kcal, 0g macros) as complete and known zero.
  2. **Domain Models Hardening:**
     - `normalizeMealTemplate` and `normalizeMeal` safely enforce `indeterminate` uncertainty on positive-calorie records with 0g macros when explicit completeness is not provided.
  3. **Comprehensive Regression & E2E Acceptance Matrix (28 Automated Journeys):**
     - Journeys 1–18: Full migration upgrade matrix (V0 through V13 up to V14) across clean and populated states, proving zero data loss for legacy workouts, active sessions, user profiles, weight records, and historical meals.
     - Journeys 19–28: Complete functional and UI/UX journeys covering offline food catalog search, portion scaling, multi-food meal logging, quick-add calorie entry, template repetition with UUID isolation, undated legacy meal recovery, Atwater 4/4/9 macro distribution, logged-days-only averages, food data provenance, cross-platform touch targets, and universal theme contrast.
  4. **Quality Gates Verification:**
     - `npm run typecheck` $\rightarrow$ 0 errors.
     - `npm run lint` $\rightarrow$ 0 warnings.
     - `npm test` $\rightarrow$ 736/736 passed (100%).
     - `npm run test:coverage` $\rightarrow$ 90.94% line coverage.
     - `npx expo-doctor` $\rightarrow$ 20/20 checks passed.
- **Files Affected:**
  - `src/db/migrations.ts` (Migration 14 added)
  - `src/models/mealTemplate.ts`
  - `src/models/meal.ts`
  - `src/__tests__/finalAcceptanceAndFullRegression.test.ts` (new - 28 tests)
  - 11 existing migration test files updated with Migration 14 assertions
- **Success Criteria:** Zero false certainty; full migration backward compatibility from V0 to V14; 736 passing automated tests; all quality gates verified.

---

### Task 4.7A: Final Migration Fidelity & Acceptance Corrections [COMPLETED]
- **Status:** COMPLETED
- **Objective:** Correct Migration 14's blanket heuristic rule using forward-only Migration 15 (`add_meal_template_review_status_and_reconcile_ambiguity_v15`), introduce transparent review status and user reconfirmation pathway for ambiguous templates, add mandatory regression test suite covering Cases A through J, and align acceptance documentation with verified physical test constraints, exact contrast measurements, and database query realities.
- **Pre-conditions:** Task 4.7 completed and verified (736 baseline tests).
- **Outcome Metrics:** 749 total passing automated tests (+13 new tests in `templateMigrationFidelityAndAmbiguityReconciliation.test.ts`), 90.79% overall line coverage, 0 TypeScript errors, 0 ESLint warnings, 20/20 Expo Doctor checks passing.
- **Technical Specifications:**
  1. **Forward-Only Migration 15 (`add_meal_template_review_status_and_reconcile_ambiguity_v15`):**
     - Migrations 1–14 preserved strictly immutable and forward-only.
     - Added `review_status TEXT NOT NULL DEFAULT 'confirmed'` column and index `idx_meal_templates_review_status` to `meal_templates`.
     - Flags positive-calorie zero-macro indeterminate templates affected by Migration 14 as `review_status = 'ambiguous'`, declaring historical uncertainty honestly rather than fabricating data.
  2. **Domain Models & Repositories Resilience:**
     - `MealTemplate`: added `reviewStatus?: 'confirmed' | 'ambiguous'`, updated `normalizeMealTemplate` and `createTemplateFromMeal`.
     - `mealTemplateRepository`: updated `getTemplateById` and `getAllTemplates` to map `review_status`; updated `createTemplate` and `updateTemplate` to insert/update `review_status`; implemented `reconfirmTemplate(id, completeness, macros)` to allow user-driven resolution of ambiguous states.
     - `mealTemplateService`: added `reconfirmMealTemplate(id, completeness, macros)` service wrapper.
  3. **UI Transparency & Localization:**
     - `MealsScreen`: added warning badge (`⚠️ Review Macros`) for templates with `reviewStatus === 'ambiguous'`.
     - `en.ts` and `ar.ts`: added `ambiguousNotice` and `reconfirmMacros` translation keys.
  4. **Mandatory Regression Matrix (Cases A through J):**
     - 13 comprehensive tests in `src/__tests__/templateMigrationFidelityAndAmbiguityReconciliation.test.ts` covering Cases A through J, idempotency, transaction rollback, and repository lifecycle.
  5. **Documentation & Acceptance Alignment:**
     - Transparently acknowledged Linux host testing limitations: physical Android/iOS devices and simulators reported honestly as NOT TESTED.
     - Documented exact calculated WCAG contrast ratios across Light and Dark themes.
     - Accurately documented `getAllMeals()` single-query performance reality with in-memory calendar date filtering.
- **Files Affected:**
  - `src/db/migrations.ts` (Migration 15 added)
  - `src/models/mealTemplate.ts`
  - `src/db/repositories/mealTemplateRepository.ts`
  - `src/db/types.ts`
  - `src/services/mealTemplateService.ts`
  - `src/screens/MealsScreen.tsx`
  - `src/i18n/en.ts` & `src/i18n/ar.ts`
  - `src/__tests__/templateMigrationFidelityAndAmbiguityReconciliation.test.ts` (new - 13 tests)
  - 12 existing test suites updated with Migration 15 assertions
- **Success Criteria:** Historical ambiguity transparently flagged without data destruction; full forward-only Migration 15 compatibility; 749 passing automated tests; all quality gates verified.
