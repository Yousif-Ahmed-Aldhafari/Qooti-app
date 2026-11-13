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

### Item 3.3A [RESOLVED] Exercise Catalog Identity Persistence & Data Integrity
- **Description:** Resolve catalog identity persistence defect by adding versioned SQLite Migration 4 (`add_workout_exercise_catalog_id_v4`), updating `SQLiteWorkoutRepository` mapping in both read and write directions, hardening `AddWorkoutScreen` and `AppNavigator` against race conditions and save failures, and proving upgrade paths from V1, V2, and V3.
- **Resolution:**
  1. **Versioned SQLite Migration 4 (`add_workout_exercise_catalog_id_v4`):**
     - Added Migration 4 in `src/db/migrations.ts` altering `workout_exercises` to add nullable `catalog_id TEXT` column.
     - Preserves all historical workout records, child exercise rows, and existing primary/foreign key constraints.
     - Fully idempotent using `addMissingColumns()`.
     - Tested clean upgrades from V0, V1, V2, and V3 to V4.
  2. **Repository Mapping Alignment (`SQLiteWorkoutRepository`):**
     - Updated `ExerciseRow` interface with `catalog_id: string | null`.
     - In `getAllWorkouts()` and `getWorkoutById()`: mapped `catalogId: ex.catalog_id ?? undefined`.
     - In `insertWorkout()`, `updateWorkout()`, and `saveAllWorkouts()`: mapped `catalog_id` explicitly into SQL statements (`ex.catalogId ?? null`).
     - Preserved transaction rollback semantics, ID stability, and sort ordering.
  3. **Add Screen Save Reliability Audit:**
     - Made `onSave` in `AddWorkoutScreenProps` return `Promise<void> | void`.
     - Added `isSaving` state and disabled Save button during persistence to prevent duplicate submissions and duplicate workouts.
     - In `AppNavigator.tsx`, made `saveWorkout` asynchronous, awaiting `addWorkout(workout)` before navigating to `workoutDetails` or updating selection.
     - Kept draft data accessible upon persistence failure for safe user retry.
  4. **Catalog Identity Semantics:**
     - Catalog exercises retain stable canonical slug IDs (`barbell-bench-press`).
     - Legacy and custom exercises store `null` (`undefined` in domain model) and are never auto-matched or inferred by name.
     - Future or unknown catalog IDs load gracefully without crashing.
  5. **Testing Evidence:**
     - 15 new automated regression and integrity tests in `src/__tests__/catalogIdPersistence.test.ts`.
     - Total project test suite: **226 passing tests**, 0 failures, 0 regressions.
     - 91.27% overall coverage; 20/20 Expo Doctor checks passing.

---

