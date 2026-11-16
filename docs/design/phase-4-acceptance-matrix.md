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
| **Task 4.6** | Cross-Platform UX, A11y & RTL Parity | **450** (+8) | Touch target bounds, screen reader accessibility labels, RTL layout symmetry. |
| **Task 4.7** | Final Acceptance & Merge Readiness | **450+** | Full 11-step migration upgrade matrix (V0 through V9), cross-platform regression suite. |

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

---

## 3. Physical Device Acceptance Matrix (Android & iOS)

| Test ID | Test Scenario | Android Physical Device (Pixel / Galaxy) | iOS Physical Device (iPhone) | Acceptance Status |
|---|---|---|---|---|
| **PHY-NUT-01** | **Multi-Food Meal Creation:** Add meal with 3 foods (chicken, rice, olive oil) from catalog. | Verify ripple touch, keyboard dismissal on tap outside, correct total calories. | Verify smooth opacity dimming, iOS interactive keyboard dismiss, correct totals. | Verified (Task 4.3) |
| **PHY-NUT-02** | **Portion Scaling:** Adjust chicken from 100g to 250g. | Instant macro calculation update, keyboard stays responsive. | Instant calculation update, no layout jank or flicker. | Verified (Task 4.2) |
| **PHY-NUT-03** | **Meal Editing:** Open saved meal, change title, edit 1 food quantity, add 1 new food, save. | Atomic update, returns to details screen with updated values. | Atomic update, returns to details screen with updated values. | Verified (Task 4.1) |
| **PHY-NUT-04** | **Meal Deletion:** Tap delete in details screen, confirm alert. | Android Material dialog with dismiss/confirm, returns to meals list, meal removed. | iOS ActionSheet / Alert dialog, returns to meals list, meal removed. | Verified (Task 4.1) |
| **PHY-NUT-05** | **Midnight Boundary Logging:** Set device clock to 01:15 AM (UTC+3). Log a meal. | Meal appears under current calendar day, NOT yesterday. | Meal appears under current calendar day, NOT yesterday. | Verified (Task 4.1) |
| **PHY-NUT-06** | **Search in Arabic:** Search for "دجاج" (chicken) in Arabic mode. | Instant search results in Arabic, RTL text alignment, Latin numbers for macros. | Instant search results in Arabic, RTL text alignment, Latin numbers for macros. | Verified (Task 4.3) |
| **PHY-NUT-07** | **Touch Target Clearance:** Tap food delete icon and quantity steppers. | $\ge 48\text{dp}$ touch target, no accidental adjacent taps. | $\ge 44\text{pt}$ touch target, no accidental adjacent taps. | Pending Task 4.6 |
| **PHY-NUT-08** | **App Kill & Relaunch:** Log 2 meals, kill app from recents, relaunch. | All meals immediately hydrated from SQLite, exact macros intact. | All meals immediately hydrated from SQLite, exact macros intact. | Verified (Task 4.1) |

---

## 4. Migration & Backward Compatibility Acceptance

| From Version | To Version | Target Verification | Safety Contract |
|---|---|---|---|
| **V1** | **V9** | Clean upgrade adding `custom_foods`, `catalog_id`, `meal_type`, and `notes`. | All V1 meals and meal items preserved intact. |
| **V4** | **V9** | Preserves workout catalog IDs alongside new meal catalog IDs. | No column collision; clean schema coexistence. |
| **V8** | **V9** | Direct forward upgrade from latest Phase 3 schema. | Zero disruption to workout sessions, sets, profile, or settings. |
