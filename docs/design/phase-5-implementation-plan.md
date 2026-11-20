# Phase 5 Implementation Plan: Body Tracking & Analytics Architecture

- **Document Version:** 1.0.0
- **Status:** Approved Engineering Roadmap
- **Date:** November 2026
- **Target Branch:** `dev/phase-5-body-tracking`
- **Scope:** 7 Engineering Milestones (Task 5.0 to Task 5.6)

---

## 1. Phase 5 Architecture Objectives

1. **Eliminate Persistence Hazards:** Eradicate the destructive `saveAllProgress` whole-table wipe pattern in favor of atomic, granular SQLite operations (`insertBodyWeightEntry`, `updateBodyWeightEntry`, `deleteBodyWeightEntry`, `insertBodyMeasurementEntry`, etc.).
2. **Normalized Biometric Schema:** Introduce forward-only SQLite Migration 16 (`add_body_tracking_and_biometrics_v16`) providing dedicated tables for body weight history, body measurements (circumferences), body composition, and progress photos.
3. **Data Preservation & Honest Semantics:** Safely backfill legacy `progress_entries` where `weight_kg > 0` into the new weight table. Treat missing circumferences as explicit `null` rather than fabricating zero readings.
4. **Multiple Daily Weigh-Ins:** Support timestamped weigh-ins (`date` + `time`) disambiguating morning fasted, post-workout, and evening measurements.
5. **Scientifically Honest Analytics:** Deliver 7-day rolling moving averages (EMA/SMA) to smooth daily water and glycogen fluctuations without masking genuine trends; time-range windows (`7d`, `30d`, `90d`, `1y`, `all`); goal delta projections; and anatomical ratios (Waist-to-Hip, Waist-to-Height).
6. **Local-First Progress Photos & Privacy:** Persist progress photos strictly in the private app sandbox with relative file URIs, pose categorization (`front`, `side`, `back`), comparison sets, and safe physical unlinking upon deletion.
7. **Bilingual Parity & Accessibility:** Full Arabic (`ar-SA-u-nu-latn`) and English (`en`) layout symmetry, high-contrast themes (WCAG 2.1 AA), TalkBack/VoiceOver accessible chart alternatives, and minimum $\ge 48\text{dp}$ touch targets.

---

## 2. Phase 5 Task Dependency Graph

```
[ Task 5.0: Body Tracking Architecture Audit & Blueprint ] ────────► (COMPLETE)
       │
       ▼
[ Task 5.1: Migration 16 & Normalized Biometric Storage ] ────────► (Database & Repositories)
       │
       ▼
[ Task 5.2: Body Weight Logging, History & Strict Validation ] ───► (Weight CRUD & Profile Sync)
       │
       ▼
[ Task 5.3: Body Measurements & Circumference Tracking ] ────────► (Circumference CRUD & Ratios)
       │
       ▼
[ Task 5.4: Biometric Analytics, Moving Averages & Charting ] ───► (Trend Smoothing & Filters)
       │
       ▼
[ Task 5.5: Progress Photos & Visual Comparison ] ───────────────► (Local Media & Slider)
       │
       ▼
[ Task 5.6: Final Acceptance, Full Regression & Merge Readiness ] ► (Verification & PR Ready)
```

---

## 3. Detailed Task Specifications

### Task 5.0: Body Tracking & Analytics Architecture Audit (Completed)
- **Goal:** Full audit of existing `ProgressEntry`, `progressRepository`, `ProgressScreen`, and persistence systems.
- **Deliverables:**
  - `docs/design/phase-5-body-tracking-architecture-audit.md`
  - `docs/design/phase-5-implementation-plan.md`
  - `docs/design/phase-5-acceptance-matrix.md`
  - Updated `docs/design/qooti-roadmap.md`.
- **Quality Gates:** 773 baseline tests passing, 0 TypeScript errors, 0 ESLint warnings, 20/20 Expo Doctor checks.

---

### Task 5.1: Migration 16 & Normalized Biometric Storage Architecture (Completed)
- **Goal:** Design and execute forward-only Migration 16 (`add_body_tracking_and_biometrics_v16`) without altering Migrations 1–15.
- **Key Deliverables:**
  - Create SQLite tables:
    - `body_weight_entries` (id, date, time, weight_kg, notes, source, created_at, updated_at).
    - `body_measurement_entries` (id, date, time, chest_cm, waist_cm, hips_cm, left_arm_cm, right_arm_cm, left_thigh_cm, right_thigh_cm, left_calf_cm, right_calf_cm, shoulders_cm, neck_cm, notes, created_at, updated_at).
    - `body_composition_entries` (id, date, time, body_fat_percentage, skeletal_muscle_mass_kg, bone_mass_kg, body_water_percentage, method, notes, created_at, updated_at).
    - `progress_photos` (id, date, time, relative_path, pose, weight_entry_id, notes, is_favorite, created_at, updated_at).
  - Non-destructive legacy migration: backfill `body_weight_entries` from `progress_entries` where `weight_kg > 0`.
  - Concrete repositories:
    - `SQLiteBodyWeightRepository` implementing `BodyWeightRepository` with atomic CRUD.
    - `SQLiteBodyMeasurementRepository` implementing `BodyMeasurementRepository`.
    - `SQLiteBodyCompositionRepository` implementing `BodyCompositionRepository`.
    - `SQLiteProgressPhotoRepository` implementing `ProgressPhotoRepository`.
  - Elimination of `DELETE FROM progress_entries;` table wipe and adoption of row-level progress persistence.
  - Complete domain models and boundary validation in `src/models/biometrics.ts`.
