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
       ├──► [ Phase 1B: Native Stack Navigation ] (Optional / Deferred Architectural Epic)
       │
       ▼
[ Phase 2: User Profiles & Personalization ] ───► (In Progress)
       │
       ▼
[ Phase 3: Complete Workout System + Edit/Delete ]
       │
       ▼
[ Phase 4: Nutrition & Meal Planning + Edit/Delete ]
       │
       ▼
[ Phase 5: Body Tracking & Analytics ]
       │
       ▼
[ Phase 6: AI Fitness Coach ]
       │
       ▼
[ Phase 7: Advanced Integrations ]
       │
       ▼
[ Phase 8: Production Testing & Launch ]
```

---

## 2. Detailed Phase Breakdown

### Phase 1: Architecture & Foundation Baseline [COMPLETED & MERGED]
- **Core Mission:** Robust SQLite persistence architecture, repository pattern, first-launch hydration, non-destructive migrations, dual-language translation engine (EN/AR), and Expo SDK 58 upgrade.
- **Milestone Outcome:** 100% verified SQLite durability, no sample data reseeding loops, automated test suite with isolated in-memory mocks, and green GitHub Actions CI.

### Phase 1A: Native UI/UX Polish, Accessibility & Dual-Platform Alignment [COMPLETED & MERGED]
- **Core Mission:** Apple HIG and Android Material Design 3 parity, measured safe-area bottom navigation clearances, form ergonomics (`KeyboardAvoidingView`, tap-to-dismiss, inline validation), responsive macro input grids (320dp–430dp), platform touch feedback (ink ripple vs smooth opacity), composite screen reader announcements, and canonical RTL symmetry.
- **Milestone Outcome:** 99 passing automated tests, 93.5%+ coverage, 13/13 physical Android & iPhone acceptance checks verified.

### Phase 1B: Native Stack Navigation Migration [OPTIONAL / DEFERRED ARCHITECTURAL EPIC]
- **Core Mission:** Migrate sub-screens from state-based navigation to `@react-navigation/native-stack`.
- **Target Deliverables:**
  - Hardware-accelerated UIKit interactive edge swipe-back with native spring physics on iOS.
  - Native Android predictive back gesture animation support.
  - Symmetrical right-edge swipe-back in Arabic (RTL).
  - Dirty-state form protection guards (`beforeRemove`) to prevent accidental dismissal during entry.
  - Architectural blueprint documented in [`docs/design/native-navigation-migration-assessment.md`](file:///mnt/samsungSSD/Projects/Qooti-app/docs/design/native-navigation-migration-assessment.md).
- **Status:** Non-blocking deferred enhancement. Phase 1A state-based navigation operates smoothly and passed physical device acceptance.

### Phase 2: User Profiles & Personalization [IN PROGRESS]
- **Core Mission:** Complete personal profile architecture, clinically-backed caloric and macronutrient targets, fitness goals, training background, workout/equipment preferences, and dietary customization.
- **Key Deliverables:**
  - **Task 2.1 [COMPLETED]:** User Profile & Personalization Architecture. Domain model extensions, non-destructive SQLite Migration 2 (`add_profile_personalization_v2`), Mifflin-St Jeor BMR, PAL activity multipliers for TDEE, goal-adjusted calorie targets, macronutrient distributions, and hydration/sleep recommendations.
  - **Task 2.1A [COMPLETED]:** Personalization Engine Safety & Data Integrity. Adult eligibility guard (18+), adolescent protection, BMR biological reference transparency, caloric safety floor, and Atwater factor macro balance.
  - **Task 2.1B [COMPLETED]:** Migration Compatibility & Recommendation Contract. Versioned SQLite Migration 3 (`add_profile_confirmation_and_bmr_ref_v3`), robust legacy migration upgrade matrix, and recommendation state machine.
  - **Task 2.2 [COMPLETED]:** Interactive Personalization Onboarding & Profile UI. 5-step onboarding wizard, live biometric previews, profile editing, and custom target override management.
  - **Task 2.3 [COMPLETED]:** Daily Nutrition Targets & Dashboard Synchronization. Single shared target resolution contract (`resolveEffectiveNutritionTargets`), Home/Meals/Progress screen synchronization, and over-target remaining calculations.
  - **Task 2.4 [COMPLETED]:** Nutrition Target Integrity & Physical Device Acceptance. Precedence verification, fallback value safety (no fabricated percentages), MealDetailsScreen & ProfileScreen MacroCard target guard, historical period labeling, and 153 passing automated tests.
  - **Task 2.5 [COMPLETED / MERGE-READY]:** Final Personalization Acceptance & Merge Readiness. Comprehensive eligibility precedence audit, adolescent custom override guard (preserves values without application approval), Age 17 vs 18 boundary tests, 157 passing tests, and remote CI verification.

### Phase 3: Complete Workout System + Edit/Delete [PLANNED]
- **Core Mission:** Implement full lifecycle management for logged workouts, exercise items, and training progression.
- **Target Deliverables:**
  - **Workout Editing:** Edit workout title, duration, date, notes, and individual exercises (sets, reps, weight, duration, notes) with atomic SQLite transactions.
  - **Workout Deletion:** Platform-conforming deletion confirmation with cascade cleanup of child exercises and real-time dashboard recalculation.
  - **Exercise Catalog & Templates:** Exercise library, muscle group targeting, and quick-add from previous workout history.

### Phase 4: Nutrition & Meal Planning + Edit/Delete [PLANNED]
- **Core Mission:** Implement full lifecycle management for logged meals, food items, and nutrition planning.
- **Target Deliverables:**
  - **Meal Editing:** Edit meal title, timestamp, and food items (portion sizes, calories, macros) with atomic SQLite update transactions.
  - **Meal Deletion:** Platform-conforming deletion confirmation with cascade cleanup of child items and real-time calorie balance recalculation.
  - **Food Catalog & Custom Foods:** Expanded food database, custom recipe creator, and barcode scanning integration.

### Phase 5: Body Tracking & Analytics [PLANNED]
- **Core Mission:** Comprehensive biometric progression tracking and historical visualization.
- **Target Deliverables:**
  - Weight trends, moving averages, and body measurement logging (chest, waist, hips, arms).
  - Interactive multi-week / multi-month progress charts with time-range filtering (7d, 30d, 90d, 1y).
  - Progress photos comparison and body composition estimation.

### Phase 6: AI Fitness Coach [PLANNED]
- **Core Mission:** Intelligent, contextual training and nutrition guidance tailored to user biometrics and daily adherence.
- **Target Deliverables:**
  - Context-aware daily insights based on calorie and workout adherence.
  - Dynamic workout volume suggestions and recovery recommendations.
  - Conversational fitness assistant respecting local privacy and on-device storage.

### Phase 7: Advanced Integrations [PLANNED]
- **Core Mission:** Seamless ecosystem connectivity with health platforms and wearables.
- **Target Deliverables:**
  - Apple HealthKit integration (steps, active energy, workouts, weight).
  - Google Health Connect / Android Health Connect integration.
  - Wearable device sync and background activity tracking.

### Phase 8: Production Testing & Launch [PLANNED]
- **Core Mission:** End-to-end production hardening, automated CI/CD pipeline, app store asset preparation, and store deployment.
- **Target Deliverables:**
  - EAS production builds (AAB for Google Play Store, IPA for Apple App Store).
  - Automated smoke test suites and crash monitoring.
  - Store metadata, screenshots, privacy disclosures, and bilingual store listings (EN/AR).
