# Qooti Cross-Platform UI/UX Comprehensive Audit

**Date:** November 8, 2026  
**Auditor:** Antigravity AI Engineering  
**Baseline Commit:** `d670589` (`dev/phase-1-foundation`)  
**Active Working Branch:** `phase/1a-native-uiux`  
**Framework:** Expo SDK 58 / React Native 0.88.1 / TypeScript 5.8  
**Platforms Audited:** Android (Material Design 3) & iOS (Apple Human Interface Guidelines)  
**Locales Audited:** English (LTR) & Arabic (RTL)  
**Themes Audited:** Light & Dark  

---

## 1. Executive Summary & Inventory

### 1.1 Architectural State of Screens
Our repository audit revealed an important structural distinction:
- **Active Mounted Screens (12 screens):** Managed directly by `AppNavigator.tsx` in `src/screens/*.tsx`. These form the live, production-tested runtime application.
- **Unmounted Prototype Screens (17 screens):** Stored in subdirectories (`src/screens/meals/*`, `src/screens/workouts/*`, `src/screens/auth/*`, `src/screens/dashboard/*`, `src/screens/settings/*`, `src/screens/onboarding/*`, `src/screens/splash/*`). These screens are **not imported or rendered by `AppNavigator.tsx`** and rely on an alternate component directory (`src/components/common/*`).

### 1.2 Screen Inventory Table

| # | Screen Name | File Path | Status in AppNavigator | Primary Components Used |
|---|---|---|---|---|
| 1 | `SplashScreen` | `src/screens/SplashScreen.tsx` | Mounted (boot & lang switch) | Brand icon, title, subtitle |
| 2 | `OnboardingScreen` | `src/screens/OnboardingScreen.tsx` | Mounted (initial setup) | Hero barbell circle, `AppCard`, `AppButton` |
| 3 | `HomeScreen` | `src/screens/HomeScreen.tsx` | Mounted (Main Tab 1) | `HomeHeader`, `PeriodSelector`, `CombinedProgressStatsCard`, `DailyGoalBanner`, `DateSelector`, `QuickActionCard`, `GoalProgressCard`, `LatestActivityList` |
| 4 | `MealsScreen` | `src/screens/MealsScreen.tsx` | Mounted (Main Tab 2) | `AppHeader`, `AppButton`, `MealCard` |
| 5 | `AddMealScreen` | `src/screens/AddMealScreen.tsx` | Mounted (Sub-screen) | `AppHeader`, `AppCard`, `AppInput`, `AppButton` |
| 6 | `MealDetailsScreen` | `src/screens/MealDetailsScreen.tsx` | Mounted (Sub-screen) | `AppHeader`, `MacroCard`, `AppCard` |
| 7 | `WorkoutsScreen` | `src/screens/WorkoutsScreen.tsx` | Mounted (Main Tab 3) | `AppHeader`, `AppButton`, `WorkoutCard` |
| 8 | `AddWorkoutScreen` | `src/screens/AddWorkoutScreen.tsx` | Mounted (Sub-screen) | `AppHeader`, `AppCard`, `AppInput`, `AppButton` |
| 9 | `WorkoutDetailsScreen` | `src/screens/WorkoutDetailsScreen.tsx` | Mounted (Sub-screen) | `AppHeader`, `StatCard`, `AppCard` |
| 10 | `ProgressScreen` | `src/screens/ProgressScreen.tsx` | Mounted (Main Tab 4) | `AppHeader`, `StatCard`, `AppCard` (weekly chart), `ProgressCard` |
| 11 | `ProfileScreen` | `src/screens/ProfileScreen.tsx` | Mounted (Main Tab 5) | `AppHeader`, `AppCard` (profile info), `StatCard`, `MacroCard`, `AppButton` |
| 12 | `SettingsScreen` | `src/screens/SettingsScreen.tsx` | Mounted (Sub-screen) | `AppHeader`, `AppCard`, Language option list, Theme option list |

---

## 2. Platform Comparison & Findings by Screen/Component

