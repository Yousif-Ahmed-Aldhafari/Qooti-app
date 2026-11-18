# Phase 4 Acceptance Matrix: Nutrition & Meal Planning

- **Document Version:** 1.0.0
- **Status:** Approved Quality Assurance Matrix
- **Date:** November 2026
- **Base Commit:** `7ba790621517cafde2847bdd69001b151e1a46ab`
- **Target Branch:** `dev/phase-4-nutrition`
- **Baseline Test Suite:** **388 Passing Tests (0 Failures, 0 Skipped)**

---

## 1. Automated Test Suite Milestones & Growth Targets

| Milestone / Task | Focus Area | Minimum Test Target | Key Test Criteria |
|---|---|---|---|
| **Baseline (Task 4.0)** | Pre-Flight Environment | **388** | 100% Phase 1–3 test preservation, zero TypeScript errors, zero lint warnings. |
| **Task 4.1** | Meal Lifecycle, Granular Persistence & Editing | **402** (+14) | **423 Passed (+35)** — Granular SQLite CRUD without `saveAllMeals`, domain validation, local date bounds, atomic delete cascade. |
| **Task 4.1A** | Meal Input Validation & Transaction Ownership Hardening | **423** | **445 Passed (+22)** — Strict nutrient/quantity parsing, comma/period decimals, reject NaN/Infinity/1e50, leap-year validation, atomic transaction ownership contract without nested calls. |
| **Task 4.2** | Bilingual Food Catalog & Portion Scaling | **455** (+10) | **480 Passed (+35)** — 158 verified bilingual catalog entries, pure mass-basis portion scaling, custom foods persistence, Arabic search normalization, Migration 9 schema safety. |
| **Task 4.2A** | Food Data Provenance & Portion Scaling Safety | **480** | **500 Passed (+20)** — 158-item provenance audit (143 verified, 6 estimated, 9 unverified, 0 mismatch), scaling bounds/overflow protection, monotonic `createId('meal-item')`. |
| **Task 4.3** | Multi-Food Meal Creation & Search UX | **510** (+10) | **540 Passed (+40)** — Multi-food drafts, food search picker with portion selector, manual food entries, day-by-day navigation, slot categorization, legacy meal compatibility. |
| **Task 4.3A** | Daily Diary Date Integrity & Navigation Hardening | **540** | **565 Passed (+25)** — Undated legacy meal isolation, zero daily totals inflation, live local midnight rollover, AppState resume listener, persistent selected date across Add/Edit/Delete, tabs, and language switches. |
| **Task 4.4** | Nutrition Analytics & Daily Targets | **575** (+10) | **605 Passed (+40)** — Pure aggregator `getDailyNutritionSummary`, target progress engine with fallback handling, Atwater 4/4/9 macro distribution with 100% integer normalization, `MacroDistributionBar` component, `MealsScreen` dashboard card, and `ProgressScreen` real meal aggregation. |
| **Task 4.4A** | Nutrition Trend Integrity & Coverage Hardening | **615** (+10) | **640 Passed (+35)** — Independent 7-day calendar series, zero synthetic fallback to `ProgressEntry.calories`, genuine Hamilton-Hare largest-remainder rounding, rendered component regression coverage (92.58% line coverage). |
| **Task 4.5** | Meal Templates, Favorites & Quick-Log | **650** (+10) | **650 Passed (+10)** — Repeat meal ID isolation (`createId('meal')` and `createId('meal-item')`), favorite SQLite persistence via note encoding, quick calorie logging (`QuickAddMealModal`) with strict parsing, itemless daily summary aggregation, rendered component coverage in EN & AR. |
| **Task 4.5A** | Template Integrity, Unknown Macros & Quick-Log Hardening | **662** (+12) | **662 Passed (+12)** — Independent `meal_templates` and `meal_template_items` SQLite tables (Migration 10), clean note preservation without synthetic markers, explicit unknown macro semantics (`NutritionCompleteness`, `proteinKnown`, `carbsKnown`, `fatKnown`), safe repeat-meal workflows, quick-add error recovery with draft retention. |
| **Task 4.5B** | Template Nutrient Fidelity & Legacy Favorites | **671** (+9) | **671 Passed (+9)** — Itemless templates retain explicit itemless structure (`items: []`) with direct nutrient totals, full completeness and macro known flag preservation across template save and log, forward Migration 11 adding totals columns to `meal_templates` with item backfill, and repair of false favorites from Migration 10 user-prose substring matches. |
| **Task 4.6** | Cross-Platform UX, A11y & RTL Parity | **683** (+12) | **683 Passed (+12)** — Migration 12 (`favorite_source` provenance & V10 template repair), touch target bounds ($\ge 48\text{dp}$ Android, $\ge 44\text{pt}$ iOS), `android_ripple` vs opacity, TalkBack/VoiceOver labels, bidirectional RTL symmetry, and Latin numeral preservation (`ar-SA-u-nu-latn`). |
| **Task 4.6A** | Legacy Template Migration Safety & Acceptance Hardening | **708** (+25) | **708 Passed (+25)** — Forward Migration 13 restoring confirmed zero macros with child item evidence, favorite source preservation on meal edit, 20 database upgrade matrix tests, 5 interactive component tests. |
| **Task 4.7** | Final Acceptance, Full Regression & Merge Readiness | **708+** | **736 Passed (+28)** — Forward Migration 14 reconciling positive-calorie templates to honest uncertainty, full 18-step migration matrix (V0 to V14 clean and populated), 10 end-to-end user journeys (Journeys 19–28), 90.94% line coverage, 20/20 Expo Doctor checks. |
| **Task 4.7A** | Final Migration Fidelity & Acceptance Corrections | **736+** | **749 Passed (+13)** — Forward-only Migration 15 adding template `review_status = 'ambiguous'` for reconciled records, user reconfirmation pathway, honest reporting of physical test environment (NOT TESTED on Linux host), exact measured contrast ratios, 90.79% line coverage, 20/20 Expo Doctor. |
| **Task 4.7 Closeout** | Template Macro Review Flow & Final Acceptance Closeout | **749+** | **759 Passed (+10)** — Localized user-facing template review and reconfirmation modal (`ReviewTemplateModal`), `MealsScreen` review action for ambiguous templates, atomic reconfirmation with nutrient overrides and unknown macro flags, form state preservation on SQLite failure, 91.11% line coverage, 20/20 Expo Doctor. |
| **Task 4.7 Final Fix** | Template Nutrient Integrity, Multi-Item Protection & Strict Parsing | **759+** | **764 Passed (+5)** — Atomic reconfirmation of itemless and single-item templates, explicit per-item corrections for multi-item templates, rejection of unsupported aggregate edits without item breakdown (preventing silent discards), strict nutrient parser validation (`parseStrictNutrientInput`), form state preservation on error, 90.59% line coverage, 20/20 Expo Doctor. |
| **Task 4.7 Data Preservation Fix** | Nutrient Preservation Under Unknown Status & Hardening | **764+** | **773 Passed (+9)** — Non-zero nutrient measurements preserved without coercing to 0 when marked unrecorded; independent known/unknown flags; aggregate totals derived consistently; itemless and multi-item reconfirmation preservation; 90.84% line coverage, 20/20 Expo Doctor. |

