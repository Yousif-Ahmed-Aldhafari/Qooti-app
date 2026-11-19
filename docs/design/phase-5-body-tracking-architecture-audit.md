# Phase 5 Body Tracking & Analytics Architecture Audit

- **Document Version:** 1.0.0
- **Status:** Approved Architecture Baseline
- **Date:** November 2026
- **Branch:** `dev/phase-5-body-tracking`
- **Base Commit:** `9904a3a389556618cb06a100771e42c210847e3c` (Phase 4 Nutrition complete & merged into main)
- **Target Subsystem:** Biometrics, Body Weight, Body Circumferences, Progress Photos, Body Composition, and Historical Analytics

---

## 1. Executive Summary & Audit Baseline

Following the complete closeout and verification of Phase 4 (Nutrition & Meal Planning, Food Catalog with 150+ verified entries, Portion Scaling Engine, Multi-Item/Itemless Template Integrity, Unknown Macro Reconciliation, and Physical Android Verification) merged into `main` at commit `9904a3a`, this audit establishes the complete engineering baseline for **Phase 5: Body Tracking & Analytics**.

This document provides a comprehensive structural audit of all existing progress, biometric, workout, nutrition, and persistence systems in Qooti. It identifies structural technical debt, establishes canonical data models, details forward-only migration strategies, designs scientifically honest analytics formulas, and provides an end-to-end task roadmap.

In strict compliance with project governance:
- **No Phase 5 feature code has been implemented during Task 5.0.**
- **Migrations 1–15 remain strictly frozen and unmodified.**
- **`main` remains untouched.**

### 1.1 Verified Pre-Flight Environment
- **Active Branch:** `dev/phase-5-body-tracking` (cleanly tracking `origin/dev/phase-5-body-tracking`)
- **Starting HEAD SHA:** `9904a3a389556618cb06a100771e42c210847e3c`
- **Git Working Tree:** 100% clean
- **Baseline Test Suite:** **773 / 773 automated tests passing** across 31 test suites (0 failures, 0 skipped)
- **Code Coverage:** **90.82% overall line coverage** (`90.82% lines, 76.29% branches, 83.16% functions`)
- **TypeScript Typecheck:** **0 errors** (`tsc --noEmit`)
- **ESLint Quality Gate:** **0 warnings, 0 errors** (`eslint --max-warnings=0`)
- **Expo Doctor:** **20 / 20 health checks passed** (Expo SDK 58 clean compatibility)

---

## 2. Architectural Audit of Existing Systems

### 2.1 The Critical Persistence Anti-Pattern: Whole-Table Replacement (`saveAllProgress`)
The existing progress persistence layer suffers from the identical architectural vulnerability that afflicted Workouts in Phase 3 and Meals in Phase 4:

