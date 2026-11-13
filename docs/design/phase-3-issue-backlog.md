# Qooti Phase 3 Workout Lifecycle & Management Backlog

**Version:** 1.0.0  
**Status:** Active Tracking  
**Scope:** Phase 3 Execution, Verification Findings & Feature Lifecycle  
**Date:** November 2026  

---

## 1. Resolved Tasks in Phase 3

### Item 3.1 [RESOLVED] Workout Lifecycle Audit & Safe Editing
- **Description:** Audit existing workout persistence architecture, harden `updateWorkout()` atomic transaction semantics, implement strict domain validation without silent coercion, prevent global `saveAllWorkouts()` table wipes, provide full workout editing UI, and verify cross-platform parity on Android and iOS.
- **Resolution:**
  1. **Reused Repository Methods:**
     - Reused existing canonical `SQLiteWorkoutRepository` methods: `getWorkoutById()`, `getAllWorkouts()`, `updateWorkout()`, `insertWorkout()`, and `deleteWorkout()`.
     - Explicitly eliminated destructive table-replacement calls (`saveAllWorkouts()`) from single-workout modification flows.
  2. **Schema & Domain Alignment:**
     - Audited existing `workouts` (`id`, `title`, `date`, `time`, `notes`, `created_at`) and `workout_exercises` (`id`, `workout_id`, `name`, `target_muscles`, `sets`, `reps`, `weight`, `duration`, `notes`, `sort_order`).
     - Clarified that workout-level duration is derived dynamically from child exercise durations (`workout.exercises.reduce((sum, ex) => sum + ex.duration, 0)`), preventing schema mixing or data duplication.
     - Documented individual set logging and dedicated workout duration as potential future schema extensions (deferred to later tasks).
  3. **Editing Transaction Semantics:**
     - Hardened `updateWorkout()` with pre-flight existence verification (`SELECT id FROM workouts WHERE id = ?;`), preventing orphaned rows from invalid IDs.
     - Preserved existing parent workout ID and exercise IDs.
     - Deterministic child exercise ordering maintained via `sort_order` index.
     - Entire edit operation executes in `withExclusiveTransactionAsync` with full rollback on any failure.
  4. **Strict Domain Validation (`validateWorkout` / `validateExercise`):**
     - Non-empty workout title.
     - Non-empty exercise names.
     - Valid ISO/date string formats.
     - Non-negative finite integer constraints for `sets` and `reps`.
     - Non-negative finite numerical constraints for `weight` and `duration` (rejects `NaN`, `Infinity`, and negative values without silent coercion).
     - Unique exercise IDs enforced within workout collections.
     - Safe handling of empty-workout sessions (workouts with 0 exercises are supported without error).
  5. **Granular AppContext Persistence:**
     - Replaced naive `saveWorkouts(state.workouts)` auto-sync effect with targeted, atomic asynchronous operations (`insertWorkoutService`, `updateWorkoutService`, `deleteWorkoutService`).
     - State synchronization across `WorkoutsScreen`, `WorkoutDetailsScreen`, `HomeScreen`, and `ProgressScreen` without reload loops.
  6. **Workout Editing UI (`EditWorkoutScreen`):**
     - Full prefilled editing form for title, date, time, notes, and individual exercise parameters (name, sets, reps, weight, duration, notes).
     - Exercise addition and removal capabilities within the session.
     - Inline validation with immediate error clearing on input.
     - Form dirty tracking and unsaved changes confirmation dialog.
     - Saving/loading indicator and error banner on transaction failure.
     - Integrated into `AppNavigator` with header "Edit" action from `WorkoutDetailsScreen` and safe back navigation.
  7. **Testing Evidence:**
     - 15 new comprehensive regression and acceptance tests in `src/__tests__/workoutLifecycleEditing.test.ts` (172 total project tests passing).
     - 94.56% code coverage.
     - 20/20 Expo Doctor checks passing.

---

### Item 3.2 [RESOLVED] Safe Workout Deletion & History Integrity
- **Description:** Implement safe, user-confirmed deletion of individual workouts using the existing SQLite repository and AppContext architecture, ensuring deletion affects exactly the selected workout and its owned exercises without data loss elsewhere or premature UI updates.
- **Resolution:**
  1. **Delete Repository Hardening:**
     - Pre-flight ID validation (rejects empty/whitespace IDs).
     - Existence verification (`SELECT id FROM workouts WHERE id = ?`) inside transaction returning explicit not-found error.
     - Atomic transaction with rollback (`withExclusiveTransactionAsync`) ensuring clean rollback on simulated SQL failures.
     - Cascade child exercise deletion alongside foreign key constraints.
     - Deterministic handling of concurrent/duplicate deletion attempts and support for empty exercise collections.
  2. **Deletion UI & Platform-Native Confirmation:**
     - Added `'danger'` variant to `AppButton` adhering to WCAG 2.1 AA contrast in light and dark themes.
     - Native confirmation dialog identifying the workout and informing that its exercises will be removed.
     - Minimum 48dp touch target on Android and >= 44pt on iOS.
     - Full English and Arabic localization parity (`workouts.deleteWorkout`, `workouts.deleteWorkoutMessage`).
  3. **Delete State Machine:**
     - Explicit state machine: `idle` -> `confirming` -> `deleting` -> `success` / `error`.
     - Button disabled during deletion to prevent duplicate submissions.
     - In error state: screen and workout remain available with localized retryable error banner.
     - Never navigates away before persistence succeeds.
  4. **Navigation & Synchronization:**
     - `AppNavigator` routes to `WorkoutsScreen` upon successful deletion and clears `selectedWorkoutId`.
     - Stale selection guard safely falls back to workouts screen without crash.
     - `HomeScreen` recalculates workout count and progress ratios; `WorkoutsScreen` restores empty state when last workout is removed.
     - Unrelated workouts, meals, and profile data remain completely untouched.
  5. **Edit Screen UX Correction:**
     - Replaced generic `common.requiredMessage` with dedicated localized confirmation (`workouts.discardChangesMessage`) and actions ("Keep Editing" / "Discard Changes").
     - Added Android hardware Back button handling to trigger the discard prompt when form is dirty.
  6. **Testing Evidence:**
     - 19 automated tests in `src/__tests__/workoutDeletionIntegrity.test.ts` (191 total tests passing, 0 failures).

