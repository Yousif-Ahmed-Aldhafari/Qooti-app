# Qooti Cross-Platform Acceptance Test Matrix

**Status:** Permanent Reusable Quality Gate  
**Version:** 1.0.0  
**Scope:** Verification protocol for all Phase 1A and future screen/component releases  
**Standard:** Apple HIG / Material Design 3 / WCAG 2.1 AA  

---

## 1. Test Environments & Devices

| Target Category | Specification / Device | Purpose |
|---|---|---|
| **Physical Android (Primary)** | Samsung Galaxy S22 Ultra (SM_S908U1), Android 14/15, One UI 6 | Flagship large screen, curved edges, One UI quirks |
| **Compact Android** | Emulator / Physical: 360 × 640 dp (e.g. Galaxy A-series) | Smallest mainstream viewport, dense grid wrapping |
| **Android Navigation Modes** | 1. Gesture Navigation<br>2. 3-Button Navigation (Back, Home, Recents) | Inset clearance, hardware back event interception |
| **Physical iPhone (Primary)** | iPhone 14/15/16 Pro (iOS 17/18) | Dynamic Island, Home Indicator safe areas, SF Pro |
| **Compact iPhone** | iPhone SE (3rd Gen) / Mini (375 × 667 pt) | Home button safe area, small viewport layout |
| **Locales** | 1. English (en-US, LTR)<br>2. Arabic (ar-SA, RTL) | Bidirectional symmetry, Latin digit preservation |
| **Themes** | 1. Light Theme<br>2. Dark Theme<br>3. System Follow | Contrast, elevation, OLED readability |

---

## 2. Reusable Verification Protocol Matrix

### Matrix A: System Integration & Chroming

| Test ID | Test Scenario | Verification Steps | iOS Expected Result | Android Expected Result | Status |
|---|---|---|---|---|---|
| **SYS-01** | Status Bar Visibility & Contrast | Launch on Light and Dark themes | Status bar icons are dark in Light mode, light in Dark mode | Status bar is translucent/transparent, icons match theme contrast | Ready for Test |
| **SYS-02** | Home Indicator / Navigation Bar | Inspect bottom of screen across all tabs | Bottom tab bar floats above Home Indicator without clipping | Bottom tab bar clears 3-button bar (Back/Home/Recents) by >= 8dp | Ready for Test |
| **SYS-03** | Android Back Button Stack | Navigate: Home -> Meals -> Add Meal -> tap Back | N/A (Gesture / button test) | Returns to Meals screen; pressing Back again returns to Home | Implemented / Verified (Task 1A.2, 1A.4) |
| **SYS-04** | iOS Left-Edge Swipe Back | Open Meal Details -> swipe right from left screen edge | Interactive pop transition returns smoothly to Meals | N/A (Android system back gesture handles back) | Assessed for Phase 1B (native-navigation-migration-assessment.md) |
| **SYS-05** | App Backgrounding & Resume | Minimize app while on a sub-screen for 30s, then reopen | App resumes on exact screen without state reset | App resumes on exact screen without state reset | Ready for Test |

---

### Matrix B: Layout, Ergonomics & Responsive Scaling

| Test ID | Test Scenario | Verification Steps | iOS Expected Result | Android Expected Result | Status |
|---|---|---|---|---|---|
| **LAY-01** | Compact Viewport Wrapping (360dp) | Open `AddMealScreen` on 360dp width device | Macro inputs (Protein, Carbs, Fats) do not wrap awkwardly | Inputs adapt cleanly without single-item orphan lines | Ready for Test |
| **LAY-02** | Dynamic Type / Font Scaling 1.5x | Set OS Font Size to Large (+150%) | Text flows naturally without truncation in cards or headers | Text flows without overlapping or clipping inside containers | Ready for Test |
| **LAY-03** | Tablet / Large Device Width (>430dp) | Open Home dashboard on large screen/tablet | Content remains centered with balanced maximum reading width | Content remains centered with balanced maximum reading width | Ready for Test |
| **LAY-04** | Scroll Clearance with Bottom Nav | Scroll to the bottom of all 5 main tabs | Last item completely visible above floating bottom nav | Last item completely visible above floating bottom nav | Ready for Test |

---

### Matrix C: Form Interaction & Virtual Keyboard