```ts
// src/db/repositories/progressRepository.ts (lines 62-84)
async saveAllProgress(entries: ProgressEntry[], txn?: IDatabase): Promise<void> {
  const target = txn || this.db;
  const now = new Date().toISOString();

  await target.withExclusiveTransactionAsync(async (t) => {
    await t.runAsync('DELETE FROM progress_entries;');

    for (const raw of entries) {
      const normalized = normalizeProgressEntry(raw);
      await t.runAsync(
        `INSERT INTO progress_entries (id, date, label, calories, workouts, weight_kg, steps, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
        normalized.id, normalized.date, normalized.label, normalized.calories,
        normalized.workouts, normalized.weightKg, normalized.steps, now
      );
    }
  });
}
```

In `src/store/AppContext.tsx` (lines 636–654):
```ts
useEffect(() => {
  if (!state.isReady || !isHydratedRef.current) return;
  saveProgressEntries(state.progressEntries)
    .catch((err) => { ... });
}, [state.isReady, state.progressEntries]);
```

**Severity: CRITICAL DATA LOSS RISK.**
1. Every state mutation to `progressEntries` issues a destructive `DELETE FROM progress_entries;`.
2. If an in-memory entry is dropped or if the app terminates mid-loop, historical progress data is wiped permanently.
3. Concurrent writes or background tasks can wipe newly committed rows.
4. Granular CRUD is non-existent: there is no `updateProgressEntry`, no `deleteProgressEntry`, and no row-level updates.

### 2.2 Conflation of Distinct Domains in `ProgressEntry`
The legacy `ProgressEntry` model attempts to track four orthogonal concepts in a single flat record:
```ts
// src/models/progress.ts
export type ProgressEntry = {
  id: string;
  date?: string;
  label?: string;
  calories: number;   // Aggregated daily nutrition
  workouts: number;   // Aggregated daily workout count
  weightKg: number;   // Biological body weight measurement
  steps?: number;     // Activity pedometer count
};
```

This conflation causes severe architectural friction:
- **Missing vs. Zero Ambiguity:** `weight_kg REAL NOT NULL DEFAULT 0` forces unmeasured days to record `weightKg: 0`. The database cannot tell whether a user weighed 0 kg (biologically impossible) or simply didn't weigh themselves.
- **Single Entry per Date Limitation:** The table uses `date TEXT NOT NULL` with an index, but human body weight fluctuates throughout the day (morning fasted vs. evening post-meal). Storing weight as a single daily flat attribute prevents tracking diurnal fluctuations or multiple weigh-ins.
- **Absence of Circumference Tracking:** No fields exist for chest, waist, hips, arms, thighs, calves, neck, or shoulders.
- **Absence of Visual Progress:** No support for progress photo attachments, pose categorization (front, side, back), or comparison workflows.
- **Absence of Body Composition:** No tracking for body fat percentage, lean mass, or water retention.

### 2.3 Profile vs. Progress Synchronization Disconnect
In `src/models/profile.ts`:
- `UserProfile` contains `weightKg: number` and `targetWeightKg?: number`.
- When a user updates their profile weight in `ProfileScreen` or `EditProfileScreen`, **no entry** is added to `progress_entries`.
- Conversely, when `ProgressScreen` renders the latest weight, it reads:
  ```ts
  value={`${latest?.weightKg ?? profile.weightKg} ${t('common.kg')}`}
  ```
- If `progress_entries` contains historical entries with `weightKg = 0` (due to workout-only logging), `latest.weightKg` resolves to `0 kg`, completely overriding the valid profile weight!

### 2.4 Date Attribution, Timezones & Midnight Rollover
- In `src/screens/ProgressScreen.tsx`, date aggregation uses `useLiveLocalDate(referenceDate, clock)`, correctly updating at midnight.
- However, `ProgressEntry` stores `date` as a naked string (`YYYY-MM-DD` or short day label like `'Fri'`), with no timestamp (`HH:mm`), no timezone offset, and no UTC provenance.
- For users traveling across timezones, measurements logged at 11:30 PM shift to the previous day or duplicate calendar days.

### 2.5 Privacy and Local-First Storage
- Qooti is a local-first, privacy-respecting fitness platform.
- Progress photos constitute highly sensitive biometric data.
- Storing photos with absolute filesystem paths breaks on iOS across app updates (container UUID rotation).
- Deleting a progress record without unlinking the underlying image file results in orphaned storage leaks on the user's physical device.

---

## 3. Canonical Phase 5 Data Architecture

To solve these architectural defects without breaking existing Phase 1–4 capabilities, Phase 5 will introduce **dedicated, normalized, domain-driven tables** while maintaining backward compatibility with legacy `progress_entries`.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Phase 5 Biometric Schema                        │
└────────────────────────────────────────────────────────────────────────┘
        │
        ├─────────────────────────────┬───────────────────────────┐
        ▼                             ▼                           ▼
┌─────────────────────────┐ ┌──────────────────────┐ ┌─────────────────────────┐
│   body_weight_entries   │ │body_measurement_entry│ │ body_composition_entry │
├─────────────────────────┤ ├──────────────────────┤ ├─────────────────────────┤
│ id (PK)                 │ │ id (PK)              │ │ id (PK)                 │
│ date (YYYY-MM-DD)       │ │ date (YYYY-MM-DD)    │ │ date (YYYY-MM-DD)       │
│ time (HH:mm)            │ │ time (HH:mm)         │ │ time (HH:mm)            │
│ weight_kg (REAL > 0)    │ │ chest_cm (REAL null) │ │ body_fat_pct (REAL null)│
│ notes (TEXT null)       │ │ waist_cm (REAL null) │ │ muscle_mass_kg (null)   │
│ source (manual/import)  │ │ hips_cm (REAL null)  │ │ bone_mass_kg (null)     │
│ created_at (ISO UTC)    │ │ arms_cm (REAL null)  │ │ water_pct (REAL null)   │
│ updated_at (ISO UTC)    │ │ thighs_cm (REAL null)│ │ method (caliper/dexa/..)│
└─────────────────────────┘ └──────────────────────┘ └─────────────────────────┘
        │                                                         │
        └──────────────────────────┬──────────────────────────────┘
                                   ▼
                      ┌──────────────────────────┐
                      │     progress_photos      │
                      ├──────────────────────────┤
                      │ id (PK)                  │
                      │ date (YYYY-MM-DD)        │
                      │ time (HH:mm)             │
                      │ relative_path (TEXT)     │
                      │ pose (front/side/back)   │
                      │ weight_entry_id (FK null)│
                      │ notes (TEXT null)        │
                      │ is_favorite (INTEGER 0/1)│
                      └──────────────────────────┘
```

