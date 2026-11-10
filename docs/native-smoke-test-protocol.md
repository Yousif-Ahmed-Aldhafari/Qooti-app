# Qooti Native Device Smoke-Test Protocol (Android & iOS)

This document specifies the exact, step-by-step manual validation protocol for native mobile execution of Qooti (Phase 1.6 baseline).

> **Execution Status in Current Environment:**
> **NOT EXECUTED** — No connected Android/iOS device, adb bridge, or simulator was available in the build container environment. All steps below are specified for physical-device validation before production distribution.

---

## 1. Clean Installation
- [ ] **Android:** Install fresh APK / run `npx expo run:android` on clean emulator/device.
- [ ] **iOS:** Install fresh build / run `npx expo run:ios` on iOS Simulator/device.
- [ ] **Expectation:** Splash screen renders with Qooti branding -> Transitions into Onboarding screen -> Default language is English.

---

## 2. Onboarding & First-Launch Transition
- [ ] On clean launch, complete the onboarding flow.
- [ ] Select goal, enter target metric, and tap "Get Started".
- [ ] **Expectation:** Database initializes `app_settings` with `hasCompletedOnboarding: 1`. App immediately displays the `home` tab with glass card layout and donut stats.

---

## 3. Legacy AsyncStorage to SQLite Migration
- [ ] Pre-populate device with legacy `@qooti/meals`, `@qooti/workouts`, `@qooti/profile`, `@qooti/settings` keys in AsyncStorage before launch.
- [ ] Launch application.
- [ ] **Expectation:** Startup migration automatically runs atomically inside exclusive transaction:
  - All existing meals and workouts appear in their respective screens.
  - If any record was corrupted, an amber non-intrusive banner appears: `"legacy record(s) could not be migrated due to invalid format"`.
  - Raw AsyncStorage records remain untouched as recovery backup.

---

## 4. Meal & Workout CRUD Lifecycle
- [ ] **Create Meal:** Navigate to Meals -> Tap "Add Meal" -> Enter title, items, calories, macros -> Tap Save.
  - Verify card renders in Meals screen.
- [ ] **Detail Navigation:** Tap newly created meal -> Verify MealDetails screen renders item breakdown.
- [ ] **Delete Meal:** Delete the meal while viewing details.
  - Verify app immediately returns to Meals tab without blank screen or crash.
- [ ] **Create Workout:** Navigate to Workouts -> Tap "Add Workout" -> Enter title, exercises, sets, reps -> Tap Save.
- [ ] **Delete Workout:** Delete workout while viewing details -> Verify returns to Workouts tab cleanly.

---

## 5. Force-Close & Restart Persistence
- [ ] Add 2 meals and 1 workout.
- [ ] Swipe up to force-close the application in Android/iOS app switcher.
- [ ] Reopen application.
- [ ] **Expectation:** Splash screen displays -> Hydrates state from SQLite -> Exactly the 2 meals and 1 workout render. No default or sample seed data is injected.

---

## 6. Offline Execution
- [ ] Enable Airplane Mode (disable Wi-Fi and Cellular data).
- [ ] Launch app, navigate through all tabs, add a meal, update profile weight.
- [ ] **Expectation:** App operates completely offline without network hangs, spinners, or crashes.

---

## 7. Android Hardware Back Button Handling
- [ ] Navigate: Home -> Profile -> Settings. Press physical/gesture back button.
  - **Expectation:** Navigates back to Profile tab (does not exit app).
- [ ] Navigate: Meals -> Meal Details. Press hardware back button.
  - **Expectation:** Navigates back to Meals tab.
- [ ] On Workouts tab, press hardware back button.
  - **Expectation:** Navigates to Home tab.
- [ ] On Home tab, press hardware back button.
  - **Expectation:** Exits application cleanly to Android launcher.

---

## 8. In-App Language Switching & RTL Layout Behavior (Android & iOS)
- [ ] Navigate to Settings -> Language -> Select Arabic (`العربية`).
- [ ] Verify NO iOS Settings redirect and NO restart confirmation dialog appears.
- [ ] Verify Qooti's splash screen displays smoothly for transition (~600ms).
- [ ] **Expectation:** Entire React UI reinitializes automatically in Arabic right-to-left (RTL). Tab icons, chevrons, headers, and form inputs align properly to the right. Text displays in Arabic translations.
- [ ] Navigate back to Settings -> Select English -> Verify splash transition occurs and LTR layout restores.
- [ ] Force-close and reopen app -> Verify selected language persists from SQLite.

---

## 9. Theme Switching (Light / Dark / System)
- [ ] In Settings, switch Theme to Dark.
  - Verify background changes to `#181A1B` and card surfaces update instantly.
- [ ] Switch to Light.
  - Verify background updates to `#FFFFFF`.
- [ ] Switch to System.
  - Toggle device OS dark mode in quick settings -> Verify app dynamically matches system mode.

---

## 10. Background to Foreground Transitions
- [ ] Open Qooti, input an unsubmitted meal in AddMealScreen.
- [ ] Switch to another app or home screen for 30 seconds.
- [ ] Return to Qooti.
- [ ] **Expectation:** Form state and navigation view are preserved without reloading or resetting.