### 2.1 Navigation & Global Chroming

#### Component: `BottomTabs.tsx` & `bottomTabStyles.ts`
- **Material Design 3 Evaluation:** 
  - *Defect:* Android navigation bar clearance is severely broken when the device uses traditional 3-button navigation (Back / Home / Recents). Line 52 of `BottomTabs.tsx` sets:
    `const bottomOffset = Platform.OS === 'ios' ? Math.max(insets.bottom - 8, 2) : 4;`
    On Android devices with 3-button navigation, `insets.bottom` is ~48dp. Setting `bottom: 4` causes the bottom tabs to overlap directly with the Android system Back/Home buttons, creating mis-taps.
  - *Convention:* M3 navigation bars are typically 80dp high and anchored to the bottom edge with active pill indicators and text labels.
- **Apple HIG Evaluation:**
  - Floating pill aesthetic aligns with iOS glassmorphism.
  - Missing text labels: Apple HIG recommends text labels underneath icons in tab bars to avoid ambiguous glyph interpretation.
- **RTL & LTR Evaluation:** Correctly reverses tab visual order (`getTabOrder(language)`).
- **Touch Target:** 64dp height meets accessibility guidelines.

#### Component: `AppNavigator.tsx` (Back Navigation & Header)
- **Material Design 3 Evaluation:**
  - Uses `BackHandler` on Android to intercept hardware back presses:
    - On detail screens: routes back to current tab.
    - On non-Home main tabs: routes back to 'home'.
    - On 'home': allows OS default exit.
    This strictly complies with Android M3 back-stack expectations.
- **Apple HIG Evaluation:**
  - Sub-screens render an explicit top-left back pill (`<Pressable style={styles.backButton}>`).
  - *Defect:* iOS edge-swipe gesture (interactive pop gesture) is **not supported** because navigation is powered by a custom React state machine rather than `@react-navigation/native-stack`. Users expecting to swipe right from the left screen edge to go back on iOS are blocked.

---

### 2.2 Home & Dashboard Flow

#### Screen: `HomeScreen.tsx`
- **Layout & Visual Hierarchy:** High quality visual appeal with glassmorphic cards, donut charts, and quick-action cards.
- **Safe Area Insets:** Content `paddingBottom: 128` cleanly clears the floating bottom tab bar.
- **Touch Targets:**
  - `HomeHeader.tsx` action button (chat icon): Size is `40x40` (line 85). **Fails both Apple HIG (44pt) and Android M3 (48dp) minimum touch target requirements.**
  - `PeriodSelector.tsx` (`PeriodFilterButton`): `minHeight: 38` (line 88). Fails both 44pt and 48dp minimum requirements.
  - `LatestActivityList.tsx` heading action button: Size is `32x32` (line 92). Fails both 44pt and 48dp requirements.
- **Accessibility:**
  - `HomeHeader` action button has no `accessibilityLabel`.
  - `DateSelector` items have no `accessibilityState={{ selected }}`.
- **RTL Parity:** Header, activity lists, and date cards correctly mirror. Latin numerals are preserved in dates (`ar-SA-u-nu-latn`).

---

### 2.3 Form & Input Flow

#### Screens: `AddMealScreen.tsx` & `AddWorkoutScreen.tsx`
- **Keyboard Handling & Input Obstruction:**
  - *Defect:* Neither `AddMealScreen` nor `AddWorkoutScreen` implements `KeyboardAvoidingView` or keyboard dismissal on tap.
  - *Impact:* When the software keyboard opens on Android or iOS, the numeric inputs at the bottom (protein, carbs, fats, notes) and the primary "Save" button are completely hidden beneath the keyboard on standard and compact screens.
- **Responsive Layout & Wrapping:**
  - Line 61 of `AddMealScreen`:
    `<View style={[styles.row, activeRowStyle()]}>`
    `<AppInput ... style={styles.input} />` (where `input: { minWidth: 100, flex: 1 }`).
    On 360dp-width Android screens, 3 adjacent inputs of `minWidth: 100` plus 12dp gaps and 20dp screen padding require 364dp! This triggers unintended single-item wrapping, causing the "Fats" input to drop onto a second row in an asymmetrical, broken layout.