| Test ID | Test Scenario | Verification Steps | iOS Expected Result | Android Expected Result | Status |
|---|---|---|---|---|---|
| **KEY-01** | Keyboard Occlusion on Form Entry | Tap lowest input in `AddMealScreen` (Fats) | View shifts up; input and Save button remain visible | View shifts up; input and Save button remain visible | Ready for Test |
| **KEY-02** | Tap Outside to Dismiss Keyboard | Tap on background while keyboard is open | Keyboard dismisses smoothly | Keyboard dismisses smoothly | Ready for Test |
| **KEY-03** | Input Focus Highlighting | Tap between Meal Name and Quantity fields | Active input shows clear highlighted focus border | Active input shows clear highlighted focus border | Ready for Test |
| **KEY-04** | Numeric Keyboard Keypad | Tap Calories or Duration field | Numeric/decimal keypad opens without alpha characters | Numeric/decimal keypad opens without alpha characters | Ready for Test |
| **KEY-05** | Empty Validation Handling | Tap Save with empty required fields | Inline error text highlights required fields | Inline error text highlights required fields | Ready for Test |

---

### Matrix D: Tactile Feedback & Interaction Physics

| Test ID | Test Scenario | Verification Steps | iOS Expected Result | Android Expected Result | Status |
|---|---|---|---|---|---|
| **FB-01** | Button Touch Feedback | Tap `AppButton` on Home, Meals, or Settings | Opacity dims smoothly to ~0.78 on press | Ink ripple originates from touch point within button bounds | Ready for Test |
| **FB-02** | Card Touch Feedback | Tap `MealCard` or `WorkoutCard` | Card surface dims subtly without layout flicker | Card exhibits subtle surface ripple | Ready for Test |
| **FB-03** | Minimum Touch Target Hit Area | Tap small action icons (`HomeHeader`, `PeriodSelector`) | Taps register easily on first attempt (min 44pt hit area) | Taps register easily on first attempt (min 48dp hit area) | Ready for Test |

---

### Matrix E: Bidirectional Parity (English & Arabic)

| Test ID | Test Scenario | Verification Steps | LTR (English) Expected | RTL (Arabic) Expected | Status |
|---|---|---|---|---|---|
| **RTL-01** | Bottom Tab Bar Order | Check tab order left-to-right | Home, Meals, Workouts, Progress, Profile | Profile, Progress, Workouts, Meals, Home | Ready for Test |
| **RTL-02** | In-App Language Switching | Settings -> Language -> select Arabic/English | Smooth splash transition; UI reloads in target language; SQLite settings persisted; no DevSettings.reload(); no native forceRTL restart | Smooth splash transition; UI reloads in target language; SQLite settings persisted; no DevSettings.reload(); no native forceRTL restart | Ready for Test |
| **RTL-03** | Header & Back Button Alignment | Inspect sub-screen top header | Back arrow points left; text aligns left | Back arrow points right; text aligns right | Ready for Test |
| **RTL-04** | Fitness Numbers & Dates | Inspect calorie numbers, dates, weights | Latin digits (e.g. 2,450 kcal) | Latin digits preserved (e.g. 2,450 سعرة حرارية) | Ready for Test |
| **RTL-05** | Onboarding Text Alignment | View Onboarding screen in Arabic | Text is left-aligned | Text is right-aligned | Ready for Test |

---

### Matrix F: Accessibility & Assistive Technologies

| Test ID | Test Scenario | Verification Steps | iOS (VoiceOver) Expected | Android (TalkBack) Expected | Status |
|---|---|---|---|---|---|
| **A11Y-01** | Screen Reader Navigation | Swipe through Home dashboard items | Focus ring moves sequentially; announces role & label | Focus ring moves sequentially; announces role & label | Implemented / Verified (Task 1A.5) |
| **A11Y-02** | Interactive Control Labels | Focus on icon buttons (Header action, Back, Tabs) | Announces descriptive label ("Settings", "Back", "Home") | Announces descriptive label ("Settings", "Back", "Home") | Implemented / Verified (Task 1A.3, 1A.5) |
| **A11Y-03** | Form Input Association | Focus on form inputs in `AddMealScreen` | Announces label and current text value | Announces label and current text value | Implemented / Verified (Task 1A.3, 1A.4) |
| **A11Y-04** | Color Contrast (WCAG AA) | Automated contrast ratio check across light & dark | Minimum 4.5:1 for body copy; 3:1 for large titles | Minimum 4.5:1 for body copy; 3:1 for large titles | Verified (Task 1A.1) |

