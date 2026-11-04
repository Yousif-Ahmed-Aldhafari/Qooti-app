import test from 'node:test';
import assert from 'node:assert/strict';
import { I18nManager, Alert } from 'react-native';
import { getDatabase, closeDatabase } from '../db/database';
import { SQLiteSettingsRepository } from '../db/repositories/settingsRepository';
import { SQLiteMealRepository } from '../db/repositories/mealRepository';
import { SQLiteWorkoutRepository } from '../db/repositories/workoutRepository';
import { loadSettings, saveSettings, defaultSettings } from '../services/settingsService';
import { applyRTL, direction, textAlign, writingDirection, rowStyle, rowDirection, flexStart, flexEnd, alignItemsStart, alignItemsEnd } from '../utils/rtl';
import { applyAppDirection } from '../utils/languageDirection';
import { translate } from '../i18n';
import enJson from '../i18n/en.json';
import arJson from '../i18n/ar.json';
import { normalizeMeal, normalizeMealItem } from '../models/meal';
import { normalizeWorkout, normalizeExercise } from '../models/workout';
import type { Language, Settings } from '../models/settings';

async function setupFreshDb() {
  await closeDatabase();
  const db = await getDatabase();
  await db.execAsync(`
    DELETE FROM meals;
    DELETE FROM workouts;
    DELETE FROM user_profiles;
    DELETE FROM progress_entries;
    DELETE FROM app_settings;
  `);
  (I18nManager as any).reset();
  (Alert as any).reset();
  return db;
}

test('Regression RTL 1: English → Arabic language change persists smoothly without native restart or forceRTL', async () => {
  const db = await setupFreshDb();
  const settingsRepo = new SQLiteSettingsRepository(db);

  // Start with English
  const initialSettings: Settings = {
    ...defaultSettings,
    selectedLanguage: 'en',
    themeMode: 'light',
    hasCompletedOnboarding: true,
  };
  await settingsRepo.saveSettings(initialSettings);

  I18nManager.isRTL = false;
  const restartRequired = applyRTL('ar');

  assert.equal(restartRequired, false, 'In-app switching must NOT require native restart (Correction 1)');
  assert.equal((I18nManager as any).calls.forceRTL.length, 0, 'forceRTL must not be called (Correction 1)');
  assert.equal((I18nManager as any).calls.allowRTL.length, 0, 'allowRTL must not be called (Correction 1)');

  // Persist updated settings to SQLite before switching authoritative language (Correction 7)
  const updatedSettings: Settings = {
    ...initialSettings,
    selectedLanguage: 'ar',
  };
  await saveSettings(updatedSettings);

  const persisted = await settingsRepo.getSettings();
  assert.ok(persisted);
  assert.equal(persisted.selectedLanguage, 'ar');
  assert.equal(persisted.themeMode, 'light');
  assert.equal(persisted.hasCompletedOnboarding, true);
});

test('Regression RTL 2: Arabic → English language change behaves consistently without native reload', async () => {
  const db = await setupFreshDb();
  const settingsRepo = new SQLiteSettingsRepository(db);

  const initialSettings: Settings = {
    ...defaultSettings,
    selectedLanguage: 'ar',
    themeMode: 'dark',
    hasCompletedOnboarding: true,
  };
  await settingsRepo.saveSettings(initialSettings);

  // Case A: App started natively in RTL
  I18nManager.isRTL = true;
  const restartRequiredNativeRTL = applyRTL('en');
  assert.equal(restartRequiredNativeRTL, false, 'No restart required when native is RTL');
  assert.equal((I18nManager as any).calls.forceRTL.length, 0, 'forceRTL must not be called');

  // Case B: App was in Arabic in JS but native is still LTR
  I18nManager.isRTL = false;
  const restartRequiredNativeLTR = applyRTL('en');
  assert.equal(restartRequiredNativeLTR, false, 'No restart required when native is LTR');

  await saveSettings({ ...initialSettings, selectedLanguage: 'en' });
  const persisted = await settingsRepo.getSettings();
  assert.ok(persisted);
  assert.equal(persisted.selectedLanguage, 'en');
  assert.equal(persisted.themeMode, 'dark');
});

test('Regression RTL 3: Saved language after simulated app restart', async () => {
  await setupFreshDb();

  // Save Arabic setting
  await saveSettings({
    ...defaultSettings,
    selectedLanguage: 'ar',
    themeMode: 'system',
    hasCompletedOnboarding: true,
  });

  // Simulate cold app restart: close connection and clear cache
  await closeDatabase();

  // Re-hydrate on new launch
  const hydrated = await loadSettings();
  assert.ok(hydrated);
  assert.equal(hydrated.selectedLanguage, 'ar');
  assert.equal(hydrated.themeMode, 'system');

  // Apply direction from hydrated settings
  applyAppDirection(hydrated.selectedLanguage);
  assert.equal(direction('ar'), 'rtl');
  assert.equal(textAlign('ar'), 'right');
  assert.equal(writingDirection('ar'), 'rtl');
  assert.deepEqual(rowStyle('ar'), { flexDirection: 'row-reverse' });
});