### 3.1 Domain Model 1: Body Weight Entries (`body_weight_entries`)
Represents discrete, timestamped body weight observations.

```ts
export type WeightSource = 'manual' | 'profile_sync' | 'import' | 'legacy_migration';

export type BodyWeightEntry = {
  id: string;                    // Prefixed UUID: `bw_...`
  date: string;                  // Canonical local date: YYYY-MM-DD
  time: string;                  // Canonical local 24-hr time: HH:mm
  weightKg: number;              // Canonical storage in kilograms (> 0, <= 500)
  notes?: string | null;         // Optional context (e.g. "Morning fasted")
  source: WeightSource;          // Data provenance
  createdAt: string;             // ISO-8601 UTC timestamp
  updatedAt: string;             // ISO-8601 UTC timestamp
};
```

**Database DDL (Migration 16):**
```sql
CREATE TABLE IF NOT EXISTS body_weight_entries (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  weight_kg REAL NOT NULL CHECK(weight_kg > 0 AND weight_kg <= 500),
  notes TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_body_weight_date_time ON body_weight_entries(date DESC, time DESC);
```

### 3.2 Domain Model 2: Body Measurement Entries (`body_measurement_entries`)
Tracks anatomical circumferences in metric centimeters. Every measurement site is explicitly nullable; missing measurements remain `null` and are **never** stored as zero.

```ts
export type BodyMeasurementEntry = {
  id: string;                    // `bm_...`
  date: string;                  // YYYY-MM-DD
  time: string;                  // HH:mm
  chestCm?: number | null;
  waistCm?: number | null;
  hipsCm?: number | null;
  leftArmCm?: number | null;
  rightArmCm?: number | null;
  leftThighCm?: number | null;
  rightThighCm?: number | null;
  leftCalfCm?: number | null;
  rightCalfCm?: number | null;
  shouldersCm?: number | null;
  neckCm?: number | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
};
```

