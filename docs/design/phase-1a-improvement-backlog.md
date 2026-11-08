# Qooti Phase 1A UI/UX Improvement Backlog

**Version:** 1.0.0  
**Status:** Approved for Implementation  
**Derived From:** `phase-1a-uiux-audit.md`  
**Execution Phase:** Phase 1A (Native UI/UX Polish & Platform Alignment)  

---

## 1. Architectural Strategy & Design System Enhancements

### 1.1 Guiding Principles
- **No Third-Party Component Libraries:** Avoid introducing heavy UI kits (such as React Native Paper or NativeBase). Continue extending Qooti's lightweight, battle-tested native styling primitives.
- **Component Consolidation:** The unmounted prototype screens and duplicate components in `src/screens/<subfolder>` and `src/components/common` should be cleaned up or selectively migrated into the active component directory.
- **Platform-Adaptive Primitives:**
  - `AppButton`: Add `android_ripple` on Android while retaining smooth opacity feedback on iOS.
  - `AppInput`: Add focus state management, accessible labeling, and inline error text support.
  - `BottomTabs`: Add platform-aware bottom safe-area insets to prevent Android 3-button navigation overlaps.

---

## 2. Prioritized Epics & Work Items

### Epic 1: Navigation Ergonomics & System Integration

#### Item 1.1 [P1] Android 3-Button Navigation Bar Clearance in BottomTabs
- **Affected Files:** `src/components/BottomTabs.tsx`, `src/components/bottomTabStyles.ts`
- **Description:** Adjust the bottom offset of `BottomTabs` so it respects the full `insets.bottom` on Android devices with 3-button navigation enabled, while preserving the sleek floating pill on gesture navigation and iOS.
- **Implementation:**
  ```typescript
  const bottomOffset = Platform.select({
    ios: Math.max(insets.bottom - 8, 2),
    android: insets.bottom > 0 ? insets.bottom + 4 : 12,
  });
  ```
- **Acceptance Criteria:**
  1. On Android with 3-button navigation, bottom tabs float cleanly above the system bar with at least 8dp clearance.
  2. On Android with gesture navigation, bottom tabs float 12dp above the gesture bar.
  3. On iOS with Home Indicator, bottom offset remains `Math.max(insets.bottom - 8, 2)`.
  4. Tab switching remains responsive across all 5 tabs in both English and Arabic.

#### Item 1.2 [P2] iOS Interactive Edge-Swipe Back Navigation
- **Affected Files:** `src/navigation/AppNavigator.tsx`
- **Description:** Enable native swipe-from-left-edge to go back on iOS when inside detail or sub-screens (`mealDetails`, `workoutDetails`, `addMeal`, `addWorkout`, `settings`).
- **Acceptance Criteria:**
  1. Swiping from the left edge on iOS returns to the parent tab.
  2. Android hardware back button and system back gesture continue to work seamlessly.
  3. No blank screens or unmounted state loops.

---

### Epic 2: Form & Input Ergonomics

#### Item 2.1 [P1] Keyboard Avoidance & Dismissal for Add Meal & Add Workout
- **Affected Files:** `src/screens/AddMealScreen.tsx`, `src/screens/AddWorkoutScreen.tsx`
- **Description:** Wrap form contents in a responsive keyboard-avoiding container so that all inputs and the primary Save button remain visible and accessible when the virtual keyboard is active.
- **Implementation:**
  ```tsx
  <KeyboardAvoidingView
    style={{ flex: 1 }}
    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
  >
    <ScrollView keyboardShouldPersistTaps="handled">
      ...
    </ScrollView>
  </KeyboardAvoidingView>
  ```
- **Acceptance Criteria:**
  1. Tapping on the lowest input field (fats/notes) automatically scrolls the field into view above the keyboard on both Android and iOS.
  2. Tapping outside an input dismisses the keyboard.
  3. The Save button can be reached without closing the keyboard manually.

#### Item 2.2 [P1] Compact Screen Layout Grid for Numeric Inputs
- **Affected Files:** `src/screens/AddMealScreen.tsx`, `src/screens/AddWorkoutScreen.tsx`
- **Description:** Fix flex wrapping of the three adjacent macro inputs (`protein`, `carbs`, `fats`) on screens 360dp–375dp wide.
- **Acceptance Criteria:**
  1. On 360dp screens, macro inputs render in a balanced 2x2 grid or an evenly divided 3-column row without awkward single-item line wraps.
  2. On standard screens (>390dp), inputs remain aligned in a single row.
  3. Layout mirrors cleanly in Arabic RTL without horizontal clipping.

#### Item 2.3 [P2] Input Focus States & Inline Validation
- **Affected Files:** `src/components/AppInput.tsx`, `src/screens/AddMealScreen.tsx`, `src/screens/AddWorkoutScreen.tsx`
- **Description:** Add visual focus border highlighting to `AppInput` and replace disruptive `Alert.alert` calls with inline error messaging.
- **Acceptance Criteria:**
  1. Focused input displays a 1.5px border in `colors.primary`.
  2. Missing required fields show an inline red error message below the field.
  3. No modal popup appears on empty save attempts.

