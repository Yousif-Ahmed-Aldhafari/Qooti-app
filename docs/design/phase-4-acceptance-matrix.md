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
| **Task 4.1** | Meal Lifecycle, Granular Persistence & Editing | **402** (+14) | Granular SQLite CRUD without `saveAllMeals`, domain validation, local date bounds, atomic delete cascade. |
| **Task 4.2** | Bilingual Food Catalog & Portion Scaling | **414** (+12) | Catalog lookups in EN/AR, portion multipliers, reciprocal scaling, Migration 9 schema safety. |
| **Task 4.3** | Multi-Food Meal Creation & Search UX | **424** (+10) | Multi-item meal serialization, search filtering, category pills, date switcher queries. |
| **Task 4.4** | Nutrition Analytics & Daily Targets | **434** (+10) | Macro distribution formulas ($4/4/9$), surplus/deficit calculations, progress entry synchronization. |
| **Task 4.5** | Meal Templates, Favorites & Quick-Log | **442** (+8) | Repeat meal ID isolation, favorite toggling, quick calorie logging without item breakdown. |
| **Task 4.6** | Cross-Platform UX, A11y & RTL Parity | **450** (+8) | Touch target bounds, screen reader accessibility labels, RTL layout symmetry. |
| **Task 4.7** | Final Acceptance & Merge Readiness | **450+** | Full 11-step migration upgrade matrix (V0 through V9), cross-platform regression suite. |

---

## 2. Technical Acceptance Criteria by Capability

### 2.1 Persistence & Data Integrity Acceptance Criteria
- [ ] **AC-PER-01:** `saveAllMeals` whole-table wipe pattern is completely removed from the meal creation, editing, and deletion call paths.
- [ ] **AC-PER-02:** Creating a new meal invokes `insertMealService` with an atomic SQLite transaction, ensuring child items are inserted alongside the parent meal.
- [ ] **AC-PER-03:** Updating an existing meal invokes `updateMealService` atomically, updating parent meal attributes and synchronizing child food items in a single transaction.
- [ ] **AC-PER-04:** Deleting a meal invokes `deleteMealService` with an atomic transaction, cascading deletion to all child `meal_items` and leaving no orphaned rows.
- [ ] **AC-PER-05:** Meal and food item identifiers use `createId` with monotonic counter and UUID entropy, rejecting naive timestamp IDs (`Date.now()`).
- [ ] **AC-PER-06:** Meal creation and persistence in `AppNavigator` is asynchronous, awaiting confirmation before navigating away from the edit/create form.
- [ ] **AC-PER-07:** Any SQLite database write failure preserves the user's draft in UI state and displays a retryable error banner.

### 2.2 Date & Time Integrity Acceptance Criteria
- [ ] **AC-DAT-01:** Meals logged across midnight boundaries (e.g., 00:01 to 02:59 in UTC+3) use the local calendar date (`YYYY-MM-DD`), never shifting to the prior UTC day.
- [ ] **AC-DAT-02:** Meal timestamps are stored in standardized 24-hr `HH:mm` format, enabling accurate chronological sorting.
- [ ] **AC-DAT-03:** `MealsScreen` date navigation displays meals matching the selected calendar date without timezone distortion.

### 2.3 Food Catalog & Calculation Acceptance Criteria
- [ ] **AC-CAT-01:** Bilingual food catalog contains $\ge 150$ verified foods with accurate 100g base profiles (calories, protein, carbs, fats).
- [ ] **AC-CAT-02:** Catalog foods offer standard serving sizes (e.g. piece, cup, scoop, tbsp) with accurate gram conversion multipliers.
- [ ] **AC-CAT-03:** Scaling food quantity proportionally updates calories and macros in real-time.
- [ ] **AC-CAT-04:** Domain validation strictly rejects negative calories, negative quantities, `NaN`, and `Infinity`.
- [ ] **AC-CAT-05:** Total meal calories equal the sum of child food item calories ($\pm 1\text{ kcal}$ due to integer rounding).