**Database DDL (Migration 16):**
```sql
CREATE TABLE IF NOT EXISTS body_measurement_entries (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  chest_cm REAL CHECK(chest_cm IS NULL OR (chest_cm >= 10 AND chest_cm <= 300)),
  waist_cm REAL CHECK(waist_cm IS NULL OR (waist_cm >= 10 AND waist_cm <= 300)),
  hips_cm REAL CHECK(hips_cm IS NULL OR (hips_cm >= 10 AND hips_cm <= 300)),
  left_arm_cm REAL CHECK(left_arm_cm IS NULL OR (left_arm_cm >= 5 AND left_arm_cm <= 150)),
  right_arm_cm REAL CHECK(right_arm_cm IS NULL OR (right_arm_cm >= 5 AND right_arm_cm <= 150)),
  left_thigh_cm REAL CHECK(left_thigh_cm IS NULL OR (left_thigh_cm >= 10 AND left_thigh_cm <= 200)),
  right_thigh_cm REAL CHECK(right_thigh_cm IS NULL OR (right_thigh_cm >= 10 AND right_thigh_cm <= 200)),
  left_calf_cm REAL CHECK(left_calf_cm IS NULL OR (left_calf_cm >= 5 AND left_calf_cm <= 150)),
  right_calf_cm REAL CHECK(right_calf_cm IS NULL OR (right_calf_cm >= 5 AND right_calf_cm <= 150)),
  shoulders_cm REAL CHECK(shoulders_cm IS NULL OR (shoulders_cm >= 10 AND shoulders_cm <= 300)),
  neck_cm REAL CHECK(neck_cm IS NULL OR (neck_cm >= 10 AND neck_cm <= 150)),
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_body_measurement_date_time ON body_measurement_entries(date DESC, time DESC);
```

### 3.3 Domain Model 3: Progress Photos (`progress_photos`)
Stores references to locally persisted photo files inside the application's private sandboxed document directory.

```ts
export type PhotoPose = 'front' | 'side' | 'back' | 'other';

export type ProgressPhoto = {
  id: string;                    // `photo_...`
  date: string;                  // YYYY-MM-DD
  time: string;                  // HH:mm
  relativePath: string;          // Sandbox-relative file path: 'progress_photos/photo_xyz.jpg'
  pose: PhotoPose;               // 'front' | 'side' | 'back' | 'other'
  weightEntryId?: string | null; // Optional link to associated weigh-in
  notes?: string | null;
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
};
```

**Database DDL (Migration 16):**
```sql
CREATE TABLE IF NOT EXISTS progress_photos (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  relative_path TEXT NOT NULL,
  pose TEXT NOT NULL DEFAULT 'front',
  weight_entry_id TEXT REFERENCES body_weight_entries(id) ON DELETE SET NULL,
  notes TEXT,
  is_favorite INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_progress_photos_date ON progress_photos(date DESC);
CREATE INDEX IF NOT EXISTS idx_progress_photos_pose ON progress_photos(pose);
```

### 3.4 Domain Model 4: Body Composition Estimates (`body_composition_entries`)
Supports optional estimation of body fat percentage, skeletal muscle mass, and water percentage with honest scientific categorization of estimation methodology.

```ts
export type CompositionMethod =
  | 'dexa'
  | 'calipers'
  | 'bioimpedance'
  | 'navy_tape'
  | 'manual_estimate'
  | 'unspecified';

export type BodyCompositionEntry = {
  id: string;                    // `bc_...`
  date: string;                  // YYYY-MM-DD
  time: string;                  // HH:mm
  bodyFatPercentage?: number | null;      // 3.0% - 60.0%
  skeletalMuscleMassKg?: number | null;   // kg
  boneMassKg?: number | null;             // kg
  bodyWaterPercentage?: number | null;    // %
  method: CompositionMethod;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
};
```

---

## 4. Forward-Only Migration 16 Strategy

### 4.1 Strict Migration Invariants
1. **Migrations 1–15 are frozen.** Never edit, reorder, or delete migrations in `src/db/migrations.ts`.
2. **New schema additions start at Version 16 (`add_body_tracking_and_biometrics_v16`).**
3. **Legacy Data Preservation:** The existing `progress_entries` table is retained. Existing rows with `weight_kg > 0` are safely migrated into `body_weight_entries` with source `'legacy_migration'`.
4. **Zero Weight Protection:** Legacy entries where `weight_kg = 0` (unrecorded weight on workout logs) are **ignored** during migration, completely preventing false zero-kilogram measurements in the new biometric history!
5. **Initial Profile Baseline:** If `user_profiles.weight_kg > 0` exists and no historical progress entry exists, a baseline entry is created with source `'profile_sync'`.

```sql
-- Migration 16 Data Backfill snippet:
INSERT OR IGNORE INTO body_weight_entries (id, date, time, weight_kg, notes, source, created_at, updated_at)
SELECT
  'bw_migrated_' || id,
  date,
  '12:00',
  weight_kg,
  'Migrated from historical progress entry',
  'legacy_migration',
  created_at,
  created_at
FROM progress_entries
WHERE weight_kg > 0;
```

