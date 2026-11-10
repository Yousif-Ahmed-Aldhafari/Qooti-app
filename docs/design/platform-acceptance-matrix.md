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

---

## 3. Execution & Reporting Guidelines

1. **Evidence Standard:** No test in this matrix may be reported as `PASS` unless verified on an actual physical device or targeted emulator.
2. **Regression Rule:** Any change to navigation, theme tokens, or localization must re-run Matrix A, Matrix D, and Matrix E before release.
3. **Artifact Retention:** Screenshots and logs of physical verification must be referenced in completion reports.