---

## 2. Technical Acceptance Criteria by Capability

### 2.1 Persistence & Data Integrity Acceptance Criteria
- [x] **AC-PER-01:** `saveAllMeals` whole-table wipe pattern is completely removed from the meal creation, editing, and deletion call paths.
- [x] **AC-PER-02:** Creating a new meal invokes `insertMealService` with an atomic SQLite transaction, ensuring child items are inserted alongside the parent meal.
- [x] **AC-PER-03:** Updating an existing meal invokes `updateMealService` atomically, updating parent meal attributes and synchronizing child food items in a single transaction.
- [x] **AC-PER-04:** Deleting a meal invokes `deleteMealService` with an atomic transaction, cascading deletion to all child `meal_items` and leaving no orphaned rows.
- [x] **AC-PER-05:** Meal and food item identifiers use `createId` with monotonic counter and UUID entropy, rejecting naive timestamp IDs (`Date.now()`).
- [x] **AC-PER-06:** Meal creation and persistence in `AppNavigator` is asynchronous, awaiting confirmation before navigating away from the edit/create form.
- [x] **AC-PER-07:** Any SQLite database write failure preserves the user's draft in UI state and displays a retryable error banner.
- [x] **AC-PER-08:** `SQLiteMealRepository` honors caller transactions (`txn`) directly and only opens exclusive transactions when `txn` is absent, preventing dangerous nested transaction calls.