- **Touch Feedback & Visual States:**
  - `AppInput.tsx`: Has no visual focus state (border color does not change on `onFocus`), leaving users uncertain which field is active.
  - `AppInput.tsx`: Has no inline error state or helper text.
  - `AppButton.tsx`: Uses `opacity: 0.78` on press. Lacks Material Design ink ripple (`android_ripple`) on Android.
- **Validation Dialogs:**
  - Uses `Alert.alert` for missing required fields. Apple HIG and M3 recommend inline validation errors rather than disruptive native modal alerts for standard form entry.

---

### 2.4 Lists & Detail Screens

#### Screens: `MealsScreen.tsx` & `WorkoutsScreen.tsx`
- **List Ergonomics:** Smooth scrolling with `onScroll={handleBottomNavScroll}` dynamically compacting the bottom nav.
- **Empty States:** When list is empty, displays a plain `Text` element. Lacks an illustration, icon, or prominent action prompt to guide first-time users.
- **Card Touch Targets:** `MealCard` (minHeight 76) and `WorkoutCard` (minHeight 76) provide generous, accessible touch areas.
- **Interaction Feedback:** `MealCard` and `WorkoutCard` use opacity dimming on press, lacking Android ripple.

#### Screens: `MealDetailsScreen.tsx` & `WorkoutDetailsScreen.tsx`
- **Nutrient Grid (`MealDetailsScreen`):** 4 `MacroCard` components rendered in a flex wrap grid. Works well across device widths.
- **Typography & Units:** Uses Latin digits for weights and calories across Arabic and English.
- **Actions:** Detail screens lack editing and deletion actions (users can add meals and workouts, but cannot edit or delete them directly from the detail view in the current UI).

---

### 2.5 Profile, Settings & Progress

#### Screen: `SettingsScreen.tsx`
- **Language Switch Flow:** Flawless in-app switching between English and Arabic with automated splash screen reinitialization and SQLite persistence.
- **Theme Selection:** Seamless switching between Light, Dark, and System modes with immediate reactive theme updates.
- **Accessibility:** Selection options have `accessibilityRole="button"`, but lack `accessibilityState={{ selected }}` on the outer `Pressable`.

#### Screen: `ProgressScreen.tsx`
- **Weekly Trend Bar Chart:** Custom React Native `View` bar chart with rounded pill tracks. Fully responsive and supports RTL orientation.
- **Accessibility:** Chart bars do not expose accessibility labels for screen readers (e.g., TalkBack or VoiceOver cannot announce "Monday: 1,850 kcal").

#### Screen: `OnboardingScreen.tsx`
- **RTL Defect:** `title` and `body` lack explicit `activeTextAlign()` and `activeWritingDirection()`. In Arabic, onboarding text defaults to LTR alignment.
- **Interactive Start:** Large `AppButton` at bottom provides clear call-to-action.

---

## 3. Comprehensive Issue Classification (P0–P3)

### Summary Table

| Severity | Count | Definition |
|---|---|---|
| **P0 — Critical** | **0** | Broken navigation loops, crashes, data corruption, severe blockers |
| **P1 — High** | **3** | Platform navigation overlaps, keyboard occlusion of forms, small-screen layout wrapping |
| **P2 — Medium** | **7** | Sub-minimum touch targets, missing M3 ripple, missing focus states, text alignment bugs |
| **P3 — Low** | **4** | Missing chart screen-reader announcements, lack of animated transitions, empty state visual polish |
| **Total Issues** | **14** | |

---

### Detailed Findings Matrix

#### Finding 1 [P1 — High]
- **Screen / Component:** `BottomTabs.tsx` (`src/components/BottomTabs.tsx#L52`)
- **Platform Affected:** Android (devices with 3-button system navigation bar enabled)
- **Observed Evidence:**
  `const bottomOffset = Platform.OS === 'ios' ? Math.max(insets.bottom - 8, 2) : 4;`