---

### Matrix G: Feature Lifecycle & CRUD Capabilities (Phased Roadmap)

| Entity | Operation | Status | Target Roadmap Phase | Verified Evidence / Scope Notes |
|---|---|:---:|:---:|---|
| **Meals** | Create Meal | **PASS** | Phase 1 / 1A | Verified on Physical Android & iPhone (`AddMealScreen`) |
| **Meals** | View Meal Details | **PASS** | Phase 1 / 1A | Verified on Physical Android & iPhone (`MealDetailsScreen`) |
| **Meals** | Edit Meal | **NOT IMPLEMENTED** | **Phase 4** | Deferred to Phase 4 Nutrition Management Epic |
| **Meals** | Delete Meal | **NOT IMPLEMENTED** | **Phase 4** | Deferred to Phase 4 Nutrition Management Epic |
| **Workouts** | Create Workout | **PASS** | Phase 1 / 1A | Verified on Physical Android & iPhone (`AddWorkoutScreen`) |
| **Workouts** | View Workout Details | **PASS** | Phase 1 / 1A | Verified on Physical Android & iPhone (`WorkoutDetailsScreen`) |
| **Workouts** | Edit Workout | **NOT IMPLEMENTED** | **Phase 3** | Deferred to Phase 3 Workout Management Epic |
| **Workouts** | Delete Workout | **NOT IMPLEMENTED** | **Phase 3** | Deferred to Phase 3 Workout Management Epic |

*Status Legend:*
- **PASS:** Formally verified on physical target device.
- **FAIL:** Verified non-conformance or defect on target device.
- **NOT TESTED:** Implemented in code but awaiting physical device execution.
- **NOT IMPLEMENTED:** Intentionally deferred to designated future roadmap phase.

---

### Matrix H: Physical Device Acceptance Results (Phase 1 + 1A Integration)

Verified across:
- **Physical Android Device:** Samsung Galaxy S22 Ultra (Android 14 / One UI 6) — **13/13 Areas PASS**
- **Physical iOS Device:** iPhone 14/15 Pro (iOS 17/18 via Expo Go / Metro) — **13/13 Areas PASS**

| # | Acceptance Verification Area | Physical Android | Physical iPhone | Verified Evidence / Notes |
|:---:|---|:---:|:---:|---|
| 1 | **Splash & Hydration** | **PASS** | **PASS** | Branded logo, smooth launch transition into Home without flicker |
| 2 | **Onboarding Screen & RTL** | **PASS** | **PASS** | Right-aligned Arabic text (`cb66e25`), LTR in English, persists status |
| 3 | **Home Dashboard & Metrics** | **PASS** | **PASS** | Donut charts, date selector, quick actions, Android ink ripple, iOS opacity |
| 4 | **Bottom Navigation Clearance** | **PASS** | **PASS** | $\ge 8\text{dp}$ clearance above Android 3-button bar (`d3e4a38`), Home Indicator clean |
| 5 | **Meals Screen & List Rendering** | **PASS** | **PASS** | Dynamic card list, rich empty state when empty (`1f74200`) |
| 6 | **Add Meal Form & Validation** | **PASS** | **PASS** | Keyboard avoidance (`8868d78`), inline errors (`92eea25`), responsive macros (`6638bb6`) |
| 7 | **Workouts Screen & List** | **PASS** | **PASS** | Dynamic card list, rich empty state when empty (`1f74200`) |
| 8 | **Add Workout Form & Validation** | **PASS** | **PASS** | Keyboard avoidance (`8868d78`), inline errors (`fa323e9`), sets/reps entry |
| 9 | **Progress Screen & Charts** | **PASS** | **PASS** | Weekly trend bar chart, accessible summaries, weight cards |
| 10 | **Profile Screen & Biometrics** | **PASS** | **PASS** | Avatar initials, biometrics, macro targets, settings button |
| 11 | **Settings & Universal Themes** | **PASS** | **PASS** | Light/Dark theme switching, accessible radio options (`b0a1cbe`) |
| 12 | **In-App Language Toggle** | **PASS** | **PASS** | English $\leftrightarrow$ Arabic in-app toggle, durable SQLite save, splash transition |
| 13 | **SQLite Persistence & Restart** | **PASS** | **PASS** | Full app force-close and relaunch preserves all created meals, workouts, settings |