### 2.2 Date & Time Integrity Acceptance Criteria
- [x] **AC-DAT-01:** Meals logged across midnight boundaries (e.g., 00:01 to 02:59 in UTC+3) use the local calendar date (`YYYY-MM-DD`), never shifting to the prior UTC day.
- [x] **AC-DAT-02:** Meal timestamps are stored in standardized 24-hr `HH:mm` format, enabling accurate chronological sorting.
- [x] **AC-DAT-03:** `MealsScreen` date navigation displays meals matching the selected calendar date without timezone distortion.
- [x] **AC-DAT-04:** Meal dates strictly validate exact `YYYY-MM-DD` without trailing spaces, timestamps, or invalid leap days (e.g. rejecting 2026-02-29, accepting 2024-02-29). Standardized 24-hr `HH:mm` on save while supporting legacy read formats.

### 2.3 Food Catalog & Calculation Acceptance Criteria
- [x] **AC-CAT-01:** Bilingual food catalog contains $\ge 150$ verified foods (158 implemented) with accurate 100g base profiles (calories, protein, carbs, fats).
- [x] **AC-CAT-02:** Catalog foods offer standard serving sizes (e.g. piece, cup, scoop, tbsp) with accurate gram conversion multipliers.
- [x] **AC-CAT-03:** Scaling food quantity proportionally updates calories and macros in real-time.
- [x] **AC-CAT-04:** Domain validation strictly rejects negative calories, negative quantities, `NaN`, and `Infinity`.
- [x] **AC-CAT-05:** Total meal calories equal the sum of child food item calories ($\pm 1\text{ kcal}$ due to integer rounding).
- [x] **AC-CAT-06:** Strict UI nutrient input parsing distinguishes entered 0 from empty inputs, supports comma/period decimal separators, rejects scientific notation (`1e50`), bounds inputs ($\le 100,000$), and preserves raw user input with localized inline errors.
- [x] **AC-CAT-07:** All 158 food catalog entries have documented provenance status (`VERIFIED`, `ESTIMATED`, `UNVERIFIED`, `MISMATCH`) with verified sources linked to authoritative public databases (USDA FoodData Central / SFDA SFCT) and synthetic codes transparently classified.
- [x] **AC-CAT-08:** Portion scaling functions enforce `SCALING_LIMITS` preventing floating-point overflow, reject non-finite inputs (`NaN`, `Infinity`), and meal snapshots use monotonic `createId('meal-item')`.

### 2.4 User Experience & Workflow Acceptance Criteria
- [x] **AC-UI-01:** Users can add multiple food items to a single meal draft before saving.
- [x] **AC-UI-02:** Users can reorder or remove individual food items from a meal draft.
- [x] **AC-UI-03:** Users can edit any previously logged meal via `EditMealScreen`.
- [x] **AC-UI-04:** Users can delete any previously logged meal with a two-step confirmation dialog.
- [x] **AC-UI-05:** Meals screen supports day-by-day navigation with today, yesterday, and calendar selector.
- [x] **AC-UI-06:** Empty state displays friendly illustrations and quick-add actions when no meals are logged for a selected date.