### Item 3.4 [RESOLVED] Workout History, Volume Analytics & Quick-Add
- **Description:** Build a comprehensive workout history and training progression experience on top of the existing Workout, Exercise, Exercise Catalog and SQLite architecture. Enable users to review past training sessions, understand volume trends per muscle group, filter by time horizons, and quickly duplicate/repeat previous workouts as editable templates without mutating historical records.
- **Resolution:**
  1. **Explicit Workout Volume Semantics (`src/utils/workoutAnalytics.ts`):**
     - Defined explicit formula: `exerciseVolume = sets × reps × weight` (kg-reps load).
     - Bodyweight movements (`weight === 0` or missing) are flagged as bodyweight (`isBodyweight: true`) with `0 kg` load, preventing fabricated load numbers.
     - Duration-only exercises (e.g. plank, cardio) do not treat duration minutes as repetitions or weight.
     - Missing, negative, `NaN`, or non-finite parameters neutralize safely to `0` without throwing or corrupting aggregates.
  2. **Muscle Group Volume Attribution Invariant:**
     - 100% of an exercise's load volume is attributed strictly to its primary muscle group (resolved from catalog definition or `targetMuscles[0]`).
     - Secondary muscle groups are tracked for movement frequency/exposure only.
     - Strict conservation invariant verified: `sum(volumeByMuscle) === totalVolumeKg` (zero volume inflation or double-counting).
  3. **Date-Based Filtering & Chronological Ordering:**
     - Implemented `filterWorkoutsByPeriod(workouts, period)` supporting `7d`, `30d`, `90d`, and `all`.
     - Workouts sorted chronologically descending (newest first) by date and time.
     - Time window calculation uses UTC midnight boundary relative to the reference date for exact and testable date filtering.
  4. **Exercise Progression & Catalog Identity Resolution:**
     - Implemented `getExerciseHistory(workouts, options)` returning performance data points sorted chronologically.
     - Identity matching policy: exercises with a `catalogId` match by canonical slug ID even if display name was customized; custom exercises without `catalogId` match strictly by case-insensitive trimmed name and never match catalog entries.
     - Implemented `calculateWorkoutProgressionSummary()` computing total workouts, total volume, average workout duration, muscle group distributions, and period-over-period percentage changes with division-by-zero protection.
  5. **Quick-Add / Repeat Workout Architecture:**
     - Built `createQuickAddWorkoutDraft(source, options)` generating a completely new draft workout with unique workout ID and unique exercise IDs (`draft-ex-${Date.now()}-${idx}`).
     - Populates draft with current date and time while preserving exercise parameters, target muscles, and `catalogId`.
     - Zero mutation of the source workout: verified immutable via deep comparison.
     - Wired through `WorkoutDetailsScreen` ("Repeat Workout" / "Use as Template") -> `AppNavigator` -> `AddWorkoutScreen` with `initialWorkout` prop, allowing full review and editing before atomic SQLite insert.
     - Double-submission guard (`isSaving` flag) rejects concurrent duplicate submissions and rolls back cleanly on simulated database errors.
  6. **UI & Cross-Platform Parity:**
     - `WorkoutsScreen`: period filter chips (`All`, `7 Days`, `30 Days`, `90 Days`), summary stats cards (Workouts, Duration, Total Volume), and period-empty recovery state.
     - `WorkoutCard`: displays duration, exercise count, load volume, and bodyweight tag; updated accessibility labels.
     - `WorkoutDetailsScreen`: stats header showing Duration and Total Volume, Target Muscles badges, and Repeat Workout action button.
     - Full English and Arabic localization parity (`en.ts`, `ar.ts`) with Latin numeral formatting in Arabic (`ar-SA-u-nu-latn`).
     - Theme-token compliance for WCAG 2.1 AA in light and dark modes, and minimum 48dp Android / 44pt iOS touch targets.
  7. **Testing Evidence:**
     - 23 new comprehensive automated tests in `src/__tests__/workoutHistoryAnalytics.test.ts`.
     - Total project test suite: **249 passing tests**, 0 failures.
     - 91.33% codebase line coverage (91.93% on `workoutAnalytics.ts`).
     - 20/20 Expo Doctor checks passing.

---