### Matrix I: Phase 2 Personalization & Target Integrity Device Acceptance

Verified across:
- **Physical Android Device:** Samsung Galaxy S22 Ultra (SM_S908U1), Android 15, One UI 7, dev build
- **Physical iOS Device:** iPhone 15 Pro, iOS 18.2 (Expo Go / Metro dev client)
- **Acceptance Scope Reconciliation:** 16 core cross-platform physical interaction and UI synchronization scenarios + 1 clinical boundary verification check (Item 17: Adolescent Custom Target Policy) = 17/17 verified scenarios.

| # | Phase 2 Acceptance Area | Physical Android | Physical iPhone | Verified Evidence / Scope Notes |
|:---:|---|:---:|:---:|---|
| 1 | **5-Step Onboarding Flow** | **PASS** | **PASS** | Biometrics, goal selection, activity level, diet preferences, recommendation preview |
| 2 | **Profile Attributes & Confirmation** | **PASS** | **PASS** | Edit mode allows editing and confirming physical attributes; saves atomically to SQLite |
| 3 | **Target Resolution Precedence** | **PASS** | **PASS** | Custom override takes immediate precedence when enabled; reset restores recommended |
| 4 | **Adolescent Protection (<18)** | **PASS** | **PASS** | Strict refusal of automated adult deficits; displays pediatric guidance alert |
| 5 | **Unconfirmed Profile Protection** | **PASS** | **PASS** | Unconfirmed attributes never activate fake targets; displays setup prompt banner |
| 6 | **Home Dashboard Target Sync** | **PASS** | **PASS** | Combined progress stats, daily goal banner, and goal cards synchronize with resolver |
| 7 | **Meals Screen Target Summary** | **PASS** | **PASS** | Daily nutrition summary header updates dynamically with consumed totals vs target |
| 8 | **Meal Details Macro Cards** | **PASS** | **PASS** | Shows actual meal nutrition; omits fake progress fill when targets are unconfirmed |
| 9 | **Progress Screen Goal Card** | **PASS** | **PASS** | Displays active goal with helper or `-- kcal` when unconfirmed; no invented goals |
| 10 | **Historical Intake vs Target** | **PASS** | **PASS** | Aggregates historical intake; clearly labels comparison against current active target |
| 11 | **Form Keyboard Avoidance** | **PASS** | **PASS** | Keyboard avoids numeric inputs on AddMeal, AddWorkout, and Profile edit screens |
| 12 | **Navigation Modes (3-Button/Gesture)** | **PASS** | **PASS** | Bottom tab bar floats above Android 3-button bar by >= 8dp and clears iOS Home Indicator |
| 13 | **Bilingual RTL/LTR Parity** | **PASS** | **PASS** | Arabic RTL mirroring, English LTR symmetry, Latin digits preserved (`ar-SA-u-nu-latn`) |
| 14 | **Universal Themes (Light & Dark)** | **PASS** | **PASS** | High contrast, WCAG 2.1 AA compliant text, theme tokens preserved across restarts |
| 15 | **Screen Reader (TalkBack/VoiceOver)** | **PASS** | **PASS** | MacroCard, StatCard, and ProgressCard announce values with proper role and status |
| 16 | **SQLite Persistence & Restart** | **PASS** | **PASS** | Force-close and relaunch restores confirmed attributes, custom targets, and meals |
| 17 | **Adolescent Custom Target Policy** | **PASS** | **PASS** | Stored manual values preserved for user tracking, adult algorithmic calculations withheld (`hasApprovedTarget = false`), pediatric guidance alert displayed |

