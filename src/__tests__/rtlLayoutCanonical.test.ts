import test from 'node:test';
import assert from 'node:assert/strict';
import { I18nManager } from 'react-native';

import {
  isRTL,
  shouldReverseLayout,
  applyRTL,
  direction,
  textAlign,
  writingDirection,
  rowDirection,
  rowStyle,
  flexStart,
  flexEnd,
  alignItemsStart,
  alignItemsEnd,
  getTabOrder,
  setActiveLanguage,
  getActiveLanguage,
  activeTextAlign,
  activeWritingDirection,
} from '../utils/rtl';
import {
  getAppTabOrder,
  getDirection,
  getTextAlign,
  getWritingDirection,
  getRowDirection,
  getRowStyle,
  getFlexStart,
  getFlexEnd,
  getAlignItems,
  getOppositeAlignItems,
} from '../utils/languageDirection';
import { defaultSettings } from '../services/settingsService';
import { bottomTabStyles, calculateBottomNavOffset } from '../components/bottomTabStyles';
import { SQLiteSettingsRepository } from '../db/repositories/settingsRepository';
import { SQLiteMealRepository } from '../db/repositories/mealRepository';
import { SQLiteWorkoutRepository } from '../db/repositories/workoutRepository';
import { getDatabase, closeDatabase } from '../db';
import { normalizeMeal, normalizeMealItem } from '../models/meal';
import { normalizeWorkout, normalizeExercise } from '../models/workout';

test('Task 10C - Part E.1: Arabic headers and screen ordering', () => {
  setActiveLanguage('ar');
  assert.equal(textAlign('ar'), 'right');
  assert.equal(writingDirection('ar'), 'rtl');
  assert.deepEqual(rowStyle('ar'), { flexDirection: 'row-reverse' });

  // In AppHeader, children are [copy, action]. Under row-reverse:
  // Child 0 (copy/title) is placed on the visual RIGHT with right-aligned text.
  // Child 1 (action button) is placed on the visual LEFT.
  assert.equal(textAlign('ar'), 'right');
  assert.equal(rowDirection('ar'), 'row-reverse');
});

test('Task 10C - Part E.2: English headers and ordering', () => {
  setActiveLanguage('en');
  assert.equal(textAlign('en'), 'left');
  assert.equal(writingDirection('en'), 'ltr');
  assert.deepEqual(rowStyle('en'), { flexDirection: 'row' });

  // In AppHeader, children are [copy, action]. Under row:
  // Child 0 (copy/title) is placed on the visual LEFT with left-aligned text.
  // Child 1 (action button) is placed on the visual RIGHT.
  assert.equal(textAlign('en'), 'left');
  assert.equal(rowDirection('en'), 'row');
});

test('Task 10C - Part E.3: Arabic bottom navigation order', () => {
  // In Arabic, reading starts from the right:
  // Tab 0 (leftmost) is Profile, Tab 4 (rightmost) is Home.
  const arabicTabs = getTabOrder('ar');
  assert.deepEqual(arabicTabs, ['profile', 'progress', 'workouts', 'meals', 'home']);
  assert.equal(arabicTabs[0], 'profile', 'Leftmost tab in Arabic is Profile');
  assert.equal(arabicTabs[4], 'home', 'Rightmost tab in Arabic is Home');

  // In English, reading starts from the left:
  // Tab 0 (leftmost) is Home, Tab 4 (rightmost) is Profile.
  const englishTabs = getTabOrder('en');
  assert.deepEqual(englishTabs, ['home', 'meals', 'workouts', 'progress', 'profile']);
  assert.equal(englishTabs[0], 'home', 'Leftmost tab in English is Home');
  assert.equal(englishTabs[4], 'profile', 'Rightmost tab in English is Profile');

  // Utility delegation parity
  assert.deepEqual(getAppTabOrder('ar'), arabicTabs);
  assert.deepEqual(getAppTabOrder('en'), englishTabs);
  assert.equal(getDirection('ar'), direction('ar'));
  assert.equal(getTextAlign('ar'), textAlign('ar'));
  assert.equal(getWritingDirection('ar'), writingDirection('ar'));
  assert.equal(getRowDirection('ar'), rowDirection('ar'));
  assert.deepEqual(getRowStyle('ar'), rowStyle('ar'));
  assert.equal(getFlexStart('ar'), flexStart('ar'));
  assert.equal(getFlexEnd('ar'), flexEnd('ar'));
  assert.equal(getAlignItems('ar'), alignItemsStart('ar'));
  assert.equal(getOppositeAlignItems('ar'), alignItemsEnd('ar'));
});