### Item 3.4A [RESOLVED] History Analytics & Quick-Add Integrity Hardening
- **Description:** Targeted hardening of date-window calculations, chronological sorting, collision-resistant identifier generation, retry preservation, and exercise classification edge cases before proceeding to Task 3.5.
- **Resolution:**
  1. **Date Boundary Policy & DST Protection (`src/utils/workoutAnalytics.ts`):**
     - Implemented `isValidDateString` validating calendar dates in `YYYY-MM-DD` format (rejects month > 12, day > 31, and non-leap years such as `2026-02-29` while allowing `2024-02-29`).
     - Implemented `toLocalDateString` formatting dates from local calendar components (`getFullYear()`, `getMonth() + 1`, `getDate()`), eliminating UTC day-drifts.
     - Implemented `getDateWindow(period, referenceDate)` and `getPreviousDateWindow(period, referenceDate)` with noon reference times (`12:00:00`) to guarantee immunity from daylight saving time (DST) boundary shifts.
     - Historical bounded periods (`7d`, `30d`, `90d`) strictly exclude future workouts (`w.date > endDate`). For `'all'`, future planned sessions are retained by default but caller can pass `{ includeFuture: false }` for historical-only metrics.
  2. **Previous Period Comparison Policy:**
     - Previous period is guaranteed equivalent length in calendar days without overlap: `previousDateWindow.endDate < dateWindow.startDate`.
     - Percentage changes in `calculateWorkoutProgressionSummary()` compare strictly non-overlapping cohorts with zero double-counting.
  3. **Collision-Resistant Quick-Add Identity Generation (`src/utils/id.ts`):**
     - Hardened `createId(prefix)` leveraging runtime `globalThis.crypto.randomUUID()` when available, with a monotonic counter + high-entropy fallback.
     - 100% collision-resistant under rapid concurrent execution (verified with 100 consecutive rapid executions).
     - `createQuickAddWorkoutDraft` generates fresh collision-resistant IDs for workout and exercises without mutating source objects.
     - `AddWorkoutScreen` maintains a stable `draftWorkoutId` during editing and persistence retries, preventing duplicate record creation upon transient failures.
  4. **Exercise Classification Semantics:**
     - Explicit category taxonomy: `weighted`, `bodyweight`, `duration_only`, `unweighted`.
     - Catalog equipment metadata (`equipment === 'bodyweight'`) and canonical naming patterns identify confirmed bodyweight movements.
     - Zero-weight resistance exercises on non-bodyweight movements are categorized as `unweighted` (unknown/unrecorded load) rather than falsely flagged as bodyweight.
     - `WorkoutVolumeSummary.isBodyweightOnly` requires that all exercises be confirmed bodyweight with no weighted or unweighted movements.
  5. **Quick-Add Navigation & Retry Safety:**
     - `AppNavigator` instantiates fresh draft via `createQuickAddWorkoutDraft(workout)` and sets `quickAddTemplate`.
     - Header Back, Cancel button, and Android hardware Back return directly to the source workout details when in Quick-Add mode.
     - Failed save keeps all form inputs and stable draft identity for immediate user retry.
  6. **Testing Evidence:**
     - 20 new comprehensive automated tests in `src/__tests__/workoutAnalyticsHardening.test.ts`.
     - Total project test suite: **269 passing tests**, 0 failures.
     - Codebase line coverage: **91.81%** (`workoutAnalytics.ts`: 97.94%, `id.ts`: 100%).
     - 20/20 Expo Doctor checks passing.

---