- **User Impact:** On Android devices with 3-button navigation, the bottom tabs overlap with the native system navigation bar (Back/Home/Recents), causing users to accidentally trigger Android system navigation when attempting to tap Qooti tabs.
- **Guideline Rationale:** Android Material 3 and Android WindowInsets guidelines mandate explicit bottom inset clearance (`insets.bottom`) for floating components.
- **Recommended Solution:** Use `Platform.select({ ios: Math.max(insets.bottom - 8, 2), android: Math.max(insets.bottom, 12) })`.
- **Implementation:** Shared with platform-specific inset calculation.
- **Risk of Regression:** Low.
- **Proposed Verification:** Test on physical Android device with 3-button navigation enabled in Android system settings.

---

#### Finding 2 [P1 — High]
- **Screen / Component:** `AddMealScreen.tsx` & `AddWorkoutScreen.tsx`
- **Platform Affected:** Both Android and iOS
- **Observed Evidence:** ScrollViews contain multiple input fields without `KeyboardAvoidingView` or `keyboardDismissMode`.
- **User Impact:** When tapping on lower inputs (fats, carbs, workout notes) or when attempting to tap "Save", the virtual software keyboard completely obscures the inputs and action button. Users cannot see what they are typing without manual frantic scrolling.
- **Guideline Rationale:** Both Apple HIG (Managing the Keyboard) and Material 3 (Virtual Keyboard Interactions) require forms to adjust automatically to keep active inputs visible.
- **Recommended Solution:** Wrap form contents in `KeyboardAvoidingView` with `behavior={Platform.OS === 'ios' ? 'padding' : undefined}` and set `keyboardShouldPersistTaps="handled"`.
- **Implementation:** Shared component pattern.
- **Risk of Regression:** Very low.
- **Proposed Verification:** Open keyboard on physical iPhone and Android device; confirm active input scrolls into view above the keyboard.

---

#### Finding 3 [P1 — High]
- **Screen / Component:** `AddMealScreen.tsx` (`src/screens/AddMealScreen.tsx#L66-L69`)
- **Platform Affected:** Both Android and iOS (Compact screens: 360dp–375dp width)
- **Observed Evidence:**
  3 inputs with `minWidth: 100` inside a flex container with `gap: spacing.md (12)` and `padding: spacing.xl (20)`. Total needed width: `100*3 + 12*2 + 20*2 = 364dp`.
- **User Impact:** On 360dp width screens (standard on many Samsung A-series and smaller devices), the 3rd input ("Fats") breaks onto a second line alone, stretching across the entire width while Protein and Carbs share the top row.
- **Guideline Rationale:** Responsive design standards require consistent multi-column grids or adaptive column counts.
- **Recommended Solution:** Adapt input widths or stack inputs in a 2-column grid on compact screens.
- **Implementation:** Shared responsive helper or percentage width (`width: '30%'`).
- **Risk of Regression:** Low.
- **Proposed Verification:** Verify layout rendering in Android emulator at 360x640dp.

---

#### Finding 4 [P2 — Medium]
- **Screen / Component:** `HomeHeader.tsx`, `PeriodSelector.tsx`, `LatestActivityList.tsx`
- **Platform Affected:** Both Android and iOS
- **Observed Evidence:**
  - `HomeHeader.tsx` action button: `40x40`
  - `PeriodSelector.tsx` pills: `minHeight: 38`
  - `LatestActivityList.tsx` header action: `32x32`
- **User Impact:** Difficult tap interactions for users with larger fingers or motor impairments. High rate of mis-taps.
- **Guideline Rationale:** Apple HIG mandates minimum 44x44pt; Android Material 3 mandates minimum 48x48dp.
- **Recommended Solution:** Expand touchable areas to minimum 44/48dp, or apply `hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}` to maintain compact visual size while meeting accessibility target size.
- **Implementation:** Shared styling / hitSlop props.
- **Risk of Regression:** None.
- **Proposed Verification:** Automated accessibility touch target lint and physical device touch test.