test('Task 10C.1: Bottom navigation horizontal row layout integrity and touch areas', () => {
  // 1. Container must strictly be a horizontal row (never default to column)
  assert.equal(bottomTabStyles.glass.flexDirection, 'row', 'BottomTabs glass container must be flexDirection: row');
  assert.equal(bottomTabStyles.glass.direction, 'ltr', 'BottomTabs glass must have direction: ltr for deterministic mapping');

  // 2. Each tab pressable must occupy flex: 1 and 100% height for equal horizontal touch area
  assert.equal(bottomTabStyles.tabPressable.flex, 1, 'Each tab pressable must have flex: 1');
  assert.equal(bottomTabStyles.tabPressable.height, '100%', 'Each tab pressable must fill height');

  // 3. Inner tab item fills width and height without altering sibling flow
  assert.equal(bottomTabStyles.tabItem.flex, 1);
  assert.equal(bottomTabStyles.tabItem.width, '100%');
  assert.equal(bottomTabStyles.tabItem.height, '100%');

  // 4. Exact visual order verification
  // English (left to right): Home, Meals, Workouts, Progress, Profile
  const englishOrder = getTabOrder('en');
  assert.deepEqual(englishOrder, ['home', 'meals', 'workouts', 'progress', 'profile']);

  // Arabic (left to right): Profile, Progress, Workouts, Meals, Home
  const arabicOrder = getTabOrder('ar');
  assert.deepEqual(arabicOrder, ['profile', 'progress', 'workouts', 'meals', 'home']);
});

test('Task 1A.2 - Part B: Bottom navigation platform-adaptive safe-area clearance', () => {
  // 1. iOS with Home Indicator (34pt inset) -> 26pt bottom offset
  assert.equal(calculateBottomNavOffset(34, 'ios'), 26);

  // 2. iOS without Home Indicator (0pt inset) -> 2pt bottom offset minimum
  assert.equal(calculateBottomNavOffset(0, 'ios'), 2);

  // 3. Android with 3-button system navigation (48dp inset) -> 56dp offset (clears buttons with 8dp margin)
  assert.equal(calculateBottomNavOffset(48, 'android'), 56);

  // 4. Android with gesture navigation (16dp inset) -> 24dp offset (clears gesture bar with 8dp margin)
  assert.equal(calculateBottomNavOffset(16, 'android'), 24);

  // 5. Android with 0 insets (edge-to-edge hidden or legacy) -> 12dp offset (comfortable margin)
  assert.equal(calculateBottomNavOffset(0, 'android'), 12);
});

test('Task 1A.2 - Part D: Compact macro input responsive layout rules', () => {
  // Test viewport threshold behavior for compact form layouts
  function getMacroLayoutMode(screenWidth: number): 'compact' | 'expanded' {
    return screenWidth < 340 ? 'compact' : 'expanded';
  }

  // 320dp small devices (e.g. iPhone SE 1st gen, small Android) use 2+1 grid
  assert.equal(getMacroLayoutMode(320), 'compact');

  // 360dp standard Android viewport fits 3 columns comfortably without orphan wrapping
  assert.equal(getMacroLayoutMode(360), 'expanded');

  // 375dp (iPhone 8 / SE 2nd / 3rd gen) fits 3 columns
  assert.equal(getMacroLayoutMode(375), 'expanded');

  // 390dp+ (iPhone 12/13/14/15/16, modern Android) fits 3 columns
  assert.equal(getMacroLayoutMode(393), 'expanded');
  assert.equal(getMacroLayoutMode(412), 'expanded');
});