---

## 5. Analytics & Visualization Architecture

### 5.1 Moving Averages & Fluctuations
Human scale weight fluctuates by $\pm 1.0\text{ to }2.5\text{ kg}$ daily due to water retention, hydration levels, glycogen stores, sodium intake, and digestive contents. Plotting raw daily measurements directly produces jagged, demotivating trend lines.

**Exponential Moving Average (EMA) Formula:**
For day $t$ with weight $W_t$ and smoothing factor $\alpha$:
$$\text{EMA}_t = \alpha \cdot W_t + (1 - \alpha) \cdot \text{EMA}_{t-1}$$
Where $\alpha = \frac{2}{N + 1}$. For a 7-day smoothing window ($N=7$), $\alpha \approx 0.25$.

**Simple Moving Average (SMA-7) for Sparse Data:**
When data is sparse (e.g., user weighs in 2–3 times a week), compute the 7-day rolling average over the sliding window $[d - 6, d]$:
$$\bar{W}_d = \frac{1}{|K_d|} \sum_{i \in K_d} W_i$$
Where $K_d$ is the set of days in $[d - 6, d]$ that possess at least one logged weigh-in. If $|K_d| = 0$, the trend indicates a data gap rather than fabricating points.

### 5.2 Time-Range Windows
Consistent with `workoutAnalytics.ts` and `nutrition.ts`, analytics will support standardized time windows:
- **`7d`:** Last 7 calendar days (immediate daily fluctuations and acute changes).
- **`30d`:** Last 30 calendar days (standard monthly progress).
- **`90d`:** Last 90 calendar days (quarterly macro trend and body recomposition).
- **`1y`:** Last 365 calendar days (long-term lifestyle change).
- **`all`:** All-time historical timeline since registration.

### 5.3 Weight Change Velocity & Goal Projections
- **Net Change:** $\Delta W = W_{\text{current}} - W_{\text{start}}$
- **Rate of Change (Weekly):**
  $$\text{Velocity} = \frac{\Delta W}{\text{Elapsed Days}} \times 7 \quad (\text{kg / week})$$
- **Target Comparison:**
  - Remaining weight to goal: $|W_{\text{current}} - W_{\text{target}}|$
  - Goal Completion Percentage:
    $$\text{Progress \%} = \begin{cases} 
      100\% & \text{if goal reached} \\
      \frac{W_{\text{start}} - W_{\text{current}}}{W_{\text{start}} - W_{\text{target}}} \times 100\% & \text{if } W_{\text{start}} \neq W_{\text{target}} \\
      100\% & \text{if } W_{\text{start}} = W_{\text{target}}
    \end{cases}$$
  - Guard against division by zero when $W_{\text{start}} = W_{\text{target}}$.
  - Cap cleanly at $100\%$ while displaying milestone badges if the target was exceeded.

### 5.4 Anatomical Ratios & Scientific Integrity
- **Waist-to-Hip Ratio (WHR):**
  $$\text{WHR} = \frac{\text{Waist (cm)}}{\text{Hips (cm)}}$$
  WHO Benchmarks: Healthy male $< 0.90$; Healthy female $< 0.85$.
- **Waist-to-Height Ratio (WHtR):**
  $$\text{WHtR} = \frac{\text{Waist (cm)}}{\text{Height (cm)}}$$
  Universal Benchmark: Keep waist to less than half your height ($\text{WHtR} < 0.50$).
- **Neutral, Non-Judgmental Language:** Never display shaming or diagnostic declarations. Frame metrics objectively: *"Within recommended health range"* or *"Above reference range"*.

---

## 6. Cross-Platform UI/UX, Accessibility & Localization