---

### Item 3.3 [RESOLVED] Exercise Catalog, Muscle Group Targeting & Multi-Exercise Workout Creation
- **Description:** Implement an extensible, offline-first bilingual Exercise Catalog spanning 10 muscle groups and 6 equipment categories, dual-axis filtering and search engine, reusable `ExercisePickerModal`, multi-exercise workout creation in `AddWorkoutScreen`, catalog replacement and reordering in `EditWorkoutScreen`, and resolve Task 3.2 source-review audit findings.
- **Resolution:**
  1. **Offline Bilingual Exercise Catalog (`src/models/exerciseCatalog.ts`, `src/data/exerciseCatalog.ts`):**
     - Authored starter library of 48 exercises covering all 10 canonical muscle groups (`chest`, `back`, `shoulders`, `biceps`, `triceps`, `quadriceps`, `hamstrings`, `glutes`, `calves`, `core`) and 6 equipment types (`bodyweight`, `dumbbell`, `barbell`, `cable`, `machine`, `resistance-band`).
     - Includes primary/secondary muscle tags, movement category (`compound` / `isolation`), English and Arabic names, searchable aliases, and localized step-by-step instructions.
     - Built `searchCatalog()` with normalized diacritic-insensitive Arabic search (`tashkeel`, `alif`, `taa marbuta`, `yaa` normalizations) and dual-axis filtering.
     - Attached optional `catalogId?: string;` to `Exercise` domain model with backwards-compatible normalization.
  2. **Exercise Picker Modal (`src/components/ExercisePickerModal.tsx`):**
     - Full-featured modal with real-time text search, horizontal scrollable muscle group filter chips, equipment filter chips, and active filter counter.
     - Displays muscle tags, equipment badge, category indicator, and localized instructions for each exercise.
     - Touch targets satisfy >= 48dp on Android and >= 44pt on iOS with platform-native ripple and opacity press feedback.
     - VoiceOver and TalkBack accessibility traits (`search`, `button`, accessibility labels).
  3. **Multi-Exercise Workout Creation (`src/screens/AddWorkoutScreen.tsx`):**
     - Extended creation form from single exercise to multiple dynamic exercises (`DraftExercise[]`).
     - "Add from Catalog" opens picker and pre-fills name, target muscles, and parameters; "Add Custom Exercise" allows bespoke manual entry.
     - Exercise sequence reordering with "Move Up" / "Move Down" controls preserving deterministic execution order.
     - Per-exercise parameter inputs (sets, reps, weight, duration, notes) with inline validation and instant error clearing on keystroke.
     - Atomic SQLite save via `insertWorkout` inside exclusive transaction.
  4. **Edit Screen Integration (`src/screens/EditWorkoutScreen.tsx`):**
     - Integrated catalog picker modal to allow replacing any exercise with a catalog item or adding new catalog items to existing workouts.
     - Added "From Catalog" badge indicator for catalog-linked exercises.
     - Exercise reordering (Move Up / Down) with dirty tracking and unsaved changes confirmation dialog.
  5. **Task 3.2 Audit Findings Corrections:**
     - `Alert.onDismiss` guard: fixed in `WorkoutDetailsScreen` so dismiss only resets state if currently in `confirming` state, never canceling active deletions.
     - Protected retry: deletion retry button re-engages user confirmation instead of invoking delete directly.
     - Localized accessibility strings: replaced hard-coded English strings with `workouts.retryDeletion`, `workouts.dismissError`, and `workouts.dismissStorageError`.
     - Duration fallback: removed fabricated `totalMinutes || 45` fallback across `WorkoutCard` and `WorkoutDetailsScreen`, accurately presenting actual session duration.
  6. **Testing Evidence:**
     - 20 new comprehensive tests in `src/__tests__/exerciseCatalogWorkouts.test.ts` (211 total project tests passing, 0 failures).
     - 91.32% line coverage across the codebase (100% on `exerciseCatalog.ts`).
     - 20/20 Expo Doctor checks passing.

---

## 2. Planned Tasks in Phase 3

### Item 3.4 [PLANNED] Workout History, Volume Analytics & Quick-Add
- **Description:** Workout history views, volume progression analytics per muscle group, and quick-add capability from previous workout sessions with remembered loads.
- **Status:** Next planned task in Phase 3.

---

## 3. Known Limitations & Architectural Notes

1. **Derived Duration:**
   - Workout duration continues to be derived from the sum of exercise durations. Dedicated session timer or workout-level duration column is not currently part of the SQLite schema.
2. **Aggregated Set Model:**
   - Exercises are stored as aggregated sets/reps/weight (`sets: 4, reps: 10, weight: 60`). Individual set-by-set logging (e.g. Set 1: 60kg x 10, Set 2: 65kg x 8) is deferred to future schema migrations.
3. **Navigation Architecture:**
   - Navigation remains state-based within `AppNavigator.tsx`, in compliance with project architecture rules. Native stack navigation remains deferred to Phase 1B.