#### Algorithmic Eligibility vs Clinical Disclaimer
> [!IMPORTANT]
> **Application Recommendation Eligibility vs Medical Approval:**  
> The internal boolean attribute `hasApprovedTarget` strictly designates application recommendation eligibility (i.e., an adult profile with confirmed attributes, valid biometrics, and active calculated recommendations without conflicting constraints). It does **NOT** denote clinical approval, medical certification, or healthcare endorsement.  
> 
> **Adolescent Custom Target Tracking:**  
> For adolescent profiles (<18 years):  
> 1. Stored manual custom target values remain available and displayed for user reference and tracking.  
> 2. Automated adult algorithmic deficit calculations remain strictly disabled (`hasApprovedTarget = false`).  
> 3. Pediatric clinical guidance alerts remain continuously visible in the UI.  
> 4. Manual target values entered by the user are user reference numbers, not clinical or medical prescriptions.

---

### Matrix J: Phase 3 Workout Lifecycle & Safe Editing Device Acceptance

Verified across:
- **Physical Android Device:** Samsung Galaxy S22 Ultra (SM_S908U1), Android 15, One UI 7, dev build
- **Physical iOS Device:** iPhone 15 Pro, iOS 18.2 (Expo Go / Metro dev client)

| # | Phase 3 Task 3.1 Acceptance Area | Physical Android | Physical iOS | Verified Evidence / Scope Notes |
|:---:|---|:---:|:---:|---|
| 1 | **Workout Details Edit Trigger** | **PASS** | **PASS** | "Edit" button in `WorkoutDetailsScreen` header opens `EditWorkoutScreen` |
| 2 | **Prefilled Workout Attributes** | **PASS** | **PASS** | Title, date, time, notes, and exercises prefilled accurately from SQLite record |
| 3 | **Atomic Title / Metadata Updates** | **PASS** | **PASS** | Updating title/date/time persists atomically to SQLite; updates list & details |
| 4 | **Exercise Parameter Editing** | **PASS** | **PASS** | Editing sets, reps, weight, duration, notes updates child rows in `workout_exercises` |
| 5 | **Exercise Addition & Removal** | **PASS** | **PASS** | Adding/removing exercises within session updates sort order and cascade syncs |
| 6 | **ID Stability & Deterministic Order** | **PASS** | **PASS** | Existing exercise IDs preserved; `sort_order` strictly maintained on reload |
| 7 | **Strict Numerical Validation** | **PASS** | **PASS** | Rejects empty titles, empty exercise names, negative values, and non-integers |
| 8 | **Immediate Error Clearing** | **PASS** | **PASS** | Inline error clears immediately as user types or corrects field |
| 9 | **Dirty Tracking & Unsaved Changes** | **PASS** | **PASS** | Prompts confirmation if changes are dirty on Cancel/Back; clean exit if untouched |
| 10 | **Loading & Saving State** | **PASS** | **PASS** | Save button disables and displays saving state during transaction |
| 11 | **Save Failure Feedback** | **PASS** | **PASS** | Displays explicit error banner if transaction fails without crashing or data loss |
| 12 | **Isolation of Other Workouts** | **PASS** | **PASS** | Editing workout A does not delete, mutate, or re-order workouts B or C |
| 13 | **No Global Table Wipe** | **PASS** | **PASS** | `saveAllWorkouts()` is bypassed; uses granular `updateWorkout()` atomic transaction |
| 14 | **Bilingual RTL/LTR Parity** | **PASS** | **PASS** | Arabic RTL mirroring, English LTR symmetry, Latin digits preserved (`ar-SA-u-nu-latn`) |
| 15 | **Universal Themes (Light & Dark)** | **PASS** | **PASS** | WCAG 2.1 AA contrast maintained across light and dark modes with theme tokens |
| 16 | **Keyboard Avoidance & Ergonomics** | **PASS** | **PASS** | Keyboard avoids numeric inputs; tap-to-dismiss active; ≥48dp Android / ≥44pt iOS |
| 17 | **SQLite Persistence Across Restart** | **PASS** | **PASS** | Force-close and relaunch preserves all edited workout parameters from SQLite |

---

### Matrix K: Phase 3 Task 3.2 Safe Workout Deletion & History Integrity Device Acceptance

Verified across:
- **Physical Android Device:** Samsung Galaxy S22 Ultra (SM_S908U1), Android 15, One UI 7, dev build
- **Physical iOS Device:** iPhone 15 Pro, iOS 18.2 (Expo Go / Metro dev client)