### 6.1 Dual-Platform Citizenship
- **Android:** Material Design 3 surface elevations, `android_ripple` touch feedback on list rows and buttons, standard 3-button navigation clearance ($\ge 48\text{dp}$ touch targets), and hardware Back button modal dismissal.
- **iOS:** Apple HIG system font metrics (SF Pro), smooth opacity dimming on press, swipe-to-dismiss gesture on modals, and safe area inset clearance for home indicators and Dynamic Island.

### 6.2 Bidirectional (RTL / LTR) Parity
- Full mirror symmetry for Arabic (`ar`) and English (`en`).
- Charts render chronologically from right-to-left in Arabic and left-to-right in English.
- Use `activeRowStyle()`, `activeTextAlign()`, and `activeWritingDirection()`.
- **Latin Numeral Preservation:** Format weights, dates, and measurements with Latin digits in Arabic (`ar-SA-u-nu-latn`, e.g. `74.5 كجم`, `2026-11-20`).

### 6.3 Universal Theme Support
- Full compliance with `light`, `dark`, and `system` modes.
- Dynamic tokens via `themeColors()`.
- Strict adherence to WCAG 2.1 AA contrast ($\ge 4.5:1$ for text, $\ge 3:1$ for interactive icons/controls).

### 6.4 Accessible Chart Alternatives
- Every visual chart component must provide an accessible text equivalent for TalkBack and VoiceOver:
  ```tsx
  accessibilityLabel={`${t('progress.weightTrend')}: ${trendSummaryText}`}
  ```
- Summary includes starting weight, ending weight, lowest, highest, net change, and date range.

---

## 7. Strict Input Validation Standards

Following the successful hardening in Phase 4 (`parseStrictNutrientInput`):
- **Weight Inputs:** Must be strictly positive ($10.0\text{ kg} \le W \le 500.0\text{ kg}$).
- **Circumference Inputs:** Must be strictly positive ($10.0\text{ cm} \le C \le 300.0\text{ cm}$).
- **Body Fat Inputs:** ($3.0\% \le \text{BF} \le 60.0\%$).
- **Strict Parsing Contract:**
  - Reject empty strings.
  - Reject `NaN`, `Infinity`, `-Infinity`.
  - Reject negative values.
  - Reject malformed strings (e.g. `"75..5"`, `"abc"`, `"--"`).
  - Support both comma and period decimal separators (`75.5` and `75,5`).
  - Safe conversion between metric (kg/cm) and imperial (lb/in) without cumulative rounding errors.

---

## 8. Summary of Technical Debt & Architectural Decisions

| Area | Current Baseline Issue | Phase 5 Architectural Remedy |
| :--- | :--- | :--- |
| **Persistence** | Destructive `DELETE FROM progress_entries` wipe pattern in `saveAllProgress`. | Granular row-level CRUD in `SQLiteBodyWeightRepository` and `SQLiteBodyMeasurementRepository`. |
| **Data Normalization** | Single flat `ProgressEntry` mixes weight, workouts, calories, and steps. | Domain-driven schema: `body_weight_entries`, `body_measurement_entries`, `progress_photos`, `body_composition_entries`. |
| **Missing Semantics** | `weight_kg` defaults to 0, polluting charts with false zero readings. | Required positive weight on `body_weight_entries`; explicit `null` for unmeasured circumferences. |
| **Time Granularity** | Naked date string without time prevents multiple entries on the same day. | Structured `date` (`YYYY-MM-DD`) + `time` (`HH:mm`) + UTC `created_at` timestamp. |
| **Profile Sync** | Profile weight update does not log progress; progress does not update profile. | Bi-directional synchronization service linking profile baseline and latest weight entry. |
| **Photo Privacy** | No photo support; potential absolute path breakages across app updates. | Sandboxed relative URI storage in private documents directory; physical file cleanup on delete. |
| **Migrations** | Migrations 1–15 must remain frozen. | Forward-only **Migration 16** (`add_body_tracking_and_biometrics_v16`) with non-destructive backfill. |

---

## 9. Conclusion & Next Step Authorization

The system architecture and existing code have been fully audited. All technical debt, persistence risks, and data preservation invariants are thoroughly mapped.

**Recommendation:** Proceed to **Task 5.1: Migration 16 & Normalized Biometric Storage Architecture**.
