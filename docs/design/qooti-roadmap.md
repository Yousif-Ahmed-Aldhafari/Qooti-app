# Qooti Product & Engineering Roadmap

- **Version:** 1.0.0
- **Status:** Active Blueprint
- **Scope:** Architectural Roadmap & Feature Delivery Phases
- **Date:** November 2026

---

## 1. Phase Overview

```
[ Phase 1: Foundation Baseline ] ───────► (Complete & Merged into Main)
       │
       ▼
[ Phase 1A: Native UI/UX & A11y ] ─────► (Complete & Merged into Main)
       │
       ▼
[ Phase 1B: Native Stack Navigation ] ─► (Documented Architectural Epic)
       │
       ▼
[ Phase 2: Analytics & Profile Expansion ]
       │
       ▼
[ Phase 3: Workout Management & Full Lifecycle (Edit / Delete) ]
       │
       ▼
[ Phase 4: Meal & Nutrition Management Lifecycle (Edit / Delete) ]
       │
       ▼
[ Phase 5: Cloud Sync, Backup & Multi-Device Synchronization ]
```

---

## 2. Detailed Phase Breakdown

### Phase 1: Architecture & Foundation Baseline [COMPLETED]
- **Core Mission:** Robust SQLite persistence architecture, repository pattern, first-launch hydration, non-destructive migrations, dual-language translation engine (EN/AR), and Expo SDK 58 upgrade.
- **Milestone Outcome:** 100% verified SQLite durability, no sample data reseeding loops, automated test suite with isolated in-memory mocks, and green GitHub Actions CI.

### Phase 1A: Native UI/UX Polish, Accessibility & Dual-Platform Alignment [COMPLETED]
- **Core Mission:** Apple HIG and Android Material Design 3 parity, measured safe-area bottom navigation clearances, form ergonomics (`KeyboardAvoidingView`, tap-to-dismiss, inline validation), responsive macro input grids (320dp–430dp), platform touch feedback (ink ripple vs smooth opacity), composite screen reader announcements, and canonical RTL symmetry.
- **Milestone Outcome:** 99 passing automated tests, 93.5%+ coverage, 13/13 physical Android & iPhone acceptance checks verified.

### Phase 1B: Native Stack Navigation Migration [DOCUMENTED ARCHITECTURAL EPIC]
- **Core Mission:** Migrate sub-screens from state-based navigation to `@react-navigation/native-stack`.
- **Target Deliverables:**
  - Hardware-accelerated UIKit interactive edge swipe-back with native spring physics.
  - Native Android predictive back animation support.
  - Symmetrical right-edge swipe-back in Arabic (RTL).
  - Dirty-state form protection guards (`beforeRemove`) to prevent accidental dismissal during entry.
  - Architecture blueprint documented in [`docs/design/native-navigation-migration-assessment.md`](file:///mnt/samsungSSD/Projects/Qooti-app/docs/design/native-navigation-migration-assessment.md).

### Phase 2: Analytics, Goals & Profile Expansion [PLANNED NEXT]
- **Core Mission:** Expand user goal tracking, historical analytics, biometrics progression, and visual trend breakdowns.
- **Target Deliverables:**
  - Dynamic calorie & macronutrient target calculations based on user goal (cut, maintain, bulk).
  - Multi-week progress charts and weight trend analysis.
  - Prototype cleanup and legacy screen review.

### Phase 3: Workout Management & Full Lifecycle (Edit & Delete) [PLANNED]
- **Core Mission:** Implement full lifecycle management for logged workouts and exercise items.
- **Target Deliverables:**
  - **Workout Editing:** Edit workout title, duration, date, and individual exercises (sets, reps, weight, notes) with atomic SQLite update transactions.
  - **Workout Deletion:** Safe deletion modal/dialog with cascade cleanup of child exercises and real-time dashboard recalculation.
  - **Exercise Reordering & Custom Templates:** Quick-add from previous workout history.

### Phase 4: Meal & Nutrition Management Lifecycle (Edit & Delete) [PLANNED]
- **Core Mission:** Implement full lifecycle management for logged meals and food ingredients.
- **Target Deliverables:**
  - **Meal Editing:** Edit meal title, timestamp, and food items (portion sizes, calories, macros) with atomic SQLite update transactions.
  - **Meal Deletion:** Safe deletion modal/dialog with cascade cleanup of child items and real-time calorie balance recalculation.
  - **Custom Foods & Barcode Scanning Integration:** Nutrition database lookup.

### Phase 5: Cloud Sync, Backup & Multi-Device Synchronization [FUTURE]
- **Core Mission:** Encrypted cloud backup, remote database synchronization, and multi-device account recovery.