test('Regression RTL 4: In-app language switching requires no native restart across all native RTL states', () => {
  (I18nManager as any).reset();

  // Native is LTR
  I18nManager.isRTL = false;
  assert.equal(applyRTL('ar'), false, 'LTR native + Arabic target = seamless in-app switch');
  assert.equal(applyRTL('en'), false, 'LTR native + English target = seamless in-app switch');

  // Native is RTL
  I18nManager.isRTL = true;
  assert.equal(applyRTL('ar'), false, 'RTL native + Arabic target = seamless in-app switch');
  assert.equal(applyRTL('en'), false, 'RTL native + English target = seamless in-app switch');
  assert.equal((I18nManager as any).calls.forceRTL.length, 0, 'No forceRTL calls (Correction 1)');
});

test('Regression RTL 5: Repeated rapid language switching maintains transactional integrity', async () => {
  const db = await setupFreshDb();
  const repo = new SQLiteSettingsRepository(db);

  const languages: Language[] = ['en', 'ar', 'en', 'ar', 'en', 'ar'];
  for (const lang of languages) {
    applyRTL(lang);
    await saveSettings({
      ...defaultSettings,
      selectedLanguage: lang,
    });
  }

  const finalSettings = await repo.getSettings();
  assert.ok(finalSettings);
  assert.equal(finalSettings.selectedLanguage, 'ar');
});

test('Regression RTL 6: Hydration does not trigger reload loops or alerts', async () => {
  await setupFreshDb();
  (Alert as any).reset();

  // Settings in Arabic
  await saveSettings({
    ...defaultSettings,
    selectedLanguage: 'ar',
  });

  // Hydration should only apply direction and NOT call Alert or reload
  const loaded = await loadSettings();
  assert.ok(loaded);
  applyAppDirection(loaded.selectedLanguage);

  assert.equal((Alert as any).alertCalls.length, 0, 'Initial hydration must never show a restart alert');
});

test('Regression RTL 7: SQLite settings save completes before language change commits to UI (Correction 7)', async () => {
  const db = await setupFreshDb();
  const repo = new SQLiteSettingsRepository(db);

  // User changes language to Arabic
  const newLanguage: Language = 'ar';
  applyRTL(newLanguage);

  // Settings are saved BEFORE state commit / splash dismissal (Correction 7)
  await saveSettings({
    ...defaultSettings,
    selectedLanguage: newLanguage,
  });

  const saved = await repo.getSettings();
  assert.ok(saved);
  assert.equal(saved.selectedLanguage, 'ar', 'Saved language must persist reliably in SQLite');
});

test('Regression RTL 8: Existing meals, workouts, and profile preserved across language switches', async () => {
  const db = await setupFreshDb();
  const mealRepo = new SQLiteMealRepository(db);
  const workoutRepo = new SQLiteWorkoutRepository(db);
  const settingsRepo = new SQLiteSettingsRepository(db);

  // Seed sample data
  await mealRepo.insertMeal(
    normalizeMeal({
      id: 'meal-rtl-test',
      title: 'Post-Workout Shake',
      date: '2026-10-31',
      time: '12:00',
      items: [
        normalizeMealItem({
          id: 'i1',
          name: 'Whey',
          quantity: 1,
          calories: 150,
          protein: 30,
          carbs: 4,
          fats: 2,
        }),
      ],
    }),
  );

  await workoutRepo.insertWorkout(
    normalizeWorkout({
      id: 'workout-rtl-test',
      title: 'Leg Day',
      date: '2026-10-31',
      time: '14:00',
      exercises: [
        normalizeExercise({
          id: 'e1',
          name: 'Squats',
          sets: 4,
          reps: 10,
          weightKg: 100,
        }),
      ],
      durationMinutes: 45,
      caloriesBurned: 350,
    }),
  );

  await settingsRepo.saveSettings({
    ...defaultSettings,
    selectedLanguage: 'en',
    themeMode: 'dark',
    hasCompletedOnboarding: true,
  });

  // Switch to Arabic
  applyRTL('ar');
  await saveSettings({
    ...defaultSettings,
    selectedLanguage: 'ar',
    themeMode: 'dark',
    hasCompletedOnboarding: true,
  });

  // Verify meals and workouts are 100% intact
  const meals = await mealRepo.getAllMeals();
  assert.equal(meals.length, 1);
  assert.equal(meals[0].title, 'Post-Workout Shake');

  const workouts = await workoutRepo.getAllWorkouts();
  assert.equal(workouts.length, 1);
  assert.equal(workouts[0].title, 'Leg Day');

  const settings = await settingsRepo.getSettings();
  assert.ok(settings);
  assert.equal(settings.selectedLanguage, 'ar');
  assert.equal(settings.themeMode, 'dark');
  assert.equal(settings.hasCompletedOnboarding, true);
});