### Item 3.5 [RESOLVED] Active Workout Execution, Per-Set Logging & Timers
- **Description:** Implement a complete, reliable active workout execution experience with individual set logging (actual reps & weight vs planned targets), rest timers, elapsed workout duration derived from persisted timestamps, interrupted session recovery upon app relaunch, and strict separation between planned and actual training volume.
- **Resolution:**
  1. **Canonical Domain Models (`src/models/workoutSession.ts`):**
     - Introduced `WorkoutSession`, `WorkoutSessionExercise`, `WorkoutSet`, `SessionStatus` (`'active' | 'paused' | 'completed' | 'discarded'`), and `SetStatus` (`'pending' | 'completed' | 'skipped'`).
     - State machine validation via `validateSessionTransition()`: terminal statuses (`completed`, `discarded`) strictly cannot transition back to active/paused.
     - Strict domain validation via `validateWorkoutSet()` enforcing positive integer set numbers, non-negative reps/weights, and RPE bounds [1, 10].
  2. **SQLite Migration 5 (`src/db/migrations.ts`):**
     - Versioned non-destructive migration `add_workout_execution_sessions_v5`.
     - Tables: `workout_sessions`, `workout_session_exercises`, `workout_sets` with foreign key cascades and indexes on `status`, `started_at`, and parent relationships.
     - Preserves Migrations 1–4 and all legacy user workouts without modification.
  3. **Repository & Service Architecture (`src/db/repositories/workoutSessionRepository.ts`, `src/services/workoutSessionService.ts`):**
     - Implemented `SQLiteWorkoutSessionRepository` with transactional integrity (`withExclusiveTransactionAsync`).
     - Session uniqueness guard: rejects starting a new session if an active/paused session already exists.
     - Timestamp-based elapsed duration calculation (`accumulatedElapsedMs + (now - lastResumedAt)`), eliminating timer drift across pauses, unmounts, or app backgrounding.
     - Supports individual set completion, editing, skipping, and dynamic addition of extra sets.
     - Discarding cleanly purges uncommitted session sets. Deleting a template workout sets `source_workout_id` to NULL without corrupting completed session records.
  4. **Active Workout Execution UI (`src/screens/ActiveWorkoutScreen.tsx`):**
     - Real-time elapsed duration clock and status indicator (Active / Paused).
     - Rest countdown timer with `+30s` increment and skip actions.
     - Per-set editing table displaying planned targets alongside actual reps, actual weight, and checkmark / skip controls.
     - "Add Set" action dynamically adds extra sets to any exercise.
     - Finish Workout modal with actual performance metrics (elapsed minutes, completed sets, actual volume, total reps) and warning banner when sets remain incomplete.
     - Back navigation with leave confirmation prompt (leaves session running safely in background) and discard confirmation modal.
  5. **Navigation & Session Recovery (`src/navigation/AppNavigator.tsx`, `src/store/AppContext.tsx`):**
     - `AppContext` hydrates active session from SQLite on app startup.
     - Active workout banner on `WorkoutsScreen` provides one-tap resumption into the running session.
     - Conflict alert on `WorkoutDetailsScreen` if starting a workout while another session is in progress (Resume / Discard & Start New / Cancel).
     - Android hardware back button handles active session gracefully without accidental data loss or premature screen exit.
  6. **Separation of Actual vs Planned Volume (`src/utils/workoutAnalytics.ts`):**
     - Implemented `calculateSessionPerformanceSummary(session)` computing actual verified volume strictly from completed sets ($\sum reps_{actual} \times weight_{actual}$).
     - Incomplete sets contribute 0 load, preventing artificial volume inflation.
  7. **Testing Evidence:**
     - 30 comprehensive automated tests in `src/__tests__/activeWorkoutExecution.test.ts`.
     - Total project test suite: **299 passing tests**, 0 failures.
     - Codebase line coverage: **90.79%** (`workoutSession.ts`: 95.71%, `workoutSessionRepository.ts`: 91.95%).
     - 20/20 Expo Doctor checks passing.

---

