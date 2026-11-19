# Qooti Product & Engineering Roadmap

- **Version:** 2.0.0
- **Status:** Active Engineering Blueprint
- **Scope:** Architectural Roadmap & Feature Delivery Phases
- **Date:** November 2026

---

## 1. Phase Overview

```
[ Phase 1: Foundation Baseline ] ────────────────► (Complete & Merged into Main)
       │
       ▼
[ Phase 1A: Native UI/UX & A11y ] ──────────────► (Complete & Merged into Main)
       │
       ├──► [ Phase 1B: Native Stack Navigation ] (Deferred / Optional Architectural Epic)
       │
       ▼
[ Phase 2: User Profiles & Personalization ] ───► (Complete & Merged into Main)
       │
       ▼
[ Phase 3: Complete Workout System + Edit/Delete ] ──► (Complete & Merged into Main)
       │
       ▼
[ Phase 4: Nutrition & Meal Planning + Edit/Delete ] ──► (Complete & Merged into Main)
       │
       ▼
[ Phase 5: Body Tracking & Analytics ] ──► (Active Engineering Epic - In Progress)
       │
       ▼
[ Phase 6: AI Fitness Coach ] (Planned)
       │
       ▼
[ Phase 7: Advanced Integrations ] (Planned)
       │
       ▼
[ Phase 8: Production Testing & Launch ] (Planned)
```

---

## 2. Detailed Phase Breakdown

### Phase 1: Foundation — Complete
- **Core Mission:** Robust SQLite persistence architecture, repository pattern, first-launch hydration, non-destructive migrations, dual-language translation engine (EN/AR), and Expo SDK 58 upgrade.
- **Milestone Outcome:** 100% verified SQLite durability, no sample data reseeding loops, automated test suite with isolated in-memory mocks, and green GitHub Actions CI.

### Phase 1A: Cross-Platform UI/UX — Complete
- **Core Mission:** Apple HIG and Android Material Design 3 parity, measured safe-area bottom navigation clearances, form ergonomics (`KeyboardAvoidingView`, tap-to-dismiss, inline validation), responsive macro input grids (320dp–430dp), platform touch feedback (ink ripple vs smooth opacity), composite screen reader announcements, and canonical RTL symmetry.
- **Milestone Outcome:** 99 passing automated tests, 93.5%+ coverage, 13/13 physical Android & iPhone acceptance checks verified.

