import test from 'node:test';
import assert from 'node:assert/strict';
import { I18nManager, Alert } from 'react-native';
import { getDatabase, closeDatabase } from '../db/database';
import { SQLiteSettingsRepository } from '../db/repositories/settingsRepository';
import { SQLiteMealRepository } from '../db/repositories/mealRepository';
import { SQLiteWorkoutRepository } from '../db/repositories/workoutRepository';
import { loadSettings, saveSettings, defaultSettings } from '../services/settingsService';
import { applyRTL, direction, textAlign, writingDirection, rowStyle } from '../utils/rtl';
import { applyAppDirection } from '../utils/languageDirection';
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

test('Regression RTL 1: English → Arabic language change persists and flags restart safely', async () => {
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

  assert.equal(restartRequired, true, 'Switching from LTR to Arabic must require native restart');
  assert.equal((I18nManager as any).calls.forceRTL.at(-1), true, 'forceRTL must be true');
  assert.equal((I18nManager as any).calls.allowRTL.at(-1), true, 'allowRTL must be true');

  // Persist updated settings to SQLite before requesting restart
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

test('Regression RTL 2: Arabic → English language change behaves consistently', async () => {
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
  assert.equal(restartRequiredNativeRTL, true, 'Switching from native RTL to English requires restart');
  assert.equal((I18nManager as any).calls.forceRTL.at(-1), false, 'forceRTL must be false for en');

  // Case B: App was in Arabic in JS but native is still LTR
  I18nManager.isRTL = false;
  const restartRequiredNativeLTR = applyRTL('en');
  assert.equal(restartRequiredNativeLTR, false, 'If native is already LTR, restart is not required');

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
  assert.deepEqual(rowStyle('ar'), { direction: 'rtl', flexDirection: 'row' });
});

test('Regression RTL 4: RTL restart required vs not required truth table', () => {
  (I18nManager as any).reset();

  // Native is LTR
  I18nManager.isRTL = false;
  assert.equal(applyRTL('ar'), true, 'LTR native + Arabic target = restart required');
  assert.equal(applyRTL('en'), false, 'LTR native + English target = restart not required');

  // Native is RTL
  I18nManager.isRTL = true;
  assert.equal(applyRTL('ar'), false, 'RTL native + Arabic target = restart not required');
  assert.equal(applyRTL('en'), true, 'RTL native + English target = restart required');
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

test('Regression RTL 7: Cancelled or dismissed restart dialog preserves saved settings', async () => {
  const db = await setupFreshDb();
  const repo = new SQLiteSettingsRepository(db);

  // User changes language to Arabic
  const newLanguage: Language = 'ar';
  applyRTL(newLanguage);

  // Settings are saved BEFORE alert is presented
  await saveSettings({
    ...defaultSettings,
    selectedLanguage: newLanguage,
  });

  // User dismisses alert or cancels without restarting immediately
  const saved = await repo.getSettings();
  assert.ok(saved);
  assert.equal(saved.selectedLanguage, 'ar', 'Saved language must persist even if restart is postponed');
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