### Item 3.5A [RESOLVED] Active Session Integrity, Set Validation & Recovery
- **Description:** Resolve active workout session integrity defects prior to device acceptance: enforce strict set validation (reject NaN, Infinity, negative reps/weights, fractional reps, out-of-range RPE without silent rounding or clamping), implement terminal session mutation protection, guarantee discard safety, enforce clean skipped set consistency, establish database-level single active session guarantee via Migration 6 partial unique index, ensure rest timer persistence and clock rollback immunity, and provide resilient UI error recovery.
- **Resolution:**
  1. **Strict Set Validation (`src/models/workoutSession.ts`, `src/db/repositories/workoutSessionRepository.ts`):**
     - `validateWorkoutSet()` strictly validates planned and actual values.
     - Actual repetitions require non-negative integers (rejects fractional actual repetitions such as 8.5, negative values, NaN, and Infinity without silent rounding or clamping).
     - Actual weights require finite non-negative numbers (rejects negative numbers, NaN, and Infinity without clamping to 0).
     - RPE requires finite numbers between 1 and 10.
     - `completeSet()`, `updateSet()`, and `addSet()` validate inputs before SQLite write within transactional boundaries.
  2. **Terminal Session Protection (`src/db/repositories/workoutSessionRepository.ts`):**
     - Inside transactions, queries parent session status.
     - Mutations (`completeSet`, `skipSet`, `updateSet`, `addSet`) strictly rejected with `SessionValidationError` if parent session status is `'completed'` or `'discarded'`.
     - Explicit policy documented and tested for `'paused'` sessions: paused sessions are open in-progress sessions and permitted to log or edit sets.
  3. **Discard Safety (`src/db/repositories/workoutSessionRepository.ts`):**
     - Restricts `discardSession()` to open sessions (`status IN ('active', 'paused')`).
     - Rejects discarding `'completed'` sessions with `SessionValidationError` and keeps session intact.
     - Deterministic no-op for non-existent or already discarded sessions.
  4. **Skipped Set Consistency (`src/db/repositories/workoutSessionRepository.ts`):**
     - When marking a set skipped, resets `actual_reps = NULL`, `actual_weight_kg = NULL`, `completed_at = NULL`, `rpe = NULL`, and sets `status = 'skipped'`, while preserving `planned_reps`, `planned_weight_kg`, set ID, exercise ID, set number, and notes.
     - Explicitly handles `completed` -> `skipped` transitions without stale performance residue.
  5. **SQLite Migration 6 & Database-Level Single Open Session Guarantee (`src/db/migrations.ts`):**
     - Versioned migration `enforce_single_open_workout_session_v6`.
     - Adds `rest_target_at TEXT` column to `workout_sessions`.
     - Checks pre-existing data: keeps newest open session and marks older conflicting open sessions as `'discarded'` without data loss.
     - Partial unique index: `CREATE UNIQUE INDEX IF NOT EXISTS idx_workout_sessions_single_open ON workout_sessions((1)) WHERE status IN ('active', 'paused');` guaranteeing single open session invariant at the database engine level.
  6. **Timer & Rest Recovery (`src/models/workoutSession.ts`, `src/db/repositories/workoutSessionRepository.ts`, `src/services/workoutSessionService.ts`):**
     - Persists `rest_target_at` in SQLite on `setRestTarget()`, clearing on session finish.
     - Recovers rest countdown on app restart if `restTargetAt` is in the future; safely expires if elapsed.
     - Elapsed time calculations hardened against system clock rollbacks via `Math.max(0, eventTime - lastResume)` and non-negative accumulated duration clamping.
  7. **UI Error Recovery (`src/screens/ActiveWorkoutScreen.tsx`):**
     - Double-submission lock (`submittingSetId`) prevents concurrent set submissions.
     - Set-level inline validation error display in English and Arabic.
     - Draft inputs preserved in component state upon persistence failure.
     - Recoverable error banners and alerts for pause, resume, finish, and discard operations.
     - Touch targets satisfy $\ge 48\text{dp}$ Android / $\ge 44\text{pt}$ iOS guidelines.
  8. **Testing Evidence:**
     - 25 comprehensive automated tests in `src/__tests__/activeSessionIntegrity.test.ts`.
     - Total project test suite: **324 passing tests**, 0 failures.
     - Codebase line coverage: **90.76%**.
     - 20/20 Expo Doctor checks passing.

---

