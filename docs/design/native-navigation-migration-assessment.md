# Qooti Native Navigation Migration Assessment
## Interactive Swipe-Back, Architecture Risks & Phase 1B Roadmap

- **Status:** Strategic Assessment & Architecture Blueprint
- **Target Application:** Qooti (React Native 0.83 / Expo SDK 58)
- **Primary Scope:** iOS Interactive Swipe-Back & `@react-navigation/native-stack` Migration
- **Date:** November 2026

---

## 1. Executive Summary

Qooti currently utilizes a lightweight, deterministic state-based router centered around an active screen indicator (`activeScreen: ScreenName`) coordinated through React Context and state machine dispatchers. While this architecture provides zero external routing overhead, synchronous tab transitions, and predictable mockability for automated tests, it lacks native UIKit stack dynamics on iOS—specifically **hardware-accelerated interactive edge swipe-back (interactive pop gesture)** and native platform navigation physics.

This document analyzes the engineering trade-offs, risks, bidirectional (RTL) nuances, and structural requirements for migrating Qooti to `@react-navigation/native-stack`, establishing a clear blueprint for Phase 1B while keeping the proven state router stable through Phase 1A.

---

## 2. iOS Interactive Swipe-Back Analysis

### 2.1 Native UIKit vs. Custom PanResponder Simulation

Under Apple Human Interface Guidelines (HIG), users expect an interactive edge-swipe gesture to dismiss pushed detail views (`MealDetailsScreen`, `WorkoutDetailsScreen`, `AddMealScreen`, `AddWorkoutScreen`, `SettingsScreen`).

Attempting to simulate this gesture in JavaScript using `PanResponder` or basic `GestureDetector` within a custom single-container router introduces severe limitations:

| Evaluation Dimension | Custom JS PanResponder | `@react-navigation/native-stack` |
| :--- | :--- | :--- |
| **Gesture Engine** | JavaScript thread (`PanResponder`) or UI thread worklets | Native UIKit `UINavigationController` interactive pop gesture |
| **Physics & Inertia** | Approximate custom spring curves | True Apple iOS UIKit physics with velocity thresholds |
| **Gesture Collisions** | Frequent collisions with horizontal `ScrollView`s, sliders, and swipeable cells | Handled natively by UIKit gesture recognizer priorities |
| **Header Synchronization** | Manual frame/opacity interpolations | Native navigation bar title fade and back-chevron transitions |
| **Memory Footprint** | Both parent and child screens remain active in the React tree | Native view controllers manage OS-level view offloading |

**Finding:** Simulating swipe-back in JavaScript introduces fragility and gesture conflicts with Qooti's horizontal date pickers and activity cards. True native stack navigation is required to achieve authentic Apple HIG fidelity.

---

## 3. Benefits of `@react-navigation/native-stack`

1. **True Native UIKit Hierarchy:**
   On iOS, screens are backed by `UIViewController` within `UINavigationController`. On Android, screens map to native `FragmentTransaction`s.
2. **Interactive Swipe-Back Out of the Box:**
   Interactive edge-swipe with native cancellation physics (releasing mid-swipe smoothly snaps back or completes the pop based on velocity).
3. **Hardware Back Button Parity on Android:**
   Direct integration with Android's `OnBackPressedDispatcher` and predictive back animations in modern Android (API 33+).
4. **Memory & Layout Efficiency:**
   Off-screen view controllers do not consume continuous GPU composition layers, preventing memory warnings on lower-end devices.

---

## 4. Technical Risks & Complexities

Migrating from state-based navigation to native-stack is a significant architectural transition that entails five specific risks:

### 4.1 Screen Unmounting & Unsaved Form State Loss
* **Risk:** In state-based navigation, navigating away or presenting an alert does not automatically unmount parent state unless instructed. In native stack, popping a screen unmounts the component and destroys local component state.
* **Impact:** In `AddMealScreen` or `AddWorkoutScreen`, an accidental edge-swipe could discard food items or workout exercises before saving to SQLite.
* **Mitigation:**
  - Implement navigation guards (`beforeRemove` event listener) to trigger a confirmation dialog if the form is dirty.
  - Automatically persist form drafts into a temporary SQLite `drafts` table or in-memory React context.