| # | Phase 3 Task 3.2 Acceptance Area | Physical Android | Physical iOS | Verified Evidence / Scope Notes |
|:---:|---|:---:|:---:|---|
| 1 | **Delete Action Trigger** | **PASS** | **PASS** | Destructive button present at bottom of `WorkoutDetailsScreen` with trash icon and min 48dp/44pt target |
| 2 | **Confirmation Dialog** | **PASS** | **PASS** | Tapping Delete displays platform native dialog naming the workout and warning that exercises will be removed |
| 3 | **Cancel Deletion** | **PASS** | **PASS** | Tapping Cancel closes dialog, leaves delete state `idle`, and preserves workout and exercises completely |
| 4 | **Confirmed Deletion Execution** | **PASS** | **PASS** | Tapping Delete confirms deletion, disables action, executes SQLite delete, and updates AppContext |
| 5 | **Safe Post-Deletion Navigation** | **PASS** | **PASS** | Navigates back to `WorkoutsScreen` and clears `selectedWorkoutId`; never renders stale deleted workout |
| 6 | **Child Cascade Cleanup** | **PASS** | **PASS** | All associated exercise records in `workout_exercises` are purged atomically |
| 7 | **Isolation of Other Data** | **PASS** | **PASS** | Unrelated workouts, user profile, daily targets, and meal logs remain 100% untouched |
| 8 | **Empty State Transition** | **PASS** | **PASS** | Deleting the last workout immediately displays the empty state on `WorkoutsScreen` without crash |
| 9 | **Dashboard & Progress Sync** | **PASS** | **PASS** | `HomeScreen` workout counter, progress ratio, and activities update cleanly without NaN or divide-by-zero |
| 10 | **Error Recovery & Retry Banner** | **PASS** | **PASS** | Simulated persistence failure displays inline retry banner; screen remains open; retry re-attempts deletion |
| 11 | **Bilingual Translation Parity** | **PASS** | **PASS** | English and Arabic confirmation strings render with full RTL/LTR symmetry and Latin numbers |
| 12 | **Universal Themes (Light & Dark)** | **PASS** | **PASS** | Danger color tokens (`#D95666` light / `#FF6B7A` dark) provide WCAG 2.1 AA compliant contrast |
| 13 | **Screen Reader Accessibility** | **PASS** | **PASS** | TalkBack and VoiceOver announce button role, label, and destructive action |
| 14 | **Edit Screen Discard UX** | **PASS** | **PASS** | `EditWorkoutScreen` prompts dedicated "Discard changes?" alert on cancel/back with "Keep Editing" / "Discard Changes" |
| 15 | **Android Hardware Back Handling** | **PASS** | **PASS** | Hardware back on dirty edit screen prompts discard confirmation; back on details returns to workouts tab |
| 16 | **SQLite Persistence Across Restart** | **PASS** | **PASS** | App relaunch confirms deleted workout is permanently removed from SQLite database |

---

### Matrix L: Phase 3 Task 3.3 Exercise Catalog & Multi-Exercise Workout Creation Device Acceptance

Verified across:
- **Physical Android Device:** Samsung Galaxy S22 Ultra (SM_S908U1), Android 15, One UI 7, dev build
- **Physical iOS Device:** iPhone 15 Pro, iOS 18.2 (Expo Go / Metro dev client)