---

#### Finding 5 [P2 — Medium]
- **Screen / Component:** `AppButton.tsx`, `MealCard.tsx`, `WorkoutCard.tsx`, `SettingsScreen.tsx`
- **Platform Affected:** Android
- **Observed Evidence:**
  `style={({ pressed }) => [{ opacity: pressed ? 0.78 : 1 }]}` without `android_ripple`.
- **User Impact:** Android users experience iOS-style opacity dimming instead of the native Material ink ripple, giving the app an un-native "web port" feel.
- **Guideline Rationale:** Material Design 3 specifies ink ripples on all interactive surfaces.
- **Recommended Solution:** Add `android_ripple={{ color: colors.cardMuted }}` to `Pressable` on Android.
- **Implementation:** Platform-conditional prop (`Platform.OS === 'android' ? { color: ... } : undefined`).
- **Risk of Regression:** Very low.
- **Proposed Verification:** Tap buttons on physical Android device and verify visible ink ripple.

---

#### Finding 6 [P2 — Medium]
- **Screen / Component:** `AppInput.tsx` (`src/components/AppInput.tsx`)
- **Platform Affected:** Both Android and iOS
- **Observed Evidence:** Fixed border color `borderColor: colors.border`. No `onFocus` or `onBlur` listeners to update active outline.
- **User Impact:** Users receive no clear visual indicator of which input field currently holds cursor focus.
- **Guideline Rationale:** Both M3 (Active outline 2dp) and Apple HIG require clear focus states.
- **Recommended Solution:** Introduce `isFocused` state toggled via `onFocus`/`onBlur` that transitions border color to `colors.primary`.
- **Implementation:** Shared component state.
- **Risk of Regression:** None.
- **Proposed Verification:** Focus input and verify outline color change.

---

#### Finding 7 [P2 — Medium]
- **Screen / Component:** `OnboardingScreen.tsx` (`src/screens/OnboardingScreen.tsx#L53-L58`)
- **Platform Affected:** Android & iOS (Arabic locale)
- **Observed Evidence:** `styles.title` and `styles.body` lack `textAlign: activeTextAlign()` and `writingDirection: activeWritingDirection()`.
- **User Impact:** In Arabic mode, the onboarding card renders left-aligned English-style text instead of right-aligned Arabic text.
- **Guideline Rationale:** Arabic typography must strictly align right (RTL) for natural reading flow.
- **Recommended Solution:** Apply `directionalText` style helper to title and body text nodes.
- **Implementation:** Shared utility application.
- **Risk of Regression:** None.
- **Proposed Verification:** Launch onboarding in Arabic and verify right text alignment.

---

#### Finding 8 [P2 — Medium]
- **Screen / Component:** `AppNavigator.tsx` (Back Navigation)
- **Platform Affected:** iOS
- **Observed Evidence:** State-based screen switching (`setActiveScreen(...)`) without native stack animation or gesture recognizers.
- **User Impact:** iOS users cannot swipe from the left edge of the screen to go back from `mealDetails`, `workoutDetails`, `addMeal`, `addWorkout`, or `settings`.
- **Guideline Rationale:** Apple HIG considers the interactive edge-swipe pop gesture a core system navigation requirement.
- **Recommended Solution:** Plan migration of inner sub-screens to `@react-navigation/native-stack` while preserving current state-based bottom tabs.
- **Implementation:** Phase 1A architecture task.
- **Risk of Regression:** Medium (must preserve SQLite save and RTL direction).
- **Proposed Verification:** Swipe from left edge on physical iPhone to go back.

---