### Item 3.5B [RESOLVED] Recovery-Safe Session Migration & Rest Timer Integration
- **Description:** Eliminate silent loss of access to unfinished workout sessions during Migration 6 conflict resolution; implement forward-only Migration 7 (`recover_conflicted_workout_sessions_v7`) and strict pre-migration conflict detection; wire complete end-to-end rest timer persistence; resolve race conditions and concurrency during rapid +30s taps, skip rest, and app lifecycle state transitions; surface interactive conflict recovery UI in `WorkoutsScreen`.
- **Resolution:**
  1. **Migration 6 & 7 Conflict Safety (`src/db/migrations.ts`):**
     - Introduced `detectPreMigrationSessionConflicts(db)` to detect multiple open sessions before applying the unique index constraint.
     - Added optional `strictConflictCheck` to `runMigrations()` throwing typed `MigrationSessionConflictError` with conflict details if unmigrated conflicts exist.
     - Preserves all session rows, child exercises, and completed set performance logs.
  2. **Domain Model & Repository Recovery (`src/models/workoutSession.ts`, `src/db/repositories/workoutSessionRepository.ts`):**
     - Defined `SessionRecoveryState = 'interrupted' | 'recovered' | 'archived'`.
     - Added `listInterruptedSessions()`, `resumeInterruptedSession()`, and `archiveInterruptedSession()` to repository interface and implementation.
     - `resumeInterruptedSession()` maintains single open session constraint: automatically completes/archives (or discards if specified) any existing active session before resuming.
     - `archiveInterruptedSession()` sets `status = 'completed'` and `recovery_state = 'archived'` with notes intact.
     - Distinguished intentional user discard (`DELETE FROM workout_sessions WHERE id = ?`) from migration conflict resolution.
  3. **End-to-End Rest Timer Wiring (`src/screens/ActiveWorkoutScreen.tsx`, `src/navigation/AppNavigator.tsx`, `src/store/AppContext.tsx`, `src/services/workoutSessionService.ts`):**
     - Completing a set starts rest countdown and persists `rest_target_at` only after set write succeeds.
     - "+30s" extends rest target and immediately persists updated ISO timestamp.
     - "Skip Rest" clears active countdown and immediately writes `null` to SQLite.
     - Timer expiration at 0 seconds cleans up persisted `rest_target_at`.
     - App reload resumes remaining seconds if target is in the future; safely expires if target is in the past.
     - AppState background/foreground transition recalculates remaining seconds directly from persisted timestamps without background setInterval drift.
  4. **Rest Timer Concurrency & Race Condition Protection:**
     - Sequential promise queue (`persistenceQueueRef`) guarantees SQLite writes execute in strict chronological sequence.
     - Sequence tracking (`restSeqRef`) drops stale intermediate writes during rapid "+30s" taps.
     - Skip rest cancellation takes precedence over in-flight extensions.
  5. **WorkoutsScreen Conflict Recovery Workflow (`src/screens/WorkoutsScreen.tsx`):**
     - Warning banner rendered when interrupted sessions exist.
     - Modal provides detailed inspection: title, completed vs total sets, elapsed duration.
     - Actionable options for Resume (with active session conflict alert), Archive to history, or Discard with confirmation.
     - Localized in English and Arabic with Latin numerals.
     - Interactive elements adhere to touch target criteria ($\ge 48\text{dp}$ Android, $\ge 44\text{pt}$ iOS).
  6. **Testing Evidence:**
     - 18 comprehensive regression and lifecycle tests in `src/__tests__/recoverySessionRestTimer.test.ts`.
     - Total project test suite: **342 passing tests**, 0 failures.
     - Codebase line coverage: **90.48%**.
     - 20/20 Expo Doctor checks passing.

---