### 4.2 Bottom Tab Synchronization
* **Risk:** Qooti's custom floating `BottomTabs` currently has automated scroll-hide logic (`useBottomNavScrollHandler`) and platform safe-area clearance.
* **Impact:** Wrapping individual stack navigators inside tabs vs. nesting a tab navigator inside a root stack alters header heights, bottom clearances, and modal presentation layers.
* **Recommended Structure:**
  - **Root Stack Navigator:**
    - `MainTabs` (Screen hosting BottomTabs containing Home, Meals, Workouts, Progress, Profile)
    - `AddMeal` (Stack modal or standard push)
    - `AddWorkout` (Stack modal or standard push)
    - `MealDetails` (Push screen with bottom bar hidden)
    - `WorkoutDetails` (Push screen with bottom bar hidden)
    - `Settings` (Push screen with bottom bar hidden)

### 4.3 Bidirectional (Arabic RTL / English LTR) Edge Swipe
* **Risk:** In iOS UIKit, the interactive pop gesture edge depends on the layout direction:
  - English (LTR): Edge swipe starts at the **left screen edge** and swipes rightward.
  - Arabic (RTL): Edge swipe starts at the **right screen edge** and swipes leftward.
* **Impact:** When switching languages in-app without a native app reload (a core Qooti architectural principle), UIKit's view hierarchy direction must properly reflect the new writing direction.
* **Mitigation:**
  - Verify that `I18nManager.isRTL` or React Navigation's `direction: 'rtl'` property updates the native gesture edge correctly upon language dispatch.
  - Ensure back navigation icons (`arrow-back` vs. `arrow-forward`) and header titles synchronize dynamically.

### 4.4 Automated Test Harness Migration
* **Risk:** Qooti currently maintains 99 Node-based unit and integration tests executing at blazing speed (~5-9 seconds total) without requiring a full React Native runtime or NativeEventEmitter mocks.
* **Impact:** Introducing `@react-navigation` can introduce dependencies on `react-native-screens` and native event emitters that require deep mock configurations in unit test environments.
* **Mitigation:**
  - Maintain abstract navigation interfaces (`NavigationContext`) that allow headless integration tests to run with simulated routers while native platforms bind to the stack navigator.

---

## 5. Phase 1B Migration Architecture Plan

```
[ RootStackNavigator ]
  │
  ├── [ MainTabNavigator ] (BottomTabs visible)
  │     ├── HomeScreen
  │     ├── MealsScreen
  │     ├── WorkoutsScreen
  │     ├── ProgressScreen
  │     └── ProfileScreen
  │
  ├── [ MealDetailsScreen ] (Native Push - Back Gesture Active)
  ├── [ WorkoutDetailsScreen ] (Native Push - Back Gesture Active)
  ├── [ AddMealScreen ] (Native Modal / Form Guard Active)
  ├── [ AddWorkoutScreen ] (Native Modal / Form Guard Active)
  └── [ SettingsScreen ] (Native Push - Back Gesture Active)
```

### Proposed Execution Steps (Phase 1B):
1. **Dependency Addition:** Install `@react-navigation/native` and `@react-navigation/native-stack` matching Expo SDK 58 compatibility.
2. **Nav Structure Implementation:** Create `src/navigation/RootNavigator.tsx` and type declarations (`RootStackParamList`).
3. **Form Guard Protection:** Add `beforeRemove` hooks to `AddMealScreen` and `AddWorkoutScreen`.
4. **RTL Parity Testing:** Validate right-edge interactive pop on physical iOS devices in Arabic.
5. **Headless Test Shims:** Ensure all existing 99+ tests execute cleanly without degradation.

---

## 6. Strategic Recommendation

> [!IMPORTANT]
> **Maintain Current State Router for Phase 1A; Schedule Native-Stack for Phase 1B Epic.**

1. **Stability First:** Qooti's current router is fully verified across Android hardware back, Arabic RTL flipping, SQLite state persistence, and zero test failures.
2. **Scope Isolation:** Migrating to `@react-navigation/native-stack` during Phase 1A would destabilize existing regression suites and conflate UI/UX styling with structural routing refactoring.
3. **Execution Plan:** Complete Task 1A.5 and Task 1A.6 on the current branch. Dedicate the first milestone of Phase 1B to the native navigation stack migration using the architecture outlined above.
