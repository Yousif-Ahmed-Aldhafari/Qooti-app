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
[ Task 4.0: Nutrition Architecture Audit & Blueprint ] ────────► (CURRENT AUDIT - COMPLETE)
       │
       ▼
[ Task 4.1: Meal Lifecycle Integrity, Granular Persistence & Editing ]
       │
       ▼
[ Task 4.2: Bilingual Food Catalog & Portion Scaling Engine ]
       │
       ▼
[ Task 4.3: Multi-Food Meal Creation, Search UX & Day Navigation ]
       │
       ▼
[ Task 4.4: Nutrition Analytics, Daily Targets & Macro Distribution ]
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

### Task 4.1: Meal Lifecycle Integrity, Granular Persistence & Editing
- **Objective:** Fix P0 and P1 persistence defects; introduce granular async repository methods in `AppContext`; implement `EditMealScreen` and safe meal deletion.
- **Pre-conditions:** Task 4.0 audit complete; 388 baseline tests passing.
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

### Task 4.2: Bilingual Food Catalog & Portion Scaling Engine
- **Objective:** Build built-in bilingual food database (~150+ foods), custom foods database schema, and automatic portion scaling calculations.
- **Pre-conditions:** Task 4.1 completed and verified.
- **Technical Specifications:**
  1. **Bilingual Food Catalog (`src/data/foodCatalog.ts`):**
     - ~150 foods with `id` (slug), `nameEn`, `nameAr`, `category`, base 100g nutritional profile (calories, protein, carbs, fats).
     - Standard serving units: `servingUnitEn`, `servingUnitAr`, `servingWeightGrams` (e.g. 1 egg = 50g, 1 piece = 60g, 1 tbsp = 15g, 1 cup = 240g).
     - Middle Eastern staple foods: dates, labneh, lentils, ful mudammas, tahini, hummus, pita bread, grilled lamb, kabsa chicken.
  2. **Portion Scaling Engine (`src/utils/foodScaling.ts`):**
     - Scaled macros formula:
       $$\text{Nutrient} = \text{round}\left(\frac{\text{BaseNutrient}_{100\text{g}} \times \text{Quantity} \times \text{UnitMultiplier}}{100}\right)$$
     - Dynamic reciprocal scaling: updating calories or grams recalculates the corresponding portion.
  3. **SQLite Migration 9 (`add_custom_foods_and_meal_enhancements_v9`):**
     - Create `custom_foods` table (`id`, `name`, `calories`, `protein`, `carbs`, `fats`, `serving_size`, `serving_unit`, `created_at`).
     - Add `catalog_id` and `portion_unit` to `meal_items`.
     - Add `meal_type` ('breakfast' | 'lunch' | 'dinner' | 'snack') and `notes` to `meals`.
- **Files Affected:**
  - `src/data/foodCatalog.ts` (new)
  - `src/utils/foodScaling.ts` (new)
  - `src/db/schema.ts`
  - `src/db/migrations.ts`
  - `src/db/repositories/foodCatalogRepository.ts` (new)
  - `src/models/food.ts` (new)
- **Automated Test Requirements:**
  - Catalog search tests in English and Arabic.
  - Portion scaling precision tests (rounding, fractional servings).
  - Migration 9 upgrade and backward compatibility tests with legacy databases (V1–V8).
- **Success Criteria:** Clean catalog resolution for 150+ items; bidirectional scaling accuracy; zero migration errors.

---

### Task 4.3: Multi-Food Meal Creation, Search UX & Day Navigation
- **Objective:** Redesign meal creation/editing flow to support multiple foods; add food search picker modal; implement day-by-day navigation in `MealsScreen`.
- **Pre-conditions:** Task 4.2 completed and verified.
- **Technical Specifications:**
  1. **Multi-Food Meal Form (`AddMealScreen`, `EditMealScreen`):**
     - Dynamic food items list with add, remove, and reorder controls.
     - Live updating meal totals card (calories, protein, carbs, fats) reflecting all draft items.
  2. **Food Picker Modal (`FoodPickerModal.tsx`):**
     - Search input with debounced bilingual matching (`nameEn` and `nameAr`).
     - Category filter pills (Proteins, Carbs, Fats, Dairy, Produce, Regional).
     - Portion selector allowing quantity input with unit toggle (Grams vs Standard Servings).
     - "Custom Food" quick-entry option.
  3. **Meals Screen Day Navigation:**
     - Date switcher bar: Today, Yesterday, or custom date picker.
     - Grouping meals by slot: Breakfast, Lunch, Dinner, Snack.
     - Daily target comparison banner updated for the currently viewed date.
- **Files Affected:**
  - `src/screens/AddMealScreen.tsx`
  - `src/screens/EditMealScreen.tsx`
  - `src/screens/MealsScreen.tsx`
  - `src/components/FoodPickerModal.tsx` (new)
  - `src/components/FoodItemRow.tsx` (enhanced)
  - `src/components/MealSlotSection.tsx` (new)
- **Automated Test Requirements:**
  - Multi-item meal serialization and SQLite persistence roundtrip.
  - Food search filtering and category selection tests.
  - Date switcher navigation and day-filtered query tests.
- **Success Criteria:** Ability to create a meal with 5+ items; instant bilingual search; clean date navigation.

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