---

### Epic 3: Touch Targets, Accessibility & Tactile Feedback

#### Item 3.1 [P2] Accessible Touch Targets for Header Actions and Filters
- **Affected Files:** `src/components/home/HomeHeader.tsx`, `src/components/home/PeriodSelector.tsx`, `src/components/home/LatestActivityList.tsx`
- **Description:** Expand touch targets to meet Apple HIG (44pt) and Android M3 (48dp).
- **Implementation:** Apply `hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}` and adjust `minHeight: 44` on `PeriodFilterButton`.
- **Acceptance Criteria:**
  1. `HomeHeader` action button has an effective hit area of at least 44x44pt / 48x48dp.
  2. `PeriodFilterButton` touch height is at least 44dp.
  3. `LatestActivityList` header action has an effective hit area of at least 44x44pt / 48x48dp.

#### Item 3.2 [P2] Native Material Ink Ripple on Android
- **Affected Files:** `src/components/AppButton.tsx`, `src/components/MealCard.tsx`, `src/components/WorkoutCard.tsx`, `src/screens/SettingsScreen.tsx`
- **Description:** Provide native Android ink ripple feedback on `Pressable` components while maintaining iOS opacity dimming.
- **Implementation:**
  ```tsx
  android_ripple={Platform.OS === 'android' ? { color: colors.cardMuted, borderless: false } : undefined}
  ```
- **Acceptance Criteria:**
  1. On Android, tapping buttons or cards produces a visible Material ink ripple.
  2. On iOS, buttons continue to dim with `opacity: 0.78`.

#### Item 3.3 [P2] Screen Reader Accessibility Audit & Semantics
- **Affected Files:** All active components in `src/components/*`
- **Description:** Add missing `accessibilityLabel`, `accessibilityHint`, and `accessibilityState` across icon buttons, form fields, and selection options.
- **Acceptance Criteria:**
  1. TalkBack (Android) and VoiceOver (iOS) announce meaningful labels for all interactive controls.
  2. Selected options in `SettingsScreen` and `DateSelector` announce their selected state.
  3. Form inputs announce their corresponding field label.

---

### Epic 4: RTL Alignment & Empty State Polish

#### Item 4.1 [P2] OnboardingScreen RTL Text Alignment
- **Affected Files:** `src/screens/OnboardingScreen.tsx`
- **Description:** Enforce `activeTextAlign()` and `activeWritingDirection()` on title and body copy in `OnboardingScreen`.
- **Acceptance Criteria:**
  1. When Arabic is active, onboarding title and body text align right (RTL).
  2. When English is active, onboarding title and body text align left (LTR).

#### Item 4.2 [P3] Rich Empty States for Meals and Workouts
- **Affected Files:** `src/screens/MealsScreen.tsx`, `src/screens/WorkoutsScreen.tsx`
- **Description:** Replace plain text messages with a branded empty state (icon, friendly message, and prominent "Add Meal" / "Add Workout" button).
- **Acceptance Criteria:**
  1. Empty meals list displays a styled illustration/icon, clear explanation, and actionable button.
  2. Empty workouts list displays an exercise illustration/icon and actionable button.

---

## 3. Recommended Implementation Roadmap for Task 1A.2

To ensure safety, stability, and zero regressions, the implementation must proceed in focused batches:

- **Batch 1 (Immediate Priority — Navigation & Forms — Completed in Task 1A.2):**
  - Item 1.1: [RESOLVED] Android 3-Button Navigation Bar Clearance in `BottomTabs.tsx`
  - Item 2.1: [RESOLVED] Keyboard Avoidance & Dismissal in `AddMealScreen.tsx` & `AddWorkoutScreen.tsx`
  - Item 2.2: [RESOLVED] Compact Screen Layout Grid for Numeric Inputs
  - Item 4.1: [RESOLVED] `OnboardingScreen.tsx` RTL Text Alignment

- **Batch 2 (Tactile & Visual Polish — Completed in Task 1A.3):**
  - Item 3.1: [RESOLVED] Accessible Touch Targets for Header Actions and Filters (`HomeHeader`, `PeriodSelector`, `LatestActivityList`)
  - Item 3.2: [RESOLVED] Native Material Ink Ripple on Android (`AppButton`, `MealCard`, `WorkoutCard`, `PeriodSelector`, `LatestActivityList`)
  - Item 2.3: [RESOLVED] Input Focus States & Inline Validation Presentation (`AppInput` focus border, error text, helper text, accessible states)
  - Item 3.3: [RESOLVED] Screen Reader Accessibility Audit & Semantics (`accessibilityRole`, `accessibilityLabel`, `accessibilityState`)
  - Item 4.2: [RESOLVED] Rich Empty States for Meals and Workouts (`EmptyState.tsx`, `MealsScreen.tsx`, `WorkoutsScreen.tsx`)

- **Batch 3 (Remaining Scope for Task 1A.4):**
  - Item 1.2: iOS Interactive Edge-Swipe Back Navigation in `AppNavigator.tsx`
  - Settings Screen Native Toggles and Feedback Polish
  - Prototype Screen Audit & Deprecation
