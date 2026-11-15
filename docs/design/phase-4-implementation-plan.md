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
[ Task 4.4: Nutrition Analytics, Daily Targets & Macro Distribution ] ──► (NEXT)
       │
       ▼
[ Task 4.5: Meal Templates, Favorites & Quick-Log ]
       │
       ▼
[ Task 4.6: Cross-Platform UI/UX, A11y & Arabic Parity Hardening ]
       │
       ▼
[ Task 4.7: Final Acceptance, Regression & Merge Readiness ]
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

### Task 4.4: Nutrition Analytics, Daily Targets & Macro Distribution
- **Objective:** Synchronize logged meals with daily targets, calculate macronutrient percentage distributions, and update historical progress entries.
- **Pre-conditions:** Task 4.3 completed and verified.
- **Technical Specifications:**
  1. **Macro Distribution & Analytics Engine (`src/utils/nutritionAnalytics.ts`):**
     - Compute calorie percentages from macros:
       $$\%P = \frac{\text{Protein} \times 4}{\text{Total kcal}} \times 100, \quad \%C = \frac{\text{Carbs} \times 4}{\text{Total kcal}} \times 100, \quad \%F = \frac{\text{Fats} \times 9}{\text{Total kcal}} \times 100$$
     - Calorie balance comparison vs effective target from `resolveEffectiveNutritionTargets`.
     - Surplus/deficit calculation with safe weekly weight change estimates.
  2. **Progress Synchronization:**
     - Automatically update or aggregate `progress_entries` in SQLite when meals are saved or deleted.
     - Connect `ProgressScreen` weekly chart to actual logged nutrition history.
  3. **Visual Macro Breakdown Card (`MacroDistributionCard.tsx`):**
     - Render visual macro split bar (Protein/Carbs/Fats) on `MealDetailsScreen` and `MealsScreen`.
- **Files Affected:**
  - `src/utils/nutritionAnalytics.ts` (new)
  - `src/components/MacroDistributionCard.tsx` (new)
  - `src/screens/ProgressScreen.tsx`
  - `src/screens/HomeScreen.tsx`
  - `src/services/progressService.ts`
- **Automated Test Requirements:**
  - Macro percentage calculation tests (handling 0 total calories without division by zero).
  - Target remaining / over-target calculation tests.
  - Progress entry synchronization tests.
- **Success Criteria:** Accurate macro distribution charts; real meal data reflected in ProgressScreen.

---

### Task 4.5: Meal Templates, Favorites & Quick-Log
- **Objective:** Allow users to save favorite meals as templates, repeat past meals with 1 tap, and quickly log standalone calories.
- **Pre-conditions:** Task 4.4 completed and verified.
- **Technical Specifications:**
  1. **Meal Templates & Favorites:**
     - Mark meal as favorite or template.
     - "Repeat Meal" / "Log Again" action in `MealDetailsScreen` copying items with fresh IDs into today's log.
  2. **Quick-Add Calorie Entry:**
     - Quick-add modal for logging calories without item breakdown (preserving `totalCalories` in itemless meal).
     - Ensure `calculateDailyNutrition` correctly handles itemless meals.
- **Files Affected:**
  - `src/screens/MealDetailsScreen.tsx`
  - `src/components/QuickAddMealModal.tsx` (new)
  - `src/utils/nutrition.ts`
- **Automated Test Requirements:**
  - Repeat meal flow creating fresh IDs and persisting correctly.
  - Quick-add itemless meal calculation verification.
- **Success Criteria:** 1-tap meal repetition; quick calorie logging without breaking macro analytics.

---

### Task 4.6: Cross-Platform UI/UX, A11y & Arabic Parity Hardening
- **Objective:** Audit and harden all nutrition screens for Apple HIG, Android Material 3, accessibility, and RTL layout symmetry.
- **Pre-conditions:** Task 4.5 completed and verified.
- **Technical Specifications:**
  1. **Touch Target Sizing:**
     - Ensure all buttons, picker rows, and icons meet $\ge 48\text{dp}$ on Android and $\ge 44\text{pt}$ on iOS.
  2. **Touch Feedback:**
     - Android: `android_ripple` on cards, food rows, and buttons.
     - iOS: Smooth opacity feedback (`activeOpacity={0.7}`).
  3. **Accessibility (VoiceOver & TalkBack):**
     - Screen reader announcements for macro distributions and targets.
     - Accessible labels on quantity steppers and food removal buttons.
  4. **Bidirectional Symmetry (RTL / LTR):**
     - Verify Arabic food names, category pills, and table alignments.
     - Keep numbers in Latin numerals (`ar-SA-u-nu-latn`).
- **Files Affected:**
  - All screens and components created in Tasks 4.1–4.5.
- **Automated Test Requirements:**
  - RTL style and writing direction regression tests.
  - Accessibility label tests for nutrition UI.
- **Success Criteria:** 100% visual symmetry in Arabic and English; flawless physical device touch interaction.

---

### Task 4.7: Final Acceptance, Regression & Merge Readiness
- **Objective:** Run complete end-to-end regression across all phases (Phase 1 through Phase 4), execute physical device acceptance, and prepare merge to `main`.
- **Pre-conditions:** Tasks 4.1 through 4.6 completed and verified.
- **Technical Specifications:**
  1. **Dead Code Cleanup:**
     - Remove or archive orphaned files in `src/screens/meals/`.
  2. **Full Migration Upgrade Matrix:**
     - Test database upgrades from V0, V1, V2, V3, V4, V5, V6, V7, V8 to V9.
     - Verify zero data loss for legacy workouts, sessions, profile, and meals.
  3. **Quality Gates Verification:**
     - `npm run typecheck` $\rightarrow$ 0 errors.
     - `npm run lint` $\rightarrow$ 0 warnings.
     - `npm test` $\rightarrow$ 100% passing tests (target: $\ge 430$ tests).
     - `npx expo-doctor` $\rightarrow$ 20/20 checks passed.
  4. **Documentation & Roadmap Update:**
     - Update `docs/design/qooti-roadmap.md` marking Phase 4 complete.
- **Success Criteria:** Clean CI pipeline, zero regressions, merge approval.