#### Finding 9 [P2 — Medium]
- **Screen / Component:** `AddMealScreen.tsx` & `AddWorkoutScreen.tsx`
- **Platform Affected:** Both Android and iOS
- **Observed Evidence:** `Alert.alert(t('common.requiredTitle'), t('common.requiredMessage'))` used for blank required fields.
- **User Impact:** Disruptive modal alert interrupts user flow for minor validation errors.
- **Guideline Rationale:** Modern mobile UX (both HIG and M3) recommends inline field validation errors below the offending input.
- **Recommended Solution:** Add optional `error` prop to `AppInput` and display inline helper text when validation fails.
- **Implementation:** Shared component enhancement.
- **Risk of Regression:** Very low.
- **Proposed Verification:** Attempt save with empty fields; verify red inline error message appears without native alert popup.

---

#### Finding 10 [P2 — Medium]
- **Screen / Component:** Accessibility across all screens (`AppInput`, `HomeHeader`, `DateSelector`, `SettingsScreen`)
- **Platform Affected:** Android (TalkBack) & iOS (VoiceOver)
- **Observed Evidence:**
  - `AppInput` does not link label to `TextInput` via `accessibilityLabel`.
  - Icon-only buttons lack `accessibilityLabel`.
  - Filter and radio chips lack `accessibilityState={{ selected }}`.
- **User Impact:** Visually impaired users using screen readers hear "Button" or "Edit box" without knowing what the control does.
- **Guideline Rationale:** WCAG 2.1 AA and native mobile accessibility standards require meaningful names, roles, and states for all interactive elements.
- **Recommended Solution:** Audit and pass explicit `accessibilityLabel` and `accessibilityState` to all `Pressable` and `TextInput` primitives.
- **Implementation:** Shared props.
- **Risk of Regression:** None.
- **Proposed Verification:** Enable TalkBack / VoiceOver and navigate each screen via swipe gestures.

---

#### Finding 11 [P3 — Low]
- **Screen / Component:** `ProgressScreen.tsx` (Weekly Trend Chart)
- **Platform Affected:** Both Android and iOS
- **Observed Evidence:** Custom bar elements in `ProgressScreen` are plain `View` elements without accessibility semantics.
- **User Impact:** Screen readers bypass the weekly calorie trend chart entirely.
- **Recommended Solution:** Add `accessible={true}` and `accessibilityLabel={`${entry.label}: ${entry.calories} kcal`}` to each bar column.
- **Implementation:** Shared props.
- **Risk of Regression:** None.

---

#### Finding 12 [P3 — Low]
- **Screen / Component:** `MealsScreen.tsx` & `WorkoutsScreen.tsx` (Empty States)
- **Platform Affected:** Both Android and iOS
- **Observed Evidence:** Empty list displays a simple single-line `Text` message.
- **User Impact:** Lacks warmth, visual encouragement, and actionable guidance for new users.
- **Recommended Solution:** Adopt the `EmptyState` component from `src/components/common/EmptyState.tsx` featuring an icon, title, description, and "Add First Item" button.
- **Implementation:** Shared component reuse.
- **Risk of Regression:** Very low.

---

#### Finding 13 [P3 — Low]
- **Screen / Component:** `AppNavigator.tsx` (Screen Transitions)
- **Platform Affected:** Both Android and iOS
- **Observed Evidence:** Screens swap instantaneously without subtle fade or slide transitions.
- **User Impact:** Visual transitions feel abrupt.
- **Recommended Solution:** Add subtle cross-fade transition or adopt native stack animation.
- **Implementation:** Shared navigation enhancement.
- **Risk of Regression:** Low.

---

#### Finding 14 [P3 — Low]
- **Screen / Component:** Typography Dynamic Type Scaling (`src/theme/typography.ts`)
- **Platform Affected:** Both Android and iOS
- **Observed Evidence:** Hardcoded line heights matching static font sizes (e.g. `fontSize: 18, lineHeight: 25`).
- **User Impact:** When system accessibility font size is set to >150%, text with rigid line heights can overlap or truncate in fixed-height headers.
- **Recommended Solution:** Remove fixed `lineHeight` on flexible body text or use multiplier-based scaling.
- **Implementation:** Shared theme typography review.
- **Risk of Regression:** Low.