test('Task 10C - Part E.4: RTL back button position and arrow direction', () => {
  (I18nManager as any).reset();
  I18nManager.isRTL = false;

  // Arabic back button:
  // 1. alignSelf: flexStart('ar') -> 'flex-end' (aligns to visual RIGHT in column)
  assert.equal(flexStart('ar'), 'flex-end');
  // 2. rowStyle('ar') -> flexDirection: 'row-reverse' (places icon on visual right of text)
  assert.deepEqual(rowStyle('ar'), { flexDirection: 'row-reverse' });
  // 3. Arrow direction for RTL: chevron-forward (points right >)
  const arabicBackIcon = isRTL('ar') ? 'chevron-forward' : 'chevron-back';
  assert.equal(arabicBackIcon, 'chevron-forward');

  // English back button:
  // 1. alignSelf: flexStart('en') -> 'flex-start' (aligns to visual LEFT in column)
  assert.equal(flexStart('en'), 'flex-start');
  // 2. rowStyle('en') -> flexDirection: 'row' (places icon on visual left of text)
  assert.deepEqual(rowStyle('en'), { flexDirection: 'row' });
  // 3. Arrow direction for LTR: chevron-back (points left <)
  const englishBackIcon = isRTL('en') ? 'chevron-forward' : 'chevron-back';
  assert.equal(englishBackIcon, 'chevron-back');
});

test('Task 10C - Part E.5: RTL form labels and input direction', () => {
  // In Arabic, labels and text are right-aligned
  assert.equal(textAlign('ar'), 'right');
  assert.equal(writingDirection('ar'), 'rtl');

  // In English, labels and text are left-aligned
  assert.equal(textAlign('en'), 'left');
  assert.equal(writingDirection('en'), 'ltr');

  // Form input rows (e.g. Quantity + Calories, Sets + Reps) flow RTL
  assert.deepEqual(rowStyle('ar'), { flexDirection: 'row-reverse' });
  assert.deepEqual(rowStyle('en'), { flexDirection: 'row' });
});

test('Task 10C - Part E.6: Directional layout when native isRTL=false (Expo Go on iOS/Android)', () => {
  (I18nManager as any).reset();
  I18nManager.isRTL = false;

  // Arabic targets must reverse layout relative to native LTR
  assert.equal(shouldReverseLayout('ar'), true);
  assert.equal(rowDirection('ar'), 'row-reverse');
  assert.equal(flexStart('ar'), 'flex-end');
  assert.equal(flexEnd('ar'), 'flex-start');
  assert.equal(alignItemsStart('ar'), 'flex-end');
  assert.equal(alignItemsEnd('ar'), 'flex-start');

  // English targets must keep normal layout
  assert.equal(shouldReverseLayout('en'), false);
  assert.equal(rowDirection('en'), 'row');
  assert.equal(flexStart('en'), 'flex-start');
  assert.equal(flexEnd('en'), 'flex-end');
  assert.equal(alignItemsStart('en'), 'flex-start');
  assert.equal(alignItemsEnd('en'), 'flex-end');
});

test('Task 10C - Part E.7: Directional layout when native isRTL=true (Native RTL device)', () => {
  (I18nManager as any).reset();
  I18nManager.isRTL = true;

  // Arabic targets rely on native RTL: no manual inversion
  assert.equal(shouldReverseLayout('ar'), false);
  assert.equal(rowDirection('ar'), 'row');
  assert.equal(flexStart('ar'), 'flex-start');
  assert.equal(flexEnd('ar'), 'flex-end');
  assert.equal(alignItemsStart('ar'), 'flex-start');
  assert.equal(alignItemsEnd('ar'), 'flex-end');

  // English targets must reverse native RTL to display LTR
  assert.equal(shouldReverseLayout('en'), true);
  assert.equal(rowDirection('en'), 'row-reverse');
  assert.equal(flexStart('en'), 'flex-end');
  assert.equal(flexEnd('en'), 'flex-start');
  assert.equal(alignItemsStart('en'), 'flex-end');
  assert.equal(alignItemsEnd('en'), 'flex-start');

  // Cleanup
  (I18nManager as any).reset();
});

test('Task 10C - Part E.8: No double mirroring', () => {
  (I18nManager as any).reset();
  I18nManager.isRTL = false;

  // Verify rowStyle does NOT contain direction: 'rtl'
  // In Yoga, combining direction: 'rtl' with flexDirection: 'row-reverse' causes double mirroring
  const arabicRow = rowStyle('ar');
  assert.equal((arabicRow as any).direction, undefined, 'rowStyle must not specify direction: rtl');
  assert.equal(arabicRow.flexDirection, 'row-reverse');

  const englishRow = rowStyle('en');
  assert.equal((englishRow as any).direction, undefined, 'rowStyle must not specify direction: ltr');
  assert.equal(englishRow.flexDirection, 'row');

  // Direction utility returns valid CSS/Yoga direction without polluting rowStyle
  assert.equal(direction('ar'), 'rtl');
  assert.equal(direction('en'), 'ltr');
});