### 2.5 Nutrition Analytics & Target Acceptance Criteria
- [x] **AC-ANL-01:** `getDailyNutritionSummary` aggregates only meals matching the exact `YYYY-MM-DD` date and strictly excludes undated meals (`date: ''`) without mutating or dropping them.
- [x] **AC-ANL-02:** When meal child items are absent, `getDailyNutritionSummary` cleanly falls back to meal-level total calories and macros.
- [x] **AC-ANL-03:** Non-finite or negative nutritional values (`NaN`, `Infinity`, `< 0`) are sanitized to zero for summaries, flagged via `hasInvalidNutrients`, and leave persisted SQLite rows untouched.
- [x] **AC-ANL-04:** `calculateNutritionTargetProgress` reuses authoritative `resolveEffectiveNutritionTargets(profile)` without creating redundant calculation logic, correctly honoring all target statuses (`ready`, `unconfirmed`, `unsupported`, `conflicting`, `invalid`, `missing`).
- [x] **AC-ANL-05:** When `hasActiveTarget === false`, `SAFE_FALLBACK_TARGETS` are never presented as approved user goals, and UI setup banners guide the user to complete profile setup.
- [x] **AC-ANL-06:** `calculateMacroDistribution` derives macro energy via Atwater factors ($4\text{ kcal/g}$ protein, $4\text{ kcal/g}$ carbs, $9\text{ kcal/g}$ fats) and guarantees integer percentages sum strictly to $100\%$ via largest-remainder normalization (or $0\%$ when no macros are logged).
- [x] **AC-ANL-07:** Label calories logged by the user remain completely independent from macro-derived energy estimates.
- [x] **AC-ANL-08:** `ProgressScreen` accepts live meals from `AppContext` and computes real daily calories and weekly averages strictly over logged days (`-- kcal` when unlogged), while maintaining authoritative weight and workout metrics from `progress`.

### 2.6 Nutrition Trend & Calendar Series Acceptance Criteria
- [x] **AC-TRD-01:** 7-day trend generates an explicit local calendar range ending on the live reference date via `getCalendarDateRange`, regardless of whether `progress_entries` exists.
- [x] **AC-TRD-02:** Meal-logging days appear in the weekly trend even if no matching `progress_entry` exists.
- [x] **AC-TRD-03:** Unverified synthetic calories from `ProgressEntry.calories` are never used as meal intake; when `meals === undefined`, an explicit unavailable state is rendered.
- [x] **AC-TRD-04:** Unlogged days (`hasLogs: false`) are strictly distinguished from days with recorded zero-calorie meals (`hasLogs: true, calories: 0`), and averages are computed across logged days only.
- [x] **AC-TRD-05:** Macro distribution uses genuine largest-remainder rounding with deterministic tie-breaking, ensuring exact 100% integer sum for positive macro energy.
- [x] **AC-TRD-06:** Dynamic local midnight rollover and AppState foreground resume refresh the 7-day window without layout distortion.

### 2.7 Meal Templates, Favorites & Quick-Log Acceptance Criteria
- [x] **AC-TPL-01:** `createRepeatedMealDraft` generates brand-new meal ID and new item IDs (`createId('meal')` and `createId('meal-item')`), preventing primary key collisions and child item cross-linking.
- [x] **AC-TPL-02:** Repeating a meal leaves the source meal completely unmutated (strict immutability).
- [x] **AC-TPL-03:** Child item macronutrients, quantities, units, and catalog provenance are preserved 100% on repeated meals.
- [x] **AC-TPL-04:** Marking/unmarking a meal as favorite persists across database reloads via SQLite note encoding without destructive schema migrations.
- [x] **AC-TPL-05:** `QuickAddMealModal` strictly validates user numeric inputs using `parseStrictNutrientInput`, rejecting non-finite, negative, and malformed inputs with localized inline errors.
- [x] **AC-TPL-06:** Itemless meals created via Quick Add aggregate accurately into `getDailyNutritionSummary`, target progress, and macro distribution.

### 2.8 Template Integrity, Unknown Macros & Quick-Log Hardening (Task 4.5A) Acceptance Criteria
- [x] **AC-TPL-07:** Migration 10 adds independent `meal_templates` and `meal_template_items` tables with indices and foreign keys, and structural `is_favorite`, `nutrition_completeness`, `protein_known`, `carbs_known`, `fat_known` columns to `meals`.
- [x] **AC-TPL-08:** `SQLiteMealTemplateRepository` provides independent CRUD operations for templates; deleting a template never deletes meals, and deleting a meal never deletes templates.
- [x] **AC-TPL-09:** Granular `toggleMealFavorite` updates favorite status atomically in SQLite without modifying or reinserting child meal items.
- [x] **AC-TPL-10:** User notes containing literal `[favorite]` text are preserved without truncation, and new writes never prepend synthetic favorite markers.
- [x] **AC-TPL-11:** Explicit unknown macronutrient semantics distinguish confirmed 0g from omitted macros across daily summaries, target progress, and macro distributions.
- [x] **AC-TPL-12:** Quick-Add error recovery displays a localized error banner upon SQLite failure, preserves user draft input without clearing, and prevents duplicate submissions.
- [x] **AC-TPL-13:** Repeated meal draft defaults to `isFavorite: false` and `isTemplate: false`, preserving unknown macro completeness flags.

