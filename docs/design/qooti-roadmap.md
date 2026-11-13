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
[ Phase 3: Complete Workout System + Edit/Delete ] (Next)
       │
       ▼
[ Phase 4: Nutrition & Meal Planning + Edit/Delete ] (Planned)
       │
       ▼
[ Phase 5: Body Tracking & Analytics ] (Planned)
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

### Phase 3: Complete Workout System [IN PROGRESS]
- **Core Mission:** Implement full lifecycle management for logged workouts, exercise items, and training progression.
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
  - **Task 3.6 [NEXT]:** Training Volume & Progression Insights. Longitudinal progression trends, volume load comparisons across weeks and months, personal records (PRs), and workout frequency charts based on logged execution sessions.

### Phase 4: Nutrition & Meal Planning — Planned
- **Core Mission:** Implement full lifecycle management for logged meals, food items, and nutrition planning.
- **Target Deliverables:**
  - **Meal Editing:** Edit meal title, timestamp, and food items (portion sizes, calories, macros) with atomic SQLite update transactions.
  - **Meal Deletion:** Platform-conforming deletion confirmation with cascade cleanup of child items and real-time calorie balance recalculation.
  - **Food Catalog & Custom Foods:** Expanded food database, custom recipe creator, and barcode scanning integration.

### Phase 5: Body Tracking & Analytics — Planned
- **Core Mission:** Comprehensive biometric progression tracking and historical visualization.
- **Target Deliverables:**
  - Weight trends, moving averages, and body measurement logging (chest, waist, hips, arms).
  - Interactive multi-week / multi-month progress charts with time-range filtering (7d, 30d, 90d, 1y).
  - Progress photos comparison and body composition estimation.

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
