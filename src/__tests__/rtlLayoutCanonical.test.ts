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