### 2.9 Template Nutrient Fidelity & Legacy Favorites (Task 4.5B) Acceptance Criteria
- [x] **AC-TPL-14:** `MealTemplate` domain model and `meal_templates` table store direct nutrient totals (`totalCalories`, `totalProtein`, `totalCarbs`, `totalFat`) and completeness flags (`nutritionCompleteness`, `proteinKnown`, `carbsKnown`, `fatKnown`).
- [x] **AC-TPL-15:** Itemless calorie-only or partial meals saved as templates produce explicit itemless templates (`items: []`) without fabricating synthetic food items.
- [x] **AC-TPL-16:** Logging from a template (`createMealFromTemplate`) preserves itemless structure and exact completeness and macro known/unknown flags, never inventing confirmed zero macros.
- [x] **AC-TPL-17:** Migration 11 (`add_meal_template_nutrient_fidelity_and_favorite_repair_v11`) safely adds nutrient totals to `meal_templates`, backfills existing template totals from items, and repairs false favorites resulting from Migration 10 user-prose substring matches while preserving legitimate prefix markers and user favorites.

### 2.10 Legacy Template Migration Safety & Acceptance Hardening (Task 4.6A) Acceptance Criteria
- [x] **AC-TPL-18:** Forward-only Migration 13 (`harden_template_nutrient_fidelity_and_favorite_provenance_v13`) restores confirmed zero macros (`complete`, `protein_known = 1`, `carbs_known = 1`, `fat_known = 1`) for templates with verifiable child food items (catalog identity, portion units, non-serving units, distinct food names, or multiple items) without altering Migrations 1–12.
- [x] **AC-TPL-19:** Honest uncertainty is strictly preserved for templates lacking child item evidence or matching synthetic footprints; they remain `indeterminate` with unknown macros without fabricating false certainty.
- [x] **AC-TPL-20:** Updating meal details in `EditMealScreen` and `mealRepository.updateMeal` strictly preserves existing `is_favorite`, `favorite_source`, `nutrition_completeness`, and macro known flags from SQLite if omitted from the update payload.
- [x] **AC-TPL-21:** Full regression and upgrade matrix (20 database state tests) verifies clean forward upgrades across V9->V13, V10->V13, V11->V13, V12->V13, and fresh V0->V13 with transactional rollback on failure and idempotence.
- [x] **AC-TPL-22:** Interactive component tests verify touch targets ($\ge 48\text{dp}$ Android, $\ge 44\text{pt}$ iOS), callback firing, modal state preservation, accessible error presentation, and RTL back arrow symmetry across `MealsScreen`, `FoodPickerModal`, `ManualFoodModal`, `QuickAddMealModal`, and `MacroCard`.

### 2.11 Final Acceptance, Full Regression & Merge Readiness (Task 4.7) Acceptance Criteria
- [x] **AC-FIN-01:** Forward-only Migration 14 (`reconcile_template_unknown_macros_and_preserve_uncertainty_v14`) safely reconciles templates with `total_calories > 0 AND total_protein = 0 AND total_carbs = 0 AND total_fat = 0` to `nutrition_completeness = 'indeterminate'`, `protein_known = 0`, `carbs_known = 0`, `fat_known = 0`, leaving Migrations 1–13 immutable.
- [x] **AC-FIN-02:** Genuine zero-calorie beverages and items (e.g. spring water: 0 kcal, 0g P, 0g C, 0g F) retain `nutrition_completeness = 'complete'` and confirmed zero macros without false uncertainty.
- [x] **AC-FIN-03:** Comprehensive 18-step migration upgrade matrix validates upgrades across V0, V1, V2, V3, V4, V5, V6, V7, V8, V9, V10, V11, V12, and V13 up to V14 in both clean and populated states, proving zero data loss for workouts, active sessions, profile personalization, and meals.
- [x] **AC-FIN-04:** 10 end-to-end user journeys (Journeys 19–28 in `finalAcceptanceAndFullRegression.test.ts`) verify catalog search, portion scaling, multi-food logging, quick calorie add, template repeat with UUID isolation, undated legacy meal recovery, Atwater 4/4/9 macro distribution, logged-days averages, food data provenance, accessibility touch targets, and universal theme contrast.
- [x] **AC-FIN-05:** Quality gates fully satisfied with 736 passing automated tests, 90.94% line coverage, 0 TypeScript errors, 0 ESLint warnings, and 20/20 Expo Doctor checks passed.