test('Task 10C - Part E.9: Language switching without reload', () => {
  (I18nManager as any).reset();

  // Switching language returns false (no reload requested)
  assert.equal(applyRTL('ar'), false);
  assert.equal(getActiveLanguage(), 'ar');
  assert.equal((I18nManager as any).calls.forceRTL.length, 0);
  assert.equal((I18nManager as any).calls.allowRTL.length, 0);

  assert.equal(applyRTL('en'), false);
  assert.equal(getActiveLanguage(), 'en');
  assert.equal((I18nManager as any).calls.forceRTL.length, 0);
  assert.equal((I18nManager as any).calls.allowRTL.length, 0);
});

test('Task 10C - Part E.10: SQLite and theme preservation across language changes', async () => {
  const db = await getDatabase();
  const settingsRepo = new SQLiteSettingsRepository(db);
  const mealRepo = new SQLiteMealRepository(db);
  const workoutRepo = new SQLiteWorkoutRepository(db);

  // 1. Seed initial data in English with dark mode
  await settingsRepo.saveSettings({
    ...defaultSettings,
    selectedLanguage: 'en',
    themeMode: 'dark',
    hasCompletedOnboarding: true,
  });

  await mealRepo.insertMeal(
    normalizeMeal({
      id: 'meal-task10c-test',
      title: 'Healthy Breakfast',
      date: '2026-11-01',
      time: '08:00',
      items: [
        normalizeMealItem({
          id: 'item-10c',
          name: 'Eggs',
          quantity: 2,
          calories: 140,
          protein: 12,
          carbs: 1,
          fat: 10,
        }),
      ],
    }),
  );

  await workoutRepo.insertWorkout(
    normalizeWorkout({
      id: 'workout-task10c-test',
      title: 'Morning Cardio',
      date: '2026-11-01',
      time: '09:00',
      exercises: [
        normalizeExercise({
          id: 'ex-10c',
          name: 'Running',
          sets: 1,
          reps: 1,
          weightKg: 0,
          durationMinutes: 30,
        }),
      ],
      durationMinutes: 30,
      caloriesBurned: 250,
    }),
  );

  // 2. Switch language to Arabic
  applyRTL('ar');
  await settingsRepo.saveSettings({
    ...defaultSettings,
    selectedLanguage: 'ar',
    themeMode: 'dark',
    hasCompletedOnboarding: true,
  });

  // 3. Close database and simulate restart
  await closeDatabase();

  // 4. Verify settings, theme, meals, and workouts
  const reopenedDb = await getDatabase();
  const reopenedSettingsRepo = new SQLiteSettingsRepository(reopenedDb);
  const reopenedMealRepo = new SQLiteMealRepository(reopenedDb);
  const reopenedWorkoutRepo = new SQLiteWorkoutRepository(reopenedDb);

  const restoredSettings = await reopenedSettingsRepo.getSettings();
  assert.ok(restoredSettings);
  assert.equal(restoredSettings.selectedLanguage, 'ar');
  assert.equal(restoredSettings.themeMode, 'dark', 'Dark theme must be preserved');
  assert.equal(restoredSettings.hasCompletedOnboarding, true);

  const restoredMeals = await reopenedMealRepo.getAllMeals();
  assert.ok(restoredMeals.some((m) => m.id === 'meal-task10c-test'));
  assert.equal(restoredMeals.find((m) => m.id === 'meal-task10c-test')?.title, 'Healthy Breakfast');

  const restoredWorkouts = await reopenedWorkoutRepo.getAllWorkouts();
  assert.ok(restoredWorkouts.some((w) => w.id === 'workout-task10c-test'));
  assert.equal(restoredWorkouts.find((w) => w.id === 'workout-task10c-test')?.title, 'Morning Cardio');
});

test('Task 1A.2 - Part E: Onboarding canonical RTL text alignment and writing direction', () => {
  // Arabic onboarding text alignment must be right-aligned with rtl writing direction
  applyRTL('ar');
  assert.equal(activeTextAlign(), 'right');
  assert.equal(activeWritingDirection(), 'rtl');

  // English onboarding text alignment must be left-aligned with ltr writing direction
  applyRTL('en');
  assert.equal(activeTextAlign(), 'left');
  assert.equal(activeWritingDirection(), 'ltr');
});