test('Regression RTL 9: Layout direction engine correctly flips in Expo Go and avoids double-mirroring under Native RTL', () => {
  // Condition 1: Expo Go on iOS (native RTL is false, user selects Arabic)
  (I18nManager as any).reset();
  I18nManager.isRTL = false;
  assert.equal(rowDirection('ar'), 'row-reverse', 'Expo Go Arabic row must be row-reverse');
  assert.equal(flexStart('ar'), 'flex-end', 'Expo Go Arabic flexStart must align to right');
  assert.equal(flexEnd('ar'), 'flex-start', 'Expo Go Arabic flexEnd must align to left');
  assert.equal(alignItemsStart('ar'), 'flex-end');
  assert.equal(alignItemsEnd('ar'), 'flex-start');

  // Condition 2: Expo Go on iOS (native RTL is false, user selects English)
  assert.equal(rowDirection('en'), 'row', 'Expo Go English row must be normal row');
  assert.equal(flexStart('en'), 'flex-start');
  assert.equal(flexEnd('en'), 'flex-end');
  assert.equal(alignItemsStart('en'), 'flex-start');
  assert.equal(alignItemsEnd('en'), 'flex-end');

  // Condition 3: Native RTL Build (native RTL is true, user selects Arabic) -> Avoid double-mirroring!
  I18nManager.isRTL = true;
  assert.equal(rowDirection('ar'), 'row', 'Native RTL build must NOT double-reverse row');
  assert.equal(flexStart('ar'), 'flex-start', 'Native RTL build flexStart relies on native mirroring');
  assert.equal(flexEnd('ar'), 'flex-end');
  assert.equal(alignItemsStart('ar'), 'flex-start');
  assert.equal(alignItemsEnd('ar'), 'flex-end');

  // Condition 4: Native RTL Build booted in Arabic, but user selects English in app
  assert.equal(rowDirection('en'), 'row-reverse', 'Native RTL with English selection must reverse native RTL');
  assert.equal(flexStart('en'), 'flex-end');
  assert.equal(flexEnd('en'), 'flex-start');

  // Cleanup
  (I18nManager as any).reset();
});

test('Regression RTL 10: Complete translation key parity and fallback behavior', () => {
  // Verify all essential screen and component keys return Arabic translations
  assert.equal(translate('ar', 'app.name'), 'قوتي');
  assert.equal(translate('ar', 'tabs.home'), 'الرئيسية');
  assert.equal(translate('ar', 'tabs.meals'), 'الوجبات');
  assert.equal(translate('ar', 'tabs.workouts'), 'التمارين');
  assert.equal(translate('ar', 'common.calories'), 'السعرات');
  assert.equal(translate('ar', 'common.back'), 'رجوع');
  assert.equal(translate('ar', 'macros.calories'), 'السعرات');
  assert.equal(translate('ar', 'macros.protein'), 'بروتين');
  assert.equal(translate('ar', 'macros.kcal'), 'سعرة');
  assert.equal(translate('ar', 'macros.grams'), 'جم');
  assert.equal(translate('ar', 'home.todayPlan'), 'خطة اليوم');
  assert.equal(translate('ar', 'settings.restartTitle'), 'يلزم إعادة التشغيل');

  // Verify interpolation
  assert.equal(
    translate('ar', 'home.goals.percentComplete', { amount: 75 }),
    '75% مكتمل',
  );
  assert.equal(
    translate('en', 'home.goals.percentComplete', { amount: 75 }),
    '75% completed',
  );

  // Parity between EN and AR dictionaries
  function countLeafKeys(obj: any): number {
    let count = 0;
    for (const k in obj) {
      if (typeof obj[k] === 'object' && obj[k] !== null) {
        count += countLeafKeys(obj[k]);
      } else {
        count++;
      }
    }
    return count;
  }

  assert.equal(countLeafKeys(enJson), 325);
  assert.equal(countLeafKeys(arJson), 325);
});

test('Regression RTL 11: Latin numeral preservation in Arabic date formatting', () => {
  const d = new Date(2026, 10, 1); // Nov 1, 2026
  const weekday = new Intl.DateTimeFormat('ar-SA-u-nu-latn', { weekday: 'short' }).format(d);
  const day = new Intl.DateTimeFormat('ar-SA-u-nu-latn', { day: 'numeric' }).format(d);
  const monthYear = new Intl.DateTimeFormat('ar-SA-u-nu-latn', { month: 'long', year: 'numeric' }).format(d);

  // Arabic words
  assert.equal(weekday, 'الأحد');
  assert.ok(monthYear.includes('نوفمبر'));

  // Latin numbers
  assert.equal(day, '1');
  assert.ok(monthYear.includes('2026'));
  assert.equal(day.includes('١'), false, 'Day must NOT use Eastern Arabic numerals');
  assert.equal(monthYear.includes('٢٠٢٦'), false, 'Year must NOT use Eastern Arabic numerals');
});