### Phase 1B: Native Stack Migration — Deferred/Optional
- **Core Mission:** Migrate sub-screens from state-based navigation to `@react-navigation/native-stack`.
- **Target Deliverables:**
  - Hardware-accelerated UIKit interactive edge swipe-back with native spring physics on iOS.
  - Native Android predictive back gesture animation support.
  - Symmetrical right-edge swipe-back in Arabic (RTL).
  - Dirty-state form protection guards (`beforeRemove`) to prevent accidental dismissal during entry.
  - Architectural blueprint documented in [`docs/design/native-navigation-migration-assessment.md`](file:///mnt/samsungSSD/Projects/Qooti-app/docs/design/native-navigation-migration-assessment.md).
- **Status:** Non-blocking deferred enhancement. Phase 1A state-based navigation operates smoothly and passed physical device acceptance.

### Phase 2: User Profiles & Personalization — Complete
- **Core Mission:** Complete personal profile architecture, clinically-backed caloric and macronutrient targets, fitness goals, training background, workout/equipment preferences, and dietary customization.
- **Key Deliverables:**
  - **Task 2.1 [COMPLETED]:** User Profile & Personalization Architecture. Domain model extensions, non-destructive SQLite Migration 2 (`add_profile_personalization_v2`), Mifflin-St Jeor BMR, PAL activity multipliers for TDEE, goal-adjusted calorie targets, macronutrient distributions, and hydration/sleep recommendations.
  - **Task 2.1A [COMPLETED]:** Personalization Engine Safety & Data Integrity. Adult eligibility guard (18+), adolescent protection, BMR biological reference transparency, caloric safety floor, and Atwater factor macro balance.
  - **Task 2.1B [COMPLETED]:** Migration Compatibility & Recommendation Contract. Versioned SQLite Migration 3 (`add_profile_confirmation_and_bmr_ref_v3`), robust legacy migration upgrade matrix, and recommendation state machine.
  - **Task 2.2 [COMPLETED]:** Interactive Personalization Onboarding & Profile UI. 5-step onboarding wizard, live biometric previews, profile editing, and custom target override management.
  - **Task 2.3 [COMPLETED]:** Daily Nutrition Targets & Dashboard Synchronization. Single shared target resolution contract (`resolveEffectiveNutritionTargets`), Home/Meals/Progress screen synchronization, and over-target remaining calculations.
  - **Task 2.4 [COMPLETED]:** Nutrition Target Integrity & Physical Device Acceptance. Precedence verification, fallback value safety (no fabricated percentages), MealDetailsScreen & ProfileScreen MacroCard target guard, historical period labeling, and 153 passing automated tests.
  - **Task 2.5 [COMPLETED]:** Final Personalization Acceptance & Merge Readiness. Comprehensive eligibility precedence audit, adolescent custom override guard (preserves values without application approval), Age 17 vs 18 boundary tests, 157 passing tests, and remote CI verification.

### Phase 3: Complete Workout System — Complete & Merged into Main
- **Core Mission:** Implement full lifecycle management for logged workouts, exercise items, active workout execution, per-set logging, rest timers, and training progression.
- **Merge Commit:** `7ba790621517cafde2847bdd69001b151e1a46ab` (Merged PR #3 into `main` with 388 passing tests).
- **Key Deliverables:**
  - **Task 3.1 [COMPLETED]:** Workout Lifecycle Audit & Safe Editing. Atomic `updateWorkout` transactions, strict domain validation (`validateWorkout`), granular `AppContext` persistence (no global `saveAllWorkouts`), and `EditWorkoutScreen` UI.
  - **Task 3.2 [COMPLETED]:** Safe Workout Deletion & History Integrity. Pre-flight ID verification, atomic SQLite deletion with cascade child cleanup and rollback, delete state machine (`idle` -> `confirming` -> `deleting` -> `success` / `error`), localized confirmation dialogs, retryable error handling, navigation safety, and empty state sync.
  - **Task 3.3 [COMPLETED]:** Exercise Catalog, Muscle Group Targeting & Multi-Exercise Workout Creation. Built-in bilingual exercise database (48 exercises, 10 muscle groups, 6 equipment categories), `ExercisePickerModal` with dual-axis filtering, multi-exercise creation flow with reordering in `AddWorkoutScreen`, catalog replacement and dirty tracking in `EditWorkoutScreen`, Task 3.2 audit corrections (onDismiss guard, protected retry, real duration calculation), and 211 passing tests.
  - **Task 3.3A [COMPLETED]:** Exercise Catalog Identity Persistence & Data Integrity. Versioned SQLite Migration 4 (`add_workout_exercise_catalog_id_v4`), bidirectional `catalog_id` mapping in `SQLiteWorkoutRepository`, AddWorkoutScreen save reliability guard (disabled during persistence, draft recovery on error), async navigation handshake in `AppNavigator`, and 226 passing tests.
  - **Task 3.4 [COMPLETED]:** Workout History, Volume Analytics & Quick-Add. Explicit workout volume formulas (`sets × reps × weight`), bodyweight and duration exercise isolation, primary muscle group 100% volume attribution policy (`sum(volumeByMuscle) === totalVolumeKg`), date-range horizon filtering (`7d`, `30d`, `90d`, `all`), exercise performance progression tracking with stable catalog ID resolution, quick-add/repeat workout flow with brand new unique IDs and atomic SQLite persistence, and 249 passing tests.
  - **Task 3.4A [COMPLETED]:** History Analytics & Quick-Add Integrity Hardening. Corrected date-window boundaries with local calendar formatting, leap year and DST immunity, non-overlapping previous-period comparison policy, collision-resistant identifier generation (`createId` with crypto/monotonic entropy), draft ID retention across retry, bodyweight vs unweighted resistance classification taxonomy, and 269 passing tests.
  - **Task 3.5 [COMPLETED]:** Active Workout Execution, Per-Set Logging & Timers. Versioned SQLite Migration 5 (`add_workout_execution_sessions_v5`), canonical `WorkoutSession`, `WorkoutSessionExercise`, and `WorkoutSet` models with state machine validation, timestamp-based wall-clock elapsed duration tracking, rest countdown timer with quick increments, individual set logging (actual reps & weight vs planned targets), app relaunch session recovery, separate actual vs planned volume calculations, and 299 passing tests.
  - **Task 3.5A [COMPLETED]:** Active Session Integrity, Set Validation & Recovery. Strict validation for repetitions (finite non-negative integers, reject fractional/negative/NaN), weights, and RPE; terminal session mutation guards on completed/discarded sessions; discard safety policy; skipped set consistency nullifying actuals without data residue; versioned SQLite Migration 6 (`enforce_single_open_workout_session_v6`) with partial unique index ensuring at most one open session at the database level; rest countdown persistence and reload recovery; clock rollback immunity; UI double-submit prevention and localized error recovery; and 324 passing tests.
  - **Task 3.5B [COMPLETED]:** Recovery-Safe Session Migration & Rest Timer Integration. Forward-only versioned SQLite Migration 7 (`recover_conflicted_workout_sessions_v7`) tagging migration-discarded sessions as `interrupted` non-destructively; strict pre-migration conflict detection (`detectPreMigrationSessionConflicts`); end-to-end rest timer persistence wiring across `ActiveWorkoutScreen` $\rightarrow$ `AppNavigator` $\rightarrow$ `AppContext` $\rightarrow$ `WorkoutSessionService` $\rightarrow$ `SQLiteWorkoutSessionRepository`; sequential promise queue debouncing rapid +30s taps and ensuring Skip Rest precedence; AppState background/foreground synchronization without background setInterval drift; interactive WorkoutsScreen conflict recovery banner and review modal (resume, archive, discard); and 342 passing tests.
  - **Task 3.5C [COMPLETED]:** Final Migration Provenance & Session Recovery Safety. Default mandatory pre-migration conflict check (`strictConflictCheck: true`) halting database initialization prior to single-open index enforcement; restored historical Migration 6 definition from commit `463c607`; forward-only versioned SQLite Migration 8 (`clarify_session_recovery_provenance_v8`) attributing unproven historical discarded records to `recovery_state = 'ambiguous'`; hardened recovery repository guards with zero elapsed duration inflation; pre-migration conflict resolution flow with AppContext hydration protection; bilingual conflict resolution UI; and 364 passing tests.
  - **Task 3.6 [COMPLETED]:** Final Acceptance, Regression & Merge Readiness. Comprehensive pre-migration resolution safety defaulting to `'keep_interrupted'` (preventing false completed-session records), wall-clock duration hardening with 12h max cap and zero offline inflation, full 11-scenario migration compatibility matrix across V0 through V8, 22 end-to-end workout acceptance flows, physical Android & iOS verification, and 388 passing automated tests. Fully merged into `main`.

### Phase 4: Nutrition & Meal Planning — Complete & Merge-Ready
- **Core Mission:** Implement full lifecycle management for logged meals, food items, nutrition planning, bilingual food catalog, and daily target synchronization.
- **Key Deliverables:**
  - **Task 4.0 [COMPLETED]:** Nutrition Architecture Audit & Implementation Blueprint. Comprehensive codebase audit, verification of 388 baseline tests, identification of P0 persistence defect (`saveAllMeals` whole-table wipe), domain model audit (20 questions), local calendar date boundary hardening plan, bilingual food catalog architecture specification, and implementation roadmap.
  - **Task 4.1 [COMPLETED]:** Meal Lifecycle Integrity, Granular Persistence & Editing. Eradication of `saveAllMeals` in favor of atomic `insertMeal`, `updateMeal`, `deleteMeal` async service operations; domain validation guards; `EditMealScreen` UI; two-step deletion confirmation with transactional cascade cleanup; local calendar date formatting (`formatLocalDate`); standardized 24h `HH:mm` time format; monotonic UUID generation; and 423 passing automated tests.
  - **Task 4.1A [COMPLETED]:** Meal Input Validation & Transaction Ownership Hardening. Strict nutrient and quantity parsing (`parseStrictNutrientInput`, `parseStrictQuantity`, `parseStrictNutrient`), comma and period decimal support, rejection of non-finite values (`NaN`, `Infinity`, `1e50`), negative values, and unbounded quantities; distinction of 0 vs empty with localized errors; leap-year calendar date validation (`validateMealDate`); standardized 24h `HH:mm` persistence; explicit transaction ownership contract in `SQLiteMealRepository` preventing nested transactions; and 445 passing automated tests.
  - **Task 4.2 [COMPLETED]:** Bilingual Food Catalog & Portion Scaling Engine. Curated offline bilingual database (158 verified fitness and Middle Eastern staple foods with USDA FoodData Central and SFDA citations in EN/AR); base 100g nutritional profiles with food-specific serving multipliers; preparation state differentiation (`raw` vs `cooked`); pure mass-basis portion scaling engine with high floating-point precision; immutable meal item snapshot policy; offline search engine with Arabic diacritics/alef/taa-marbuta normalization; custom foods SQLite persistence and service layer; versioned SQLite Migration 9 (`custom_foods`, `meal_items.catalog_id`, `meal_items.portion_unit`, `meals.meal_type`, `meals.notes`); and 480 passing automated tests.
  - **Task 4.2A [COMPLETED]:** Food Data Provenance & Portion Scaling Safety. Comprehensive audit of 158 catalog foods classifying provenance (143 VERIFIED against USDA FoodData Central, 6 ESTIMATED Saudi composite dishes with documented recipe formulations, 9 UNVERIFIED SFDA staples with transparent placeholder disclaimers, 0 MISMATCH); item-by-item verification audit artifact (`food-catalog-source-audit.md`); portion scaling overflow and numerical safety guards (`SCALING_LIMITS`); monotonic `createId('meal-item')` snapshot identifiers; and 500 passing automated tests.
  - **Task 4.3 [COMPLETED]:** Multi-Food Meal Creation, Search UX & Day Navigation. Multi-food composition draft with item reordering, removal, and editing; `FoodPickerModal` with instant debounced bilingual search, category chips, provenance badges, and serving-portion selectors; `ManualFoodModal` for custom nutrient entry; day-by-day calendar navigation (`getPreviousCalendarDate`, `getNextCalendarDate`) across midnight and month/leap-year boundaries; meal slot organization (Breakfast, Lunch, Dinner, Snack, Other); legacy meal compatibility; and 540 passing automated tests.
  - **Task 4.3A [COMPLETED]:** Daily Diary Date Integrity & Navigation Hardening. Strict calendar date matching eliminating undated meal leakage across diary views; recoverable "Unassigned Date Meals" section; zero daily totals inflation; live local midnight rollover and AppState resume listener (`useLiveLocalDate`); persistent selected diary date navigation state in `AppNavigator` across Add/Edit/Delete, tabs, and language switches; and 565 passing automated tests.
  - **Task 4.4 [COMPLETED]:** Nutrition Analytics, Daily Targets & Macro Distribution. Pure functional daily intake aggregator (`getDailyNutritionSummary`); integration with authoritative target engine (`resolveEffectiveNutritionTargets`); Atwater $4/4/9$ macro distribution with largest-remainder $100\%$ integer normalization; `MacroDistributionBar` UI component; `MealsScreen` Daily Nutrition Dashboard card with non-judgmental adherence metrics and target setup banners; `ProgressScreen` real-meal intake integration and unlogged day indicators; and 605 passing automated tests.
  - **Task 4.4A [COMPLETED]:** Nutrition Trend Integrity & Coverage Hardening. Independent 7-day calendar series generation (`getCalendarDateRange`, `formatShortWeekday`); complete elimination of unverified fallback to synthetic `ProgressEntry.calories`; genuine Hamilton-Hare largest-remainder macro distribution rounding; real rendered React Native component test suite for `ProgressScreen`, `MealsScreen`, and `MacroDistributionBar` (recovering line coverage to 92.58%); and 640 passing automated tests.
  - **Task 4.5 [COMPLETED]:** Meal Templates, Favorites & Quick-Log. Favorite meal tagging and persistence via SQLite note encoding; 1-tap "Log Again Today" repeat meal flow with brand-new unique IDs (`createId('meal')` and `createId('meal-item')`) ensuring strict source immutability; `QuickAddMealModal` for fast calorie and macro logging without individual foods; filter chips ("All Meals" vs "Favorites") on `MealsScreen`; seamless daily intake aggregation; and 650 passing automated tests.
  - **Task 4.5A [COMPLETED]:** Template Integrity, Unknown Macros & Quick-Log Hardening. Versioned SQLite Migration 10 (`add_meal_templates_and_structured_favorites_v10`); dedicated `meal_templates` and `meal_template_items` tables with full CRUD isolated from consumed meal history; granular favorite toggling without rewriting child rows; clean note preservation without synthetic metadata; explicit unknown macronutrient semantics (`NutritionCompleteness`, `proteinKnown`, `carbsKnown`, `fatKnown`) distinguishing confirmed 0g from unrecorded macros; safe repeat-meal workflows resetting favorite and template flags; quick-add error recovery with draft retention and double-submit guards; and 662 passing automated tests.
  - **Task 4.5B [COMPLETED]:** Template Nutrient Fidelity & Legacy Favorites. Elimination of synthetic template items for itemless calorie-only meals; explicit itemless templates (`items: []`) with direct nutrient totals stored on `MealTemplate`; full unknown macro semantics and completeness preservation across template save and logging without inventing confirmed zeros; forward SQLite Migration 11 (`add_meal_template_nutrient_fidelity_and_favorite_repair_v11`) adding totals to `meal_templates`, backfilling template totals, and repairing false favorites caused by Migration 10 substring matching on user prose; and 671 passing automated tests.
  - **Task 4.6 [COMPLETED]:** Cross-Platform UI/UX, A11y & Arabic Parity Hardening. Forward SQLite Migration 12 (`add_provenance_and_repair_legacy_templates_v12`) adding `favorite_source` tracking (`legacy_marker`, `ambiguous`, `explicit`, `none`) and repairing pre-4.5B legacy synthetic templates with positive calories and 0g macros to `indeterminate` with unknown macros; minimum $\ge 48\text{dp}$ Android and $\ge 44\text{pt}$ iOS touch targets across all steppers, chips, delete buttons, and nav arrows; native feedback (`android_ripple` vs smooth opacity); full TalkBack/VoiceOver accessibility labels; bidirectional RTL layout symmetry with dynamic icon mirroring; Latin numeral preservation (`ar-SA-u-nu-latn`); and 683 passing automated tests.
  - **Task 4.6A [COMPLETED]:** Legacy Template Migration Safety & Cross-Platform Acceptance Hardening. Forward-only SQLite Migration 13 (`harden_template_nutrient_fidelity_and_favorite_provenance_v13`) eliminating Migration 12 over-generalization on confirmed zero-macro templates (e.g., black coffee, tea, zero-calorie items with catalog backing or distinct child items) by restoring `'complete'` status and confirmed 0g macros while preserving honest uncertainty on synthetic single-item records without child evidence; protecting `favorite_source` and `is_favorite` across meal update workflows (`EditMealScreen` & `mealRepository.updateMeal`); comprehensive 25-test migration upgrade and component interaction suite; and 708 passing automated tests.
  - **Task 4.7 [COMPLETED]:** Final Acceptance, Full Regression & Merge Readiness Audit. Forward-only SQLite Migration 14 (`reconcile_template_unknown_macros_and_preserve_uncertainty_v14`) eliminating false macro completeness for positive-calorie zero-macro templates; comprehensive 18-step migration upgrade matrix across V0 through V14 in both clean and populated states; 10 end-to-end user journeys; full verification of 736 passing automated tests, 90.94% overall line coverage, 0 TypeScript errors, 0 ESLint warnings, and 20/20 Expo Doctor checks passed.
  - **Task 4.7A [COMPLETED]:** Final Migration Fidelity & Acceptance Corrections. Forward-only SQLite Migration 15 (`add_meal_template_review_status_and_reconcile_ambiguity_v15`) adding `review_status` (`'ambiguous'` | `'confirmed'`) on `meal_templates` and flagging Migration 14 reconciled records as ambiguous without heuristic guesswork; `reconfirmTemplate` repository and service methods providing user-driven reconfirmation; `MealsScreen` ambiguous review notice; mandatory regression suite covering Cases A through J; transparent acceptance reporting of physical test limitations (physical devices/simulators NOT TESTED on Linux host), exact calculated contrast ratios, and `getAllMeals` single-query performance reality; and 749 passing automated tests (90.79% coverage).
  - **Task 4.7 Closeout [COMPLETED]:** Template Macro Review Flow & Final Acceptance Closeout. Full user-facing review and reconfirmation modal flow (`ReviewTemplateModal` and `MealsScreen` review action) with segmented Known/Unrecorded controls, strict input validation, atomic SQLite persistence with optional nutrient overrides, form state preservation on persistence errors, full bilingual English/Arabic parity and RTL layout, and 759 passing automated tests (91.11% coverage).
  - **Task 4.7 Final Fix [COMPLETED]:** Template Nutrient Integrity, Multi-Item Protection & Strict Parsing. Direct persistence of corrected calories/macros for itemless and single-item templates; multi-item template snapshot protection requiring explicit per-item corrections (`items`) and rejecting unsupported aggregate edits without item breakdown (preventing silent discards); strict nutrient input parsing with `parseStrictNutrientInput` rejecting empty, non-finite, negative, malformed, and out-of-range values; form state retention on error; and 764 passing automated tests (90.59% coverage).
  - **Task 4.7 Data Preservation Fix [COMPLETED]:** Non-Zero Nutrient Preservation Under Unknown Status. Elimination of numeric zero coercion when macronutrients are marked Unrecorded in `ReviewTemplateModal`; strict preservation of stored per-item nutrient values and aggregate totals across multi-item, single-item, and itemless templates; independent known/unknown flags; and 773 passing automated tests (90.84% coverage). Phase 4 is 100% complete and merge-ready for `main`.

### Phase 5: Body Tracking & Analytics — Active Engineering Epic
- **Core Mission:** Comprehensive biometric progression tracking, moving averages, body circumferences, visual progress photos, and historical visualization.
- **Target Deliverables:**
  - Forward-only Migration 16 (`add_body_tracking_and_biometrics_v16`) providing normalized tables for `body_weight_entries`, `body_measurement_entries`, `body_composition_entries`, and `progress_photos`.
  - Elimination of the destructive `saveAllProgress` whole-table wipe pattern in favor of atomic, row-level SQLite CRUD.
  - Weight trends, 7-day rolling moving averages (EMA/SMA), time-range filtering (`7d`, `30d`, `90d`, `1y`, `all`), and sparse-data handling without point fabrication.
  - Body measurement logging (chest, waist, hips, arms, thighs, calves, shoulders, neck) with explicit missing-value semantics.
  - Progress photos comparison with sandboxed local storage, pose classification, and safe physical unlinking upon deletion.
  - Complete dual-platform compliance (Material Design 3 / Apple HIG), RTL/LTR symmetry, Latin numeral preservation (`ar-SA-u-nu-latn`), and WCAG 2.1 AA contrast.
- **Current Status & Milestones:**
  - **Task 5.0 [COMPLETED]:** Body Tracking & Analytics Architecture Audit. Pre-flight quality gates verified (773 passing tests, 90.82% coverage, 0 TS errors, 0 ESLint warnings, 20/20 Expo Doctor checks). System audit of `progress_entries`, whole-table wipe risks, profile synchronization, canonical domain models, Migration 16 strategy, analytics formulas, implementation plan, and acceptance matrix documented.
  - **Task 5.1 [PLANNED]:** Migration 16 & Normalized Biometric Storage Architecture (`body_weight_entries`, `body_measurement_entries`, `body_composition_entries`, `progress_photos`, non-destructive legacy backfill, granular repositories).
  - **Task 5.2 [PLANNED]:** Body Weight Logging, History & Strict Validation (Timestamped weigh-ins, multiple entries per day, unit conversion kg/lb, edit/delete weight entry, profile sync).
  - **Task 5.3 [PLANNED]:** Body Measurements & Circumference Tracking (Modal and cards for chest, waist, hips, arms, thighs, calves, shoulders, neck, explicit nulls, anatomical WHR/WHtR ratios).
  - **Task 5.4 [PLANNED]:** Biometric Analytics, Moving Averages & Charting (7d/30d/90d/1y/all filters, 7-day rolling EMA/SMA, rate of change, goal comparison, accessible chart alternatives).
  - **Task 5.5 [PLANNED]:** Progress Photos & Visual Comparison (Sandboxed storage, camera/library picker, front/side/back tagging, side-by-side comparison slider, privacy controls).
  - **Task 5.6 [PLANNED]:** Final Acceptance, Full Regression & Merge Readiness (Complete V0..V16 upgrade matrix, user journeys, 100% Arabic/English parity, physical device validation).

### Phase 6: AI Fitness Coach — Planned
- **Core Mission:** Intelligent, contextual training and nutrition guidance tailored to user biometrics and daily adherence.
- **Target Deliverables:**
  - Context-aware daily insights based on calorie and workout adherence.
  - Dynamic workout volume suggestions and recovery recommendations.
  - Conversational fitness assistant respecting local privacy and on-device storage.

### Phase 7: Advanced Integrations — Planned
- **Core Mission:** Seamless ecosystem connectivity with health platforms and wearables.
- **Target Deliverables:**
  - Apple HealthKit integration (steps, active energy, workouts, weight).
  - Google Health Connect / Android Health Connect integration.
  - Wearable device sync and background activity tracking.

### Phase 8: Production Testing & Launch — Planned
- **Core Mission:** End-to-end production hardening, automated CI/CD pipeline, app store asset preparation, and store deployment.
- **Target Deliverables:**
  - EAS production builds (AAB for Google Play Store, IPA for Apple App Store).
  - Automated smoke test suites and crash monitoring.
  - Store metadata, screenshots, privacy disclosures, and bilingual store listings (EN/AR).