### 2.4 User Experience & Workflow Acceptance Criteria
- [ ] **AC-UI-01:** Users can add multiple food items to a single meal draft before saving.
- [ ] **AC-UI-02:** Users can reorder or remove individual food items from a meal draft.
- [ ] **AC-UI-03:** Users can edit any previously logged meal via `EditMealScreen`.
- [ ] **AC-UI-04:** Users can delete any previously logged meal with a two-step confirmation dialog.
- [ ] **AC-UI-05:** Meals screen supports day-by-day navigation with today, yesterday, and calendar selector.
- [ ] **AC-UI-06:** Empty state displays friendly illustrations and quick-add actions when no meals are logged for a selected date.

---

## 3. Physical Device Acceptance Matrix (Android & iOS)

| Test ID | Test Scenario | Android Physical Device (Pixel / Galaxy) | iOS Physical Device (iPhone) | Acceptance Status |
|---|---|---|---|---|
| **PHY-NUT-01** | **Multi-Food Meal Creation:** Add meal with 3 foods (chicken, rice, olive oil) from catalog. | Verify ripple touch, keyboard dismissal on tap outside, correct total calories. | Verify smooth opacity dimming, iOS interactive keyboard dismiss, correct totals. | Pending Task 4.3 |
| **PHY-NUT-02** | **Portion Scaling:** Adjust chicken from 100g to 250g. | Instant macro calculation update, keyboard stays responsive. | Instant calculation update, no layout jank or flicker. | Pending Task 4.2 |
| **PHY-NUT-03** | **Meal Editing:** Open saved meal, change title, edit 1 food quantity, add 1 new food, save. | Atomic update, returns to details screen with updated values. | Atomic update, returns to details screen with updated values. | Pending Task 4.1 |
| **PHY-NUT-04** | **Meal Deletion:** Tap delete in details screen, confirm alert. | Android Material dialog with dismiss/confirm, returns to meals list, meal removed. | iOS ActionSheet / Alert dialog, returns to meals list, meal removed. | Pending Task 4.1 |
| **PHY-NUT-05** | **Midnight Boundary Logging:** Set device clock to 01:15 AM (UTC+3). Log a meal. | Meal appears under current calendar day, NOT yesterday. | Meal appears under current calendar day, NOT yesterday. | Pending Task 4.1 |
| **PHY-NUT-06** | **Search in Arabic:** Search for "دجاج" (chicken) in Arabic mode. | Instant search results in Arabic, RTL text alignment, Latin numbers for macros. | Instant search results in Arabic, RTL text alignment, Latin numbers for macros. | Pending Task 4.3 |
| **PHY-NUT-07** | **Touch Target Clearance:** Tap food delete icon and quantity steppers. | $\ge 48\text{dp}$ touch target, no accidental adjacent taps. | $\ge 44\text{pt}$ touch target, no accidental adjacent taps. | Pending Task 4.6 |
| **PHY-NUT-08** | **App Kill & Relaunch:** Log 2 meals, kill app from recents, relaunch. | All meals immediately hydrated from SQLite, exact macros intact. | All meals immediately hydrated from SQLite, exact macros intact. | Pending Task 4.1 |

---

## 4. Migration & Backward Compatibility Acceptance

| From Version | To Version | Target Verification | Safety Contract |
|---|---|---|---|
| **V1** | **V9** | Clean upgrade adding `custom_foods`, `catalog_id`, `meal_type`, and `notes`. | All V1 meals and meal items preserved intact. |
| **V4** | **V9** | Preserves workout catalog IDs alongside new meal catalog IDs. | No column collision; clean schema coexistence. |
| **V8** | **V9** | Direct forward upgrade from latest Phase 3 schema. | Zero disruption to workout sessions, sets, profile, or settings. |
