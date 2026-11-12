# Qooti Phase 2 User Profiles & Personalization Backlog

**Version:** 1.0.0  
**Status:** Active Tracking  
**Scope:** Phase 2 Execution, Verification Findings & Deferred Enhancements  

---

## 1. Resolved Tasks & Findings in Phase 2

### Item 2.1 [RESOLVED] Personalization Domain Models & Migration Architecture
- **Description:** Added personal attributes, activity level, dietary preference, fitness goals, and non-destructive SQLite migrations.
- **Resolution:** Implemented `UserProfile` model extensions, Migration 2 (`add_profile_personalization_v2`), and repository persistence.

### Item 2.1A [RESOLVED] Calculation Safety & Adolescent Guard
- **Description:** Adult recommendation engine must be guarded against invalid adolescent deficits, caloric floors, and Atwater factor macro balance.
- **Resolution:** Added `<18` unsupported status, 1200 kcal floor warning, Mifflin-St Jeor BMR midpoint labeling, and whole-gram macro reconciliation.

### Item 2.1B [RESOLVED] SQLite V2 Migration Backward Compatibility
- **Description:** Discovered potential upgrade discrepancy for previously-applied Migration 2 databases.
- **Resolution:** Added versioned Migration 3 (`add_profile_confirmation_and_bmr_ref_v3`), supporting fresh V1, existing V2, and current databases seamlessly.

### Item 2.2 [RESOLVED] Personalization Onboarding & Profile Editing UI
- **Description:** Deliver 5-step onboarding wizard and ProfileScreen attribute editing with custom target override capabilities.
- **Resolution:** Built multi-step wizard, interactive live recommendation preview, custom target toggle, and verified Expo SDK 58 compliance.

### Item 2.3 [RESOLVED] Shared Daily Target Resolution & Screen Synchronization
- **Description:** Implement single authoritative target resolver and synchronize Home, Meals, and Progress screens.
- **Resolution:** Built `resolveEffectiveNutritionTargets`, integrated across Home, Meals, MealDetails, and Progress screens with over-target remaining calculations.

### Item 2.4 [RESOLVED] Target Integrity, Fallback Safety & Physical Device Acceptance
- **Description:** Prevent fabricated target percentages in MealDetails and Profile when targets are unconfirmed; handle partial macro overrides; verify on Android and iOS.
- **Resolution:** Updated `MacroCard` to omit fake progress fills when `hasTarget` is false; added partial macro estimation in resolver; added historical period comparison labeling; added 9 acceptance regression tests (153 total passing).

### Item 2.5 [RESOLVED] Final Personalization Acceptance & Merge Readiness
- **Description:** Mandatory eligibility audit, adolescent custom override policy (preserves custom values without application approval), Age 17 vs 18 boundary tests, and remote CI verification.
- **Resolution:** Hardened `resolveEffectiveNutritionTargets` to enforce `hasApprovedTarget = false` on all custom overrides and adolescent profiles; attached pediatric guidance prompt to adolescent custom overrides; verified Home banner and Profile alert visibility; added 4 regression acceptance tests (157 total passing).

---

## 2. Deferred Architectural Enhancements & Non-Blocking Items

### Item 2.D1 [Phase 1B / Architectural Epic] Native Stack Navigation Migration
- **Description:** Migrate sub-screens to `@react-navigation/native-stack` for native iOS interactive swipe-back gesture physics.
- **Status:** Deferred to Phase 1B / post-Phase 2. Non-blocking; current state-based navigation passes all acceptance tests.

### Item 2.D2 [Phase 3 Epic] Workout Full Lifecycle Management
- **Description:** Edit and delete logged workouts, cascade deletion of exercise sets, template creation.
- **Status:** Assigned to Phase 3. Explicitly deferred; not implemented in Phase 2.

### Item 2.D3 [Phase 4 Epic] Nutrition & Meal Planning Full Lifecycle Management
- **Description:** Edit and delete logged meals, food catalog expansion, custom recipe creation.
- **Status:** Assigned to Phase 4. Explicitly deferred; not implemented in Phase 2.

### Item 2.D4 [Phase 5 Epic] Advanced Biometric Progression & Time-Range Charts
- **Description:** Multi-week/multi-month interactive progress charts, body circumference tracking, moving average weight trends.
- **Status:** Assigned to Phase 5.
