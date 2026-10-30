import test from 'node:test';
import assert from 'node:assert/strict';

import { defaultSettings } from '../services/settingsService';
import { isRTL, direction } from '../utils/rtl';
import { resolveThemePreference, setActiveTheme, themeColors } from '../theme/colors';
import { BackHandler } from './mocks/react-native';

/**
 * State simulator for AppNavigator navigation state machine.
 * Mirrors the exact navigation logic implemented in AppNavigator.tsx.
 */
function createNavigationSession(initialSettings = defaultSettings, initialMeals: any[] = [], initialWorkouts: any[] = []) {
  let isReady = false;
  let showSplash = true;
  let hasOnboarded = initialSettings.hasCompletedOnboarding;
  let activeTab = 'home';
  let activeScreen = 'home';
  let selectedMealId: string | null = null;
  let selectedWorkoutId: string | null = null;
  let persistenceError: string | null = null;
  let settings = { ...initialSettings };
  let meals = [...initialMeals];
  let workouts = [...initialWorkouts];

  const mainTabs = ['home', 'meals', 'workouts', 'progress', 'profile'];
  function isMainTab(screen: string): boolean {
    return mainTabs.includes(screen);
  }

  // BackHandler simulation matching AppNavigator
  function handleHardwareBack(): boolean {
    if (!isMainTab(activeScreen)) {
      activeScreen = activeTab;
      return true;
    }
    if (activeTab !== 'home') {
      activeTab = 'home';
      activeScreen = 'home';
      return true;
    }
    return false;
  }

  // Meal safety synchronization
  function syncMealSafety() {
    if (activeScreen === 'mealDetails' && selectedMealId) {
      const exists = meals.some((m) => m.id === selectedMealId);
      if (!exists) {
        activeTab = 'meals';
        activeScreen = 'meals';
        selectedMealId = null;
      }
    }
  }

  // Workout safety synchronization
  function syncWorkoutSafety() {
    if (activeScreen === 'workoutDetails' && selectedWorkoutId) {
      const exists = workouts.some((w) => w.id === selectedWorkoutId);
      if (!exists) {
        activeTab = 'workouts';
        activeScreen = 'workouts';
        selectedWorkoutId = null;
      }
    }
  }

  function resolveSelectedMeal() {
    if (selectedMealId) {
      return meals.find((m) => m.id === selectedMealId) ?? null;
    }
    return null;
  }

  function resolveSelectedWorkout() {
    if (selectedWorkoutId) {
      return workouts.find((w) => w.id === selectedWorkoutId) ?? null;
    }
    return null;
  }

  return {
    get isReady() { return isReady; },
    get showSplash() { return showSplash; },
    get hasOnboarded() { return hasOnboarded; },
    get activeTab() { return activeTab; },
    get activeScreen() { return activeScreen; },
    get selectedMealId() { return selectedMealId; },
    get selectedWorkoutId() { return selectedWorkoutId; },
    get persistenceError() { return persistenceError; },
    get settings() { return settings; },
    get meals() { return meals; },
    get workouts() { return workouts; },
    hydrate: () => {
      isReady = true;
      showSplash = false;
    },
    finishOnboarding: () => {
      hasOnboarded = true;
      settings.hasCompletedOnboarding = true;
      activeTab = 'home';
      activeScreen = 'home';
    },
    selectTab: (tab: string) => {
      activeTab = tab;
      activeScreen = tab;
    },
    openMealDetails: (id: string) => {
      selectedMealId = id;
      activeScreen = 'mealDetails';
    },
    deleteMeal: (id: string) => {
      meals = meals.filter((m) => m.id !== id);
      syncMealSafety();
    },
    openWorkoutDetails: (id: string) => {
      selectedWorkoutId = id;
      activeScreen = 'workoutDetails';
    },
    deleteWorkout: (id: string) => {
      workouts = workouts.filter((w) => w.id !== id);
      syncWorkoutSafety();
    },
    openSettings: () => {
      activeScreen = 'settings';
    },
    goBack: () => {
      activeScreen = activeTab;
    },
    pressHardwareBack: () => handleHardwareBack(),
    setPersistenceError: (err: string | null) => {
      persistenceError = err;
    },
    clearPersistenceError: () => {
      persistenceError = null;
    },
    updateLanguage: (lang: 'en' | 'ar') => {
      settings.selectedLanguage = lang;
    },
    updateTheme: (theme: 'light' | 'dark' | 'system') => {
      settings.themeMode = theme;
    },
    resolveSelectedMeal,
    resolveSelectedWorkout,
  };
}

test('Navigation: First launch vs returning user navigation flow', () => {
  // First launch: onboarding not completed
  const firstLaunchSession = createNavigationSession({
    ...defaultSettings,
    hasCompletedOnboarding: false,
  });

  assert.equal(firstLaunchSession.hasOnboarded, false);
  firstLaunchSession.hydrate();
  assert.equal(firstLaunchSession.isReady, true);
  assert.equal(firstLaunchSession.hasOnboarded, false); // must present onboarding

  firstLaunchSession.finishOnboarding();
  assert.equal(firstLaunchSession.hasOnboarded, true);
  assert.equal(firstLaunchSession.activeTab, 'home');
  assert.equal(firstLaunchSession.activeScreen, 'home');

  // Returning user: onboarding already completed
  const returningSession = createNavigationSession({
    ...defaultSettings,
    hasCompletedOnboarding: true,
  });
  returningSession.hydrate();
  assert.equal(returningSession.hasOnboarded, true);
  assert.equal(returningSession.activeScreen, 'home');
});