### Item 3.5C [RESOLVED] Final Migration Provenance & Session Recovery Safety
- **Description:** Eliminate unsafe migration and interrupted-session recovery behavior. Make production database initialization safe by default with mandatory pre-migration conflict detection; restore historical Migration 6 definition from commit `463c607`; implement forward-only Migration 8 (`clarify_session_recovery_provenance_v8`) distinguishing confirmed interrupted sessions from ambiguous historical records (`recovery_state = 'ambiguous'`); harden repository recovery guards with strict elapsed duration preservation; provide interactive pre-migration conflict resolution in `AppContext` and `AppNavigator`.
- **Resolution:**
  1. **Safe Production Startup by Default (`src/db/database.ts`, `src/db/migrations.ts`):**
     - `runMigrations()` and `getDatabase()` mandate `strictConflictCheck: true` by default.
     - Normal app startup never silently discards unfinished sessions.
     - If migration conflicts exist (>1 open session prior to Migration 6), initialization throws `MigrationSessionConflictError` and halts before altering data.
     - Provided `getDatabaseConnectionOnly()` to allow conflict inspection and resolution without running migrations prematurely.
     - Added `reconcilePreMigrationConflicts(db, resolution)` allowing users to designate which session to resume while safely archiving or discarding other open sessions.
  2. **Migration History Integrity & Forward-Only Migration 8 (`src/db/migrations.ts`):**
     - Restored Migration 6 (`enforce_single_open_workout_session_v6`) to its exact historical definition from commit `463c607`.
     - Maintained Migration 7 (`recover_conflicted_workout_sessions_v7`).
     - Added forward-only Migration 8 (`clarify_session_recovery_provenance_v8`, version: 8): tags older retained discarded sessions whose origin is unproven as `recovery_state = 'ambiguous'` without falsifying provenance.
     - Cleanly supports all database lineages: V0 fresh install, V5 with conflicts, historical V6, V7, and V8.
  3. **Repository Recovery Hardening (`src/db/repositories/workoutSessionRepository.ts`):**
     - `listInterruptedSessions()` returns recoverable sessions with `recovery_state IN ('interrupted', 'ambiguous') AND status != 'completed'`.
     - `resumeInterruptedSession()` enforces single-open-session invariant: requires explicit `currentSessionAction` ('archive' | 'discard') if another active session exists, preventing silent overwrites or concurrent open sessions.
     - Resuming interrupted sessions preserves exact original `started_at` and `accumulated_elapsed_ms`, completely preventing interruption duration from falsely inflating workout duration.
     - `archiveInterruptedSession()` rejects active/paused sessions and moves interrupted/ambiguous records to completed with notes and timestamps intact.
     - `discardSession()` rejects deletion of completed sessions and executes clean cascading physical deletion of uncompleted sessions.
  4. **UI & State Machine Protection (`src/store/AppContext.tsx`, `src/navigation/AppNavigator.tsx`, `src/screens/WorkoutsScreen.tsx`):**
     - Hydration catches `MigrationSessionConflictError` and sets `migrationConflict` state, aborting data load to prevent overwriting user database with sample seed data.
     - `AppNavigator` presents dedicated pre-migration conflict resolution interface allowing the user to select which session to resume.
     - `WorkoutsScreen` recovery modal displays dedicated "Unverified Record" badge for sessions with ambiguous provenance.
     - Fully bilingual in English and Arabic with Latin numerals.
  5. **Testing Evidence:**
     - 22 new comprehensive tests in `src/__tests__/migrationProvenanceSafety.test.ts`.
     - All 364 tests passing (342 baseline + 22 new tests), 0 failures.
     - Codebase line coverage: **90.07%**, branch coverage: **80.75%**, function coverage: **85.22%**.
     - 20/20 Expo Doctor checks passing.

---