- **Verification Suite:** Migration upgrade tests (V0 $\rightarrow$ V16, V15 $\rightarrow$ V16), rollback tests, data backfill verification (790 passing tests, 90.60% coverage).

---

### Task 5.2: Body Weight Logging, History & Strict Validation
- **Goal:** Build the primary weight logging workflow with strict input validation, multi-entry per day support, and profile synchronization.
- **Key Deliverables:**
  - `AddBodyWeightModal`: Bottom sheet modal with strict decimal validation ($10.0\text{ kg} \le W \le 500.0\text{ kg}$), date picker, time picker, notes, and unit toggle (`kg` / `lb`).
  - `WeightHistoryList`: Chronological list of weigh-ins grouped by date, showing diurnal changes (e.g., morning 74.2 kg vs. evening 74.8 kg).
  - Edit & Delete Weight Entry: Row-level editing and deletion with confirmation alert.
  - Profile Synchronization Service: Updates `profile.weightKg` to the latest valid weigh-in, and vice versa.
- **Verification Suite:** Unit validation tests, unit conversion accuracy tests, edit/delete persistence tests across cold app restarts.

---

### Task 5.3: Body Measurements & Circumference Tracking
- **Goal:** Enable comprehensive anatomical circumference tracking with honest missing-value semantics.
- **Key Deliverables:**
  - `AddBodyMeasurementModal`: Input form for chest, waist, hips, biceps/arms, thighs, calves, shoulders, neck ($10.0\text{ cm} \le C \le 300.0\text{ cm}$).
  - Explicit Nulls: Empty fields remain `null`; never coerced to 0 cm.
  - Measurement History & Delta Card: Compares latest measurements against starting baseline or previous measurement.
  - Anatomical Ratios: Calculates Waist-to-Hip Ratio (WHR) and Waist-to-Height Ratio (WHtR) with neutral health benchmarks.
- **Verification Suite:** Null-preservation tests, ratio calculation edge cases, RTL display symmetry.

---

### Task 5.4: Biometric Analytics, Moving Averages & Charting (COMPLETED)
- **Goal:** Implement smoothed weight trend charts and multi-period analytics.
- **Key Deliverables:**
  - Time-Range Filter Chips: `7d`, `30d`, `90d`, `1y`, `all`.
  - 7-Day Rolling Moving Average (EMA/SMA): Smoothes out fluid retention noise without point fabrication.
  - Sparse Data Handling: Handles missing days gracefully without fabricating data points.
  - Velocity & Goal Card: Shows weekly rate of change ($\Delta\text{kg/week}$), remaining delta to goal, and progress percentage.
  - Interactive Charts: `WeightTrendChart` and `BodyMeasurementTrendChart` with touch inspection.
  - Accessible Chart Alternative: TalkBack and VoiceOver detailed descriptive summaries.
- **Verification Suite:** 27 unit and component integration tests, 899 total passing tests, 90.90% line coverage, 20/20 Expo Doctor checks.

---

### Task 5.5: Progress Photos & Visual Comparison
- **Goal:** Private, on-device progress photo tracking with side-by-side comparison.
- **Key Deliverables:**
  - Photo Attachment Modal: Native image picker (camera or gallery), pose categorization (`front`, `side`, `back`), optional linked weight entry.
  - Private Sandbox Storage: Copies images to `FileSystem.documentDirectory + 'progress_photos/'` using relative paths.
  - Visual Comparison Slider: Side-by-side or split slider comparing "Before" and "After" photos of the same pose.
  - Safe Deletion: Unlinks physical image file when photo entry is deleted from SQLite.
- **Verification Suite:** Path resolution across mock reloads, image deletion cleanup tests, pose filter tests.

---

### Task 5.6: Final Acceptance, Full Regression & Merge Readiness
- **Goal:** Comprehensive end-to-end regression across all 5 phases.
- **Key Deliverables:**
  - 18-step migration upgrade matrix from V0 through V16.
  - End-to-end user journeys (weight log, edit, delete, measurement log, photo attachment, theme switch, language switch).
  - Quality gate execution: 0 TypeScript errors, 0 ESLint warnings, 100% passing tests, $\ge 90\%$ line coverage, 20/20 Expo Doctor checks.
  - Physical Android smoke verification on connected device.
  - Merge-readiness engineering report for PR into `main`.

---

## 4. Engineering Standards & Quality Checklist

Every task in Phase 5 must satisfy:
1. **Never edit historical Migrations 1–15.**
2. **Never delete whole tables on save (`saveAll*`).**
3. **Never coerce unmeasured metrics to zero.**
4. **Support bidirectional RTL/LTR parity and Latin digits (`ar-SA-u-nu-latn`).**
5. **Enforce minimum $\ge 48\text{dp}$ touch targets on Android and $\ge 44\text{pt}$ on iOS.**
6. **Ensure WCAG 2.1 AA color contrast across Light and Dark themes.**
7. **Ensure complete automated test coverage for every new repository, service, and utility.**