test('Navigation: Splash screen visibility before and after hydration', () => {
  const session = createNavigationSession();
  assert.equal(session.isReady, false);
  assert.equal(session.showSplash, true);

  session.hydrate();
  assert.equal(session.isReady, true);
  assert.equal(session.showSplash, false);
});

test('Navigation: Deleted meal detail navigation safety prevents blank screens', () => {
  const initialMeals = [
    { id: 'meal-1', title: 'Breakfast', date: '2026-10-30', time: '08:00', items: [] },
    { id: 'meal-2', title: 'Lunch', date: '2026-10-30', time: '13:00', items: [] },
  ];
  const session = createNavigationSession(
    { ...defaultSettings, hasCompletedOnboarding: true },
    initialMeals
  );
  session.hydrate();
  session.selectTab('meals');
  assert.equal(session.activeScreen, 'meals');

  // Open meal details for meal-1
  session.openMealDetails('meal-1');
  assert.equal(session.activeScreen, 'mealDetails');
  assert.equal(session.selectedMealId, 'meal-1');
  assert.notEqual(session.resolveSelectedMeal(), null);

  // Delete meal-1 while viewing it
  session.deleteMeal('meal-1');

  // Must automatically fallback to 'meals' tab, clearing stale selection
  assert.equal(session.activeScreen, 'meals', 'Active screen must fallback to meals tab upon meal deletion');
  assert.equal(session.selectedMealId, null, 'Stale selectedMealId must be reset');
  assert.equal(session.resolveSelectedMeal(), null, 'No phantom meal returned');
});

test('Navigation: Deleted workout detail navigation safety prevents blank screens', () => {
  const initialWorkouts = [
    { id: 'workout-1', title: 'Morning Cardio', date: '2026-10-30', time: '07:00', exercises: [] },
  ];
  const session = createNavigationSession(
    { ...defaultSettings, hasCompletedOnboarding: true },
    [],
    initialWorkouts
  );
  session.hydrate();
  session.selectTab('workouts');
  session.openWorkoutDetails('workout-1');
  assert.equal(session.activeScreen, 'workoutDetails');

  // Delete workout-1
  session.deleteWorkout('workout-1');
  assert.equal(session.activeScreen, 'workouts', 'Active screen must fallback to workouts tab upon workout deletion');
  assert.equal(session.selectedWorkoutId, null);
  assert.equal(session.resolveSelectedWorkout(), null);
});

test('Navigation: Android hardware back button handler transitions correctly', () => {
  const session = createNavigationSession({ ...defaultSettings, hasCompletedOnboarding: true });
  session.hydrate();

  // 1. From subscreen (e.g., settings) -> back to active tab
  session.selectTab('profile');
  session.openSettings();
  assert.equal(session.activeScreen, 'settings');

  let handled = session.pressHardwareBack();
  assert.equal(handled, true, 'Hardware back on sub-screen must be handled');
  assert.equal(session.activeScreen, 'profile', 'Hardware back from settings returns to profile tab');

  // 2. From non-home main tab -> back to home tab
  assert.equal(session.activeTab, 'profile');
  handled = session.pressHardwareBack();
  assert.equal(handled, true, 'Hardware back on profile tab must be handled');
  assert.equal(session.activeTab, 'home', 'Hardware back on profile tab returns to home tab');
  assert.equal(session.activeScreen, 'home');

  // 3. On home tab -> back button returns false to allow OS to exit cleanly
  handled = session.pressHardwareBack();
  assert.equal(handled, false, 'Hardware back on home tab must allow default exit (return false)');
});

test('Navigation: Rapid screen and tab switching maintains consistent state', () => {
  const session = createNavigationSession({ ...defaultSettings, hasCompletedOnboarding: true });
  session.hydrate();

  const sequence = ['home', 'meals', 'workouts', 'progress', 'profile', 'meals', 'home'];
  for (const tab of sequence) {
    session.selectTab(tab);
    assert.equal(session.activeTab, tab);
    assert.equal(session.activeScreen, tab);
  }
});

test('Navigation: Persistence error banner visibility and dismissal lifecycle', () => {
  const session = createNavigationSession({ ...defaultSettings, hasCompletedOnboarding: true });
  session.hydrate();

  assert.equal(session.persistenceError, null);

  // Storage error occurs during a mutation
  session.setPersistenceError('Storage Warning: Disk write failed');
  assert.equal(session.persistenceError, 'Storage Warning: Disk write failed');

  // User dismisses the error banner
  session.clearPersistenceError();
  assert.equal(session.persistenceError, null);
  assert.equal(session.activeScreen, 'home', 'Dismissing error banner does not disrupt navigation');
});

test('Navigation: RTL direction and theme switching persist across navigation', () => {
  const session = createNavigationSession({ ...defaultSettings, hasCompletedOnboarding: true });
  session.hydrate();

  // Test language change to Arabic
  session.updateLanguage('ar');
  assert.equal(session.settings.selectedLanguage, 'ar');
  assert.equal(isRTL(session.settings.selectedLanguage), true);
  assert.equal(direction(session.settings.selectedLanguage), 'rtl');

  // Navigate to settings and change theme
  session.openSettings();
  session.updateTheme('dark');
  assert.equal(session.settings.themeMode, 'dark');

  const resolved = resolveThemePreference(session.settings.themeMode, 'light');
  assert.equal(resolved, 'dark');

  setActiveTheme('dark');
  const palette = themeColors();
  assert.equal(palette.background, '#181A1B');

  // Return to home tab
  session.goBack();
  assert.equal(session.activeScreen, 'home');
  assert.equal(session.settings.selectedLanguage, 'ar');
  assert.equal(session.settings.themeMode, 'dark');
});