### 2.12 Final Migration Fidelity & Acceptance Corrections (Task 4.7A) Acceptance Criteria
- [x] **AC-FIN-06:** Forward-only Migration 15 (`add_meal_template_review_status_and_reconcile_ambiguity_v15`) safely adds `review_status TEXT NOT NULL DEFAULT 'confirmed'` column and index `idx_meal_templates_review_status` to `meal_templates`, flagging positive-calorie zero-macro records as `review_status = 'ambiguous'`.
- [x] **AC-FIN-07:** `SQLiteMealTemplateRepository` and `mealTemplateService` provide `reconfirmTemplate` and `reconfirmMealTemplate` allowing user-driven reconfirmation of ambiguous templates without heuristic guesswork.
- [x] **AC-FIN-08:** `MealsScreen` surfaces bilingual ambiguous template review notices (`⚠️ Review Macros` / `⚠️ مراجعة الماكروز`).
- [x] **AC-FIN-09:** Comprehensive regression suite covers Cases A through J, repeat migration idempotency, transaction rollback, and full repository lifecycle (749 passing automated tests, 90.79% coverage).
- [x] **AC-FIN-10:** Acceptance documentation transparently reports physical platform limitations (physical devices/simulators NOT TESTED on Linux host), exact calculated contrast ratios, and `getAllMeals` single-query performance reality with in-memory calendar filtering.

---

## 3. Platform Verification & Testing Environment Acceptance Matrix

> [!NOTE]
> **Environment Verification Scope:**
> Testing in this repository is executed on a **Linux CI/developer host** (`x86_64-linux`).
> - **Level 1 (Static Analysis):** TypeScript (`tsc --noEmit`), ESLint (`eslint --max-warnings=0`), and Expo Doctor (`npx expo-doctor`) are **100% verified** and passing.
> - **Level 2 (Mocked Component & Hook Tests):** Automated unit, integration, and React Native component tests via Node.js test runner with in-memory SQLite and mocked UI primitives are **100% verified** (749 passing tests).
> - **Level 3 & 4 (Physical Device & Simulator Testing):** Physical Android devices, Android emulators, iOS simulators, and physical iPhones are **NOT TESTED** in this local Linux environment due to platform constraints (no attached Android hardware via `adb devices`, no running Android emulator, and iOS tooling requiring macOS/Xcode). Verification in the table below reflects Level 1 and Level 2 automated verification.