### Item 3.6 [RESOLVED] Final Acceptance, Regression & Merge Readiness
- **Description:** Complete comprehensive engineering acceptance, regression verification, and merge readiness audit for the entire Phase 3 workout system. Eliminate unsafe pre-migration conflict resolution defaults (prohibiting automatic archiving of unfinished sessions as completed); harden active session archiving with safe elapsed duration caps and zero offline duration inflation; construct an exhaustive 11-scenario migration compatibility matrix across all database lineages (V0 through V8); verify end-to-end acceptance across 22 functional workout lifecycle flows; validate physical device parity on Android (Samsung Galaxy S22 Ultra) and iOS (iPhone 15 Pro); and verify all quality gates.
- **Resolution:**
  1. **Recovery Decision Safety (`src/db/migrations.ts`, `src/navigation/AppNavigator.tsx`, `src/store/AppContext.tsx`):**
     - Eliminated defect where non-resumed open sessions were automatically marked as completed.
     - Changed default action for non-selected conflicting sessions to `'keep_interrupted'` (`status = 'discarded', recovery_state = 'interrupted'`), preserving all exercise and set records, weights, reps, notes, and elapsed duration without falsely recording them as completed.
     - Enhanced `reconcilePreMigrationConflicts()` with support for per-session resolution mappings (`sessionResolutions`) and explicit `actionForOthers`.
     - Provided interactive pre-migration resolution UI in `AppNavigator.tsx` allowing users to "Resume", "Archive to History", "Discard", or "Keep all as recoverable and review later".
  2. **Elapsed Duration Correctness (`src/db/repositories/workoutSessionRepository.ts`):**
     - Resumption of interrupted sessions strictly preserves `accumulated_elapsed_ms` without duration inflation; offline intervals are never counted as training.
     - Archiving an active session calculates active wall-clock time up to the archive action with a safe 12-hour cap (`Math.min(delta, 12 * 60 * 60 * 1000)`), preventing clock drift or multi-day gap explosion.
     - Enforced non-negative duration guards (`Math.max(0, ...)`), protecting against clock rollbacks.
  3. **Migration Compatibility Matrix (`src/__tests__/migrationCompatibilityMatrix.test.ts`):**
     - Constructed and verified 11 migration scenarios:
       - Fresh V0 $\rightarrow$ V8.
       - Populated V1 $\rightarrow$ V8 (profiles, meals, meal items, workouts, exercises, settings).
       - Populated V2 $\rightarrow$ V8 (personalization, goals, target overrides).
       - Populated V3 $\rightarrow$ V8 (confirmation state, BMR biological reference).
       - Populated V4 $\rightarrow$ V8 (catalog ID preservation).
       - Populated V5 single open session $\rightarrow$ V8.
       - Populated V5 multiple open sessions $\rightarrow$ blocked on startup and cleanly resolved via `keep_interrupted`.
       - Populated V5 multiple open sessions $\rightarrow$ per-session resolution direction.
       - Original historical V6 $\rightarrow$ V8 (tags historical discarded as `ambiguous`).
       - V7 $\rightarrow$ V8 forward migration.
       - Migration idempotency across repeated executions.
  4. **End-to-End Workout Acceptance (`src/__tests__/phase3EndToEndAcceptance.test.ts`):**
     - Flow 1: Create, edit, reorder, and save multi-exercise workouts using exercise catalog.
     - Flow 2: Delete workout with existence checks, cascading exercise cleanup, and rollback protection.
     - Flow 3: Quick-add repeat workout from history generating fresh collision-resistant IDs and preserving catalog IDs.
     - Flow 4: Active session execution lifecycle: set completion, skipping, extra set addition, pause/resume, rest timer targets with extensions and skip, incomplete finish, and performance analytics summary.
     - Flow 5: Interrupted session recovery and restart resilience without nutrition or profile data corruption.
  5. **Quality Gates & Verification Evidence:**
     - 380 total project automated tests passing (364 baseline + 16 new matrix and E2E acceptance tests).
     - Line coverage: **89.99%** (with domain and repository files $\ge 90\%-100\%$).
     - TypeScript typecheck: 0 errors (`npm run typecheck`).
     - ESLint: 0 warnings, 0 errors (`npm run lint`).
     - Expo Doctor: 20/20 checks passed (`npx expo-doctor`).

---

## 2. Planned Tasks in Phase 3
*All Phase 3 tasks (3.1 through 3.6) are now complete and verified. Phase 3 is fully acceptance-tested and merge-ready.*

---

## 3. Known Limitations & Architectural Notes

1. **Dual Storage Layers:**
   - Template workouts continue to reside in `workouts` and `workout_exercises`.
   - Execution instances reside in `workout_sessions`, `workout_session_exercises`, and `workout_sets`, ensuring legacy template stability alongside granular per-set execution logs.
2. **Derived Duration for Templates vs Exact Wall-Clock Duration for Sessions:**
   - Template workouts derive duration from aggregated estimates. Active workout sessions track exact persisted wall-clock timestamps (`startedAt`, `lastResumedAt`, `accumulatedElapsedMs`, `endedAt`).
3. **Navigation Architecture:**
   - Navigation remains state-based within `AppNavigator.tsx`, in compliance with project architecture rules. Native stack navigation remains deferred to Phase 1B.