| # | Phase 3 Task 3.3 Acceptance Area | Physical Android | Physical iOS | Verified Evidence / Scope Notes |
|:---:|---|:---:|:---:|---|
| 1 | **Catalog Modal Launch & Dismissal** | **PASS** | **PASS** | "Add from Catalog" opens `ExercisePickerModal`; close button and backdrop dismiss cleanly |
| 2 | **Dual-Axis Filtering (Muscle & Equipment)** | **PASS** | **PASS** | Horizontal chip selectors filter by 10 muscle groups and 6 equipment categories with active highlights |
| 3 | **Real-Time Bilingual Search** | **PASS** | **PASS** | Searching by English/Arabic exercise name or alias filters instantly with diacritic normalization |
| 4 | **Exercise Selection & Prepopulation** | **PASS** | **PASS** | Selecting catalog item populates exercise name, target muscles, and category into workout form |
| 5 | **Multi-Exercise Creation in Add Screen** | **PASS** | **PASS** | Users can add multiple distinct exercises (both catalog and custom) within a single session |
| 6 | **Exercise Order Sequencing (Up/Down)** | **PASS** | **PASS** | "Move Up" / "Move Down" controls dynamically reorder exercises; order persists via `sort_order` |
| 7 | **Custom Exercise Coexistence** | **PASS** | **PASS** | Bespoke exercises without catalogId coexist with catalog items in the same session without error |
| 8 | **Edit Screen Catalog Integration** | **PASS** | **PASS** | `EditWorkoutScreen` allows replacing existing exercises or adding new catalog items |
| 9 | **Legacy Free-Text Exercise Support** | **PASS** | **PASS** | Legacy workouts created prior to catalog support load without regression or missing fields |
| 10 | **Atomic Multi-Exercise Save** | **PASS** | **PASS** | Entire workout and all exercises commit atomically in `withExclusiveTransactionAsync` |
| 11 | **Task 3.2 onDismiss Guard** | **PASS** | **PASS** | Dismissing alert does not abort in-flight deletion; only resets state when in `confirming` |
| 12 | **Task 3.2 Protected Retry Confirmation** | **PASS** | **PASS** | Retrying failed deletion re-engages confirmation prompt rather than direct execution |
| 13 | **Elimination of Fabricated Duration** | **PASS** | **PASS** | Zero-duration workouts render as "0 min", never falling back to fabricated "45 min" |
| 14 | **Localized Accessibility Labels** | **PASS** | **PASS** | Deletion retry, error dismiss, and storage error labels render in active language (EN/AR) |
| 15 | **Bilingual RTL/LTR Parity** | **PASS** | **PASS** | Full visual mirroring in Arabic RTL, Latin numerals preserved (`ar-SA-u-nu-latn`), LTR in English |
| 16 | **Touch Targets & Platform Ergonomics** | **PASS** | **PASS** | All interactive elements satisfy >= 48dp on Android and >= 44pt on iOS with native press feedback |
| 17 | **Universal Themes (Light & Dark)** | **PASS** | **PASS** | Modal, chips, cards, and input fields meet WCAG 2.1 AA contrast across light and dark modes |
| 18 | **Persistence Across Application Restart** | **PASS** | **PASS** | Multi-exercise workouts persist across app termination and reload from SQLite cleanly |

---

### Matrix M: Phase 3 Task 3.3A Exercise Catalog Identity Persistence & Data Integrity Acceptance

Verified across:
- **Physical Android Device:** Samsung Galaxy S22 Ultra (SM_S908U1), Android 15, One UI 7, dev build
- **Physical iOS Device:** iPhone 15 Pro, iOS 18.2 (Expo Go / Metro dev client)

| # | Phase 3 Task 3.3A Acceptance Area | Physical Android | Physical iOS | Verified Evidence / Scope Notes |
|:---:|---|:---:|:---:|---|
| 1 | **Migration 4 Execution & Idempotence** | **PASS** | **PASS** | `add_workout_exercise_catalog_id_v4` executes cleanly without error; re-running is idempotent |
| 2 | **Legacy Row Preservation** | **PASS** | **PASS** | Existing pre-migration workout exercises retain data with `null` `catalog_id` without crash |
| 3 | **Catalog ID Insert Roundtrip** | **PASS** | **PASS** | Adding exercise from catalog writes `catalog_id` to SQLite and restores `catalogId` upon reload |
| 4 | **Catalog ID Update Roundtrip** | **PASS** | **PASS** | Editing exercise parameters or replacing with another catalog entry updates SQLite `catalog_id` |
| 5 | **Catalog ID Preservation on Reorder** | **PASS** | **PASS** | Moving exercises Up/Down retains their respective `catalog_id` mappings across SQLite reload |
| 6 | **Mixed Catalog & Custom Workouts** | **PASS** | **PASS** | Workout containing both catalog items and custom items stores and retrieves both accurately |
| 7 | **No Auto-Matching by Name** | **PASS** | **PASS** | Custom exercise named identically to catalog item retains `catalogId: undefined` (never auto-inferred) |
| 8 | **Unknown / Future Catalog ID Safety** | **PASS** | **PASS** | Exercises with arbitrary or future catalog IDs persist as-is without database or UI failure |
| 9 | **Add Screen Duplicate-Save Guard** | **PASS** | **PASS** | Rapid double-tapping Save button disables during persistence; exactly one workout created |
| 10 | **Failure Recovery & Draft Preservation** | **PASS** | **PASS** | SQLite save failure halts navigation; draft inputs remain populated for user inspection and retry |
| 11 | **Async Navigation Handshake** | **PASS** | **PASS** | `AppNavigator` awaits SQLite persistence completion before transitioning to `workoutDetails` |
| 12 | **Cold Restart Verification** | **PASS** | **PASS** | Terminating and reopening app confirms all catalog-linked workouts load with correct catalog IDs |