| Test ID | Test Scenario | Automated Component & SQLite Verification (Linux Host) | Physical / Simulator Status (Hardware Dependent) | Acceptance Status |
|---|---|---|---|---|
| **PHY-NUT-01** | **Multi-Food Meal Creation:** Add meal with 3 foods (chicken, rice, olive oil) from catalog. | Verified in `multiFoodMealAndDayNavigation.test.ts` (totals calculated, draft preserved, atomic insert). | Not Tested on Linux Host (Requires physical device / emulator) | Automated Level 2 Verified |
| **PHY-NUT-02** | **Portion Scaling:** Adjust chicken from 100g to 250g. | Verified in `foodCatalogAndPortionScaling.test.ts` (scaling limits enforced, live arithmetic update). | Not Tested on Linux Host (Requires physical device / emulator) | Automated Level 2 Verified |
| **PHY-NUT-03** | **Meal Editing:** Open saved meal, change title, edit 1 food quantity, add 1 new food, save. | Verified in `multiFoodMealAndDayNavigation.test.ts` (atomic update, provenance preserved). | Not Tested on Linux Host (Requires physical device / emulator) | Automated Level 2 Verified |
| **PHY-NUT-04** | **Meal Deletion:** Tap delete in details screen, confirm alert. | Verified in `multiFoodMealAndDayNavigation.test.ts` and `mealLifecycleIntegrity.test.ts` (cascading deletion). | Not Tested on Linux Host (Requires physical device / emulator) | Automated Level 2 Verified |
| **PHY-NUT-05** | **Midnight Boundary Logging:** Set device clock to 01:15 AM (UTC+3). Log a meal. | Verified in `multiFoodMealAndDayNavigation.test.ts` (strict local calendar date `YYYY-MM-DD`). | Not Tested on Linux Host (Requires physical device / emulator) | Automated Level 2 Verified |
| **PHY-NUT-06** | **Search in Arabic:** Search for "دجاج" (chicken) in Arabic mode. | Verified in `foodCatalogAndPortionScaling.test.ts` (Arabic text normalization, Latin digits). | Not Tested on Linux Host (Requires physical device / emulator) | Automated Level 2 Verified |
| **PHY-NUT-07** | **Touch Target Clearance:** Tap food delete icon and quantity steppers. | Verified in `crossPlatformA11yAndArabicParity.test.ts` ($\ge 48\text{dp}$ Android, $\ge 44\text{pt}$ iOS styles). | Not Tested on Linux Host (Requires physical device / emulator) | Automated Level 2 Verified |
| **PHY-NUT-08** | **App Kill & Relaunch:** Log 2 meals, kill app from recents, relaunch. | Verified in `finalAcceptanceAndFullRegression.test.ts` (SQLite hydration across reopen). | Not Tested on Linux Host (Requires physical device / emulator) | Automated Level 2 Verified |

---

## 4. Migration & Backward Compatibility Acceptance

| From Version | To Version | Target Verification | Safety Contract |
|---|---|---|---|
| **V1** | **V9** | Clean upgrade adding `custom_foods`, `catalog_id`, `meal_type`, and `notes`. | All V1 meals and meal items preserved intact. |
| **V4** | **V9** | Preserves workout catalog IDs alongside new meal catalog IDs. | No column collision; clean schema coexistence. |
| **V8** | **V9** | Direct forward upgrade from latest Phase 3 schema. | Zero disruption to workout sessions, sets, profile, or settings. |
| **V9** | **V10** | Adds independent `meal_templates` and `meal_template_items` tables, plus structured favorite and unknown macro columns to `meals`. | Preserves all existing meals, migrates `[favorite]` in notes to `is_favorite = 1`, and safely flags legacy 0-macro meals as indeterminate. |
| **V10** | **V11** | Adds nutrient totals and completeness columns to `meal_templates`, backfills template totals, and repairs falsely favorited meals. | Preserves all existing meals and templates, backfills totals, and accurately clears false favorites from prose substring matches while keeping legitimate prefix favorites. |
| **V11** | **V12** | Adds `favorite_source` column to `meals`, backfills favorite provenance without reclassification, and repairs V10 legacy synthetic templates with positive calories and 0g macros to indeterminate with unknown macros. | Preserves all existing meals and templates, tracks provenance without destructive data loss, and repairs false 0g macros to indeterminate without guessing. |
| **V12** | **V13** | Restores confirmed zero macros on templates with verifiable child food item evidence, ensures valid non-null `favorite_source` and indices across all meals, and preserves indeterminate status for uncertain itemless templates. | Forward-only upgrade leaving Migrations 1–12 immutable; zero data loss; preserves honest uncertainty without fabricating false nutritional certainty. |
| **V13** | **V14** | Safely reconciles positive-calorie templates with 0g across all macros to indeterminate with unknown macros, eliminating false completeness where macros were unmeasured. Preserves genuine 0-calorie items as complete. | Forward-only upgrade leaving Migrations 1–13 immutable; strictly honors Atwater thermodynamic constraints; zero data loss for workouts, profiles, and historical meals. |
| **V14** | **V15** | Adds `review_status` column and index to `meal_templates`. Flags positive-calorie zero-macro indeterminate templates as `review_status = 'ambiguous'`, providing a user-driven reconfirmation pathway without heuristic guesswork. | Forward-only upgrade leaving Migrations 1–14 immutable; transparently acknowledges unrecoverable metadata loss as historical ambiguity; zero data loss. |