---

### Matrix N: Phase 3 Task 3.4 Workout History, Volume Analytics & Quick-Add Acceptance

Verified across:
- **Physical Android Device:** Samsung Galaxy S22 Ultra (SM_S908U1), Android 15, One UI 7, dev build
- **Physical iOS Device:** iPhone 15 Pro, iOS 18.2 (Expo Go / Metro dev client)

| # | Phase 3 Task 3.4 Acceptance Area | Physical Android | Physical iOS | Verified Evidence / Scope Notes |
|:---:|---|:---:|:---:|---|
| 1 | **Chronological History Ordering** | **PASS** | **PASS** | Workout list sorts newest-first across all combinations of dates and times |
| 2 | **Date Range Horizon Filtering** | **PASS** | **PASS** | `All`, `7 Days`, `30 Days`, and `90 Days` filters compute correct relative cutoff boundaries |
| 3 | **Volume Calculation Formula** | **PASS** | **PASS** | Weighted exercises calculate `sets × reps × weight` (kg load) accurately |
| 4 | **Bodyweight Movement Flagging** | **PASS** | **PASS** | Bodyweight movements render "Bodyweight" tag without fabricating load volume |
| 5 | **Duration-Only Exercise Safety** | **PASS** | **PASS** | Duration exercises contribute to session duration and do not treat minutes as reps/load |
| 6 | **Safe Numerical Fallbacks** | **PASS** | **PASS** | Missing, negative, `NaN`, or non-finite inputs neutralize safely without crash |
| 7 | **Primary Muscle Attribution** | **PASS** | **PASS** | 100% of exercise volume attributed to primary muscle group from catalog or `targetMuscles[0]` |
| 8 | **Volume Conservation Invariant** | **PASS** | **PASS** | `sum(volumeByMuscle) === totalVolumeKg` strictly verified with zero double-counting |
| 9 | **Exercise Progression Tracking** | **PASS** | **PASS** | `getExerciseHistory` traces historical performance chronologically for individual exercises |
| 10 | **Catalog Identity Matching** | **PASS** | **PASS** | Exercise history matches canonical `catalogId` regardless of user display name edits |
| 11 | **Custom Exercise Isolation** | **PASS** | **PASS** | Custom exercises match strictly by trimmed name and never collide with catalog exercises |
| 12 | **Quick-Add Brand New IDs** | **PASS** | **PASS** | "Repeat Workout" generates fresh workout ID and unique exercise IDs for the new draft |
| 13 | **Source Workout Immutability** | **PASS** | **PASS** | Source workout in SQLite and AppContext remains 100% unmutated when repeating workout |
| 14 | **Pre-Save Template Inspection** | **PASS** | **PASS** | Quick-add transitions to `AddWorkoutScreen`, allowing user to review/edit before saving |
| 15 | **Duplicate Submission Guard** | **PASS** | **PASS** | Save button disables during persistence; duplicate tap rejected without duplicate entries |
| 16 | **Save Failure Rollback** | **PASS** | **PASS** | SQLite error during quick-add rolls back transaction; draft preserved for user retry |
| 17 | **History & Analytics Bilingual Parity** | **PASS** | **PASS** | Full RTL mirroring in Arabic, Latin numerals (`ar-SA-u-nu-latn`), LTR in English |
| 18 | **Theme Contrast & Touch Targets** | **PASS** | **PASS** | Filter chips, stat cards, and buttons meet WCAG 2.1 AA and >= 48dp Android / >= 44pt iOS |

---

## 3. Execution & Reporting Guidelines

1. **Evidence Standard:** No test in this matrix may be reported as `PASS` unless verified on an actual physical device or targeted emulator.
2. **Regression Rule:** Any change to navigation, theme tokens, or localization must re-run Matrix A, Matrix D, and Matrix E before release.
3. **Artifact Retention:** Screenshots and logs of physical verification must be referenced in completion reports.
